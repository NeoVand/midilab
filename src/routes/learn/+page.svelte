<script lang="ts">
	import {
		CURRICULUM,
		ALL_LESSONS,
		TOTAL_MINUTES,
		ACT_ICON,
		lessonPath
	} from '$lib/curriculum/registry';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Tick02Icon, PlugSocketIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	const overall = $derived(progress.fractionOf(ALL_LESSONS.map((l) => l.id)));
	const doneLessons = $derived(ALL_LESSONS.filter((l) => progress.isLessonComplete(l.id)).length);
	const nextLesson = $derived(
		ALL_LESSONS.find((l) => !progress.isLessonComplete(l.id)) ?? ALL_LESSONS[0]
	);

	const HARDWARE_TITLE: Record<string, string> = {
		better: 'Better with hardware attached',
		required: 'Needs a MIDI device'
	};

	function actMinutes(lessons: { minutes: number }[]) {
		return lessons.reduce((t, l) => t + l.minutes, 0);
	}
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-10 px-8 py-12">
	<header class="flex flex-col gap-3">
		<h1 class="text-3xl font-semibold tracking-tight">The course</h1>
		<p class="prose-body text-muted-foreground">
			Six acts. You do not advance by clicking Next — each lesson ends in checkpoints that the
			engine verifies by watching the MIDI stream. Everything works with no hardware attached; most
			of it works better with some.
		</p>

		<!--
			The resume row. An index this long without one makes you scroll
			looking for the first title you don't recognise.
		-->
		<div
			class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-card px-4 py-3"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-1.5">
				<p class="label">{doneLessons > 0 ? 'Up next' : 'Start here'}</p>
				<p class="truncate text-sm font-medium">
					{nextLesson.number}. {nextLesson.title}
				</p>
			</div>
			<div class="flex items-center gap-3">
				<div class="hidden flex-col items-end gap-1.5 sm:flex">
					<span class="tnum text-xs text-muted-foreground">
						{doneLessons} of {ALL_LESSONS.length} done · {Math.round(TOTAL_MINUTES / 60)} hours in total
					</span>
					<div class="h-1.5 w-40 overflow-hidden rounded-full bg-border">
						<div
							class="h-full rounded-full bg-ok transition-[width] duration-500"
							style="width: {Math.max(overall * 100, overall > 0 ? 2 : 0)}%"
						></div>
					</div>
				</div>
				<Button href={lessonPath(nextLesson)} size="lg">
					{doneLessons > 0 ? 'Continue' : 'Begin'}
					<HugeiconsIcon icon={ArrowRight01Icon} size={15} />
				</Button>
			</div>
		</div>
	</header>

	{#each CURRICULUM as act (act.id)}
		{@const done = act.lessons.filter((l) => progress.isLessonComplete(l.id)).length}
		{@const frac = done / act.lessons.length}
		<section id={act.id} class="flex scroll-mt-8 flex-col gap-3">
			<div class="flex items-center gap-3.5">
				<!-- The mark, with the act's progress drawn round it. -->
				<span class="relative grid size-11 shrink-0 place-items-center">
					<svg viewBox="0 0 44 44" class="absolute inset-0 -rotate-90">
						<circle cx="22" cy="22" r="20" fill="none" class="stroke-border" stroke-width="2" />
						{#if frac > 0}
							<circle
								cx="22"
								cy="22"
								r="20"
								fill="none"
								class="stroke-ok"
								stroke-width="2"
								stroke-linecap="round"
								stroke-dasharray="{frac * 125.66} 125.66"
							/>
						{/if}
					</svg>
					<HugeiconsIcon
						icon={ACT_ICON[act.id]}
						size={19}
						strokeWidth={1.6}
						class={frac === 1 ? 'text-ok' : 'text-muted-foreground'}
					/>
				</span>
				<div class="min-w-0 flex-1">
					<div class="flex items-baseline gap-2.5">
						<span class="label text-muted-foreground">Act {act.number}</span>
						<h2 class="text-lg leading-tight font-semibold tracking-tight">{act.title}</h2>
					</div>
					<p class="mt-0.5 text-sm text-muted-foreground">{act.subtitle}</p>
				</div>
				<span class="tnum shrink-0 self-center font-mono text-xs text-muted-foreground">
					{done}/{act.lessons.length} · {actMinutes(act.lessons)} min
				</span>
			</div>

			<!--
				One container, ruled rows. Thirty separately bordered cards down a
				page is thirty-odd rectangles competing for the same attention; a table
				of contents is a list, and it should look like one.
			-->
			<ol class="overflow-hidden rounded-lg border bg-card">
				{#each act.lessons as lesson, i (lesson.id)}
					{@const complete = progress.isLessonComplete(lesson.id)}
					{@const isNext = lesson.id === nextLesson.id}
					<li>
						<a
							href={lessonPath(lesson)}
							class={cn(
								'relative grid grid-cols-[1.75rem_1fr_auto] items-baseline gap-x-4 px-4 py-3 transition-colors hover:bg-accent/50',
								i > 0 && 'border-t'
							)}
						>
							{#if isNext && doneLessons > 0}
								<span class="absolute inset-y-0 left-0 w-[3px] bg-ok"></span>
							{/if}
							<span
								class={cn(
									'tnum self-start pt-0.5 text-center font-mono text-xs',
									complete ? 'text-ok' : 'text-muted-foreground'
								)}
							>
								{#if complete}
									<HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.5} class="mx-auto" />
								{:else}
									{String(lesson.number).padStart(2, '0')}
								{/if}
							</span>
							<span class="min-w-0">
								<span class="block font-medium">{lesson.title}</span>
								<span class="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
									{lesson.blurb}
								</span>
							</span>
							<span
								class="tnum flex shrink-0 items-center gap-2 self-start pt-0.5 text-xs text-muted-foreground"
							>
								{#if lesson.hardware && lesson.hardware !== 'none'}
									<HugeiconsIcon
										icon={PlugSocketIcon}
										size={12}
										aria-label={HARDWARE_TITLE[lesson.hardware]}
									/>
								{/if}
								{lesson.minutes} min
							</span>
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{/each}
</div>
