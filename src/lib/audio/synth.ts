/**
 * A sixteen-channel multitimbral synthesiser driven by `MidiMessage` values.
 *
 * This is the app's fallback device: with no hardware plugged in at all, every
 * lesson still makes sound, because the synth receives exactly the same messages
 * an external instrument would. It is also a live demonstration of the
 * *receiver decides* principle — the whole point of Lesson 7. It honours CC 74
 * as cutoff and CC 71 as resonance because it chooses to, not because the
 * protocol makes it.
 *
 * MPE falls out for free: since every MPE note lives on its own channel, and
 * bend/pressure/CC 74 are tracked per channel and applied to that channel's
 * voices in real time, per-note expression already works. The only extra piece
 * is a wider default bend range on member channels.
 */

import { audio, type AudioEngine } from './engine';
import { presetForProgram, type Preset } from './presets';
import { triggerDrum } from './drums';
import type { MidiMessage } from '$lib/midi/messages';
import { bendToUnit } from '$lib/midi/messages';
import { noteToFrequency } from '$lib/midi/notes';

const MAX_VOICES = 48;
const DRUM_CHANNEL = 9;

class Voice {
	readonly channel: number;
	readonly note: number;
	readonly startedAt: number;
	released = false;

	#ctx: AudioContext;
	#preset: Preset;
	#osc1: OscillatorNode;
	#osc2: OscillatorNode;
	#noise: AudioBufferSourceNode | null = null;
	#filter: BiquadFilterNode;
	#amp: GainNode;
	#panner: StereoPannerNode;
	#lfoGain: GainNode;
	#baseFreq: number;
	#peak: number;
	#cutoffScale = 1;
	#stopAt = Infinity;

	constructor(
		engine: AudioEngine,
		preset: Preset,
		channel: number,
		note: number,
		velocity: number,
		when: number,
		lfo: OscillatorNode,
		out: AudioNode,
		reverbAmount: number,
		delayAmount: number
	) {
		const ctx = engine.context!;
		this.#ctx = ctx;
		this.#preset = preset;
		this.channel = channel;
		this.note = note;
		this.startedAt = when;
		this.#baseFreq = noteToFrequency(note);

		const t = Math.max(when, ctx.currentTime);

		this.#filter = ctx.createBiquadFilter();
		this.#filter.type = 'lowpass';
		this.#filter.Q.value = preset.resonance;

		this.#amp = ctx.createGain();
		this.#amp.gain.value = 0;

		this.#panner = ctx.createStereoPanner();

		this.#osc1 = ctx.createOscillator();
		this.#osc1.type = preset.osc1;
		this.#osc1.frequency.value = this.#baseFreq;

		this.#osc2 = ctx.createOscillator();
		this.#osc2.type = preset.osc2;
		this.#osc2.frequency.value = this.#baseFreq;
		this.#osc2.detune.value = preset.detune;

		const g2 = ctx.createGain();
		g2.gain.value = preset.osc2Level;

		// Vibrato: one shared LFO, scaled per voice so mod-wheel depth is per channel.
		this.#lfoGain = ctx.createGain();
		this.#lfoGain.gain.value = 0;
		lfo.connect(this.#lfoGain);
		this.#lfoGain.connect(this.#osc1.detune);
		this.#lfoGain.connect(this.#osc2.detune);

		this.#osc1.connect(this.#filter);
		this.#osc2.connect(g2).connect(this.#filter);

		if (preset.noise > 0 && engine.noiseBuffer) {
			const n = ctx.createBufferSource();
			n.buffer = engine.noiseBuffer;
			n.loop = true;
			const ng = ctx.createGain();
			ng.gain.value = preset.noise;
			n.connect(ng).connect(this.#filter);
			n.start(t);
			this.#noise = n;
		}

		this.#filter.connect(this.#amp).connect(this.#panner);
		this.#panner.connect(out);
		if (reverbAmount > 0 && engine.reverbSend) {
			const send = ctx.createGain();
			send.gain.value = reverbAmount;
			this.#panner.connect(send).connect(engine.reverbSend);
		}
		if (delayAmount > 0 && engine.delaySend) {
			const send = ctx.createGain();
			send.gain.value = delayAmount;
			this.#panner.connect(send).connect(engine.delaySend);
		}

		// Velocity shapes both loudness and brightness, which is what makes a
		// velocity curve feel like dynamics rather than a volume knob.
		const v = velocity / 127;
		this.#peak = Math.pow(v, 1.5) * preset.gain * 0.22;
		this.#cutoffScale = 0.45 + v * 0.55;

		this.#osc1.start(t);
		this.#osc2.start(t);
		this.#attack(t);
	}

	#attack(t: number) {
		const p = this.#preset;
		const a = this.#amp.gain;
		a.cancelScheduledValues(t);
		a.setValueAtTime(0.0001, t);
		a.linearRampToValueAtTime(this.#peak, t + Math.max(0.001, p.attack));
		a.setTargetAtTime(this.#peak * p.sustain, t + p.attack, Math.max(0.01, p.decay / 3));

		const f = this.#filter.frequency;
		const base = this.#cutoffFreq();
		const open = Math.min(18000, base * Math.pow(2, p.filterEnv));
		f.cancelScheduledValues(t);
		f.setValueAtTime(Math.max(40, base), t);
		f.linearRampToValueAtTime(Math.max(40, open), t + Math.max(0.001, p.attack));
		f.setTargetAtTime(Math.max(40, base), t + p.attack, Math.max(0.02, p.filterDecay / 3));

		if (p.sustain === 0) this.#stopAt = t + p.attack + p.decay + p.release;
	}

	#cutoffFreq(): number {
		return Math.max(40, Math.min(18000, this.#preset.cutoff * this.#cutoffScale));
	}

	/** Live cutoff control — this is CC 74 arriving mid-note. */
	setCutoffScale(scale: number): void {
		this.#cutoffScale = scale;
		if (this.released) return;
		this.#filter.frequency.setTargetAtTime(this.#cutoffFreq(), this.#ctx.currentTime, 0.02);
	}

	setResonance(q: number): void {
		this.#filter.Q.setTargetAtTime(q, this.#ctx.currentTime, 0.02);
	}

	setBendCents(cents: number): void {
		const t = this.#ctx.currentTime;
		this.#osc1.detune.setTargetAtTime(cents, t, 0.006);
		this.#osc2.detune.setTargetAtTime(cents + this.#preset.detune, t, 0.006);
	}

	setVibratoDepth(cents: number): void {
		this.#lfoGain.gain.setTargetAtTime(cents, this.#ctx.currentTime, 0.05);
	}

	setPan(pan: number): void {
		this.#panner.pan.setTargetAtTime(pan, this.#ctx.currentTime, 0.02);
	}

	setLevel(scale: number): void {
		if (this.released) return;
		this.#amp.gain.setTargetAtTime(
			this.#peak * this.#preset.sustain * scale,
			this.#ctx.currentTime,
			0.02
		);
	}

	release(when = this.#ctx.currentTime): void {
		if (this.released) return;
		this.released = true;
		const t = Math.max(when, this.#ctx.currentTime);
		const r = Math.max(0.01, this.#preset.release);
		const a = this.#amp.gain;
		a.cancelScheduledValues(t);
		a.setValueAtTime(a.value, t);
		a.setTargetAtTime(0.0001, t, r / 4);
		this.#stopAt = t + r * 1.5;
		this.#osc1.stop(this.#stopAt);
		this.#osc2.stop(this.#stopAt);
		this.#noise?.stop(this.#stopAt);
	}

	/** Immediate cut, for All Sound Off and panic. */
	kill(): void {
		const t = this.#ctx.currentTime;
		this.released = true;
		this.#amp.gain.cancelScheduledValues(t);
		this.#amp.gain.setTargetAtTime(0.0001, t, 0.004);
		this.#stopAt = t + 0.05;
		try {
			this.#osc1.stop(this.#stopAt);
			this.#osc2.stop(this.#stopAt);
			this.#noise?.stop(this.#stopAt);
		} catch {
			/* already stopped */
		}
	}

	get finished(): boolean {
		return this.#ctx.currentTime > this.#stopAt;
	}

	dispose(): void {
		try {
			this.#osc1.disconnect();
			this.#osc2.disconnect();
			this.#noise?.disconnect();
			this.#filter.disconnect();
			this.#amp.disconnect();
			this.#panner.disconnect();
			this.#lfoGain.disconnect();
		} catch {
			/* already gone */
		}
	}
}

export interface ChannelState {
	program: number;
	bankMsb: number;
	bankLsb: number;
	volume: number;
	expression: number;
	pan: number;
	modulation: number;
	sustain: boolean;
	cutoff: number;
	resonance: number;
	reverb: number;
	chorus: number;
	pressure: number;
	bend: number;
	bendRange: number;
	/** Parameter-selector state for the RPN/NRPN handshake. */
	rpn: { msb: number; lsb: number } | null;
	nrpn: { msb: number; lsb: number } | null;
	muted: boolean;
}

function initialChannel(): ChannelState {
	return {
		program: 0,
		bankMsb: 0,
		bankLsb: 0,
		volume: 100,
		expression: 127,
		pan: 64,
		modulation: 0,
		sustain: false,
		cutoff: 64,
		resonance: 64,
		reverb: 12,
		chorus: 0,
		pressure: 0,
		bend: 8192,
		bendRange: 2,
		rpn: null,
		nrpn: null,
		muted: false
	};
}

export class Synth {
	readonly channels: ChannelState[] = Array.from({ length: 16 }, () => initialChannel());

	#engine: AudioEngine;
	#voices: Voice[] = [];
	#sustained = new Set<Voice>();
	#lfo: OscillatorNode | null = null;
	#out: GainNode | null = null;
	#sweeper = 0;

	/** Notes currently sounding, keyed `channel:note`. Drives keyboard highlighting. */
	readonly active = new Set<string>();

	constructor(engine: AudioEngine = audio) {
		this.#engine = engine;
	}

	async ensureStarted(): Promise<void> {
		const ctx = await this.#engine.resume();
		if (!ctx || this.#lfo) return;
		const out = ctx.createGain();
		out.gain.value = 1;
		out.connect(this.#engine.destination!);
		this.#out = out;
		const lfo = ctx.createOscillator();
		lfo.type = 'sine';
		lfo.frequency.value = 5.2;
		lfo.start();
		this.#lfo = lfo;
		this.#sweeper = window.setInterval(() => this.#reap(), 500);
	}

	dispose(): void {
		clearInterval(this.#sweeper);
		this.allSoundOff();
	}

	#reap() {
		const alive: Voice[] = [];
		for (const v of this.#voices) {
			if (v.finished) v.dispose();
			else alive.push(v);
		}
		this.#voices = alive;
	}

	/**
	 * The one entry point. Feed it anything that came off the wire.
	 *
	 * `audioTime` lets a scheduler place the event precisely on the audio
	 * clock instead of "whenever this function was called", which is the whole
	 * difference between a sequencer that swings and one that stumbles.
	 */
	handle(msg: MidiMessage, audioTime?: number): void {
		switch (msg.type) {
			case 'noteOn':
				this.noteOn(msg.channel, msg.note, msg.velocity, audioTime);
				break;
			case 'noteOff':
				this.noteOff(msg.channel, msg.note, audioTime);
				break;
			case 'controlChange':
				this.controlChange(msg.channel, msg.controller, msg.value);
				break;
			case 'programChange':
				this.channels[msg.channel].program = msg.program;
				break;
			case 'pitchBend':
				this.pitchBend(msg.channel, msg.value);
				break;
			case 'channelAftertouch':
				this.aftertouch(msg.channel, msg.pressure);
				break;
			case 'polyAftertouch':
				this.polyAftertouch(msg.channel, msg.note, msg.pressure);
				break;
			case 'reset':
				this.reset();
				break;
		}
	}

	noteOn(channel: number, note: number, velocity: number, audioTime?: number): void {
		if (velocity === 0) return this.noteOff(channel, note, audioTime);
		const ctx = this.#engine.context;
		if (!ctx || !this.#out || !this.#lfo) {
			void this.ensureStarted();
			return;
		}
		const state = this.channels[channel];
		if (state.muted) return;
		this.active.add(`${channel}:${note}`);
		const when = audioTime ?? ctx.currentTime;

		if (channel === DRUM_CHANNEL) {
			triggerDrum(this.#engine, note, velocity, this.#out, when);
			return;
		}

		// Retrigger: a second Note On for a note already sounding replaces it.
		for (const v of this.#voices) {
			if (v.channel === channel && v.note === note && !v.released) v.release();
		}
		if (this.#voices.length >= MAX_VOICES) {
			const oldest = this.#voices.find((v) => !v.released) ?? this.#voices[0];
			oldest?.kill();
		}

		const preset = presetForProgram(state.program);
		const voice = new Voice(
			this.#engine,
			preset,
			channel,
			note,
			velocity,
			when,
			this.#lfo,
			this.#out,
			(state.reverb / 127) * 0.9,
			(state.chorus / 127) * 0.6
		);
		voice.setCutoffScale(this.#cutoffScale(state));
		voice.setResonance(this.#resonance(state));
		voice.setBendCents(this.#bendCents(state));
		voice.setVibratoDepth((state.modulation / 127) * preset.vibrato);
		voice.setPan((state.pan - 64) / 63);
		voice.setLevel(this.#levelScale(state));
		this.#voices.push(voice);
	}

	noteOff(channel: number, note: number, audioTime?: number): void {
		this.active.delete(`${channel}:${note}`);
		const state = this.channels[channel];
		for (const v of this.#voices) {
			if (v.channel === channel && v.note === note && !v.released) {
				if (state.sustain) this.#sustained.add(v);
				else v.release(audioTime);
			}
		}
	}

	controlChange(channel: number, cc: number, value: number): void {
		const s = this.channels[channel];
		switch (cc) {
			case 0:
				s.bankMsb = value;
				break;
			case 32:
				s.bankLsb = value;
				break;
			case 1:
				s.modulation = value;
				this.#forEach(channel, (v) => v.setVibratoDepth((value / 127) * 60));
				break;
			case 7:
				s.volume = value;
				this.#forEach(channel, (v) => v.setLevel(this.#levelScale(s)));
				break;
			case 10:
				s.pan = value;
				this.#forEach(channel, (v) => v.setPan((value - 64) / 63));
				break;
			case 11:
				s.expression = value;
				this.#forEach(channel, (v) => v.setLevel(this.#levelScale(s)));
				break;
			case 64:
				s.sustain = value >= 64;
				if (!s.sustain) {
					for (const v of this.#sustained)
						if (v.channel === channel) {
							v.release();
							this.#sustained.delete(v);
						}
				}
				break;
			case 71:
				s.resonance = value;
				this.#forEach(channel, (v) => v.setResonance(this.#resonance(s)));
				break;
			case 74:
				s.cutoff = value;
				this.#forEach(channel, (v) => v.setCutoffScale(this.#cutoffScale(s)));
				break;
			case 91:
				s.reverb = value;
				break;
			case 93:
				s.chorus = value;
				break;
			case 98:
				s.nrpn = { msb: s.nrpn?.msb ?? 0, lsb: value };
				s.rpn = null;
				break;
			case 99:
				s.nrpn = { msb: value, lsb: s.nrpn?.lsb ?? 0 };
				s.rpn = null;
				break;
			case 100:
				s.rpn = { msb: s.rpn?.msb ?? 0, lsb: value };
				s.nrpn = null;
				break;
			case 101:
				s.rpn = { msb: value, lsb: s.rpn?.lsb ?? 0 };
				s.nrpn = null;
				break;
			case 6:
				this.#dataEntry(channel, value);
				break;
			case 120:
				this.allSoundOff(channel);
				break;
			case 121:
				this.resetControllers(channel);
				break;
			case 123:
				this.allNotesOff(channel);
				break;
			case 124:
			case 125:
			case 126:
			case 127:
				this.allNotesOff(channel);
				break;
		}
	}

	#dataEntry(channel: number, value: number) {
		const s = this.channels[channel];
		if (!s.rpn) return;
		// RPN 0,0 — pitch bend sensitivity, in semitones.
		if (s.rpn.msb === 0 && s.rpn.lsb === 0) {
			s.bendRange = value;
			this.#forEach(channel, (v) => v.setBendCents(this.#bendCents(s)));
		}
	}

	pitchBend(channel: number, value: number): void {
		const s = this.channels[channel];
		s.bend = value;
		this.#forEach(channel, (v) => v.setBendCents(this.#bendCents(s)));
	}

	aftertouch(channel: number, pressure: number): void {
		const s = this.channels[channel];
		s.pressure = pressure;
		this.#forEach(channel, (v) => v.setCutoffScale(this.#cutoffScale(s)));
	}

	polyAftertouch(channel: number, note: number, pressure: number): void {
		const s = this.channels[channel];
		for (const v of this.#voices) {
			if (v.channel === channel && v.note === note) {
				v.setCutoffScale(this.#cutoffScale(s) * (0.7 + (pressure / 127) * 1.4));
			}
		}
	}

	allNotesOff(channel?: number): void {
		for (const v of this.#voices) {
			if (channel === undefined || v.channel === channel) v.release();
		}
		this.#sustained.clear();
		this.#clearActive(channel);
	}

	allSoundOff(channel?: number): void {
		for (const v of this.#voices) {
			if (channel === undefined || v.channel === channel) v.kill();
		}
		this.#sustained.clear();
		this.#clearActive(channel);
	}

	resetControllers(channel?: number): void {
		const range = channel === undefined ? this.channels.keys() : [channel];
		for (const c of range) {
			const s = this.channels[c];
			s.modulation = 0;
			s.expression = 127;
			s.sustain = false;
			s.bend = 8192;
			s.pressure = 0;
			this.#forEach(c, (v) => {
				v.setBendCents(0);
				v.setVibratoDepth(0);
				v.setLevel(this.#levelScale(s));
			});
		}
	}

	reset(): void {
		this.allSoundOff();
		for (let i = 0; i < 16; i++) this.channels[i] = initialChannel();
	}

	#clearActive(channel?: number) {
		if (channel === undefined) return this.active.clear();
		for (const key of [...this.active]) {
			if (key.startsWith(`${channel}:`)) this.active.delete(key);
		}
	}

	#forEach(channel: number, fn: (v: Voice) => void) {
		for (const v of this.#voices) if (v.channel === channel) fn(v);
	}

	#cutoffScale(s: ChannelState): number {
		// CC 74 at its 64 default means "leave the preset alone"; the range spans
		// roughly five octaves either side, which is what makes a sweep dramatic.
		const cc = Math.pow(2, ((s.cutoff - 64) / 64) * 3.2);
		const press = 1 + (s.pressure / 127) * 1.6;
		return cc * press;
	}

	#resonance(s: ChannelState): number {
		return 0.3 + Math.pow(s.resonance / 64, 2.2) * 12;
	}

	#levelScale(s: ChannelState): number {
		return (s.volume / 127) * (s.expression / 127);
	}

	#bendCents(s: ChannelState): number {
		return bendToUnit(s.bend) * s.bendRange * 100;
	}

	get voiceCount(): number {
		return this.#voices.filter((v) => !v.finished).length;
	}
}

export const synth = new Synth();
