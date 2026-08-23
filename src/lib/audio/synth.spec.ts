import { describe, it, expect } from 'vitest';
import { timeScale } from './synth';

/**
 * CC 73, 75 and 72 are defined as offsets from the patch rather than as
 * settings, and the whole point of the envelope lesson is that this makes
 * their effect proportional. The properties below are what "relative" has to
 * mean for that to be true.
 */
describe('the Sound Controller time scaling', () => {
	it('leaves the patch alone at the centre of the range', () => {
		expect(timeScale(64)).toBe(1);
	});

	it('never reverses direction', () => {
		const values = Array.from({ length: 128 }, (_, v) => timeScale(v));
		expect(values.every((v, i) => i === 0 || v > values[i - 1])).toBe(true);
	});

	it('shortens below centre and lengthens above it', () => {
		expect(timeScale(0)).toBeLessThan(0.1);
		expect(timeScale(127)).toBeGreaterThan(10);
	});

	it('stays proportional, so a fast patch stays fast', () => {
		// A two-millisecond piano attack at the top of the range is still
		// under a tenth of a second; a pad's is most of a second.
		expect(0.002 * timeScale(127)).toBeLessThan(0.1);
		expect(0.85 * timeScale(127)).toBeGreaterThan(0.5);
	});
});
