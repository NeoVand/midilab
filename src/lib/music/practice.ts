export interface PracticeNote {
	note: number;
	start: number;
	duration: number;
	velocity?: number;
	channel?: number;
}
export interface PlayedNote {
	note: number;
	start: number;
	duration?: number;
	velocity: number;
	channel: number;
}
export interface NoteFeedback {
	expected: PracticeNote;
	played?: PlayedNote;
	timingMs?: number;
	durationMs?: number;
	problem:
		'correct' | 'early' | 'late' | 'wrong-note' | 'missing' | 'velocity' | 'too-short' | 'too-long';
}
export interface PracticeResult {
	passed: boolean;
	correct: number;
	total: number;
	extra: number;
	notes: NoteFeedback[];
}

/** Match identical pitches near their intended onset, including rolled chords. */
export function evaluatePractice(
	expected: PracticeNote[],
	played: PlayedNote[],
	bpm: number,
	assessVelocity = false,
	assessDuration = false
): PracticeResult {
	const used = new Set<number>();
	const secondsPerBeat = 60 / bpm;
	const tolerance = Math.max(0.14, secondsPerBeat * 0.25);
	const feedback = [...expected]
		.sort((a, b) => a.start - b.start || a.note - b.note)
		.map((target): NoteFeedback => {
			const at = target.start * secondsPerBeat;
			const candidates = played
				.map((note, index) => ({ note, index }))
				.filter(({ index }) => !used.has(index));
			const samePitch = candidates.filter(
				({ note }) => note.note === target.note && note.channel === (target.channel ?? 0)
			);
			const candidate = (samePitch.length ? samePitch : candidates).sort(
				(a, b) => Math.abs(a.note.start - at) - Math.abs(b.note.start - at)
			)[0];
			if (!candidate) return { expected: target, problem: 'missing' };
			used.add(candidate.index);
			const timingMs = Math.round((candidate.note.start - at) * 1000);
			const expectedDuration = target.duration * secondsPerBeat;
			const durationTolerance = Math.max(0.14, expectedDuration * 0.4);
			const durationDifference = (candidate.note.duration ?? 0) - expectedDuration;
			const durationMs = Math.round(durationDifference * 1000);
			const problem =
				candidate.note.note !== target.note || candidate.note.channel !== (target.channel ?? 0)
					? 'wrong-note'
					: Math.abs(timingMs) > tolerance * 1000
						? timingMs < 0
							? 'early'
							: 'late'
						: assessVelocity && Math.abs(candidate.note.velocity - (target.velocity ?? 90)) > 24
							? 'velocity'
							: assessDuration && Math.abs(durationDifference) > durationTolerance
								? durationDifference < 0
									? 'too-short'
									: 'too-long'
								: 'correct';
			return { expected: target, played: candidate.note, timingMs, durationMs, problem };
		});
	const correct = feedback.filter((note) => note.problem === 'correct').length;
	const extra = played.length - used.size;
	return {
		passed: expected.length > 0 && correct === expected.length && extra === 0,
		correct,
		total: expected.length,
		extra,
		notes: feedback
	};
}

/** A key still down at the end has been held through all remaining measured time. */
export function completeHeldNotes(played: PlayedNote[], until: number): PlayedNote[] {
	return played.map((note) =>
		note.duration === undefined ? { ...note, duration: Math.max(0, until - note.start) } : note
	);
}

export function practiceBeats(notes: PracticeNote[]): number {
	return Math.max(
		4,
		Math.ceil(Math.max(0, ...notes.map((note) => note.start + note.duration)) / 4) * 4
	);
}
