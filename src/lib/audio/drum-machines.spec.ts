import { describe, expect, it } from 'vitest';
import { DRUM_KITS, drumDescriptor, drumKit, drumSample } from './drum-machines';

describe('portable sampled drum kits', () => {
	it('maps every visible pad and all starter-pattern hits onto real samples', () => {
		for (const kit of DRUM_KITS) {
			const descriptor = drumDescriptor(kit.program);
			for (const note of [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]) {
				expect(descriptor.samples).toContain(drumSample(kit.program, note));
			}
			expect(descriptor.samples.length).toBeLessThan(24);
		}
	});

	it('uses the studio kit for unrecognized GM kit programs and preserves unmapped-note fallback', () => {
		expect(drumKit(127).program).toBe(0);
		expect(drumSample(25, 36)).toBe('kick/bd0050');
		expect(drumSample(0, 100)).toBeUndefined();
	});
});
