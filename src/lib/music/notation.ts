/**
 * A tiny notation for writing melodies in source.
 *
 * The alternative is arrays of `{ note: 76, start: 3.25, duration: 0.25 }`,
 * and a forty-note phrase written that way is unreadable, unreviewable, and
 * impossible to transpose without recomputing every `start` by hand. One
 * mistyped start time silently shifts everything after it.
 *
 * So melodies are written the way a musician would dictate them — pitches in
 * order, durations only where they change, bar lines for the eye — and the
 * start times are computed. The same reasoning as the rest of this codebase:
 * the parser is thirty lines, and reading it is cheaper than trusting a table.
 *
 * ```
 * E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/.5 D4/2
 * ```
 *
 * Grammar, one token at a time:
 *
 * | Token          | Means                                              |
 * | -------------- | -------------------------------------------------- |
 * | `C4`           | middle C for one beat                              |
 * | `F#5` `Eb3`    | accidentals, either spelling                       |
 * | `C4/0.5`       | half a beat                                        |
 * | `_/2`          | two beats of silence                               |
 * | `C4+E4+G4/2`   | a chord — all three notes, same start and length   |
 * | `C4>`          | accented                                           |
 * | `C4-`          | ghost: much quieter than its neighbours            |
 * | `C4.`          | staccato: sounds for a third of its written length  |
 * | `|`            | bar line. Ignored; there for whoever reads this     |
 *
 * Durations are in beats and persist until changed, because in real music
 * they mostly do not change: a run of sixteenths is `/0.25` once, not sixteen
 * times.
 */

import { parseNoteName } from '$lib/midi/notes';
import type { NoteSpec } from '$lib/midi/player.svelte';

export interface ParseOptions {
	/** Default velocity for an unmarked note. */
	velocity?: number;
	/** Channel for every note in the phrase. */
	channel?: number;
	/**
	 * Fraction of its written length a note actually sounds. Slightly under 1
	 * so repeated pitches re-articulate instead of running together — a
	 * detail that is the difference between a phrase and a drone.
	 */
	gate?: number;
	/** Semitones to shift the whole phrase. */
	transpose?: number;
}

const ACCENT = 18;
const GHOST = -34;
const STACCATO_GATE = 0.34;

/** Parse the notation above into timed notes, in beats. */
export function phrase(source: string, opts: ParseOptions = {}): NoteSpec[] {
	const { velocity = 88, channel = 0, gate = 0.9, transpose = 0 } = opts;

	const out: NoteSpec[] = [];
	let at = 0;
	let duration = 1;

	for (const raw of source.split(/\s+/)) {
		const token = raw.trim();
		if (!token || token === '|') continue;

		// Articulation marks come off the end before anything else is read, so
		// that `C4/0.5>` and `C4>` both work and neither confuses the pitch.
		let body = token;
		let vel = velocity;
		let noteGate = gate;
		for (;;) {
			const last = body[body.length - 1];
			if (last === '>') vel += ACCENT;
			else if (last === '-') vel += GHOST;
			else if (last === '.') noteGate = STACCATO_GATE;
			else break;
			body = body.slice(0, -1);
		}

		const slash = body.lastIndexOf('/');
		if (slash > 0) {
			const parsed = Number(body.slice(slash + 1));
			if (!Number.isFinite(parsed) || parsed <= 0) {
				throw new Error(`Bad duration in “${token}”`);
			}
			duration = parsed;
			body = body.slice(0, slash);
		}

		if (body === '_') {
			at += duration;
			continue;
		}

		for (const name of body.split('+')) {
			const note = parseNoteName(name, 'c4');
			if (note === null) throw new Error(`Unparseable pitch “${name}” in “${token}”`);
			const shifted = note + transpose;
			// A transposition that walks off the end of the range is a bug in the
			// caller, not something to clamp silently into a wrong note.
			if (shifted < 0 || shifted > 127) {
				throw new Error(`“${name}” transposed by ${transpose} lands outside 0–127`);
			}
			out.push({
				note: shifted,
				start: at,
				duration: duration * noteGate,
				velocity: Math.max(1, Math.min(127, Math.round(vel))),
				channel
			});
		}
		at += duration;
	}

	return out;
}

/** Total length of a phrase in beats, including the tail of the last note. */
export function phraseBeats(notes: NoteSpec[]): number {
	return notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
}

/** Shift every note by a number of beats — for stacking phrases end to end. */
export function after(beats: number, notes: NoteSpec[]): NoteSpec[] {
	return notes.map((n) => ({ ...n, start: n.start + beats }));
}

/** Put phrases on top of each other, unchanged. */
export function together(...parts: NoteSpec[][]): NoteSpec[] {
	return parts.flat().sort((a, b) => a.start - b.start);
}
