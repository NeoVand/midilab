import type { MidiMessage } from '$lib/midi/messages';
import { makeNote, normalizeNote, quantizeNotes, type StudioNote } from './model';

interface RecorderOptions {
	bpm: number;
	lengthBeats?: number;
	grid?: number;
	/** Measured input delay, removed from both starts and releases. */
	latencyMs?: number;
}

interface HeldNote {
	note: number;
	velocity: number;
	start: number;
	released: boolean;
}

/** One finite take, recorded from actual input times rather than the lookahead playhead. */
export class TakeRecorder {
	#options: Required<RecorderOptions>;
	#origin = 0;
	#running = false;
	#held = new Map<string, HeldNote>();
	#pedals = new Set<string>();
	#notes: StudioNote[] = [];

	constructor({ bpm, lengthBeats = 32, grid = 0, latencyMs = 0 }: RecorderOptions) {
		this.#options = { bpm, lengthBeats, grid, latencyMs };
	}

	start(atMs: number): void {
		this.#origin = atMs;
		this.#running = true;
		this.#notes = [];
		this.#held.clear();
		this.#pedals.clear();
	}

	#beat(atMs: number): number {
		return ((atMs - this.#origin - this.#options.latencyMs) * this.#options.bpm) / 60_000;
	}

	#release(key: string, end: number): void {
		const held = this.#held.get(key);
		if (!held) return;
		this.#held.delete(key);
		this.#notes.push(
			normalizeNote(
				makeNote(held.note, held.start, Math.max(1 / 96, end - held.start), held.velocity),
				this.#options.lengthBeats
			)
		);
	}

	handle(message: MidiMessage, atMs: number, source = 'local'): void {
		if (!this.#running || !('channel' in message)) return;
		const beat = this.#beat(atMs);
		const part = `${source}:${message.channel}`;
		const end = Math.min(this.#options.lengthBeats, Math.max(0, beat));
		const key = 'note' in message ? `${source}:${message.channel}:${message.note}` : '';
		if (message.type === 'noteOff' || (message.type === 'noteOn' && message.velocity === 0)) {
			const held = this.#held.get(key);
			if (held && this.#pedals.has(part)) held.released = true;
			else this.#release(key, end);
		} else if (message.type === 'noteOn') {
			if (beat < 0 || beat >= this.#options.lengthBeats) return;
			// A repeated strike closes the previous articulation before opening the next.
			this.#release(key, beat);
			this.#held.set(key, {
				note: message.note,
				velocity: message.velocity,
				start: beat,
				released: false
			});
		} else if (
			message.type === 'controlChange' &&
			message.controller === 64 &&
			message.channel !== 9
		) {
			if (message.value >= 64) this.#pedals.add(part);
			else {
				this.#pedals.delete(part);
				for (const [active, held] of this.#held) {
					if (active.startsWith(`${part}:`) && held.released) this.#release(active, end);
				}
			}
		} else if (message.type === 'controlChange' && [120, 123].includes(message.controller)) {
			this.#pedals.delete(part);
			for (const active of [...this.#held.keys()]) {
				if (active.startsWith(`${part}:`)) this.#release(active, end);
			}
		}
	}

	finish(atMs: number): StudioNote[] {
		if (!this.#running) return this.#notes.map((note) => ({ ...note }));
		const end = Math.min(this.#options.lengthBeats, Math.max(0, this.#beat(atMs)));
		for (const key of [...this.#held.keys()]) this.#release(key, end);
		this.#running = false;
		this.#notes = quantizeNotes(this.#notes, this.#options.grid, 1, this.#options.lengthBeats);
		return this.#notes
			.sort((a, b) => a.start - b.start || a.note - b.note)
			.map((note) => ({ ...note }));
	}
}
