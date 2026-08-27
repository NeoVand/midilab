/**
 * A synthesised General MIDI drum kit for channel 10.
 *
 * No samples: every sound is built from oscillators and filtered noise. That is
 * partly so the app stays a single static bundle with nothing to download, and
 * partly because Sixteen channels wants you to hear that channel 10 is a *convention* —
 * the same note numbers that play pitches everywhere else land on percussion
 * here purely because General MIDI says so.
 */

import type { AudioEngine } from './engine';

interface DrumSpec {
	kind: 'kick' | 'snare' | 'hat' | 'tom' | 'cymbal' | 'clap' | 'perc' | 'click';
	freq: number;
	decay: number;
	tone?: number;
}

const KIT: Record<number, DrumSpec> = {
	35: { kind: 'kick', freq: 48, decay: 0.55 },
	36: { kind: 'kick', freq: 55, decay: 0.42 },
	37: { kind: 'click', freq: 1800, decay: 0.06 },
	38: { kind: 'snare', freq: 190, decay: 0.19 },
	39: { kind: 'clap', freq: 1200, decay: 0.24 },
	40: { kind: 'snare', freq: 230, decay: 0.14 },
	41: { kind: 'tom', freq: 90, decay: 0.42 },
	42: { kind: 'hat', freq: 9000, decay: 0.05 },
	43: { kind: 'tom', freq: 110, decay: 0.4 },
	44: { kind: 'hat', freq: 8200, decay: 0.09 },
	45: { kind: 'tom', freq: 140, decay: 0.36 },
	46: { kind: 'hat', freq: 8600, decay: 0.42 },
	47: { kind: 'tom', freq: 175, decay: 0.33 },
	48: { kind: 'tom', freq: 210, decay: 0.3 },
	49: { kind: 'cymbal', freq: 5200, decay: 1.5 },
	50: { kind: 'tom', freq: 260, decay: 0.28 },
	51: { kind: 'cymbal', freq: 7200, decay: 1.1, tone: 0.5 },
	52: { kind: 'cymbal', freq: 4200, decay: 1.8 },
	53: { kind: 'cymbal', freq: 9000, decay: 0.7, tone: 0.3 },
	54: { kind: 'perc', freq: 7000, decay: 0.16 },
	55: { kind: 'cymbal', freq: 6200, decay: 0.8 },
	56: { kind: 'perc', freq: 830, decay: 0.28 },
	57: { kind: 'cymbal', freq: 4800, decay: 1.4 },
	58: { kind: 'perc', freq: 400, decay: 0.4 },
	59: { kind: 'cymbal', freq: 6800, decay: 1 },
	60: { kind: 'perc', freq: 500, decay: 0.18 },
	61: { kind: 'perc', freq: 350, decay: 0.22 },
	62: { kind: 'perc', freq: 300, decay: 0.16 },
	63: { kind: 'perc', freq: 250, decay: 0.24 },
	64: { kind: 'perc', freq: 200, decay: 0.3 },
	65: { kind: 'perc', freq: 320, decay: 0.2 },
	66: { kind: 'perc', freq: 260, decay: 0.24 },
	67: { kind: 'perc', freq: 1400, decay: 0.14 },
	68: { kind: 'perc', freq: 1100, decay: 0.16 },
	69: { kind: 'hat', freq: 6000, decay: 0.14 },
	70: { kind: 'hat', freq: 7000, decay: 0.1 },
	71: { kind: 'perc', freq: 2400, decay: 0.2 },
	72: { kind: 'perc', freq: 2400, decay: 0.5 },
	73: { kind: 'perc', freq: 1600, decay: 0.12 },
	74: { kind: 'perc', freq: 1600, decay: 0.4 },
	75: { kind: 'click', freq: 2500, decay: 0.08 },
	76: { kind: 'click', freq: 1000, decay: 0.1 },
	77: { kind: 'click', freq: 780, decay: 0.12 },
	78: { kind: 'perc', freq: 900, decay: 0.14 },
	79: { kind: 'perc', freq: 700, decay: 0.3 },
	80: { kind: 'perc', freq: 5200, decay: 0.2 },
	81: { kind: 'perc', freq: 5200, decay: 0.9 }
};

export function drumLabel(note: number): DrumSpec | undefined {
	return KIT[note];
}

export function triggerDrum(
	engine: AudioEngine,
	note: number,
	velocity: number,
	out: AudioNode,
	when: number
): void {
	const ctx = engine.context;
	if (!ctx) return;
	const spec = KIT[note] ?? { kind: 'perc' as const, freq: 440, decay: 0.2 };
	const level = (velocity / 127) ** 1.4;
	const t = Math.max(when, ctx.currentTime);

	const amp = ctx.createGain();
	amp.gain.value = 0;
	amp.connect(out);

	const env = (peak: number, decay: number) => {
		amp.gain.setValueAtTime(0, t);
		amp.gain.linearRampToValueAtTime(peak, t + 0.002);
		amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
	};

	const noise = () => {
		const src = ctx.createBufferSource();
		src.buffer = engine.noiseBuffer;
		src.loop = true;
		src.start(t);
		src.stop(t + spec.decay + 0.1);
		return src;
	};

	switch (spec.kind) {
		case 'kick': {
			const osc = ctx.createOscillator();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(spec.freq * 4.5, t);
			osc.frequency.exponentialRampToValueAtTime(spec.freq, t + 0.06);
			osc.connect(amp);
			osc.start(t);
			osc.stop(t + spec.decay + 0.05);
			env(level * 1.1, spec.decay);
			break;
		}
		case 'snare': {
			const osc = ctx.createOscillator();
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(spec.freq, t);
			osc.frequency.exponentialRampToValueAtTime(spec.freq * 0.6, t + spec.decay);
			const oscGain = ctx.createGain();
			oscGain.gain.value = 0.5;
			osc.connect(oscGain).connect(amp);
			osc.start(t);
			osc.stop(t + spec.decay + 0.05);

			const hp = ctx.createBiquadFilter();
			hp.type = 'highpass';
			hp.frequency.value = 1400;
			const nGain = ctx.createGain();
			nGain.gain.value = 0.8;
			noise().connect(hp).connect(nGain).connect(amp);
			env(level, spec.decay);
			break;
		}
		case 'hat':
		case 'cymbal': {
			const hp = ctx.createBiquadFilter();
			hp.type = 'highpass';
			hp.frequency.value = spec.freq * 0.6;
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = spec.freq;
			bp.Q.value = spec.kind === 'hat' ? 1.2 : 0.6;
			noise().connect(hp).connect(bp).connect(amp);
			env(level * (spec.kind === 'hat' ? 0.5 : 0.42), spec.decay);
			break;
		}
		case 'clap': {
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = spec.freq;
			bp.Q.value = 1.4;
			noise().connect(bp).connect(amp);
			// Three fast slaps then a tail — the classic clap trick.
			amp.gain.setValueAtTime(0, t);
			for (let i = 0; i < 3; i++) {
				amp.gain.setValueAtTime(level * 0.7, t + i * 0.011);
				amp.gain.exponentialRampToValueAtTime(0.02, t + i * 0.011 + 0.01);
			}
			amp.gain.setValueAtTime(level * 0.55, t + 0.033);
			amp.gain.exponentialRampToValueAtTime(0.0001, t + spec.decay);
			break;
		}
		case 'tom': {
			const osc = ctx.createOscillator();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(spec.freq * 1.8, t);
			osc.frequency.exponentialRampToValueAtTime(spec.freq, t + spec.decay * 0.5);
			osc.connect(amp);
			osc.start(t);
			osc.stop(t + spec.decay + 0.05);
			env(level, spec.decay);
			break;
		}
		case 'click': {
			const osc = ctx.createOscillator();
			osc.type = 'square';
			osc.frequency.value = spec.freq;
			const g = ctx.createGain();
			g.gain.value = 0.35;
			osc.connect(g).connect(amp);
			osc.start(t);
			osc.stop(t + spec.decay + 0.02);
			env(level * 0.7, spec.decay);
			break;
		}
		default: {
			const osc = ctx.createOscillator();
			osc.type = 'triangle';
			osc.frequency.value = spec.freq;
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = spec.freq;
			bp.Q.value = 3;
			osc.connect(bp).connect(amp);
			osc.start(t);
			osc.stop(t + spec.decay + 0.05);
			env(level * 0.8, spec.decay);
		}
	}
}
