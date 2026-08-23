/**
 * MIDI Polyphonic Expression.
 *
 * MPE is not a new protocol. It is a convention for *using* MIDI 1.0 that
 * solves one specific problem: pitch bend, pressure and CC 74 are channel-wide,
 * so a chord on one channel can only bend as a block. MPE's answer is blunt and
 * effective — give every simultaneously sounding note its own channel, and the
 * channel-wide messages become per-note messages by construction.
 *
 * A zone consists of one **master channel** carrying anything meant for the
 * whole zone, and a run of **member channels** that each host one note at a
 * time. The lower zone's master is channel 1 with members from 2 upwards; the
 * upper zone's master is channel 16 with members counting down.
 */

import type { MidiMessage } from './messages';
import { setBendRange } from './rpn';

export type ZoneSide = 'lower' | 'upper';

export interface MpeZone {
	side: ZoneSide;
	/** Wire channel of the master. 0 for lower, 15 for upper. */
	master: number;
	/** Wire channels available for notes, in allocation order. */
	members: number[];
	/** Semitones a full bend covers on member channels. 48 is the MPE default. */
	memberBendRange: number;
	/** Semitones for the master channel, conventionally 2. */
	masterBendRange: number;
}

export function makeZone(side: ZoneSide, memberCount: number, memberBendRange = 48): MpeZone {
	const n = Math.max(0, Math.min(15, memberCount));
	return {
		side,
		master: side === 'lower' ? 0 : 15,
		members:
			side === 'lower'
				? Array.from({ length: n }, (_, i) => i + 1)
				: Array.from({ length: n }, (_, i) => 14 - i),
		memberBendRange,
		masterBendRange: 2
	};
}

/**
 * The MPE Configuration Message: RPN 0,6 on the master channel, with the
 * number of member channels as the data value. Sending zero tears the zone
 * down again, which is the polite thing to do when you are finished.
 */
export function configureZone(zone: MpeZone): MidiMessage[] {
	const out: MidiMessage[] = [
		{ type: 'controlChange', channel: zone.master, controller: 101, value: 0 },
		{ type: 'controlChange', channel: zone.master, controller: 100, value: 6 },
		{ type: 'controlChange', channel: zone.master, controller: 6, value: zone.members.length },
		{ type: 'controlChange', channel: zone.master, controller: 101, value: 127 },
		{ type: 'controlChange', channel: zone.master, controller: 100, value: 127 }
	];
	// Bend range must be declared per channel, or nothing feels right.
	out.push(...setBendRange(zone.master, zone.masterBendRange));
	for (const m of zone.members) out.push(...setBendRange(m, zone.memberBendRange));
	return out;
}

export function teardownZone(side: ZoneSide): MidiMessage[] {
	const master = side === 'lower' ? 0 : 15;
	return [
		{ type: 'controlChange', channel: master, controller: 101, value: 0 },
		{ type: 'controlChange', channel: master, controller: 100, value: 6 },
		{ type: 'controlChange', channel: master, controller: 6, value: 0 },
		{ type: 'controlChange', channel: master, controller: 101, value: 127 },
		{ type: 'controlChange', channel: master, controller: 100, value: 127 }
	];
}

export interface MpeNote {
	id: number;
	channel: number;
	note: number;
	velocity: number;
	/** −1…+1, scaled by the member bend range. */
	bend: number;
	pressure: number;
	/** CC 74, the third dimension of touch. */
	slide: number;
}

/**
 * Round-robin channel allocation.
 *
 * Round-robin rather than lowest-free is deliberate and is what the MPE
 * specification recommends: reusing a channel immediately would apply the
 * previous note's still-decaying bend and pressure to the new one.
 */
export class ZoneAllocator {
	#zone: MpeZone;
	#next = 0;
	#byChannel = new Map<number, MpeNote>();
	#counter = 0;

	constructor(zone: MpeZone) {
		this.#zone = zone;
	}

	get zone(): MpeZone {
		return this.#zone;
	}

	set zone(z: MpeZone) {
		this.#zone = z;
		this.#byChannel.clear();
		this.#next = 0;
	}

	allocate(note: number, velocity: number): MpeNote | null {
		const members = this.#zone.members;
		if (members.length === 0) return null;
		for (let i = 0; i < members.length; i++) {
			const channel = members[(this.#next + i) % members.length];
			if (!this.#byChannel.has(channel)) {
				this.#next = (this.#next + i + 1) % members.length;
				const voice: MpeNote = {
					id: ++this.#counter,
					channel,
					note,
					velocity,
					bend: 0,
					pressure: 0,
					slide: 64
				};
				this.#byChannel.set(channel, voice);
				return voice;
			}
		}
		// Every member channel is busy: steal the oldest.
		const oldest = [...this.#byChannel.values()].sort((a, b) => a.id - b.id)[0];
		this.#byChannel.delete(oldest.channel);
		const voice: MpeNote = {
			id: ++this.#counter,
			channel: oldest.channel,
			note,
			velocity,
			bend: 0,
			pressure: 0,
			slide: 64
		};
		this.#byChannel.set(voice.channel, voice);
		return voice;
	}

	release(channel: number): void {
		this.#byChannel.delete(channel);
	}

	get active(): MpeNote[] {
		return [...this.#byChannel.values()];
	}

	get(channel: number): MpeNote | undefined {
		return this.#byChannel.get(channel);
	}

	clear(): void {
		this.#byChannel.clear();
	}
}

/** Every message one MPE note produces at its start. */
export function noteOnMessages(voice: MpeNote): MidiMessage[] {
	return [
		{ type: 'controlChange', channel: voice.channel, controller: 74, value: voice.slide },
		{ type: 'channelAftertouch', channel: voice.channel, pressure: voice.pressure },
		{ type: 'pitchBend', channel: voice.channel, value: 8192 },
		{ type: 'noteOn', channel: voice.channel, note: voice.note, velocity: voice.velocity }
	];
}
