import { describe, it, expect } from 'vitest';
import { renderTake } from './render';
import { melody, melodyNotes } from '$lib/music/melodies';

/**
 * Runs in a real browser, because `OfflineAudioContext` is the thing under
 * test and there is no honest way to fake it.
 *
 * The bug this exists to catch was invisible: a pad rendered as a handful of
 * quiet blips with three quarters of the take silent, and it looked like a
 * picture — just a sparse one — so nothing about the page said anything was
 * wrong. `Voice.release` was pinning the amplitude envelope to `gain.value`,
 * which is the value *now* rather than at the scheduled release time, so any
 * note released ahead of the clock decayed from a level it had not reached
 * yet. On an instrument whose attack is longer than the note, that level was
 * near zero.
 *
 * The check is therefore about coverage rather than about exact samples: a
 * melody with no rests in it, played on an instrument that sustains, should
 * produce sound almost everywhere.
 */
describe('rendering a take offline', () => {
	const tune = melody('ode-to-joy');
	const notes = melodyNotes('ode-to-joy', { channel: 0 });

	/** Fraction of the drawing's columns that carry any signal at all. */
	function coverage(peaks: { min: number; max: number }[]): number {
		const live = peaks.filter((p) => Math.max(Math.abs(p.min), Math.abs(p.max)) > 0.001);
		return live.length / peaks.length;
	}

	it('sustains a pad across the whole piece', async () => {
		// Program 89 is Pad 2 (warm): 0.6 s attack, 1.6 s release, on a melody
		// whose notes are about half a second long. It should overlap itself into
		// something continuous — this is the one that used to come out at 0.27.
		const take = await renderTake(notes, tune.bpm, 89);
		expect(coverage(take.peaks)).toBeGreaterThan(0.9);
	}, 20_000);

	it('produces sound on every instrument the first lesson offers', async () => {
		const thin: string[] = [];
		for (const program of [0, 11, 19, 40, 48, 56, 73, 81, 89]) {
			const take = await renderTake(notes, tune.bpm, program);
			const peak = Math.max(...take.peaks.map((p) => Math.max(Math.abs(p.min), Math.abs(p.max))));
			if (coverage(take.peaks) < 0.8 || peak < 0.01) {
				thin.push(
					`program ${program}: ${(coverage(take.peaks) * 100).toFixed(0)}% covered, peak ${peak.toFixed(3)}`
				);
			}
		}
		expect(thin).toEqual([]);
	}, 60_000);

	it('reports a duration longer than the notes, so releases are not clipped', async () => {
		const take = await renderTake(notes, tune.bpm, 0);
		const lastNote = Math.max(...notes.map((n) => n.start + n.duration));
		const seconds = (lastNote * 60) / tune.bpm;
		expect(take.duration).toBeGreaterThan(seconds);
	}, 20_000);
});
