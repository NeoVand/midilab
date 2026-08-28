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
	import { gmFamily, gmProgramName } from '$lib/midi/constants';
	import { channelColour } from '$lib/midi/channelcolour';
	import { rovingGrid } from '$lib/a11y/roving';
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

<!--
	Column count follows what is in the cell, not how wide the window is. A
	wider screen was switching to eight narrow columns and truncating every
	program name back to "Acoustic Grand…" — more room producing less
	information. Compact cells carry only a number, so those can go eight
	across.
-->
<div
	class={cn(
		'grid gap-1',
		compact ? 'grid-cols-8' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8',
		className
	)}
	use:rovingGrid
>
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
			<!--
				The number is the hero. Sixteen channels showing "Acoustic Grand
				Piano" sixteen times is a wall of identical English where the only
				thing that differs — which channel this is — was the smallest type in
				the cell. The family name is enough to place the sound; the exact
				program is in the tooltip, where a detail you rarely need belongs.
			-->
			<span
				class="tnum w-4 shrink-0 text-right font-mono text-sm font-medium"
				style:color={active ? colour(c) : ''}
			>
				{c + 1}
			</span>
			{#if !compact}
				<span class="min-w-0 flex-1 truncate text-2xs leading-tight text-muted-foreground">
					{c === 9 ? 'GM kit' : gmFamily(synth.channels[c].program)}
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
