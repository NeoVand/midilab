/**
 * Progress, driven by checkpoints rather than by clicking Next.
 *
 * A checkpoint is an assertion about the MIDI stream: "a Note On with velocity
 * above 100 arrived on channel 3". The verifier watches the bus and ticks it off
 * when it actually happens. You cannot complete a lesson by scrolling past it,
 * and — more usefully — a lesson can tell you *precisely* what it is waiting for
 * while you fiddle with your hardware.
 */

import { load, save } from '$lib/stores/persist';

interface Stored {
	done: Record<string, string[]>;
	visited: string[];
}

class Progress {
	#state = $state<Stored>(load('progress', { done: {}, visited: [] }));
	/** Checkpoints declared by whichever lesson is currently mounted. */
	#registered = $state<Record<string, string[]>>({});

	get visited(): string[] {
		return this.#state.visited;
	}

	visit(lessonId: string): void {
		if (this.#state.visited.includes(lessonId)) return;
		this.#state = { ...this.#state, visited: [...this.#state.visited, lessonId] };
		this.#persist();
	}

	register(lessonId: string, checkpointId: string): void {
		const list = this.#registered[lessonId] ?? [];
		if (list.includes(checkpointId)) return;
		this.#registered = { ...this.#registered, [lessonId]: [...list, checkpointId] };
	}

	unregister(lessonId: string, checkpointId: string): void {
		const list = this.#registered[lessonId];
		if (!list) return;
		this.#registered = { ...this.#registered, [lessonId]: list.filter((c) => c !== checkpointId) };
	}

	isDone(lessonId: string, checkpointId: string): boolean {
		return (this.#state.done[lessonId] ?? []).includes(checkpointId);
	}

	complete(lessonId: string, checkpointId: string): void {
		if (this.isDone(lessonId, checkpointId)) return;
		const list = this.#state.done[lessonId] ?? [];
		this.#state = {
			...this.#state,
			done: { ...this.#state.done, [lessonId]: [...list, checkpointId] }
		};
		this.#persist();
	}

	/** Manual override, for when the hardware simply will not cooperate. */
	toggle(lessonId: string, checkpointId: string): void {
		if (this.isDone(lessonId, checkpointId)) {
			const list = (this.#state.done[lessonId] ?? []).filter((c) => c !== checkpointId);
			this.#state = { ...this.#state, done: { ...this.#state.done, [lessonId]: list } };
			this.#persist();
		} else {
			this.complete(lessonId, checkpointId);
		}
	}

	doneCount(lessonId: string): number {
		return (this.#state.done[lessonId] ?? []).length;
	}

	/** Total checkpoints for a lesson: live count if mounted, remembered otherwise. */
	totalFor(lessonId: string): number {
		return this.#registered[lessonId]?.length ?? 0;
	}

	isLessonComplete(lessonId: string): boolean {
		const total = this.totalFor(lessonId);
		if (total > 0) return this.doneCount(lessonId) >= total;
		return this.doneCount(lessonId) > 0;
	}

	/** Fraction 0–1 across a set of lessons, weighting each lesson equally. */
	fractionOf(lessonIds: string[]): number {
		if (lessonIds.length === 0) return 0;
		let sum = 0;
		for (const id of lessonIds) {
			const total = this.totalFor(id);
			if (total > 0) sum += Math.min(1, this.doneCount(id) / total);
			else if (this.doneCount(id) > 0) sum += 1;
			else if (this.#state.visited.includes(id)) sum += 0.15;
		}
		return sum / lessonIds.length;
	}

	reset(): void {
		this.#state = { done: {}, visited: [] };
		this.#persist();
	}

	#persist() {
		save('progress', this.#state);
	}
}

export const progress = new Progress();
