/**
 * An audible click on the transport.
 *
 * The transport could already run, drive the sequencer and send MIDI Clock —
 * but it made no sound of its own, so pressing play did nothing you could hear
 * and nothing obvious you could see. A transport you cannot hear is one you
 * cannot check yourself against, which is the whole point of a metronome.
 *
 * The click is scheduled on the audio clock from the tick's own timestamp, the
 * same discipline as everything else here: never `play it now from a timer`.
 * Two pitches — a higher one on the first beat of the bar — because a click
 * that does not tell you where beat one is only tells you the tempo.
 */

import { audio } from './engine';
import { transport, PPQ } from '$lib/midi/clock.svelte';
import { load, save } from '$lib/stores/persist';

/** Beat one. Deliberately a fifth above the others, not just louder. */
const ACCENT_HZ = 1600;
const BEAT_HZ = 1050;

class Metronome {
	enabled = $state<boolean>(load('metronome', false));
	/** 0–1. Independent of master volume so you can bury it under the music. */
	level = $state<number>(load('metronomeLevel', 0.5));

	#unsub: (() => void) | null = null;

	constructor() {
		$effect.root(() => {
			$effect(() => {
				save('metronome', this.enabled);
				save('metronomeLevel', this.level);
			});
			return () => {};
		});
	}

	toggle(): void {
		this.enabled = !this.enabled;
		if (this.enabled) void audio.resume();
	}

	/** Called once from the layout; safe to call again. */
	start(): () => void {
		if (this.#unsub) return () => this.stop();
		this.#unsub = transport.onTick((t) => this.#onTick(t.tick, t.audioTime));
		return () => this.stop();
	}

	stop(): void {
		this.#unsub?.();
		this.#unsub = null;
	}

	#onTick(tick: number, at: number): void {
		if (!this.enabled || tick % PPQ !== 0) return;
		const beatsPerBar = transport.beatsPerBar;
		const beatInBar = Math.floor(tick / PPQ) % beatsPerBar;
		this.#click(at, beatInBar === 0);
	}

	/**
	 * A short pitched blip with a fast exponential decay. Not a sample — this
	 * app writes its own sound, and a click is two oscillator nodes and an
	 * envelope.
	 */
	#click(at: number, accent: boolean): void {
		const ctx = audio.context;
		const out = audio.destination;
		if (!ctx || !out) return;

		const when = Math.max(at, ctx.currentTime);
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(accent ? ACCENT_HZ : BEAT_HZ, when);

		const peak = this.level * (accent ? 0.5 : 0.32);
		gain.gain.setValueAtTime(0.0001, when);
		gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.001);
		gain.gain.exponentialRampToValueAtTime(0.0001, when + (accent ? 0.055 : 0.04));

		osc.connect(gain).connect(out);
		osc.start(when);
		osc.stop(when + 0.09);
		osc.onended = () => {
			osc.disconnect();
			gain.disconnect();
		};
	}
}

export const metronome = new Metronome();
