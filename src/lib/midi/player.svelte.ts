/**
 * A small scheduled player for demo phrases and lesson examples.
 *
 * It uses the same lookahead discipline as the main transport — plan ahead,
 * hand events to the audio and MIDI layers with timestamps, never fire them
 * from a timer — so the phrases in Act I are already an example of the thing
 * Lesson 17 explains.
 */

import { audio } from '$lib/audio/engine';
import { engine } from './engine.svelte';
import { audioToPerf } from './clock.svelte';
import type { MidiMessage } from './messages';

export interface ScheduledEvent {
	/** Seconds from the start of the sequence. */
	time: number;
	message: MidiMessage;
}

export interface NoteSpec {
	note: number;
	/** Beats from the start. */
	start: number;
	/** Length in beats. */
	duration: number;
	velocity?: number;
	channel?: number;
}

/** Turn a list of notes in beats into timed Note On/Off pairs in seconds. */
export function notesToEvents(notes: NoteSpec[], bpm = 110): ScheduledEvent[] {
	const spb = 60 / bpm;
	const out: ScheduledEvent[] = [];
	for (const n of notes) {
		const channel = n.channel ?? 0;
		out.push({
			time: n.start * spb,
			message: { type: 'noteOn', channel, note: n.note, velocity: n.velocity ?? 96 }
		});
		out.push({
			time: (n.start + n.duration) * spb,
			message: { type: 'noteOff', channel, note: n.note, velocity: 0 }
		});
	}
	return out.sort((a, b) => a.time - b.time);
}

const LOOKAHEAD = 0.15;
const INTERVAL = 25;

export class SequencePlayer {
	playing = $state(false);
	/** Seconds elapsed, for progress bars. */
	position = $state(0);
	duration = $state(0);

	#events: ScheduledEvent[] = [];
	#index = 0;
	#startTime = 0;
	#timer = 0;
	#loop = false;
	#onEnd: (() => void) | undefined;

	async play(
		events: ScheduledEvent[],
		opts: { loop?: boolean; onEnd?: () => void } = {}
	): Promise<void> {
		await engine.wake();
		this.stop();
		if (events.length === 0) return;
		this.#events = [...events].sort((a, b) => a.time - b.time);
		this.duration = this.#events[this.#events.length - 1].time + 0.4;
		this.#loop = opts.loop ?? false;
		this.#onEnd = opts.onEnd;
		this.#index = 0;
		this.#startTime = audio.now + 0.1;
		this.playing = true;
		this.#tick();
		this.#timer = window.setInterval(() => this.#tick(), INTERVAL);
	}

	stop(): void {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = 0;
		if (this.playing) {
			// Release anything the sequence left hanging, on its own channels only.
			const channels = new Set(
				this.#events.map((e) => ('channel' in e.message ? e.message.channel : 0))
			);
			for (const ch of channels) {
				engine.send({ type: 'controlChange', channel: ch, controller: 123, value: 0 });
			}
		}
		this.playing = false;
		this.position = 0;
	}

	toggle(events: ScheduledEvent[], opts?: { loop?: boolean }): void {
		if (this.playing) this.stop();
		else void this.play(events, opts);
	}

	#tick() {
		if (!this.playing) return;
		const now = audio.now;
		this.position = Math.max(0, now - this.#startTime);
		const horizon = now + LOOKAHEAD;

		while (this.#index < this.#events.length) {
			const ev = this.#events[this.#index];
			const at = this.#startTime + ev.time;
			if (at > horizon) break;
			engine.send(ev.message, audioToPerf(at), at);
			this.#index++;
		}

		if (this.#index >= this.#events.length && this.position > this.duration) {
			if (this.#loop) {
				this.#index = 0;
				this.#startTime = now;
			} else {
				this.stop();
				this.#onEnd?.();
			}
		}
	}
}
