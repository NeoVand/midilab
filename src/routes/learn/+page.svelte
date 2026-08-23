<script lang="ts">
	import { CURRICULUM, ALL_LESSONS, TOTAL_MINUTES, lessonPath } from '$lib/curriculum/registry';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Tick02Icon, Clock01Icon, PlugSocketIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	const overall = $derived(progress.fractionOf(ALL_LESSONS.map((l) => l.id)));
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-10 px-8 py-12">
	<header class="flex flex-col gap-3">
		<h1 class="text-3xl font-semibold tracking-tight">The course</h1>
		<p class="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
			Six acts. You do not advance by clicking Next — each lesson ends in checkpoints that the
			engine verifies by watching the MIDI stream. Everything works with no hardware attached; most
			of it works better with some.
		</p>
		<div class="flex items-center gap-3 pt-1">
			<div class="h-1.5 w-44 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full bg-msg-note transition-[width]"
					style="width: {overall * 100}%"
				></div>
			</div>
			<span class="tnum text-xs text-muted-foreground">
				{Math.round(overall * 100)}% · {ALL_LESSONS.length} lessons · ~{Math.round(
					TOTAL_MINUTES / 60
				)}h
			</span>
		</div>
	</header>

	{#each CURRICULUM as act (act.id)}
		{@const frac = progress.fractionOf(act.lessons.map((l) => l.id))}
		<section id={act.id} class="flex scroll-mt-8 flex-col gap-4">
			<div class="flex items-baseline gap-3 border-b pb-3">
				<span class="font-mono text-xs text-muted-foreground/50">ACT {act.number}</span>
				<h2 class="text-lg font-semibold tracking-tight">{act.title}</h2>
				<span class="tnum ml-auto font-mono text-[11px] text-muted-foreground">
					{Math.round(frac * 100)}%
				</span>
			</div>
			<p class="-mt-2 text-sm text-muted-foreground">{act.subtitle}</p>

			<ol class="flex flex-col gap-1.5">
				{#each act.lessons as lesson (lesson.id)}
					{@const complete = progress.isLessonComplete(lesson.id)}
					{@const started = progress.visited.includes(lesson.id)}
					<li>
						<a
							href={lessonPath(lesson)}
							class={cn(
								'group flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors hover:border-foreground/25 hover:bg-accent/40',
								complete && 'border-ok/35 bg-ok/5'
							)}
						>
							<span
								class={cn(
									'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px]',
									complete
										? 'bg-ok text-background'
										: started
											? 'bg-muted text-foreground'
											: 'border text-muted-foreground'
								)}
							>
								{#if complete}
									<HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.5} />
								{:else}
									{lesson.number}
								{/if}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block font-medium">{lesson.title}</span>
								<span class="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
									{lesson.blurb}
								</span>
							</span>
							<span
								class="mt-1 flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground/70"
							>
								{#if lesson.hardware !== 'none'}
									<HugeiconsIcon icon={PlugSocketIcon} size={12} />
								{/if}
								<span class="tnum flex items-center gap-1">
									<HugeiconsIcon icon={Clock01Icon} size={12} />{lesson.minutes}
								</span>
							</span>
						</a>
					</li>
				{/each}
			</ol>
		</section>
	{/each}
</div>
