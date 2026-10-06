import { describe, expect, it } from 'vitest';
import {
	pairRoughness,
	ratioFromSemitones,
	semitonesFromRatio,
	roughness,
	sampleSurface,
	spectrum,
	triadRoughness
} from './acoustics';

describe('the acoustic landscape', () => {
	it('uses six harmonic or stretched partials with the same relative spectrum for sound and graph', () => {
		expect(spectrum(220, 'pure')).toEqual([{ frequency: 220, amplitude: 1 }]);
		for (const timbre of ['harmonic', 'stretched'] as const) {
			const partials = spectrum(220, timbre);
			expect(partials).toHaveLength(6);
			expect(partials.map((partial) => partial.amplitude)).toEqual([
				1,
				1 / 2,
				1 / 3,
				1 / 4,
				1 / 5,
				1 / 6
			]);
		}
		expect(spectrum(220, 'harmonic')[2].frequency).toBe(660);
		expect(spectrum(220, 'stretched')[2].frequency).toBeGreaterThan(660);
	});

	it('estimates no beating for identical pure tones and less roughness after they separate', () => {
		const note = { frequency: 220, amplitude: 1 };
		expect(pairRoughness(note, note)).toBe(0);
		expect(pairRoughness(note, { ...note, frequency: 240 })).toBeGreaterThan(
			pairRoughness(note, { ...note, frequency: 440 })
		);
	});

	it('has lower harmonic roughness at a just fifth than a nearby mistuned interval', () => {
		expect(roughness([220, 330], 'harmonic')).toBeLessThan(roughness([220, 340], 'harmonic'));
		expect(ratioFromSemitones(12)).toBe(2);
	});

	it('is symmetric in its adjustable tones and changes with the partial spectrum', () => {
		expect(triadRoughness(220, 4, 7, 'harmonic')).toBeCloseTo(
			triadRoughness(220, 7, 4, 'harmonic')
		);
		expect(triadRoughness(220, 4, 7, 'stretched')).not.toBeCloseTo(
			triadRoughness(220, 4, 7, 'harmonic'),
			5
		);
	});

	it('keeps a common height scale and puts each sample at the labelled intervals', () => {
		const surface = sampleSurface(220, 'harmonic', 12);
		expect(surface.values).toHaveLength(13 * 13);
		expect(surface.values[6 * 13 + 3]).toBeCloseTo(
			triadRoughness(220, semitonesFromRatio(1.25), semitonesFromRatio(1.5), 'harmonic'),
			6
		);
		expect(surface.scale).toBe(sampleSurface(220, 'pure', 12).scale);
		expect([...surface.values].every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
	});

	it('matches independently calculated reference landmarks without per-surface normalization', () => {
		const third = semitonesFromRatio(1.25);
		const fifth = semitonesFromRatio(1.5);
		expect(triadRoughness(261.6256, third, fifth, 'harmonic')).toBeCloseTo(0.017368218, 8);
		expect(triadRoughness(130.8128, third, fifth, 'harmonic')).toBeCloseTo(0.038754605, 8);
		expect(triadRoughness(523.2511, third, fifth, 'harmonic')).toBeCloseTo(0.008623875, 8);
		expect(triadRoughness(261.6256, 0, 0, 'harmonic')).toBeCloseTo(0.002074848, 8);
	});
});
