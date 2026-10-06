import { describe, expect, it } from 'vitest';
import { CIRCLE_KEYS, cadence, majorKey } from './harmony';

describe('the harmonic compass', () => {
	it('covers all pitch classes in fifths, including the enharmonic boundary', () => {
		expect(new Set(CIRCLE_KEYS.map((key) => key.tonicPc)).size).toBe(12);
		for (let i = 0; i < CIRCLE_KEYS.length; i++) {
			expect((majorKey(i + 1).tonicPc - majorKey(i).tonicPc + 12) % 12).toBe(7);
			const current = new Set(majorKey(i).chords.map((chord) => chord.rootPc));
			expect(majorKey(i + 1).chords.filter((chord) => current.has(chord.rootPc))).toHaveLength(6);
		}
	});

	it('spells sharp and flat keys by scale degree rather than using accidental aliases', () => {
		expect(majorKey(6).scale).toEqual(['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']);
		expect(majorKey(7).scale).toEqual(['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C']);
		expect(majorKey(0).relativeMinor).toBe('A minor');
		expect(majorKey(0).parallelMinor).toBe('C minor');
		expect(majorKey(-1).signatureText).toBe('1 flat');
	});

	it('builds only the selected major key’s diatonic triads', () => {
		for (const key of CIRCLE_KEYS) {
			const scale = new Set(key.chords.map((chord) => chord.rootPc));
			for (const chord of key.chords) {
				expect(chord.notes.every((note) => scale.has(note % 12))).toBe(true);
			}
			expect(key.chords.map((chord) => chord.quality)).toEqual([
				'major',
				'minor',
				'minor',
				'major',
				'major',
				'minor',
				'diminished'
			]);
		}
	});

	it('preserves chord identities when a cadence uses smoother inversions', () => {
		for (let index = 0; index < 12; index++) {
			for (const ending of ['home', 'surprise'] as const) {
				const route = cadence(index, ending);
				expect(route.map((chord) => chord.roman)).toEqual([
					'ii',
					'V',
					ending === 'home' ? 'I' : 'vi'
				]);
				for (const chord of route) {
					const original = majorKey(index).chords[chord.degree - 1];
					expect(chord.notes.map((note) => note % 12).sort()).toEqual(
						original.notes.map((note) => note % 12).sort()
					);
				}
			}
		}
	});
});
