/**
 * An educational estimate of sensory roughness, following Sethares's published
 * kernel with the simplified loudness weighting and three-tone aggregation
 * described by Aatish Bhatia's explorer. Equations are independently implemented;
 * see https://sethares.engr.wisc.edu/comprog.html and https://aatishb.com/dissonance/.
 * This is not a
 * model of harmonic function, musical quality, preference, or emotion.
 */
export type TimbreId = 'pure' | 'harmonic' | 'stretched';
export interface Partial {
	frequency: number;
	amplitude: number;
}
export const TIMBRES: { id: TimbreId; label: string; description: string }[] = [
	{ id: 'pure', label: 'Pure tones', description: 'One sine wave per note; no upper partials.' },
	{
		id: 'harmonic',
		label: 'Harmonic partials',
		description:
			'Six partials at whole-number multiples of each note, with relative amplitudes 1/n.'
	},
	{
		id: 'stretched',
		label: 'Stretched partials',
		description:
			'A synthetic spectrum with upper partials stretched away from whole-number multiples.'
	}
];

export const ratioFromSemitones = (semitones: number): number => 2 ** (semitones / 12);
export const semitonesFromRatio = (ratio: number): number => 12 * Math.log2(ratio);

/** Relative spectrum; a common listening gain is applied by the sound generator. */
export function spectrum(frequency: number, timbre: TimbreId): Partial[] {
	if (!Number.isFinite(frequency) || frequency <= 0) return [];
	if (timbre === 'pure') return [{ frequency, amplitude: 1 }];
	return Array.from({ length: 6 }, (_, index) => {
		const harmonic = index + 1;
		return {
			frequency: frequency * harmonic ** (timbre === 'stretched' ? 1.22 : 1),
			amplitude: 1 / harmonic
		};
	});
}

interface WeightedPartial {
	frequency: number;
	weight: number;
}

const loudnessExponent = (2 * Math.log(2)) / Math.log(10);
const weightedSpectrum = (partials: Partial[]): WeightedPartial[] =>
	partials.map(({ frequency, amplitude }) => ({
		frequency,
		weight: amplitude ** loudnessExponent / 16
	}));

function pairKernel(first: WeightedPartial, second: WeightedPartial): number {
	const delta = Math.abs(first.frequency - second.frequency);
	const scale = 0.24 / (0.0207 * Math.min(first.frequency, second.frequency) + 18.96);
	return (
		Math.min(first.weight, second.weight) *
		(Math.exp(-3.51 * scale * delta) - Math.exp(-5.75 * scale * delta))
	);
}

export function pairRoughness(first: Partial, second: Partial): number {
	const [a, b] = weightedSpectrum([first, second]);
	return pairKernel(a, b);
}

function withinTone(partials: WeightedPartial[]): number {
	let total = 0;
	for (let i = 0; i < partials.length; i++) {
		for (let j = i + 1; j < partials.length; j++) total += pairKernel(partials[i], partials[j]);
	}
	return total;
}

function betweenTones(first: WeightedPartial[], second: WeightedPartial[]): number {
	let total = 0;
	for (const a of first) for (const b of second) total += pairKernel(a, b);
	return total;
}

/** Sum unique internal pairs plus half the complete cross-tone interactions. */
export function roughness(frequencies: number[], timbre: TimbreId): number {
	const tones = frequencies.map((frequency) => weightedSpectrum(spectrum(frequency, timbre)));
	let total = tones.reduce((sum, partials) => sum + withinTone(partials), 0);
	for (let i = 0; i < tones.length; i++) {
		for (let j = i + 1; j < tones.length; j++) total += 0.5 * betweenTones(tones[i], tones[j]);
	}
	return total;
}

export function triadRoughness(
	baseHz: number,
	aSemitones: number,
	bSemitones: number,
	timbre: TimbreId
): number {
	return roughness(
		[baseHz, baseHz * ratioFromSemitones(aSemitones), baseHz * ratioFromSemitones(bSemitones)],
		timbre
	);
}

/** One fixed height/color scale across every preset and register. No per-mesh renormalization. */
export const ROUGHNESS_SCALE = 0.075;
export interface RoughnessSurface {
	/** Linear frequency-ratio axes, 1–2. Values has (steps + 1)² samples. */
	steps: number;
	values: Float32Array;
	min: number;
	max: number;
	scale: number;
}

export function sampleSurface(baseHz: number, timbre: TimbreId, steps = 192): RoughnessSurface {
	const segments = Number.isFinite(steps) ? Math.max(8, Math.min(256, Math.round(steps))) : 192;
	const values = new Float32Array((segments + 1) ** 2);
	const base = weightedSpectrum(spectrum(baseHz, timbre));
	const tones = Array.from({ length: segments + 1 }, (_, index) =>
		weightedSpectrum(spectrum(baseHz * (1 + index / segments), timbre))
	);
	// Cache each single-tone term. Only the interaction of the moving tones
	// varies across both axes, keeping dense surfaces practical on phones.
	const internal = tones.map(withinTone);
	const withBase = tones.map((tone) => 0.5 * betweenTones(base, tone));
	const baseInternal = withinTone(base);
	let min = Infinity;
	let max = 0;
	for (let b = 0; b <= segments; b++) {
		for (let a = 0; a <= segments; a++) {
			const value =
				baseInternal +
				internal[a] +
				internal[b] +
				withBase[a] +
				withBase[b] +
				0.5 * betweenTones(tones[a], tones[b]);
			values[b * (segments + 1) + a] = value;
			min = Math.min(min, value);
			max = Math.max(max, value);
		}
	}
	return { steps: segments, values, min, max, scale: ROUGHNESS_SCALE };
}
