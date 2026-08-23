<script lang="ts">
	/**
	 * The whole course, as a map rather than a grid of cards.
	 *
	 * Six acts in a fixed order, every lesson in a fixed order — a sequence,
	 * and a card grid is the one layout that throws a sequence away. Each act is
	 * a row; each lesson is a pip you can hover to name and click to open. So
	 * the section shows where the course goes, how far along you are, and gives
	 * a way into any one of them from the front page.
	 */
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { CURRICULUM, ACT_ICON, type LessonMeta } from '$lib/curriculum/registry';
	import { lessonHref, path } from '$lib/nav';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { cn } from '$lib/utils';

	/** The lesson under the cursor, whose title takes over its act's subtitle. */
	let peek = $state<LessonMeta | null>(null);

	const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
</script>

<div class="divide-y rounded-lg border">
	{#each CURRICULUM as act, a (act.id)}
		{@const done = act.lessons.filter((l) => progress.isLessonComplete(l.id)).length}
		{@const complete = done === act.lessons.length}
		<div class="grid grid-cols-[auto_1fr] gap-x-3.5 px-4 py-3.5 sm:grid-cols-[auto_1fr_auto]">
			<span class="row-span-2 mt-1 grid size-6 shrink-0 place-items-center self-start">
				<HugeiconsIcon
					icon={ACT_ICON[act.id]}
					size={18}
					strokeWidth={1.6}
					class={complete ? 'text-ok' : 'text-muted-foreground'}
				/>
			</span>

			<div class="flex min-w-0 items-baseline gap-2.5">
				<span class="label shrink-0">Act {ROMAN[a]}</span>
				<a
					href="{path('/learn')}#{act.id}"
					class="truncate leading-snug font-medium hover:underline hover:underline-offset-4"
				>
					{act.title}
				</a>
			</div>

			<!--
				The lessons. Ordered, so their order is visible; individually
				reachable, so this is a way in and not just a status bar. Left
				aligned in a fixed column, so the row lengths themselves read as
				how long each act is — right-aligning them throws that away and
				leaves a ragged edge that means nothing.
			-->
			<div
				class="col-start-2 mt-2.5 flex flex-wrap items-center gap-1 sm:col-start-3 sm:row-span-2 sm:mt-0 sm:w-[9.75rem] sm:self-center"
			>
				{#each act.lessons as l (l.id)}
					{@const isDone = progress.isLessonComplete(l.id)}
					<a
						href={lessonHref(l)}
						aria-label="Lesson {l.number}, {l.title}"
						onmouseenter={() => (peek = l)}
						onmouseleave={() => (peek = null)}
						onfocus={() => (peek = l)}
						onblur={() => (peek = null)}
						class={cn(
							'h-4 w-2.5 rounded-xs border transition-colors',
							isDone ? 'border-ok bg-ok' : 'border-border bg-muted hover:border-foreground/50'
						)}
					></a>
				{/each}
				<span class="tnum ml-auto w-10 pl-2 text-right text-2xs text-muted-foreground">
					{done}/{act.lessons.length}
				</span>
			</div>

			<!--
				One line doing two jobs: what the act is about, and — while you are
				pointing at a pip — which lesson that pip is.
			-->
			<p class="col-start-2 mt-1 truncate text-sm text-muted-foreground">
				{#if peek && act.lessons.some((l) => l.id === peek?.id)}
					<span class="tnum text-foreground">{peek.number}.</span>
					{peek.title}
				{:else}
					{act.subtitle}
				{/if}
			</p>
		</div>
	{/each}
</div>

<a
	href={path('/learn')}
	class="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
>
	Every lesson, with what each one covers
	<HugeiconsIcon icon={ArrowRight01Icon} size={14} />
</a>
