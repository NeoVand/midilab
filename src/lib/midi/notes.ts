/**
 * Note numbers, names and frequencies.
 *
 * MIDI addresses pitch as a plain integer 0–127. Middle C is *always* note 60 —
 * that part is not ambiguous. What *is* ambiguous is what you call it: Yamaha
 * and Roland historically label note 60 "C3", while scientific pitch notation
 * (and Steinberg, Ableton, Logic) call it "C4". Nothing in the protocol changes;
 * only the sticker on the key does. This module keeps both conventions available
 * so the app can show you the collision instead of pretending it away.
 */

export const NOTE_NAMES_SHARP = [
	'C',
	'C♯',
	'D',
	'D♯',
	'E',
	'F',
	'F♯',
	'G',
	'G♯',
	'A',
	'A♯',
	'B'
] as const;

export const NOTE_NAMES_FLAT = [
	'C',
	'D♭',
	'D',
	'E♭',
	'E',
	'F',
	'G♭',
	'G',
	'A♭',
	'A',
	'B♭',
	'B'
] as const;

export const NOTE_NAMES_ASCII = [
	'C',
	'C#',
	'D',
	'D#',
	'E',
	'F',
	'F#',
	'G',
	'G#',
	'A',
	'A#',
	'B'
] as const;

export const NOTE_NAMES_FLAT_ASCII = [
	'C',
	'Db',
	'D',
	'Eb',
	'E',
	'F',
	'Gb',
	'G',
	'Ab',
	'A',
	'Bb',
	'B'
] as const;

/** Which label gets attached to note 60. `c4` is scientific pitch notation. */
export type OctaveConvention = 'c3' | 'c4';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export const MIDDLE_C = 60;
export const A440 = 69;

export function pitchClass(note: number): number {
	return ((note % 12) + 12) % 12;
}

export function isBlackKey(note: number): boolean {
	return BLACK_KEYS.has(pitchClass(note));
}

/** Octave number under the given labelling convention. */
export function noteOctave(note: number, convention: OctaveConvention = 'c3'): number {
	const base = convention === 'c3' ? 2 : 1;
	return Math.floor(note / 12) - base;
}

export interface NoteNameOptions {
	flats?: boolean;
	/** Use `#`/`b` instead of the typographic ♯/♭. */
	ascii?: boolean;
	convention?: OctaveConvention;
	octave?: boolean;
}

export function noteName(note: number, opts: NoteNameOptions = {}): string {
	const { flats = false, ascii = false, convention = 'c3', octave = true } = opts;
	const pc = pitchClass(note);
	const table = ascii
		? flats
			? NOTE_NAMES_FLAT_ASCII
			: NOTE_NAMES_ASCII
		: flats
			? NOTE_NAMES_FLAT
			: NOTE_NAMES_SHARP;
	const name = table[pc];
	return octave ? `${name}${noteOctave(note, convention)}` : name;
}

/** Equal-tempered frequency in Hz. `a4` lets you retune the reference pitch. */
export function noteToFrequency(note: number, a4 = 440): number {
	return a4 * Math.pow(2, (note - A440) / 12);
}

/** Nearest note number to a frequency, plus how many cents sharp/flat it is. */
export function frequencyToNote(hz: number, a4 = 440): { note: number; cents: number } {
	const exact = A440 + 12 * Math.log2(hz / a4);
	const note = Math.round(exact);
	return { note, cents: Math.round((exact - note) * 100) };
}

const NAME_RE = /^([A-Ga-g])([#♯b♭]?)(-?\d+)$/;

/** Parse "C#3", "Eb4", "F♯-1" back to a note number. Returns null if unparseable. */
export function parseNoteName(input: string, convention: OctaveConvention = 'c3'): number | null {
	const m = NAME_RE.exec(input.trim());
	if (!m) return null;
	const letters: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
	const pc = letters[m[1].toLowerCase()];
	const accidental = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
	const base = convention === 'c3' ? 2 : 1;
	const note = (Number(m[3]) + base) * 12 + pc + accidental;
	return note >= 0 && note <= 127 ? note : null;
}

/** Interval name for a semitone distance, used in the theory-lite lessons. */
export const INTERVAL_NAMES = [
	'unison',
	'minor 2nd',
	'major 2nd',
	'minor 3rd',
	'major 3rd',
	'perfect 4th',
	'tritone',
	'perfect 5th',
	'minor 6th',
	'major 6th',
	'minor 7th',
	'major 7th',
	'octave'
] as const;

/**
 * Distances above an octave keep the compound names musicians actually use —
 * a ninth is a ninth, not "a second plus an octave" — and fall back to
 * counting octaves past the point where the compound names run out.
 */
const COMPOUND_INTERVALS: Record<number, string> = {
	13: 'minor 9th',
	14: 'major 9th',
	15: 'minor 10th',
	16: 'major 10th',
	17: 'perfect 11th',
	18: 'tritone + octave',
	19: 'perfect 12th',
	20: 'minor 13th',
	21: 'major 13th',
	22: 'minor 14th',
	23: 'major 14th',
	24: 'two octaves'
};

export function intervalName(semitones: number): string {
	const a = Math.abs(Math.round(semitones));
	if (a <= 12) return INTERVAL_NAMES[a];
	if (COMPOUND_INTERVALS[a]) return COMPOUND_INTERVALS[a];
	const octaves = Math.floor(a / 12);
	const rest = a % 12;
	return rest === 0 ? `${octaves} octaves` : `${octaves} octaves + ${INTERVAL_NAMES[rest]}`;
}
