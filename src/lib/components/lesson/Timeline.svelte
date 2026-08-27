<script lang="ts">
	/**
	 * A dated sequence, for the two lessons that have one.
	 *
	 * A table would carry the same facts and lose the thing that makes a
	 * chronology worth drawing: that the gaps between the entries are uneven and
	 * the unevenness is the story. Eighteen months from a paper to a shipping
	 * standard, then forty years of almost nothing changing.
	 *
	 * So the rail is continuous and the entries hang off it, and a single entry
	 * can be marked as the one that mattered.
	 */
	import { cn } from '$lib/utils';

	export interface TimelineEntry {
		when: string;
		what: string;
		/** One or two sentences. Optional — some dates need no elaboration. */
		detail?: string;
		/** Draw this one in the note colour: the moment the rest hangs on. */
		pivot?: boolean;
	}

	interface Props {
		entries: TimelineEntry[];
		class?: string;
	}
	let { entries, class: className }: Props = $props();
</script>

<ol class={cn('relative flex flex-col gap-5 pl-6', className)}>
	<!--
		The rail stops at the last marker rather than running to the bottom of
		the list, so it does not trail off past the final entry like an
		unfinished sentence.
	-->
	<span class="absolute top-2 bottom-2 left-[3px] w-px bg-foreground/15" aria-hidden="true"></span>

	{#each entries as e (e.when + e.what)}
		<li class="relative">
			<span
				class={cn(
					'absolute top-[0.45em] -left-6 size-[7px] rounded-full ring-3 ring-background',
					e.pivot ? 'bg-msg-note' : 'bg-muted-foreground/40'
				)}
				aria-hidden="true"
			></span>
			<p class="flex flex-wrap items-baseline gap-x-2.5">
				<span
					class={cn('tnum font-mono text-xs', e.pivot ? 'text-msg-note' : 'text-muted-foreground')}
				>
					{e.when}
				</span>
				<span class={cn('text-sm', e.pivot ? 'font-semibold' : 'font-medium')}>{e.what}</span>
			</p>
			{#if e.detail}
				<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{e.detail}</p>
			{/if}
		</li>
	{/each}
</ol>
