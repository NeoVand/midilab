import { describe, it, expect } from 'vitest';
import { chordName, spellNotes, spellingName, vexKey } from './harmony';
import { intervalName } from './notes';

describe('intervalName', () => {
	it('names the simple intervals', () => {
		expect(intervalName(0)).toBe('unison');
		expect(intervalName(4)).toBe('major 3rd');
		expect(intervalName(6)).toBe('tritone');
		expect(intervalName(7)).toBe('perfect 5th');
		expect(intervalName(11)).toBe('major 7th');
	});

	it('names compounds the way musicians say them', () => {
		expect(intervalName(12)).toBe('octave');
		expect(intervalName(14)).toBe('major 9th');
		expect(intervalName(21)).toBe('major 13th');
		expect(intervalName(24)).toBe('two octaves');
	});

	it('falls back to counting octaves past that', () => {
		expect(intervalName(36)).toBe('3 octaves');
		expect(intervalName(28)).toBe('2 octaves + major 3rd');
	});

	it('does not care about direction', () => {
		expect(intervalName(-7)).toBe('perfect 5th');
	});
});

describe('chordName', () => {
	it('needs at least two notes', () => {
		expect(chordName([60])).toBeNull();
		expect(chordName([])).toBeNull();
	});

	it('names triads', () => {
		expect(chordName([60, 64, 67])?.name).toBe('C');
		expect(chordName([60, 63, 67])?.name).toBe('Cm');
		expect(chordName([60, 63, 66])?.name).toBe('C°');
		expect(chordName([60, 64, 68])?.name).toBe('C+');
		expect(chordName([60, 65, 67])?.name).toBe('Csus4');
	});

	it('names sevenths', () => {
		expect(chordName([60, 64, 67, 71])?.name).toBe('Cmaj7');
		expect(chordName([60, 64, 67, 70])?.name).toBe('C7');
		expect(chordName([62, 65, 69, 72])?.name).toBe('Dm7');
		expect(chordName([59, 62, 65, 69])?.name).toBe('Bm7♭5');
	});

	it('spells inversions over their bass note', () => {
		expect(chordName([64, 67, 72])?.name).toBe('C/E');
		expect(chordName([64, 67, 72])?.inversion).toBe(1);
		expect(chordName([67, 72, 76])?.name).toBe('C/G');
		expect(chordName([60, 64, 67])?.inversion).toBe(0);
	});

	it('ignores octave doubling', () => {
		expect(chordName([48, 60, 64, 67, 72])?.name).toBe('C');
	});

	it('names a bare fifth without pretending it has a third', () => {
		const fifth = chordName([60, 67]);
		expect(fifth?.name).toBe('C5');
		expect(fifth?.spoken).toContain('neither major nor minor');
	});

	it('uses flats when asked', () => {
		expect(chordName([61, 65, 68], true)?.name).toBe('D♭');
		expect(chordName([61, 65, 68], false)?.name).toBe('C♯');
	});

	it('returns null rather than forcing a name onto a cluster', () => {
		expect(chordName([60, 61, 62])).toBeNull();
	});
});

describe('spellNotes', () => {
	const show = (notes: number[], flats = false) =>
		spellNotes(notes, flats).map((s) => vexKey(s).key);

	it('spells a minor chord with flats, not sharps', () => {
		// C minor seventh is E flat and B flat. Written as D sharp and A sharp
		// the noteheads sit on the wrong lines entirely.
		expect(show([60, 63, 67, 70])).toEqual(['c/4', 'eb/4', 'g/4', 'bb/4']);
	});

	it('spells a major chord with sharps where the chord calls for them', () => {
		expect(show([62, 66, 69])).toEqual(['d/4', 'f#/4', 'a/4']);
	});

	it('spells a diminished fifth as a flat five, not a sharp four', () => {
		expect(show([59, 62, 65])).toEqual(['b/3', 'd/4', 'f/4']);
		expect(show([60, 63, 66])).toEqual(['c/4', 'eb/4', 'gb/4']);
	});

	it('spells an augmented fifth as a sharp five', () => {
		expect(show([60, 64, 68])).toEqual(['c/4', 'e/4', 'g#/4']);
	});

	it('keeps the octave right when the letter crosses one', () => {
		// B sharp sounds as C but is written on the B line of the octave below.
		const s = spellNotes([60, 63, 67], false);
		expect(s[0].octave).toBe(4);
	});

	it('falls back to the caller preference when it is not a chord', () => {
		expect(show([60, 61, 62])).toEqual(['c/4', 'c#/4', 'd/4']);
		expect(show([60, 61, 62], true)).toEqual(['c/4', 'db/4', 'd/4']);
	});

	it('spells a single note from the preference', () => {
		expect(show([61])).toEqual(['c#/4']);
		expect(show([61], true)).toEqual(['db/4']);
	});
});

describe('spellingName', () => {
	const say = (notes: number[], flats = false) =>
		spellNotes(notes, flats).map((s) => spellingName(s));

	it('agrees with the notation rather than the note number', () => {
		expect(say([60, 63, 67, 70])).toEqual(['C3', 'E♭3', 'G3', 'B♭3']);
	});

	it('follows the octave convention', () => {
		expect(spellingName(spellNotes([60])[0], 'c3')).toBe('C3');
		expect(spellingName(spellNotes([60])[0], 'c4')).toBe('C4');
	});
});
