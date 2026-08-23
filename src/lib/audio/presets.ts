/**
 * Timbre presets, indexed by General MIDI *family* (program >> 3).
 *
 * This is not a sample-based GM module and does not pretend to be. It is a
 * small subtractive synth whose sixteen presets are recognisably in the right
 * neighbourhood, so that a Program Change audibly *does something* — which is
 * the entire pedagogical point of Lesson 10. A real device's mapping will
 * differ, and the lesson says so.
 */

export type OscShape = OscillatorType;

export interface Preset {
	name: string;
	osc1: OscShape;
	osc2: OscShape;
	/** Detune of osc2 in cents. Small values thicken; large ones make intervals. */
	detune: number;
	osc2Level: number;
	noise: number;
	/** Amplitude envelope, seconds (sustain is a level 0–1). */
	attack: number;
	decay: number;
	sustain: number;
	release: number;
	/** Base filter cutoff in Hz before CC 74 and velocity scale it. */
	cutoff: number;
	resonance: number;
	/** How far the filter envelope opens the cutoff, in octaves. */
	filterEnv: number;
	filterDecay: number;
	/** Vibrato depth in cents at full mod wheel. */
	vibrato: number;
	vibratoRate: number;
	gain: number;
}

const base: Preset = {
	name: 'Init',
	osc1: 'sawtooth',
	osc2: 'sawtooth',
	detune: 7,
	osc2Level: 0.5,
	noise: 0,
	attack: 0.005,
	decay: 0.25,
	sustain: 0.7,
	release: 0.3,
	cutoff: 2400,
	resonance: 0.8,
	filterEnv: 1.6,
	filterDecay: 0.5,
	vibrato: 40,
	vibratoRate: 5.2,
	gain: 0.8
};

function p(name: string, over: Partial<Preset>): Preset {
	return { ...base, name, ...over };
}

/** One per GM family, in GM order. */
export const FAMILY_PRESETS: Preset[] = [
	p('Piano', {
		osc1: 'triangle',
		osc2: 'sine',
		detune: 3,
		osc2Level: 0.35,
		attack: 0.002,
		decay: 1.6,
		sustain: 0.12,
		release: 0.45,
		cutoff: 4200,
		filterEnv: 1.4,
		filterDecay: 0.9,
		resonance: 0.4
	}),
	p('Chromatic Percussion', {
		osc1: 'sine',
		osc2: 'sine',
		detune: 1200,
		osc2Level: 0.28,
		attack: 0.001,
		decay: 1.1,
		sustain: 0,
		release: 0.9,
		cutoff: 6000,
		filterEnv: 0.6,
		resonance: 0.2
	}),
	p('Organ', {
		osc1: 'square',
		osc2: 'sine',
		detune: 1200,
		osc2Level: 0.4,
		attack: 0.008,
		decay: 0.05,
		sustain: 1,
		release: 0.08,
		cutoff: 3200,
		filterEnv: 0.2,
		resonance: 0.3
	}),
	p('Guitar', {
		osc1: 'sawtooth',
		osc2: 'triangle',
		detune: 5,
		osc2Level: 0.4,
		attack: 0.002,
		decay: 0.9,
		sustain: 0.18,
		release: 0.3,
		cutoff: 3000,
		filterEnv: 2.2,
		filterDecay: 0.35,
		resonance: 0.9
	}),
	p('Bass', {
		osc1: 'sawtooth',
		osc2: 'square',
		detune: -1205,
		osc2Level: 0.5,
		attack: 0.004,
		decay: 0.4,
		sustain: 0.45,
		release: 0.15,
		cutoff: 900,
		filterEnv: 2.4,
		filterDecay: 0.22,
		resonance: 1.6,
		gain: 0.95
	}),
	p('Strings', {
		osc1: 'sawtooth',
		osc2: 'sawtooth',
		detune: 9,
		osc2Level: 0.7,
		attack: 0.18,
		decay: 0.4,
		sustain: 0.85,
		release: 0.6,
		cutoff: 2600,
		filterEnv: 0.9,
		resonance: 0.5,
		vibrato: 26
	}),
	p('Ensemble', {
		osc1: 'sawtooth',
		osc2: 'sawtooth',
		detune: 14,
		osc2Level: 0.8,
		attack: 0.22,
		decay: 0.5,
		sustain: 0.9,
		release: 0.8,
		cutoff: 2200,
		filterEnv: 0.7,
		resonance: 0.4
	}),
	p('Brass', {
		osc1: 'sawtooth',
		osc2: 'sawtooth',
		detune: 6,
		osc2Level: 0.6,
		attack: 0.06,
		decay: 0.3,
		sustain: 0.75,
		release: 0.25,
		cutoff: 1400,
		filterEnv: 2.6,
		filterDecay: 0.6,
		resonance: 1.2
	}),
	p('Reed', {
		osc1: 'square',
		osc2: 'sawtooth',
		detune: 4,
		osc2Level: 0.3,
		noise: 0.05,
		attack: 0.04,
		decay: 0.2,
		sustain: 0.8,
		release: 0.2,
		cutoff: 2000,
		filterEnv: 1.2,
		resonance: 1
	}),
	p('Pipe', {
		osc1: 'triangle',
		osc2: 'sine',
		detune: 2,
		osc2Level: 0.3,
		noise: 0.09,
		attack: 0.05,
		decay: 0.2,
		sustain: 0.85,
		release: 0.22,
		cutoff: 3400,
		filterEnv: 0.8,
		resonance: 0.4
	}),
	p('Synth Lead', {
		osc1: 'sawtooth',
		osc2: 'square',
		detune: 11,
		osc2Level: 0.55,
		attack: 0.005,
		decay: 0.3,
		sustain: 0.65,
		release: 0.2,
		cutoff: 1800,
		filterEnv: 2.8,
		filterDecay: 0.4,
		resonance: 3.2
	}),
	p('Synth Pad', {
		osc1: 'sawtooth',
		osc2: 'triangle',
		detune: 17,
		osc2Level: 0.8,
		attack: 0.6,
		decay: 1.2,
		sustain: 0.8,
		release: 1.6,
		cutoff: 1600,
		filterEnv: 1.4,
		filterDecay: 1.8,
		resonance: 0.9
	}),
	p('Synth Effects', {
		osc1: 'sawtooth',
		osc2: 'sine',
		detune: 700,
		osc2Level: 0.6,
		noise: 0.12,
		attack: 0.3,
		decay: 1.4,
		sustain: 0.5,
		release: 1.4,
		cutoff: 1200,
		filterEnv: 3,
		filterDecay: 2.2,
		resonance: 4
	}),
	p('Ethnic', {
		osc1: 'triangle',
		osc2: 'sawtooth',
		detune: 8,
		osc2Level: 0.35,
		attack: 0.003,
		decay: 0.8,
		sustain: 0.15,
		release: 0.4,
		cutoff: 3000,
		filterEnv: 1.8,
		filterDecay: 0.4,
		resonance: 1.4
	}),
	p('Percussive', {
		osc1: 'triangle',
		osc2: 'square',
		detune: 1900,
		osc2Level: 0.2,
		noise: 0.2,
		attack: 0.001,
		decay: 0.5,
		sustain: 0,
		release: 0.35,
		cutoff: 5000,
		filterEnv: 1.2,
		filterDecay: 0.2,
		resonance: 1
	}),
	p('Sound Effects', {
		osc1: 'sawtooth',
		osc2: 'square',
		detune: 350,
		osc2Level: 0.5,
		noise: 0.4,
		attack: 0.02,
		decay: 1,
		sustain: 0.3,
		release: 0.8,
		cutoff: 1800,
		filterEnv: 2,
		resonance: 2
	})
];

export function presetForProgram(program: number): Preset {
	return FAMILY_PRESETS[Math.floor((program & 0x7f) / 8)] ?? FAMILY_PRESETS[0];
}
