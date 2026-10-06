import { load, save } from '$lib/stores/persist';
import {
	checkpointDone,
	checkpointIds,
	lessonComplete,
	migrateProgress,
	progressFraction
} from './progress-model';

export class Progress {
	#state = $state(migrateProgress(load('progress', {})));

	get visited(): string[] {
		return this.#state.visited;
	}
	visit(lesson: string): void {
		if (this.#state.visited.includes(lesson)) return;
		this.#state.visited = [...this.#state.visited, lesson];
		this.#persist();
	}

	/** Catalog totals outlive mounted components and are independent of navigation. */
	isDone(lesson: string, id: string): boolean {
		return checkpointDone(this.#state, lesson, id);
	}
	isVerified(lesson: string, id: string): boolean {
		const verified = this.#state.done[lesson];
		return (
			Object.hasOwn(this.#state.done, lesson) && Array.isArray(verified) && verified.includes(id)
		);
	}
	complete(lesson: string, id: string): void {
		if (!checkpointIds(lesson).includes(id) || this.isVerified(lesson, id)) return;
		this.#state.done[lesson] = [...(this.#state.done[lesson] ?? []), id];
		this.#state.manual[lesson] = (this.#state.manual[lesson] ?? []).filter((item) => item !== id);
		this.#persist();
	}
	/** A manual check records self-assessment, never a verified performance. */
	toggle(lesson: string, id: string): void {
		if (!checkpointIds(lesson).includes(id)) return;
		if (this.isDone(lesson, id)) {
			this.#state.done[lesson] = (this.#state.done[lesson] ?? []).filter((item) => item !== id);
			this.#state.manual[lesson] = (this.#state.manual[lesson] ?? []).filter((item) => item !== id);
		} else this.#state.manual[lesson] = [...(this.#state.manual[lesson] ?? []), id];
		this.#persist();
	}
	doneCount(lesson: string): number {
		return checkpointIds(lesson).filter((id) => this.isDone(lesson, id)).length;
	}
	totalFor(lesson: string): number {
		return checkpointIds(lesson).length;
	}
	isLessonComplete(lesson: string): boolean {
		return lessonComplete(this.#state, lesson);
	}
	isLessonVerified(lesson: string): boolean {
		return lessonComplete(this.#state, lesson, true);
	}
	fractionOf(lessons: string[]): number {
		return progressFraction(this.#state, lessons);
	}
	reset(): void {
		this.#state = migrateProgress({});
		this.#persist();
	}
	#persist(): void {
		save('progress', this.#state);
	}
}

export const progress = new Progress();
