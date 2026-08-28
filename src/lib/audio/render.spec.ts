import { describe, it, expect } from 'vitest';
import { fft } from './render';

/**
 * A hand-written FFT is plausible-looking whether or not it is right, and the
 * spectrogram it feeds would look like *a* picture either way — bands in the
 * wrong places still read as bands. So it is checked against signals whose
 * answer is known before it is trusted to describe a melody.
 */
describe('the FFT', () => {
	const N = 1024;

	/** Magnitudes of the first half — the only half that means anything real. */
	function spectrum(sample: (i: number) => number) {
		const re = new Float32Array(N);
		const im = new Float32Array(N);
		for (let i = 0; i < N; i++) re[i] = sample(i);
		fft(re, im);
		return Array.from({ length: N / 2 }, (_, k) => Math.hypot(re[k], im[k]));
	}

	it('puts a pure sine in exactly one bin', () => {
		// Sixteen whole cycles across the window, so it lands on bin 16 with no
		// leakage into its neighbours.
		const mag = spectrum((i) => Math.sin((2 * Math.PI * 16 * i) / N));
		const peak = mag.indexOf(Math.max(...mag));
		expect(peak).toBe(16);
		// And everything else is nothing.
		const others = mag.filter((_, k) => k !== 16);
		expect(Math.max(...others)).toBeLessThan(mag[16] / 1000);
	});

	it('finds both components of a two-tone signal, in proportion', () => {
		const mag = spectrum(
			(i) => Math.sin((2 * Math.PI * 8 * i) / N) + 0.5 * Math.sin((2 * Math.PI * 64 * i) / N)
		);
		expect(mag[8]).toBeGreaterThan(mag[64] * 1.9);
		expect(mag[8]).toBeLessThan(mag[64] * 2.1);
		expect(mag[32]).toBeLessThan(mag[8] / 1000);
	});

	it('reports a constant as energy at zero and nowhere else', () => {
		const mag = spectrum(() => 1);
		expect(mag[0]).toBeCloseTo(N, 0);
		expect(Math.max(...mag.slice(1))).toBeLessThan(1e-3);
	});

	it('scales a bin with the amplitude that produced it', () => {
		const quiet = spectrum((i) => 0.25 * Math.sin((2 * Math.PI * 32 * i) / N));
		const loud = spectrum((i) => Math.sin((2 * Math.PI * 32 * i) / N));
		expect(loud[32] / quiet[32]).toBeCloseTo(4, 1);
	});
});
