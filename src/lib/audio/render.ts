/**
 * Rendering a performance to audio, in the browser, faster than real time.
 *
 * The first lesson makes its whole argument with two numbers: a few hundred
 * bytes of MIDI against a megabyte of audio. Numbers are the weakest possible
 * way to make that point. What settles it is seeing the two side by side — a
 * short column of hex you could read aloud, next to a waveform and a
 * spectrogram of the sound those bytes produced — because then the asymmetry is
 * not a claim, it is a picture.
 *
 * So this renders the same notes the page just played, through the same synth,
 * into an `OfflineAudioContext`, and hands back a buffer to draw. Offline
 * because it finishes in a fraction of the piece's duration and needs no user
 * gesture, and because the result is deterministic: the picture is the same
 * every time, on every machine, which a live capture would not be.
 *
 * ## Why it reuses the real synth
 *
 * The alternative was a small purpose-built oscillator, and it would have been
 * a lie: the waveform under a paragraph saying "this is what you just heard"
 * has to be what you just heard. `SynthHost` exists so the synth can be handed
 * an offline context without knowing the difference, and `presetForProgram`
 * means changing the instrument genuinely changes the shape of the wave.
 */

import { Synth } from './synth';
import { makeImpulse, makeNoise, type SynthHost } from './engine';
import { notesToEvents } from '$lib/midi/player.svelte';
import type { NoteSpec } from '$lib/midi/player.svelte';

/** Mono, and well below CD rate: this is a picture, not a master. */
const SAMPLE_RATE = 22050;
/** Tail beyond the last Note Off, so releases are not clipped mid-decay. */
const TAIL = 1.6;

/**
 * A minimal bus on an offline context.
 *
 * The live engine's chain ends in a limiter, which is right for speakers and
 * wrong here — a limiter flattens exactly the peaks a waveform is drawn to
 * show. Reverb and delay stay, because they are part of how the instrument
 * sounds and leaving them out would draw a different instrument.
 */
class OfflineHost implements SynthHost {
	readonly context: OfflineAudioContext;
	readonly destination: GainNode;
	readonly reverbSend: GainNode;
	readonly delaySend: GainNode;
	readonly noiseBuffer: AudioBuffer;

	constructor(ctx: OfflineAudioContext) {
		this.context = ctx;

		const master = ctx.createGain();
		master.gain.value = 0.75;
		master.connect(ctx.destination);

		const convolver = ctx.createConvolver();
		convolver.buffer = makeImpulse(ctx, 2.4, 2.6);
		const reverbSend = ctx.createGain();
		const reverbReturn = ctx.createGain();
		reverbReturn.gain.value = 0.9;
		reverbSend.connect(convolver).connect(reverbReturn).connect(master);

		const delay = ctx.createDelay(2);
		delay.delayTime.value = 0.34;
		const feedback = ctx.createGain();
		feedback.gain.value = 0.32;
		const damp = ctx.createBiquadFilter();
		damp.type = 'lowpass';
		damp.frequency.value = 2600;
		const delaySend = ctx.createGain();
		const delayReturn = ctx.createGain();
		delayReturn.gain.value = 0.55;
		delaySend.connect(delay);
		delay.connect(damp).connect(feedback).connect(delay);
		delay.connect(delayReturn).connect(master);

		this.destination = master;
		this.reverbSend = reverbSend;
		this.delaySend = delaySend;
		this.noiseBuffer = makeNoise(ctx, 2);
	}

	async resume(): Promise<BaseAudioContext> {
		return this.context;
	}
}

export interface Take {
	/** Peak envelope, one pair per column of the drawing. */
	peaks: { min: number; max: number }[];
	/** Magnitudes in dB, `frames` columns of `bins` rows, 0–1 after scaling. */
	spectrogram: Float32Array;
	frames: number;
	bins: number;
	/** Seconds of audio, tail included. */
	duration: number;
	/** What the same performance costs as CD-rate stereo PCM. */
	audioBytes: number;
	/** Highest frequency a row of the spectrogram can represent. */
	nyquist: number;
}

/**
 * Render, then measure. Returns everything the drawing needs and nothing else —
 * the buffer itself is many megabytes and there is no reason to hold it.
 */
export async function renderTake(
	notes: NoteSpec[],
	bpm: number,
	program: number,
	opts: { columns?: number; frames?: number; bins?: number } = {}
): Promise<Take> {
	const events = notesToEvents(notes, bpm);
	const last = events.reduce((t, e) => Math.max(t, e.time), 0);
	const duration = last + TAIL;

	const ctx = new OfflineAudioContext(1, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
	const host = new OfflineHost(ctx);
	const synth = new Synth(host);
	await synth.ensureStarted();
	synth.handle({ type: 'programChange', channel: 0, program }, 0);

	for (const e of events) {
		// A hair off zero: a Note On exactly at t=0 in an offline context can
		// land before the graph's first block and be dropped.
		synth.handle(e.message, e.time + 0.001);
	}

	const buffer = await ctx.startRendering();
	synth.dispose();

	const data = buffer.getChannelData(0);
	return {
		peaks: envelope(data, opts.columns ?? 900),
		...stft(data, SAMPLE_RATE, opts.frames ?? 320, opts.bins ?? 128),
		duration,
		audioBytes: Math.round(duration * 44100 * 2 * 2),
		nyquist: SAMPLE_RATE / 2
	};
}

/** Min and max per column — the shape a waveform display actually draws. */
function envelope(data: Float32Array, columns: number): { min: number; max: number }[] {
	const per = Math.max(1, Math.floor(data.length / columns));
	const out: { min: number; max: number }[] = [];
	for (let c = 0; c < columns; c++) {
		let min = 0;
		let max = 0;
		const start = c * per;
		const end = Math.min(data.length, start + per);
		for (let i = start; i < end; i++) {
			const v = data[i];
			if (v < min) min = v;
			if (v > max) max = v;
		}
		out.push({ min, max });
	}
	return out;
}

/**
 * Short-time Fourier transform.
 *
 * `AnalyserNode` is the obvious tool and cannot be used: it reports whatever is
 * passing through it *now*, and an offline render has no now. So the transform
 * is done by hand over the finished buffer — which is better anyway, because
 * the frame count can be chosen to match the pixels available rather than to
 * match a frame rate.
 *
 * Rows are spaced logarithmically. Linear frequency bins put four fifths of a
 * spectrogram in the octaves nobody is playing in and squeeze the melody into
 * the bottom few pixels; a log axis is what makes the tune visible as a tune.
 */
function stft(
	data: Float32Array,
	sampleRate: number,
	frames: number,
	bins: number
): { spectrogram: Float32Array; frames: number; bins: number } {
	const size = 1024;
	const half = size / 2;
	const hop = Math.max(1, Math.floor((data.length - size) / frames));
	const out = new Float32Array(frames * bins);

	// Hann, to stop each frame's edges ringing across the whole spectrum.
	const window = new Float32Array(size);
	for (let i = 0; i < size; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));

	const re = new Float32Array(size);
	const im = new Float32Array(size);
	const mag = new Float32Array(half);

	// 20 Hz to just under Nyquist, spread evenly in octaves.
	const lo = Math.log2(20);
	const hi = Math.log2(sampleRate / 2);

	for (let f = 0; f < frames; f++) {
		const start = f * hop;
		for (let i = 0; i < size; i++) {
			const s = start + i;
			re[i] = s < data.length ? data[s] * window[i] : 0;
			im[i] = 0;
		}
		fft(re, im);
		for (let k = 0; k < half; k++) mag[k] = Math.hypot(re[k], im[k]);

		for (let b = 0; b < bins; b++) {
			const freq = 2 ** (lo + ((hi - lo) * b) / (bins - 1));
			const k = Math.min(half - 1, Math.round((freq / (sampleRate / 2)) * half));
			// Average across the bins this row covers, so the top of the picture
			// is not one arbitrary FFT bin standing in for two thousand hertz.
			const kNext = Math.min(
				half,
				Math.max(
					k + 1,
					Math.round((2 ** (lo + ((hi - lo) * (b + 1)) / (bins - 1)) / (sampleRate / 2)) * half)
				)
			);
			let sum = 0;
			for (let i = k; i < kNext; i++) sum += mag[i];
			const avg = sum / (kNext - k);
			// dB, floored at -70: below that is the render's own noise, and
			// showing it turns the quiet half of the picture into grey mush.
			const db = 20 * Math.log10(avg + 1e-9);
			out[f * bins + b] = Math.max(0, Math.min(1, (db + 70) / 70));
		}
	}
	return { spectrogram: out, frames, bins };
}

/**
 * In-place iterative radix-2 FFT. `re` and `im` must be a power of two long.
 *
 * Written out rather than pulled in: it is thirty lines, it runs a few hundred
 * times on one button press, and a dependency for it would be the largest thing
 * in this directory. Exported so it can be checked against signals whose answer
 * is known, which for hand-written numerics is not optional.
 */
export function fft(re: Float32Array, im: Float32Array): void {
	const n = re.length;

	// Bit-reversal permutation.
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) {
			[re[i], re[j]] = [re[j], re[i]];
			[im[i], im[j]] = [im[j], im[i]];
		}
	}

	for (let len = 2; len <= n; len <<= 1) {
		const ang = (-2 * Math.PI) / len;
		const wRe = Math.cos(ang);
		const wIm = Math.sin(ang);
		for (let i = 0; i < n; i += len) {
			let curRe = 1;
			let curIm = 0;
			for (let k = 0; k < len / 2; k++) {
				const uRe = re[i + k];
				const uIm = im[i + k];
				const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
				const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
				re[i + k] = uRe + vRe;
				im[i + k] = uIm + vIm;
				re[i + k + len / 2] = uRe - vRe;
				im[i + k + len / 2] = uIm - vIm;
				const nextRe = curRe * wRe - curIm * wIm;
				curIm = curRe * wIm + curIm * wRe;
				curRe = nextRe;
			}
		}
	}
}
