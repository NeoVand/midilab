/**
 * A small scheduled player for demo phrases and lesson examples.
 *
 * It uses the same lookahead discipline as the main transport — plan ahead,
 * hand events to the audio and MIDI layers with timestamps, never fire them
 * from a timer — so the phrases in Act 0 are already an example of the thing
 * Latency, jitter, and the lookahead scheduler explains.
 */

import { SvelteSet } from 'svelte/reactivity';
import { onDestroy } from 'svelte';
import { audio } from '$lib/audio/engine';
import { claimDemoPlayback } from '$lib/audio/demo-focus';
import { engine } from './engine.svelte';
import { audioToPerf } from './clock.svelte';
import { bus } from './bus';
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
	#releaseFocus: (() => void) | undefined;
	#generation = 0;
	#disposed = false;

	/**
	 * Construct this during component initialisation. It registers its own
	 * teardown, so navigating away mid-phrase releases the notes and drops the
	 * scheduling timer instead of leaving an orphan interval feeding the engine
	 * from a component that no longer exists.
	 */
	constructor() {
		const unsubscribe = bus.subscribe(({ message }) => {
			if (
				message.type === 'reset' ||
				(message.type === 'controlChange' && message.controller === 120)
			)
				this.stop();
		});
		onDestroy(() => {
			this.#disposed = true;
			unsubscribe();
			this.stop();
		});
	}

	async play(
		events: ScheduledEvent[],
		opts: { loop?: boolean; onEnd?: () => void } = {}
	): Promise<void> {
		this.stop();
		if (this.#disposed || events.length === 0) return;
		// Claim before resuming audio, so a newer request also cancels a demo
		// still waiting for the audio context. Acoustic and MIDI examples share
		// this foreground: the picture and the sound always describe one demo.
		this.#releaseFocus = claimDemoPlayback(() => this.stop());
		const generation = this.#generation;
		try {
			await engine.wake();
		} catch (error) {
			if (this.#disposed || generation !== this.#generation) return;
			this.stop();
			throw error;
		}
		if (this.#disposed || generation !== this.#generation) return;
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
		this.#generation++;
		const release = this.#releaseFocus;
		this.#releaseFocus = undefined;
		release?.();
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = 0;
		if (this.playing) {
			// Release anything the sequence left hanging, on its own channels only.
			const channels = new SvelteSet(
				this.#events.map((e) => ('channel' in e.message ? e.message.channel : 0))
			);
			for (const ch of channels) {
				engine.send(
					{ type: 'controlChange', channel: ch, controller: 123, value: 0 },
					undefined,
					undefined,
					'demo'
				);
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
			engine.send(ev.message, audioToPerf(at), at, 'demo');
			this.#index++;
		}

		if (this.#index >= this.#events.length && this.position > this.duration) {
			if (this.#loop) {
				// Advance the origin by arithmetic, not by reading the clock: the
				// wake-up that noticed the end was up to INTERVAL ms late, and
				// `startTime = now` would bake that lateness into every repeat.
				this.#index = 0;
				this.#startTime += this.duration;
				this.position = Math.max(0, now - this.#startTime);
			} else {
				this.stop();
				this.#onEnd?.();
			}
		}
	}
}
