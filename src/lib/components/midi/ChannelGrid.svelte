<script lang="ts">
	/**
	 * Sixteen channels at a glance: what is playing where, on what program, and
	 * which one your widgets are transmitting on.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { synth } from '$lib/audio/synth';
	import { gmProgramName } from '$lib/midi/constants';
	import { cn } from '$lib/utils';

	interface Props {
		/** Clicking a cell sets the transmit channel. */
		selectable?: boolean;
		compact?: boolean;
		class?: string;
	}
	let { selectable = true, compact = false, class: className }: Props = $props();

	const CHANNEL_HUES = [150, 262, 318, 75, 197, 20, 220, 100, 285, 340, 45, 175, 240, 300, 60, 210];
	const colour = (c: number) => `oklch(0.7 0.17 ${CHANNEL_HUES[c % 16]})`;
</script>

<div class={cn('grid grid-cols-4 gap-1.5 sm:grid-cols-8', className)}>
	{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
		{@const snap = noteState.channel(c)}
		{@const active = snap.notes.size > 0}
		{@const selected = engine.channel === c}
		<button
			class={cn(
				'relative flex flex-col items-start gap-0.5 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition-colors',
				selected && 'ring-1 ring-foreground/40',
				!selectable && 'cursor-default'
			)}
			style:background={active ? `color-mix(in oklch, ${colour(c)} 20%, transparent)` : ''}
			style:border-color={active ? colour(c) : ''}
			onclick={() => selectable && (engine.channel = c)}
			disabled={!selectable}
		>
			<span class="flex w-full items-baseline justify-between">
				<span class="tnum font-mono text-xs" style:color={active ? colour(c) : ''}>
					{c + 1}
				</span>
				{#if c === 9}
					<span class="label text-muted-foreground/60">drums</span>
				{:else if active}
					<span class="tnum font-mono text-2xs text-muted-foreground">{snap.notes.size}</span>
				{/if}
			</span>
			{#if !compact}
				<span class="w-full truncate text-2xs leading-tight text-muted-foreground">
					{c === 9 ? 'GM kit' : gmProgramName(synth.channels[c].program)}
				</span>
			{/if}
		</button>
	{/each}
</div>
