import { describe, expect, it } from 'vitest';
import { degreeToNote, euclid, euclidString, parsePattern, queryCycle } from './index';

describe('euclidean rhythms', () => {
	it('produces the canonical patterns', () => {
		// These are the well-known ones from Toussaint's paper.
		expect(euclidString(3, 8)).toBe('x..x..x.');
		expect(euclidString(5, 8)).toBe('x.xx.xx.');
		expect(euclidString(2, 5)).toBe('x.x..');
		expect(euclidString(4, 4)).toBe('xxxx');
		expect(euclidString(0, 4)).toBe('....');
	});

	it('always places exactly the requested number of pulses', () => {
		for (let steps = 1; steps <= 16; steps++) {
			for (let pulses = 0; pulses <= steps; pulses++) {
				expect(euclid(pulses, steps).filter(Boolean)).toHaveLength(pulses);
			}
		}
	});

	it('rotates without changing the pulse count', () => {
		const base = euclid(3, 8);
		const rotated = euclid(3, 8, 2);
		expect(rotated.filter(Boolean)).toHaveLength(3);
		expect(rotated).toEqual([...base.slice(2), ...base.slice(0, 2)]);
	});
});

describe('mini-notation', () => {
	const times = (src: string, cycle = 0) =>
		queryCycle(parsePattern(src), cycle).map((h) => [h.value, Number(h.begin.toFixed(4))]);

	it('divides a cycle evenly', () => {
		expect(times('bd sd hh sd')).toEqual([
			['bd', 0],
			['sd', 0.25],
			['hh', 0.5],
			['sd', 0.75]
		]);
	});

	it('treats ~ as a rest', () => {
		expect(times('bd ~ sd ~')).toEqual([
			['bd', 0],
			['sd', 0.5]
		]);
	});

	it('subdivides with brackets', () => {
		expect(times('bd [sd sd]')).toEqual([
			['bd', 0],
			['sd', 0.5],
			['sd', 0.75]
		]);
	});

	it('repeats with *', () => {
		expect(times('bd*4')).toEqual([
			['bd', 0],
			['bd', 0.25],
			['bd', 0.5],
			['bd', 0.75]
		]);
	});

	it('alternates between cycles with <>', () => {
		expect(times('<bd sd>', 0)).toEqual([['bd', 0]]);
		expect(times('<bd sd>', 1)).toEqual([['sd', 0]]);
		expect(times('<bd sd>', 2)).toEqual([['bd', 0]]);
	});

	it('stacks with a comma', () => {
		const haps = times('bd*2,hh*4');
		expect(haps.filter(([v]) => v === 'bd')).toHaveLength(2);
		expect(haps.filter(([v]) => v === 'hh')).toHaveLength(4);
	});

	it('applies euclidean notation', () => {
		expect(times('bd(3,8)')).toEqual([
			['bd', 0],
			['bd', 0.375],
			['bd', 0.75]
		]);
	});

	it('rejects malformed input rather than guessing', () => {
		expect(() => parsePattern('bd [sd')).toThrow();
		expect(() => parsePattern('bd(3)')).toThrow();
	});
});

describe('scales', () => {
	it('walks a minor scale and wraps by octave', () => {
		expect(degreeToNote(0, 60, 'minor')).toBe(60);
		expect(degreeToNote(2, 60, 'minor')).toBe(63);
		expect(degreeToNote(7, 60, 'minor')).toBe(72);
		expect(degreeToNote(-1, 60, 'minor')).toBe(58);
	});
});
