<script lang="ts">
	/**
	 * Boxes and arrows, for the handful of places a lesson describes a path.
	 *
	 * Not to be confused with `SignalPath`, which is a specific drawing of this
	 * application's own bus. This one is generic: a synthesiser's voice chain, a
	 * message's route from a key to a speaker, the order of a panic routine.
	 *
	 * It wraps rather than scrolling. A chain of five stages is one line on a
	 * desktop and two or three on a phone, and an arrow that turns a corner is
	 * still obviously an arrow — where a horizontal scroller hides the end of
	 * the sentence you are asking someone to read.
	 */
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	export interface ChainStep {
		label: string;
		/** A few words under the label. */
		note?: string;
		/** Draw in the note colour: the stage the surrounding prose is about. */
		accent?: boolean;
	}

	interface Props {
		steps: ChainStep[];
		class?: string;
	}
	let { steps, class: className }: Props = $props();
</script>

<ol class={cn('flex flex-wrap items-stretch gap-1.5', className)}>
	{#each steps as s, i (s.label)}
		<li class="flex items-center gap-1.5">
			<div
				class={cn(
					'flex min-w-[6.5rem] flex-col gap-0.5 rounded-lg border px-3 py-2',
					s.accent ? 'border-msg-note/40 bg-msg-note-bg' : 'bg-surface-sunken'
				)}
			>
				<span class={cn('text-xs font-medium', s.accent && 'text-msg-note')}>{s.label}</span>
				{#if s.note}
					<span class="text-2xs leading-snug text-muted-foreground">{s.note}</span>
				{/if}
			</div>
			{#if i < steps.length - 1}
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					size={14}
					class="shrink-0 text-muted-foreground"
					aria-hidden="true"
				/>
			{/if}
		</li>
	{/each}
</ol>
