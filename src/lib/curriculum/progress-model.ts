import { CHECKPOINTS } from './checkpoint-catalog';

export interface ProgressData {
	version: 2;
	done: Record<string, string[]>;
	manual: Record<string, string[]>;
	visited: string[];
}

export function checkpointIds(lesson: string): readonly string[] {
	return Object.hasOwn(CHECKPOINTS, lesson) ? CHECKPOINTS[lesson] : [];
}

function validRecord(value: unknown): Record<string, string[]> {
	if (!value || typeof value !== 'object') return {};
	return Object.fromEntries(
		Object.entries(value).flatMap(([lesson, ids]) => {
			if (!Array.isArray(ids) || !Object.hasOwn(CHECKPOINTS, lesson)) return [];
			const known = CHECKPOINTS[lesson] ?? [];
			return [
				[
					lesson,
					[
						...new Set(
							ids.filter((id): id is string => typeof id === 'string' && known.includes(id))
						)
					]
				]
			];
		})
	);
}

/** Old checks had no source evidence. Preserve them as self-reported progress. */
export function migrateProgress(value: unknown): ProgressData {
	const stored = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	return {
		version: 2,
		done: stored.version === 2 ? validRecord(stored.done) : {},
		manual: validRecord(stored.version === 2 ? stored.manual : stored.done),
		visited: Array.isArray(stored.visited)
			? stored.visited.filter((id): id is string => typeof id === 'string')
			: []
	};
}

export function checkpointDone(data: ProgressData, lesson: string, id: string): boolean {
	// Read absent keys too: Svelte must observe the first added checkpoint record.
	const verified = data.done[lesson];
	const manual = data.manual[lesson];
	return (
		(Object.hasOwn(data.done, lesson) && Array.isArray(verified) && verified.includes(id)) ||
		(Object.hasOwn(data.manual, lesson) && Array.isArray(manual) && manual.includes(id))
	);
}

export function lessonComplete(data: ProgressData, lesson: string, verifiedOnly = false): boolean {
	const ids = checkpointIds(lesson);
	return (
		ids.length > 0 &&
		ids.every((id) =>
			verifiedOnly ? (data.done[lesson] ?? []).includes(id) : checkpointDone(data, lesson, id)
		)
	);
}

export function progressFraction(data: ProgressData, lessons: string[]): number {
	if (!lessons.length) return 0;
	return (
		lessons.reduce((sum, lesson) => {
			const ids = checkpointIds(lesson);
			return (
				sum +
				(ids.length ? ids.filter((id) => checkpointDone(data, lesson, id)).length / ids.length : 0)
			);
		}, 0) / lessons.length
	);
}
