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
	import { device } from '$lib/stores/device.svelte';

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

	/**
	 * Four rows is what the column has room for under the notation and the
	 * chord; past that the list says how many it is not showing. The staff
	 * above has all of them either way.
	 */
	const listed = $derived(held.length > 6 ? held.slice(0, 5) : held);

	/**
	 * Two lines of intervals covers a five-note chord, which is as many as ten
	 * fingers put on a three-octave keyboard in practice.
	 */
	/*
	 * Two lines of intervals on a desk, one on a phone.
	 *
	 * The slot is fixed either way — that is the whole point of this column,
	 * that nothing moves as you play — but reserving a second line a phone
	 * rarely fills costs twenty pixels out of a pane that has none to give,
	 * and a six-note chord that wraps is the rarer case.
	 */
	const INTERVAL_LINES = $derived(device.narrow ? 1 : 2);
</script>

<!--
	Fixed slots, always the same height.
	
	Everything here appears and disappears as you play: a chord gets a name or
	does not, the intervals run to one line or two, the note list is empty or
	four rows deep. Letting the column size itself made the panel — and the
	whole page under it — jump every time a key went down. So each part has a
	place of a fixed size that it either fills or does not, the way a readout on
	a piece of hardware does.
-->
<div class={cn('flex h-full flex-col gap-1.5', className)}>
	<Staff {flats} class="shrink-0" />

	<!-- the chord, or what would go there -->
	<div class="flex h-9 shrink-0 flex-col justify-center gap-0.5">
		{#if held.length === 0}
			<span class="text-lg leading-none font-medium text-muted-foreground/35">—</span>
			<span class="text-2xs text-muted-foreground">
				{device.narrow ? 'play something' : 'the chord you are holding'}
			</span>
		{:else if held.length === 1}
			<span class="text-lg leading-none font-medium">{names[0]}</span>
			<span class="tnum text-2xs text-muted-foreground">
				one note · {held[0]} · {noteToFrequency(held[0]).toFixed(0)} Hz
			</span>
		{:else}
			<span class="text-lg leading-none font-medium">
				{chord ? chord.name : `${held.length} notes`}
			</span>
			<span class="truncate text-2xs text-muted-foreground">
				{chord
					? chord.spoken + (chord.inversion > 0 ? ` · ${chord.inversion}. inversion` : '')
					: 'no name for this one, which is allowed'}
			</span>
		{/if}
	</div>

	<!--
		Semitones, not scale degrees: the interval a musician hears and the
		number MIDI subtracts are the same thing, and saying both together is
		the point of the panel.
	-->
	<ul
		class="tnum flex shrink-0 flex-wrap content-start gap-x-3 gap-y-0.5 overflow-hidden text-2xs text-muted-foreground"
		style="height: calc({INTERVAL_LINES} * 1.4em)"
	>
		{#if steps.length}
			{#each steps as s, i (i)}
				<li><span class="text-foreground">+{s}</span> {intervalName(s)}</li>
			{/each}
		{:else if held.length === 0}
			<!-- Only while nothing is down. One note has no intervals, and saying
			     so under a note that is sounding reads as a broken readout. -->
			<li>and the semitones between its notes</li>
		{/if}
	</ul>

	<!--
		The same notes as numbers, on one line rather than in a table. This is
		the part that makes the panel a MIDI tool rather than a music one —
		every pair is exactly what went on the wire — and a line of them costs a
		quarter of the height a column of them did.
	-->
	<p
		class="tnum mt-auto shrink-0 overflow-hidden text-2xs leading-[1.4] text-muted-foreground"
		style="height: {device.narrow ? 1.5 : 2.8}em"
	>
		{#if held.length === 0}
			<span class="label">note · number</span>
		{:else}
			{#each listed as n, i (n)}
				<span class="mr-2.5 inline-block whitespace-nowrap">
					<span class="text-foreground">{names[i]}</span>
					{n}
				</span>
			{/each}
			{#if held.length > listed.length}+{held.length - listed.length} more{/if}
		{/if}
	</p>
</div>
