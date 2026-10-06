/** Receive MPE without flattening its member channels into one keyboard. */
import { bendToUnit, type MidiMessage } from './messages';
import { makeZone, type MpeZone } from './mpe';

export const MPE_VOICE_LIMIT = 48;

export interface MpeTracePoint {
	time: number;
	pitchSemitones: number;
	pressure: number;
	timbre: number;
}

export interface MpeVoiceSnapshot {
	id: number;
	channel: number;
	note: number;
	velocity: number;
	releaseVelocity: number;
	held: boolean;
	sustained: boolean;
	bend: number;
	pitchSemitones: number;
	pressure: number;
	effectivePressure: number;
	timbre: number;
	effectiveTimbre: number;
	startedAt: number;
	endedAt: number | null;
	history: MpeTracePoint[];
}

export interface MpeStats {
	noteCount: number;
	maxPolyphony: number;
	bendEvents: number;
	pressureEvents: number;
	timbreEvents: number;
	independentBend: boolean;
	independentPressure: boolean;
	independentTimbre: boolean;
	channelCollisions: number;
	voiceSteals: number;
}

interface ChannelState {
	bend: number;
	pressure: number;
	timbre: number;
	sustain: boolean;
	range: number;
	rpnMsb: number;
	rpnLsb: number;
	parameterKind: 'rpn' | 'nrpn' | null;
	rangeSemitones: number;
}

function emptyStats(): MpeStats {
	return {
		noteCount: 0,
		maxPolyphony: 0,
		bendEvents: 0,
		pressureEvents: 0,
		timbreEvents: 0,
		independentBend: false,
		independentPressure: false,
		independentTimbre: false,
		channelCollisions: 0,
		voiceSteals: 0
	};
}

function copyZone(zone: MpeZone): MpeZone {
	return { ...zone, members: [...zone.members] };
}

/** One instance per source. The caller filters port and event provenance. */
export class MpeInputState {
	#zone: MpeZone;
	#channels: ChannelState[] = [];
	#voices: MpeVoiceSnapshot[] = [];
	#stats = emptyStats();
	#nextId = 0;
	#expressionStarts = new Map<number, { bend: number; pressure: number; timbre: number }>();
	#releasedBends = new Map<number, number>();

	constructor(zone = makeZone('lower', 15, 48)) {
		this.#zone = copyZone(zone);
		this.clear();
	}

	get zone(): MpeZone {
		return copyZone(this.#zone);
	}

	get voices(): MpeVoiceSnapshot[] {
		return this.#voices.map((voice) => ({ ...voice, history: [...voice.history] }));
	}

	get active(): MpeVoiceSnapshot[] {
		return this.voices.filter((voice) => voice.held || voice.sustained);
	}

	get stats(): MpeStats {
		return { ...this.#stats };
	}

	get master() {
		const channel = this.#channels[this.#zone.master];
		return {
			bend: channel.bend,
			pressure: channel.pressure,
			timbre: channel.timbre,
			sustain: channel.sustain
		};
	}

	getBendRange(channel: number): number {
		return this.#channels[channel]?.range ?? this.#zone.memberBendRange;
	}

	setZone(zone: MpeZone): void {
		this.#zone = copyZone(zone);
		this.clear();
	}

	/** Receiver calibration only; never sends configuration to a controller. */
	setMemberBendRange(range: number): void {
		if (!Number.isFinite(range)) return;
		this.#zone.memberBendRange = Math.max(0, Math.min(96, range));
		for (const channel of this.#zone.members) {
			this.#channels[channel].range = this.#zone.memberBendRange;
			this.#channels[channel].rangeSemitones = this.#zone.memberBendRange;
		}
		this.#refresh();
	}

	clear(): void {
		this.#voices = [];
		this.#stats = emptyStats();
		this.#expressionStarts.clear();
		this.#releasedBends.clear();
		this.#channels = Array.from({ length: 16 }, (_, channel) => {
			const range =
				channel === this.#zone.master ? this.#zone.masterBendRange : this.#zone.memberBendRange;
			return {
				bend: 8192,
				pressure: 0,
				timbre: 64,
				sustain: false,
				range,
				rangeSemitones: range,
				rpnMsb: 127,
				rpnLsb: 127,
				parameterKind: null
			};
		});
	}

	/** Return whether this message belongs to the receiver's zone. */
	push(message: MidiMessage, time = 0): boolean {
		if (message.type === 'reset') {
			this.clear();
			return true;
		}
		if (!('channel' in message)) return false;
		const channel = message.channel;
		if (
			message.type === 'controlChange' &&
			(channel === 0 || channel === 15 || this.#zone.members.includes(channel)) &&
			this.#parameter(message, time)
		)
			return true;
		if (channel !== this.#zone.master && !this.#zone.members.includes(channel)) return false;
		const state = this.#channels[channel];
		const isMaster = channel === this.#zone.master;
		const current = this.#voices.find((voice) => voice.channel === channel && voice.held);
		switch (message.type) {
			case 'noteOn': {
				if (message.velocity === 0) {
					this.#release(channel, message.note, 0, time);
					return true;
				}
				if (current && !isMaster) this.#stats.channelCollisions++;
				const retriggered = this.#voices.find(
					(voice) => voice.channel === channel && voice.note === message.note && voice.held
				);
				if (retriggered) {
					retriggered.held = false;
					retriggered.sustained = false;
					retriggered.endedAt = time;
				}
				this.#voices.push({
					id: ++this.#nextId,
					channel,
					note: message.note,
					velocity: message.velocity,
					releaseVelocity: 0,
					held: true,
					sustained: false,
					bend: state.bend,
					pitchSemitones: 0,
					pressure: state.pressure,
					effectivePressure: 0,
					timbre: state.timbre,
					effectiveTimbre: 64,
					startedAt: time,
					endedAt: null,
					history: []
				});
				this.#stats.noteCount++;
				this.#trim(time);
				this.#stats.maxPolyphony = Math.max(this.#stats.maxPolyphony, this.active.length);
				this.#refresh(time);
				break;
			}
			case 'noteOff':
				this.#release(channel, message.note, message.velocity, time);
				break;
			case 'pitchBend': {
				if (
					!isMaster &&
					this.#independent(current, 'bend', bendToUnit(message.value) * state.range, 0.08)
				) {
					this.#stats.independentBend = true;
				}
				state.bend = message.value;
				this.#stats.bendEvents++;
				this.#refresh(time);
				break;
			}
			case 'channelAftertouch':
				if (!isMaster && this.#independent(current, 'pressure', message.pressure, 8)) {
					this.#stats.independentPressure = true;
				}
				state.pressure = message.pressure;
				this.#stats.pressureEvents++;
				this.#refresh(time);
				break;
			case 'controlChange':
				if (message.controller === 74) {
					if (!isMaster && this.#independent(current, 'timbre', message.value, 8)) {
						this.#stats.independentTimbre = true;
					}
					state.timbre = message.value;
					this.#stats.timbreEvents++;
					this.#refresh(time);
				} else if (message.controller === 64 && isMaster) {
					state.sustain = message.value >= 64;
					this.#releaseSustain(time);
				} else if (isMaster && (message.controller === 120 || message.controller === 123)) {
					for (const voice of this.#voices) {
						if ((voice.held || voice.sustained) && (isMaster || voice.channel === channel)) {
							this.#freezeMember(voice);
							voice.held = false;
							voice.sustained = message.controller === 123 && this.#sustain(voice.channel);
							if (!voice.sustained && voice.endedAt === null) voice.endedAt = time;
						}
					}
				} else if (message.controller === 121 && isMaster) {
					for (const affected of [this.#zone.master, ...this.#zone.members]) {
						const controls = this.#channels[affected];
						controls.bend = 8192;
						controls.pressure = 0;
						controls.timbre = 64;
						controls.sustain = false;
						controls.parameterKind = null;
					}
					this.#releaseSustain(time);
					this.#refresh(time);
				}
				break;
		}
		return true;
	}

	#anotherHeld(channel: number): boolean {
		return this.#voices.some(
			(voice) =>
				voice.held && voice.channel !== channel && this.#zone.members.includes(voice.channel)
		);
	}

	#independent(
		voice: MpeVoiceSnapshot | undefined,
		dimension: 'bend' | 'pressure' | 'timbre',
		value: number,
		threshold: number
	): boolean {
		if (!voice?.held) return false;
		if (!this.#anotherHeld(voice.channel)) {
			this.#expressionStarts.delete(voice.id);
			return false;
		}
		const state = this.#channels[voice.channel];
		let start = this.#expressionStarts.get(voice.id);
		if (!start) {
			start = {
				bend: bendToUnit(state.bend) * state.range,
				pressure: state.pressure,
				timbre: state.timbre
			};
			this.#expressionStarts.set(voice.id, start);
		}
		return Math.abs(value - start[dimension]) >= threshold;
	}

	#sustain(channel: number): boolean {
		return (
			(channel === this.#zone.master || this.#zone.members.includes(channel)) &&
			this.#channels[this.#zone.master].sustain
		);
	}

	#freezeMember(voice: MpeVoiceSnapshot): void {
		if (voice.held) {
			const state = this.#channels[voice.channel];
			this.#releasedBends.set(voice.id, bendToUnit(voice.bend) * state.range);
		}
	}

	#release(channel: number, note: number, velocity: number, time: number): void {
		const voice = this.#voices.find((v) => v.channel === channel && v.note === note && v.held);
		if (!voice) return;
		this.#freezeMember(voice);
		voice.held = false;
		voice.releaseVelocity = velocity;
		voice.sustained = this.#sustain(channel);
		if (!voice.sustained) voice.endedAt = time;
	}

	#releaseSustain(time: number): void {
		for (const voice of this.#voices) {
			if (voice.sustained && !this.#sustain(voice.channel)) {
				voice.sustained = false;
				voice.endedAt = time;
			}
		}
	}

	#refresh(time?: number): void {
		const master = this.#channels[this.#zone.master];
		for (const voice of this.#voices) {
			if (!voice.held && !voice.sustained) continue;
			const state = this.#channels[voice.channel];
			if (voice.held) {
				voice.bend = state.bend;
				voice.pressure = state.pressure;
				voice.timbre = state.timbre;
			}
			const isMaster = voice.channel === this.#zone.master;
			const memberBend = isMaster
				? 0
				: voice.held
					? bendToUnit(state.bend) * state.range
					: (this.#releasedBends.get(voice.id) ?? 0);
			voice.pitchSemitones = memberBend + bendToUnit(master.bend) * master.range;
			// These response curves are this lab's sound design, not mandated MPE arithmetic.
			voice.effectivePressure = isMaster
				? master.pressure
				: Math.min(127, voice.pressure + master.pressure);
			voice.effectiveTimbre = isMaster
				? master.timbre
				: Math.max(0, Math.min(127, voice.timbre + master.timbre - 64));
			if (time !== undefined) {
				voice.history.push({
					time,
					pitchSemitones: voice.pitchSemitones,
					pressure: voice.effectivePressure,
					timbre: voice.effectiveTimbre
				});
				if (voice.history.length > 80) voice.history.splice(0, voice.history.length - 80);
			}
		}
	}

	#trim(time: number): void {
		const sounding = this.#voices.filter((voice) => voice.held || voice.sustained);
		const stealOrder = [...sounding.filter((v) => !v.held), ...sounding.filter((v) => v.held)];
		for (const voice of stealOrder.slice(0, Math.max(0, sounding.length - MPE_VOICE_LIMIT))) {
			voice.held = false;
			voice.sustained = false;
			voice.endedAt = time;
			this.#stats.voiceSteals++;
		}
		const released = this.#voices.filter((voice) => !voice.held && !voice.sustained);
		const expired = new Set(released.slice(0, Math.max(0, released.length - 24)).map((v) => v.id));
		this.#voices = this.#voices.filter((voice) => !expired.has(voice.id));
		for (const id of expired) this.#expressionStarts.delete(id);
		for (const id of expired) this.#releasedBends.delete(id);
	}

	#parameter(message: Extract<MidiMessage, { type: 'controlChange' }>, time: number): boolean {
		const state = this.#channels[message.channel];
		switch (message.controller) {
			case 101:
				state.parameterKind = 'rpn';
				state.rpnMsb = message.value;
				return true;
			case 100:
				state.parameterKind = 'rpn';
				state.rpnLsb = message.value;
				return true;
			case 98:
			case 99:
				state.parameterKind = 'nrpn';
				return true;
		}
		if (state.parameterKind !== 'rpn' || state.rpnMsb !== 0) return false;
		const isMember = this.#zone.members.includes(message.channel);
		const isMaster = message.channel === this.#zone.master;
		if (
			(isMember || isMaster) &&
			state.rpnLsb === 0 &&
			(message.controller === 6 || message.controller === 38)
		) {
			if (message.controller === 6) {
				state.rangeSemitones = message.value;
				state.range = message.value;
			} else {
				state.range = state.rangeSemitones + message.value / 100;
			}
			if (isMaster) this.#zone.masterBendRange = state.range;
			else {
				this.#zone.memberBendRange = state.range;
				for (const member of this.#zone.members) {
					this.#channels[member].range = state.range;
					this.#channels[member].rangeSemitones = state.rangeSemitones;
				}
			}
			this.#refresh(time);
			return true;
		}
		if (
			state.rpnLsb === 6 &&
			message.controller === 6 &&
			(message.channel === 0 || message.channel === 15)
		) {
			const side = message.channel === 0 ? 'lower' : 'upper';
			const next = makeZone(side, message.value, 48);
			const previous = this.#zone;
			const affected = new Set([
				this.#zone.master,
				...this.#zone.members,
				next.master,
				...next.members
			]);
			for (const channel of affected) {
				const controls = this.#channels[channel];
				controls.range = channel === next.master ? 2 : 48;
				controls.rangeSemitones = controls.range;
				const oldRole =
					channel === previous.master
						? 'master'
						: previous.members.includes(channel)
							? 'member'
							: 'none';
				const nextRole =
					channel === next.master ? 'master' : next.members.includes(channel) ? 'member' : 'none';
				if (oldRole !== nextRole) {
					controls.bend = 8192;
					controls.pressure = 0;
					controls.timbre = 64;
					controls.sustain = false;
					controls.parameterKind = null;
				}
			}
			this.#zone = next;
			for (const voice of this.#voices) {
				if (!next.members.includes(voice.channel) && (voice.held || voice.sustained)) {
					voice.held = false;
					voice.sustained = false;
					voice.endedAt = time;
				}
			}
			this.#releaseSustain(time);
			this.#refresh(time);
			return true;
		}
		return false;
	}
}
