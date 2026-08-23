/**
 * Transport, tempo, and the lookahead scheduler.
 *
 * ## Why a scheduler at all
 * `setTimeout` and `setInterval` are not musical instruments. They fire whenever
 * the main thread gets round to it — which, on a page also rendering a piano
 * roll, can be tens of milliseconds late and never consistently so. The fix,
 * which every serious browser audio project converges on, is to stop asking a
 * timer to *play* things and start asking it to *plan* things:
 *
 *   a coarse ~25 ms interval wakes up, looks ~120 ms into the future, and hands
 *   every event in that window to Web Audio and Web MIDI with an explicit
 *   timestamp. The audio hardware and the MIDI subsystem then deliver them
 *   exactly on time, because they run on their own clocks.
 *
 * Lesson 17 makes you build this, then measures the difference.
 *
 * ## Two clocks, one map
 * `AudioContext.currentTime` (seconds, audio hardware) and `performance.now()`
 * (milliseconds, page) are separate clocks that drift. `audioToPerf()` maps
 * between them using `getOutputTimestamp()` where available, so a single
 * scheduled event can reach both the synth and a hardware MIDI port together.
 */

import { browser } from '$app/environment';
import { audio } from '$lib/audio/engine';
import { bus, type MidiEvent } from './bus';

/** Internal sequencer resolution. MIDI Clock is only 24 PPQN; we run finer. */
export const PPQ = 96;
/** MIDI Clock ticks per quarter note. Fixed by the spec since 1983. */
export const CLOCK_PPQ = 24;

const LOOKAHEAD_MS = 120;
const INTERVAL_MS = 25;

export interface TickEvent {
	/** Absolute tick since the transport last started, at PPQ resolution. */
	tick: number;
	/** When it should sound, in `AudioContext.currentTime` seconds. */
	audioTime: number;
	/** The same instant in `performance.now()` milliseconds, for `output.send`. */
	perfTime: number;
}

export type TickListener = (tick: TickEvent) => void;

export type ClockSource = 'internal' | 'external';

export class Transport {
	bpm = $state(120);
	playing = $state(false);
	/** Loop length in bars; 0 disables looping. */
	loopBars = $state(0);
	beatsPerBar = $state(4);

	/** Emit MIDI Clock, Start, Stop and Continue to the active outputs. */
	sendClock = $state(false);
	/** Follow incoming MIDI Clock instead of running our own. */
	source = $state<ClockSource>('internal');

	/** Current position in PPQ ticks. */
	tick = $state(0);
	/** Whether an external clock has been seen recently. */
	externalPresent = $state(false);
	externalBpm = $state(0);
	#presenceTimer = 0;
	/** Standard deviation of incoming clock intervals, in ms. The jitter figure. */
	externalJitter = $state(0);

	#timer = 0;
	#nextTick = 0;
	#nextTickTime = 0;
	#listeners = new Set<TickListener>();
	#sendFn: ((bytes: number[], perfTime: number) => void) | null = null;
	#clockIntervals: number[] = [];
	#lastClockAt = 0;
	#externalTicks = 0;
	#unsub: (() => void) | null = null;

	/** Seconds per PPQ tick at the current tempo. */
	get secondsPerTick(): number {
		return 60 / this.bpm / PPQ;
	}

	get bars(): number {
		return this.tick / (PPQ * this.beatsPerBar);
	}

	get positionLabel(): string {
		const ticksPerBar = PPQ * this.beatsPerBar;
		const bar = Math.floor(this.tick / ticksPerBar) + 1;
		const beat = Math.floor((this.tick % ticksPerBar) / PPQ) + 1;
		const sixteenth = Math.floor((this.tick % PPQ) / (PPQ / 4)) + 1;
		return `${bar}.${beat}.${sixteenth}`;
	}

	/** Register the function that puts raw bytes on the wire (the engine does this). */
	bindOutput(fn: (bytes: number[], perfTime: number) => void): void {
		this.#sendFn = fn;
	}

	onTick(listener: TickListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/**
	 * Watch the bus for incoming clock so external sync and jitter can be
	 * measured.
	 *
	 * Idempotent, and it always hands back a stop function rather than the raw
	 * unsubscribe — returning that on a second call leaves `#unsub` set while
	 * the subscription is gone, and every later call early-returns onto a dead
	 * one.
	 */
	watchExternal(): () => void {
		if (!this.#unsub) this.#unsub = bus.subscribe((e) => this.#onIncoming(e));
		// "Present" has to be able to become false again. A clock that stopped
		// two minutes ago was still being reported as live, because nothing ever
		// took the flag down. Even a 20 BPM clock is a tick every 125 ms.
		if (browser && !this.#presenceTimer) {
			this.#presenceTimer = window.setInterval(() => {
				if (!this.externalPresent) return;
				if (performance.now() - this.#lastClockAt < 1000) return;
				this.externalPresent = false;
				if (this.source === 'external') this.playing = false;
			}, 400);
		}
		return () => this.unwatchExternal();
	}

	unwatchExternal(): void {
		this.#unsub?.();
		this.#unsub = null;
		clearInterval(this.#presenceTimer);
		this.#presenceTimer = 0;
		this.externalPresent = false;
	}

	#onIncoming(e: MidiEvent) {
		if (e.direction !== 'in') return;
		const m = e.message;
		if (m.type === 'clock') {
			const now = e.time;
			if (this.#lastClockAt) {
				const delta = now - this.#lastClockAt;
				// Ignore absurd gaps: a paused sender is not jitter.
				if (delta > 0 && delta < 200) {
					this.#clockIntervals.push(delta);
					if (this.#clockIntervals.length > 96) this.#clockIntervals.shift();
					this.#recomputeExternal();
				}
			}
			this.#lastClockAt = now;
			this.externalPresent = true;
			if (this.source === 'external' && this.playing) {
				this.#externalTicks++;
				this.tick = Math.round((this.#externalTicks * PPQ) / CLOCK_PPQ);
				this.#emitExternalTick();
			}
		} else if (m.type === 'start') {
			this.#externalTicks = 0;
			if (this.source === 'external') {
				this.tick = 0;
				this.playing = true;
			}
		} else if (m.type === 'continue') {
			if (this.source === 'external') this.playing = true;
		} else if (m.type === 'stop') {
			if (this.source === 'external') this.playing = false;
		} else if (m.type === 'songPosition') {
			// Song Position Pointer counts sixteenth notes from the start.
			this.#externalTicks = (m.beats * CLOCK_PPQ) / 4;
			this.tick = Math.round((m.beats * PPQ) / 4);
		}
	}

	#recomputeExternal() {
		const xs = this.#clockIntervals;
		if (xs.length < 8) return;
		const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
		const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
		this.externalJitter = Math.sqrt(variance);
		// 24 ticks per quarter note → BPM = 60000 / (mean * 24)
		this.externalBpm = 60000 / (mean * CLOCK_PPQ);
	}

	/** Raw intervals between the last ~96 incoming clock ticks, for the jitter plot. */
	get clockIntervals(): readonly number[] {
		return this.#clockIntervals;
	}

	async start(fromZero = true): Promise<void> {
		if (this.playing) return;
		await audio.resume();
		if (fromZero) this.tick = 0;
		this.#nextTick = this.tick;
		this.#nextTickTime = audio.now + 0.05;
		this.playing = true;
		if (this.sendClock && this.#sendFn) {
			this.#sendFn([fromZero ? 0xfa : 0xfb], performance.now());
		}
		if (this.source === 'internal' && browser) {
			this.#timer = window.setInterval(() => this.#schedule(), INTERVAL_MS);
			this.#schedule();
		}
	}

	stop(): void {
		if (!this.playing) return;
		this.playing = false;
		clearInterval(this.#timer);
		this.#timer = 0;
		if (this.sendClock && this.#sendFn) this.#sendFn([0xfc], performance.now());
	}

	toggle(): void {
		if (this.playing) this.stop();
		else void this.start(false);
	}

	rewind(): void {
		this.tick = 0;
		this.#nextTick = 0;
		this.#externalTicks = 0;
		if (this.sendClock && this.#sendFn) this.#sendFn([0xf2, 0, 0], performance.now());
	}

	#schedule() {
		if (!this.playing || this.source !== 'internal') return;
		const now = audio.now;
		const horizon = now + LOOKAHEAD_MS / 1000;
		const spt = this.secondsPerTick;
		let guard = 0;

		while (this.#nextTickTime < horizon && guard++ < 2000) {
			const tick = this.#nextTick;
			const audioTime = this.#nextTickTime;
			const perfTime = audioToPerf(audioTime);

			// MIDI Clock goes out on the exact tick boundaries the spec expects.
			if (this.sendClock && this.#sendFn && tick % (PPQ / CLOCK_PPQ) === 0) {
				this.#sendFn([0xf8], perfTime);
			}

			for (const l of this.#listeners) l({ tick, audioTime, perfTime });

			this.#nextTick++;
			this.#nextTickTime += spt;

			if (this.loopBars > 0) {
				const len = this.loopBars * this.beatsPerBar * PPQ;
				if (this.#nextTick >= len) this.#nextTick = 0;
			}
		}
		this.tick = this.#nextTick;
	}

	#emitExternalTick() {
		const audioTime = audio.now;
		const perfTime = performance.now();
		for (const l of this.#listeners) l({ tick: this.tick, audioTime, perfTime });
	}

	/** Nudge the tempo by tapping. Averages the last four taps. */
	#taps: number[] = [];
	tap(): void {
		const now = performance.now();
		if (this.#taps.length && now - this.#taps[this.#taps.length - 1] > 2000) this.#taps = [];
		this.#taps.push(now);
		if (this.#taps.length > 5) this.#taps.shift();
		if (this.#taps.length < 2) return;
		const deltas: number[] = [];
		for (let i = 1; i < this.#taps.length; i++) deltas.push(this.#taps[i] - this.#taps[i - 1]);
		const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
		this.bpm = Math.round(Math.min(300, Math.max(20, 60000 / mean)) * 10) / 10;
	}
}

/**
 * Convert an `AudioContext.currentTime` value to the `performance.now()` domain.
 *
 * `getOutputTimestamp()` gives a properly correlated pair when the browser
 * supports it; otherwise we sample both clocks now and assume they tick at the
 * same rate, which is close enough over a 120 ms lookahead window.
 */
export function audioToPerf(audioTime: number): number {
	const ctx = audio.context;
	if (!ctx) return performance.now();
	const ts = ctx.getOutputTimestamp?.();
	if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined) {
		return ts.performanceTime + (audioTime - ts.contextTime) * 1000;
	}
	return performance.now() + (audioTime - ctx.currentTime) * 1000;
}

export const transport = new Transport();
