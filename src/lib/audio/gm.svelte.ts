/**
 * The General MIDI instruments, as recordings of the actual instruments.
 *
 * The synth in `synth.ts` has one timbre per GM *family* — sixteen subtractive
 * patches, recognisably in the right neighbourhood and honest about it. That
 * is fine for teaching what a Program Change does, and it is not what a piano
 * sounds like.
 *
 * So this loads the real thing: Benjamin Gleitzman's pre-rendered soundfonts,
 * through danigb's `smplr`. One instrument per program, fetched on demand,
 * cached for the session. Nothing is downloaded until a program is actually
 * asked for, and while it is on its way the built-in synth covers — silence
 * while a sample loads would be worse than an approximation.
 *
 * What sampling costs: a sampled note cannot be changed after it has started.
 * Bend, brightness and release are all applied at note-on and stay put; a
 * sample already playing cannot be re-tuned, re-filtered or re-shaped. That is
 * a real limitation of every sample player, and it is why the built-in synth
 * stays — the lessons on continuous expression need an engine that can be
 * modulated while a note is sounding.
 *
 * Which controllers survive that is not arbitrary, and `sampledCannot` below
 * is the honest list. It is worth reading: it is the same list a General MIDI
 * Level 2 sample module of 1999 would have given you.
 */

import { Soundfont, getSoundfontNames } from 'smplr';
import type { Smplr, StopFn } from 'smplr';
import { audio } from './engine';
import { synth, timeScale } from './synth';
import { load as loadSetting, save } from '$lib/stores/persist';
import { GM_PROGRAMS } from '$lib/midi/constants';
import type { MidiMessage } from '$lib/midi/messages';

/**
 * The soundfont pack names are close to the General MIDI names but not
 * derivable from them — these are the ten that a slug of the GM name misses.
 */
const RENAMED: Record<string, string> = {
	honky_tonk_piano: 'honkytonk_piano',
	clavi: 'clavinet',
	synthstrings_1: 'synth_strings_1',
	synthstrings_2: 'synth_strings_2',
	synth_voice: 'synth_choir',
	synthbrass_1: 'synth_brass_1',
	synthbrass_2: 'synth_brass_2',
	lead_8_bass_lead: 'lead_8_bass__lead',
	fx_8_sci_fi: 'fx_8_scifi',
	bag_pipe: 'bagpipe'
};

function slug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[()]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

/** program 0–127 → the pack's name for it, or null if there isn't one. */
const PACK: (string | null)[] = (() => {
	const available = new Set(getSoundfontNames());
	return GM_PROGRAMS.map((name) => {
		const s = slug(name);
		const mapped = RENAMED[s] ?? s;
		return available.has(mapped) ? mapped : null;
	});
})();

/**
 * smplr's own defaults, so that a controller sitting at 64 asks for exactly
 * what the instrument would have done unasked.
 */
const RELEASE_BASE = 0.3;
const OPEN_HZ = 20000;

/** CC 72, as seconds of amplitude release on the sample. */
export const sampledRelease = (v: number) => RELEASE_BASE * timeScale(v);

/**
 * CC 74, as a lowpass cutoff.
 *
 * Only downwards. A recording is exactly as bright as it was recorded, so
 * there is nothing above 64 for this to add — which is itself the difference
 * between filtering a synthesiser and filtering a sample, and is why the knob
 * feels one-sided here and two-sided on the synth.
 */
export const sampledCutoff = (v: number) =>
	Math.max(120, Math.min(OPEN_HZ, OPEN_HZ * Math.pow(2, (v - 64) / 10)));

/**
 * Why a controller has nowhere to land on a recorded instrument.
 *
 * Not a list of things left unimplemented — a list of things a sample player
 * cannot do, which is a different and much more interesting list. Every entry
 * here is a real property of playing back a recording rather than generating
 * a sound, and every one of them was true of the hardware modules this format
 * was written for.
 */
const SAMPLED_CANNOT: Record<number, string> = {
	1: 'Vibrato has to happen while the note sounds, and a sample cannot be modulated once it has started.',
	7: 'One recording is shared by every channel playing that program, so a per-channel level has nowhere to go.',
	10: 'Pan is per channel, and one recording is shared by every channel playing that program.',
	71: 'Resonance belongs to a filter the recording does not have.',
	73: 'The attack is part of the recording. A sampler cannot give you a swell nobody recorded.',
	75: 'So is the decay. The sample simply plays.',
	91: 'The reverb here belongs to the synth; the sampled path goes straight to the master.'
};

/** The reason a controller does nothing on the sampled engine, or null. */
export function sampledCannot(cc: number): string | null {
	return SAMPLED_CANNOT[cc] ?? null;
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

class GeneralMidi {
	/**
	 * Which engine the internal instrument runs. Sampled by default, because
	 * "what does a trumpet sound like" should be answered with a trumpet.
	 */
	enabled = $state<boolean>(loadSetting('gmSampled', true));

	/** Per program, so the UI can say which sound is on its way. */
	state = $state<Record<number, LoadState>>({});

	#players = new Map<number, Smplr>();

	constructor() {
		$effect.root(() => {
			$effect(() => save('gmSampled', this.enabled));
			return () => {};
		});
	}

	/** Held notes, so a Note Off can stop the exact voices it started. */
	#sounding = new Map<string, StopFn>();
	/** Channels whose notes are being covered by the built-in synth for now. */
	#covered = new Set<string>();

	programOf(channel: number): number {
		return synth.channels[channel].program;
	}

	/** Is this program a real recording, or is it being stood in for? */
	stateOf(program: number): LoadState {
		return this.state[program] ?? 'idle';
	}

	nameOf(program: number): string {
		return GM_PROGRAMS[program & 0x7f];
	}

	/**
	 * Ask for a program ahead of time. Safe to call repeatedly; the fetch
	 * happens once and the result is kept for the session.
	 */
	load(program: number): void {
		const p = program & 0x7f;
		if (this.#players.has(p) || this.stateOf(p) === 'loading') return;
		const pack = PACK[p];
		const ctx = audio.context;
		const out = audio.destination;
		if (!pack || !ctx || !out) return;

		this.state[p] = 'loading';
		const player = Soundfont(ctx, { instrument: pack, destination: out });
		player.ready
			.then(() => {
				this.#players.set(p, player);
				this.state[p] = 'ready';
			})
			.catch(() => {
				// Offline, blocked, or the pack moved. The synth keeps playing;
				// the only cost is that it still sounds like the synth.
				this.state[p] = 'failed';
			});
	}

	handle(msg: MidiMessage, audioTime?: number): void {
		switch (msg.type) {
			case 'noteOn':
				if (msg.velocity === 0) this.noteOff(msg.channel, msg.note, audioTime);
				else this.noteOn(msg.channel, msg.note, msg.velocity, audioTime);
				return;
			case 'noteOff':
				this.noteOff(msg.channel, msg.note, audioTime);
				return;
			case 'controlChange':
				// The synth owns the channel state either way; `noteOn` reads
				// the release and the cutoff back out of it when it starts a
				// sample. Sustain is the one controller that has to reach the
				// player itself, because it holds notes that already exist.
				synth.handle(msg, audioTime);
				if (msg.controller === 64) {
					for (const player of this.#players.values()) player.setCC(64, msg.value);
				}
				return;
			default:
				// Program Change, bend, pressure, resets: the synth owns the
				// channel state, and this reads it back out of there.
				synth.handle(msg, audioTime);
				if (msg.type === 'programChange') this.load(msg.program);
				return;
		}
	}

	noteOn(channel: number, note: number, velocity: number, audioTime?: number): void {
		if (channel === 9) {
			// Percussion is a note map, not an instrument, and the soundfont
			// packs do not carry one. The synthesised kit is what plays it.
			synth.noteOn(channel, note, velocity, audioTime);
			return;
		}
		const program = this.programOf(channel);
		const player = this.#players.get(program);
		if (!player) {
			this.load(program);
			this.#covered.add(key(channel, note));
			synth.noteOn(channel, note, velocity, audioTime);
			return;
		}
		const state = synth.channels[channel];
		// Everything here is applied once, at the start. A sample already
		// playing cannot be re-tuned, re-filtered or re-shaped, which is the
		// honest limit of this engine — and the reason CC 74 moves a held note
		// on the synth and only the next note here.
		const detune = ((state.bend - 8192) / 8192) * state.bendRange * 100;
		const stop = player.start({
			note,
			velocity,
			detune,
			time: audioTime,
			stopId: note,
			ampRelease: sampledRelease(state.releaseTime),
			lpfCutoffHz: sampledCutoff(state.cutoff)
		});
		this.#sounding.set(key(channel, note), stop);
	}

	noteOff(channel: number, note: number, audioTime?: number): void {
		const k = key(channel, note);
		if (channel === 9 || this.#covered.delete(k)) {
			synth.noteOff(channel, note, audioTime);
			return;
		}
		const stop = this.#sounding.get(k);
		this.#sounding.delete(k);
		stop?.(audioTime);
	}

	/** Notes this engine is holding, for the dock's voice count. */
	get voiceCount(): number {
		return this.#sounding.size;
	}

	/** Everything, everywhere, now — the panic button's other half. */
	allOff(): void {
		for (const stop of this.#sounding.values()) stop();
		this.#sounding.clear();
		this.#covered.clear();
		for (const player of this.#players.values()) player.stop();
		synth.allSoundOff();
	}
}

function key(channel: number, note: number): string {
	return `${channel}:${note}`;
}

export const gm = new GeneralMidi();
