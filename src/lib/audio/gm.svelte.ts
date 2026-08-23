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
 * What sampling costs: a sampled note cannot bend or be filtered after it has
 * started. Pitch bend is applied at note-on and does not glide, and CC 74 does
 * nothing here. That is a real limitation of every sample player, and it is
 * why the built-in synth stays: the lessons on continuous expression need an
 * engine that can actually be modulated while a note is sounding.
 */

import { Soundfont, getSoundfontNames } from 'smplr';
import type { Smplr, StopFn } from 'smplr';
import { audio } from './engine';
import { synth } from './synth';
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
				// Sustain is the one controller a sample player implements
				// properly; the rest are the synth's business.
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
		const bend = synth.channels[channel].bend;
		const range = synth.channels[channel].bendRange;
		// Bend is applied once, at the start. A sample already playing cannot
		// be re-tuned, which is the honest limit of this engine.
		const detune = ((bend - 8192) / 8192) * range * 100;
		const stop = player.start({
			note,
			velocity,
			detune,
			time: audioTime,
			stopId: note
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
