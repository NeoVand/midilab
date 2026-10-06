<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { CURRICULUM, actLabel, type LessonMeta } from '$lib/curriculum/registry';
	import { lessonHref, path } from '$lib/nav';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { cn } from '$lib/utils';

	let peek = $state<LessonMeta | null>(null);
</script>

<div class="course-map">
	{#each CURRICULUM as act (act.id)}
		{@const done = act.lessons.filter((lesson) => progress.isLessonComplete(lesson.id)).length}
		{@const complete = done === act.lessons.length}
		<div class={cn('act-row', complete && 'act-complete')}>
			<span class="act-number">Act {actLabel(act.number)}</span>
			<div class="act-copy">
				<a href="{path('/learn')}#{act.id}" class="act-title">{act.title}</a>
				<p class="act-description">
					{#if peek && act.lessons.some((lesson) => lesson.id === peek?.id)}
						<span class="peek-number">Lesson {peek.number}.</span> {peek.title}
					{:else}
						{act.subtitle}
					{/if}
				</p>
			</div>
			<div class="lesson-progress" role="group" aria-label="Lessons in Act {actLabel(act.number)}">
				<div class="lesson-links">
					{#each act.lessons as lesson (lesson.id)}
						{@const isDone = progress.isLessonComplete(lesson.id)}
						<a
							href={lessonHref(lesson)}
							aria-label="Lesson {lesson.number}, {lesson.title}{isDone ? ', completed' : ''}"
							title={lesson.title}
							onmouseenter={() => (peek = lesson)}
							onmouseleave={() => (peek = null)}
							onfocus={() => (peek = lesson)}
							onblur={() => (peek = null)}
							class={cn('lesson-mark', isDone && 'lesson-done')}
						></a>
					{/each}
				</div>
				<span class="progress-count"
					>{done} / {act.lessons.length}<span class="sr-only"> lessons completed</span></span
				>
			</div>
		</div>
	{/each}
</div>

<a href={path('/learn')} class="course-link">
	Explore the full course
	<HugeiconsIcon icon={ArrowRight01Icon} size={14} />
</a>

<style>
	.course-map {
		border: 1px solid var(--landing-line, var(--border));
		border-radius: 0.9rem;
		overflow: hidden;
		background: var(--landing-panel, var(--card));
	}
	.act-row {
		display: grid;
		grid-template-columns: 4.4rem minmax(0, 1fr) 15.8rem;
		align-items: center;
		gap: 1.2rem;
		padding: 1.35rem 1.5rem;
	}
	.act-row + .act-row {
		border-top: 1px solid var(--landing-line, var(--border));
	}
	.act-number {
		align-self: start;
		padding-top: 0.15rem;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
	}
	.act-complete .act-number {
		color: var(--ok);
	}
	.act-title {
		display: inline-block;
		font-size: 0.9375rem;
		font-weight: 550;
		line-height: 1.45;
		letter-spacing: -0.02em;
	}
	.act-title:hover {
		color: var(--landing-accent, var(--foreground));
	}
	.act-description {
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--muted-foreground);
		margin-top: 0.25rem;
	}
	.peek-number {
		color: var(--foreground);
	}
	.lesson-progress {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.lesson-links {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1px;
	}
	.lesson-mark {
		display: grid;
		place-items: center;
		width: 24px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 0.25rem;
	}
	.lesson-mark::before {
		content: '';
		width: 13px;
		height: 15px;
		border-radius: 3px;
		border: 1px solid var(--grid-line-strong);
		background: var(--landing-inset, var(--surface-sunken));
		transition:
			background 140ms ease,
			border-color 140ms ease;
	}
	.lesson-mark:hover::before,
	.lesson-mark:focus-visible::before {
		background: var(--landing-accent-soft, var(--muted));
		border-color: var(--landing-accent, var(--foreground));
	}
	.lesson-done::before {
		background: var(--ok);
		border-color: var(--ok);
	}
	.progress-count {
		flex-shrink: 0;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
		margin-left: auto;
		white-space: nowrap;
	}
	.course-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.1rem;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
	.course-link:hover {
		color: var(--foreground);
	}
	a:focus-visible {
		outline: 2px solid var(--landing-accent, var(--ring));
		outline-offset: 3px;
	}
	@media (max-width: 860px) {
		.act-row {
			grid-template-columns: 3.5rem minmax(0, 1fr);
			gap: 0.35rem 1rem;
			padding: 1.2rem;
		}
		.lesson-progress {
			grid-column: 2;
			justify-content: flex-start;
		}
		.progress-count {
			margin-left: 0.3rem;
		}
	}
	@media (max-width: 460px) {
		.act-row {
			grid-template-columns: 3rem minmax(0, 1fr);
			padding: 1rem;
			gap: 0.25rem 0.7rem;
		}
		.act-description {
			font-size: 0.75rem;
		}
		.lesson-progress {
			flex-wrap: wrap;
			gap: 0.3rem;
		}
		.lesson-mark {
			height: 30px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lesson-mark::before {
			transition: none;
		}
	}
</style>
