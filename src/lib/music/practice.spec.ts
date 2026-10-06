import { describe, expect, it } from 'vitest';
import { completeHeldNotes, evaluatePractice, practiceBeats } from './practice';

const phrase = [
	{ note: 60, start: 0, duration: 0.5 },
	{ note: 62, start: 1, duration: 0.5 }
];
describe('musical practice feedback', () => {
	it('checks physical key duration when rests and articulation are the objective', () => {
		const expected = [
			{ note: 60, start: 0, duration: 0.3 },
			{ note: 64, start: 2, duration: 1.5 }
		];
		const played = [
			{ note: 60, start: 0, duration: 2, velocity: 90, channel: 0 },
			{ note: 64, start: 2, duration: 0.1, velocity: 90, channel: 0 }
		];
		const result = evaluatePractice(expected, played, 60, false, true);
		expect(result.notes.map((note) => note.problem)).toEqual(['too-long', 'too-short']);
		expect(result.passed).toBe(false);
		expect(evaluatePractice(expected, played, 60).passed).toBe(true);
	});
	it('accepts expressive duration variation within a forgiving tolerance', () => {
		const expected = [{ note: 60, start: 0, duration: 1 }];
		expect(
			evaluatePractice(
				expected,
				[{ note: 60, start: 0, duration: 0.75, velocity: 90, channel: 0 }],
				60,
				false,
				true
			).passed
		).toBe(true);
	});
	it('counts an unreleased key through the end of the attempt', () => {
		const played = completeHeldNotes([{ note: 60, start: 0, velocity: 90, channel: 0 }], 4);
		expect(played[0].duration).toBe(4);
		expect(
			evaluatePractice([{ note: 60, start: 0, duration: 0.3 }], played, 60, false, true).notes[0]
				.problem
		).toBe('too-long');
	});
	it('requires the entire phrase with correct pitches and timing', () => {
		expect(
			evaluatePractice(
				phrase,
				[
					{ note: 60, start: 0.03, velocity: 90, channel: 0 },
					{ note: 62, start: 0.51, velocity: 90, channel: 0 }
				],
				120
			).passed
		).toBe(true);
	});
	it('reports early, late, missing and extra notes rather than giving completion credit', () => {
		const result = evaluatePractice(
			phrase,
			[
				{ note: 60, start: -0.2, velocity: 90, channel: 0 },
				{ note: 62, start: 0.9, velocity: 90, channel: 0 },
				{ note: 64, start: 1, velocity: 90, channel: 0 }
			],
			120
		);
		expect(result.notes.map((note) => note.problem)).toEqual(['early', 'late']);
		expect(result.extra).toBe(1);
		expect(result.passed).toBe(false);
		expect(
			evaluatePractice(phrase, [], 120).notes.every((note) => note.problem === 'missing')
		).toBe(true);
	});
	it('recognises a chord even if the fingers arrive in another order', () => {
		const chord = [60, 64, 67].map((note) => ({ note, start: 0, duration: 1 }));
		const played = [67, 60, 64].map((note, index) => ({
			note,
			start: index * 0.03,
			velocity: 90,
			channel: 0
		}));
		expect(evaluatePractice(chord, played, 90).passed).toBe(true);
	});
	it('does not mistake a melodic note for a drum with the same number', () => {
		expect(
			evaluatePractice(
				[{ note: 36, start: 0, duration: 0.2, channel: 9 }],
				[{ note: 36, start: 0, velocity: 90, channel: 0 }],
				90
			).notes[0].problem
		).toBe('wrong-note');
	});
	it('can require dynamic contrast and keeps rests in the measured bar', () => {
		expect(
			evaluatePractice(
				[{ note: 60, start: 0, duration: 1, velocity: 40 }],
				[{ note: 60, start: 0, velocity: 110, channel: 0 }],
				90,
				true
			).passed
		).toBe(false);
		expect(practiceBeats([{ note: 60, start: 6, duration: 0.5 }])).toBe(8);
	});
});
