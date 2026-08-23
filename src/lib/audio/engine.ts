/**
 * The audio context and master bus.
 *
 * Two rules that matter here and are repeated in Lesson 26:
 *
 * 1. **An AudioContext cannot start without a user gesture.** So the context is
 *    created lazily, on the first note you actually trigger, and `ready` tells
 *    the UI whether sound is possible yet.
 * 2. **Audio time and wall-clock time are different clocks.** Everything
 *    scheduled here uses `ctx.currentTime`, never `Date.now()`. The scheduler in
 *    `midi/clock.ts` is what bridges the two.
 */

import { browser } from '$app/environment';

export interface MasterMeters {
	peak: number;
	rms: number;
}

export class AudioEngine {
	#ctx: AudioContext | null = null;
	#master: GainNode | null = null;
	#analyser: AnalyserNode | null = null;
	#reverbSend: GainNode | null = null;
	#delaySend: GainNode | null = null;
	#noiseBuffer: AudioBuffer | null = null;

	volume = 0.75;

	get ready(): boolean {
		return this.#ctx !== null && this.#ctx.state === 'running';
	}

	get context(): AudioContext | null {
		return this.#ctx;
	}

	get now(): number {
		return this.#ctx?.currentTime ?? 0;
	}

	get destination(): GainNode | null {
		return this.#master;
	}

	get analyser(): AnalyserNode | null {
		return this.#analyser;
	}

	get reverbSend(): GainNode | null {
		return this.#reverbSend;
	}

	get delaySend(): GainNode | null {
		return this.#delaySend;
	}

	get noiseBuffer(): AudioBuffer | null {
		return this.#noiseBuffer;
	}

	/** Idempotent. Safe to call from any input handler. */
	async resume(): Promise<AudioContext | null> {
		if (!browser) return null;
		if (!this.#ctx) this.#build();
		if (this.#ctx && this.#ctx.state !== 'running') {
			try {
				await this.#ctx.resume();
			} catch {
				/* the browser will let us try again on the next gesture */
			}
		}
		return this.#ctx;
	}

	setVolume(v: number): void {
		this.volume = Math.max(0, Math.min(1, v));
		if (this.#master && this.#ctx) {
			this.#master.gain.setTargetAtTime(this.volume, this.#ctx.currentTime, 0.02);
		}
	}

	#build() {
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		const ctx = new Ctor({ latencyHint: 'interactive' });
		this.#ctx = ctx;

		const master = ctx.createGain();
		master.gain.value = this.volume;

		const limiter = ctx.createDynamicsCompressor();
		limiter.threshold.value = -6;
		limiter.knee.value = 6;
		limiter.ratio.value = 12;
		limiter.attack.value = 0.003;
		limiter.release.value = 0.15;

		const analyser = ctx.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.75;

		// --- Reverb: a generated impulse, so nothing has to be downloaded. ---
		const convolver = ctx.createConvolver();
		convolver.buffer = makeImpulse(ctx, 2.4, 2.6);
		const reverbSend = ctx.createGain();
		reverbSend.gain.value = 1;
		const reverbReturn = ctx.createGain();
		reverbReturn.gain.value = 0.9;
		reverbSend.connect(convolver).connect(reverbReturn).connect(master);

		// --- Delay: tempo-agnostic by default; the transport can retime it. ---
		const delay = ctx.createDelay(2);
		delay.delayTime.value = 0.34;
		const feedback = ctx.createGain();
		feedback.gain.value = 0.32;
		const damp = ctx.createBiquadFilter();
		damp.type = 'lowpass';
		damp.frequency.value = 2600;
		const delaySend = ctx.createGain();
		delaySend.gain.value = 1;
		const delayReturn = ctx.createGain();
		delayReturn.gain.value = 0.55;
		delaySend.connect(delay);
		delay.connect(damp).connect(feedback).connect(delay);
		delay.connect(delayReturn).connect(master);

		master.connect(limiter).connect(analyser).connect(ctx.destination);

		this.#master = master;
		this.#analyser = analyser;
		this.#reverbSend = reverbSend;
		this.#delaySend = delaySend;
		this.#noiseBuffer = makeNoise(ctx, 2);
	}

	/** Peak and RMS of the master bus, for the dock meters. */
	meters(): MasterMeters {
		const a = this.#analyser;
		if (!a) return { peak: 0, rms: 0 };
		const buf = new Float32Array(a.fftSize);
		a.getFloatTimeDomainData(buf);
		let peak = 0;
		let sum = 0;
		for (let i = 0; i < buf.length; i++) {
			const v = Math.abs(buf[i]);
			if (v > peak) peak = v;
			sum += buf[i] * buf[i];
		}
		return { peak, rms: Math.sqrt(sum / buf.length) };
	}

	waveform(target: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
		this.#analyser?.getFloatTimeDomainData(target);
		return target;
	}

	spectrum(target: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
		this.#analyser?.getByteFrequencyData(target);
		return target;
	}
}

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
	const rate = ctx.sampleRate;
	const length = Math.floor(rate * seconds);
	const buffer = ctx.createBuffer(2, length, rate);
	for (let c = 0; c < 2; c++) {
		const data = buffer.getChannelData(c);
		for (let i = 0; i < length; i++) {
			const t = i / length;
			// A touch of early-reflection shaping keeps it from sounding like pure noise.
			const envelope = Math.pow(1 - t, decay);
			data[i] = (Math.random() * 2 - 1) * envelope * (i < rate * 0.01 ? 0.3 : 1);
		}
	}
	return buffer;
}

function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
	const length = Math.floor(ctx.sampleRate * seconds);
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
	return buffer;
}

export const audio = new AudioEngine();
