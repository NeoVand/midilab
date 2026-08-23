<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Clock01Icon,
		ArrowRight01Icon,
		ArrowLeft01Icon,
		PlugSocketIcon,
		Target02Icon,
		Tick02Icon
	} from '@hugeicons/core-free-icons';
	import { actOf, neighbours, type LessonMeta } from '$lib/curriculum/registry';
	import { lessonHref, path } from '$lib/nav';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		lesson: LessonMeta;
		children: Snippet;
	}
	let { lesson, children }: Props = $props();

	const act = $derived(actOf(lesson.id));
	const { prev, next } = $derived(neighbours(lesson.id));
	const done = $derived(progress.doneCount(lesson.id));
	const total = $derived(progress.totalFor(lesson.id));

	onMount(() => progress.visit(lesson.id));

	const hardwareLabel: Record<string, string> = {
		none: 'No hardware needed',
		better: 'Better with hardware',
		required: 'Hardware required'
	};
</script>

<article class="mx-auto flex w-full max-w-[54rem] flex-col gap-10 px-8 py-10">
	<header class="flex flex-col gap-3">
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<a href={path('/learn')} class="hover:text-foreground">Learn</a>
			<span>/</span>
			{#if act}
				<a href="{path('/learn')}#{act.id}" class="hover:text-foreground"
					>Act {act.number} · {act.title}</a
				>
			{/if}
		</div>

		<div class="flex items-start gap-4">
			<span class="tnum mt-0.5 font-mono text-3xl leading-none text-muted-foreground tabular-nums">
				{String(lesson.number).padStart(2, '0')}
			</span>
			<div class="min-w-0 flex-1">
				<h1 class="text-3xl leading-tight font-semibold tracking-tight text-balance">
					{lesson.title}
				</h1>
				<p class="prose-body mt-2 text-pretty text-muted-foreground">
					{lesson.blurb}
				</p>
			</div>
		</div>

		<div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
			<span class="flex items-center gap-1.5">
				<HugeiconsIcon icon={Clock01Icon} size={13} />
				{lesson.minutes} min
			</span>
			<span class="flex items-center gap-1.5">
				<HugeiconsIcon icon={PlugSocketIcon} size={13} />
				{hardwareLabel[lesson.hardware ?? 'none']}
			</span>
			{#if total > 0}
				<!-- Finishing a lesson should read as finished. "3 of 3" in the same
				     grey as "0 of 3" makes the last checkpoint feel like nothing. -->
				<span class={cn('flex items-center gap-1.5', done === total && 'text-ok')}>
					<HugeiconsIcon icon={done === total ? Tick02Icon : Target02Icon} size={13} />
					{#if done === total}
						All {total} checkpoints done
					{:else}
						{done} of {total} checkpoints
					{/if}
				</span>
			{/if}
		</div>
	</header>

	<section class="rounded-lg border bg-surface-sunken p-5">
		<p class="mb-3 text-sm font-medium">By the end you can</p>
		<ul class="flex flex-col gap-2">
			{#each lesson.objectives as o (o)}
				<li class="flex gap-2.5 text-sm leading-relaxed">
					<span class="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-msg-note/60"></span>
					{o}
				</li>
			{/each}
		</ul>
	</section>

	<div class="lesson-prose flex flex-col gap-10">
		{@render children()}
	</div>

	<!--
		The end of a lesson is a page turn, not a pair of links. Both directions
		get the same weight and the same shape, and the title of what comes next
		is the thing you are actually choosing.
	-->
	<nav class="grid gap-3 border-t pt-6 sm:grid-cols-2">
		{#if prev}
			<a
				href={lessonHref(prev)}
				class="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-foreground/25"
			>
				<span class="flex items-center gap-1 text-xs text-muted-foreground">
					<HugeiconsIcon icon={ArrowLeft01Icon} size={12} /> Previous
				</span>
				<span class="text-sm font-medium">{prev.title}</span>
			</a>
		{:else}
			<span class="hidden sm:block"></span>
		{/if}
		{#if next}
			<a
				href={lessonHref(next)}
				class="flex flex-col items-end gap-1 rounded-lg border bg-card px-4 py-3 text-right transition-colors hover:border-foreground/25 sm:col-start-2"
			>
				<span class="flex items-center gap-1 text-xs text-muted-foreground">
					Next <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
				</span>
				<span class="text-sm font-medium">{next.title}</span>
			</a>
		{:else}
			<a
				href={path('/learn')}
				class="flex flex-col items-end gap-1 rounded-lg border bg-card px-4 py-3 text-right transition-colors hover:border-foreground/25 sm:col-start-2"
			>
				<span class="flex items-center gap-1 text-xs text-muted-foreground">
					That was the last one <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
				</span>
				<span class="text-sm font-medium">Back to the course</span>
			</a>
		{/if}
	</nav>
</article>
