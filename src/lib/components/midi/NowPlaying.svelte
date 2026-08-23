<script lang="ts">
	/**
	 * What you are playing, in the three languages at once.
	 *
	 * A note is a number to the protocol, a key under your hands, and a name to
	 * everyone you will ever play with — and the whole difficulty of learning
	 * MIDI is that nothing on screen usually says all three at the same time.
	 * So: the notation, the chord symbol and what it is called out loud, the
	 * intervals in semitones — which is the unit MIDI actually counts in — and
	 * the notes themselves as numbers and frequencies.
	 */
	import Staff from './Staff.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { noteToFrequency, intervalName } from '$lib/midi/notes';
	import { chordName, spellNotes, spellingName } from '$lib/midi/harmony';
	import { settings } from '$lib/stores/settings.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		flats?: boolean;
		class?: string;
	}
	let { flats = false, class: className }: Props = $props();

	const held = $derived.by(() => {
		void noteState.version;
		const out: number[] = [];
		for (let n = 0; n < 128; n++) if (noteState.isHeld(n)) out.push(n);
		return out;
	});

	const chord = $derived(chordName(held, flats));
	/**
	 * Spelled the same way the staff spells them — the list beside the notation
	 * has to agree with it, or neither is trustworthy.
	 */
	const names = $derived(
		spellNotes(held, flats).map((s) => spellingName(s, settings.octaveConvention))
	);

	/** Every note measured from the lowest — the way you hear a chord. */
	const steps = $derived(held.length > 1 ? held.slice(1).map((n) => n - held[0]) : []);

	/** More than this and the list is longer than the panel; the staff still has them all. */
	const listed = $derived(held.slice(0, 6));
</script>

<div class={cn('flex h-full flex-col gap-2', className)}>
	<Staff {flats} class="shrink-0" />

	{#if held.length === 0}
		<p class="text-xs leading-relaxed text-muted-foreground">
			Play, and this names it — the notes, the chord, and the distances between them.
		</p>
	{:else if held.length === 1}
		<div class="flex items-baseline gap-2">
			<span class="text-xl leading-none font-medium">{names[0]}</span>
			<span class="tnum text-xs text-muted-foreground">
				{held[0]} · {noteToFrequency(held[0]).toFixed(0)} Hz
			</span>
		</div>
	{:else}
		<div class="flex flex-col gap-1">
			<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
				<span class="text-xl leading-none font-medium">
					{chord ? chord.name : `${held.length} notes`}
				</span>
				<span class="text-xs text-muted-foreground">
					{chord
						? chord.spoken + (chord.inversion > 0 ? ` · ${chord.inversion}. inversion` : '')
						: 'no name for this one, which is allowed'}
				</span>
			</div>
			<!--
				Semitones, not scale degrees: the interval a musician hears and the
				number MIDI subtracts are the same thing, and saying both together
				is the point of the panel.
			-->
			<ul class="tnum flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-muted-foreground">
				{#each steps as s, i (i)}
					<li><span class="text-foreground">+{s}</span> {intervalName(s)}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!--
		The same notes as numbers. This is the line that makes the panel a MIDI
		tool rather than a music one: every row is exactly what went on the wire,
		beside the notation of the same thing.
	-->
	{#if held.length > 1}
		<dl class="tnum mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-2 text-2xs">
			{#each listed as n, i (n)}
				<dt class="text-foreground">{names[i]}</dt>
				<dd class="text-muted-foreground">{n} · {noteToFrequency(n).toFixed(0)} Hz</dd>
			{/each}
			{#if held.length > listed.length}
				<dt class="col-span-2 text-muted-foreground">+{held.length - listed.length} more</dt>
			{/if}
		</dl>
	{/if}
</div>
