<script lang="ts">
	/**
	 * Sixteen channels at a glance: what is playing where, on what program, and
	 * which one your widgets are transmitting on.
	 *
	 * Channel colour is its own axis — it answers "which track" where the
	 * message palette answers "what kind of message" — so it gets its own hues,
	 * but they take their lightness from the theme rather than being fixed for
	 * a dark ground and washing out on a light one.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { synth } from '$lib/audio/synth';
	import { gmProgramName } from '$lib/midi/constants';
	import { channelColour } from '$lib/midi/channelcolour';
	import { cn } from '$lib/utils';

	interface Props {
		/** Clicking a cell sets the transmit channel. */
		selectable?: boolean;
		compact?: boolean;
		class?: string;
	}
	let { selectable = true, compact = false, class: className }: Props = $props();

	const colour = channelColour;
</script>

<div class={cn('grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8', className)}>
	{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
		{@const snap = noteState.channel(c)}
		{@const active = snap.notes.size > 0}
		{@const selected = engine.channel === c}
		<button
			class={cn(
				'flex items-baseline gap-2 overflow-hidden rounded-md border bg-card px-2 py-1 text-left transition-colors',
				selected && 'border-foreground/40',
				selectable && !selected && 'hover:border-foreground/20',
				!selectable && 'cursor-default'
			)}
			style:background={active ? `color-mix(in oklch, ${colour(c)} 16%, var(--card))` : ''}
			style:border-color={active ? colour(c) : ''}
			onclick={() => selectable && (engine.channel = c)}
			disabled={!selectable}
			aria-pressed={selectable ? selected : undefined}
			title={`Channel ${c + 1} · ${c === 9 ? 'General MIDI drum kit' : gmProgramName(synth.channels[c].program)}${selectable ? ' · click to transmit here' : ''}`}
		>
			<span
				class="tnum w-4 shrink-0 text-right font-mono text-xs"
				style:color={active ? colour(c) : ''}
			>
				{c + 1}
			</span>
			{#if !compact}
				<span class="min-w-0 flex-1 truncate text-2xs leading-tight text-muted-foreground">
					{c === 9 ? 'GM kit' : gmProgramName(synth.channels[c].program)}
				</span>
			{/if}
			{#if active}
				<span class="tnum shrink-0 font-mono text-2xs" style:color={colour(c)}>
					{snap.notes.size}
				</span>
			{:else if c === 9 && compact}
				<span class="label shrink-0 text-muted-foreground">dr</span>
			{/if}
		</button>
	{/each}
</div>
