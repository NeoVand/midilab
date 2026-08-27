<script lang="ts">
	/**
	 * One bar, divided every way musicians divide it.
	 *
	 * "Twenty-four clocks per quarter note" is meaningless to someone who has
	 * never been told what a quarter note is, and being told in prose does not
	 * help much either — the whole idea is a ratio between durations, which is a
	 * thing you hear rather than a thing you read.
	 *
	 * So every row is the same four beats cut into a different number of pieces,
	 * drawn to scale and playable. The eye gets the arithmetic from the widths
	 * and the ear gets it from the click, and after that "sixteenth note" is a
	 * word for something you already know.
	 */
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import VoicePicker from './VoicePicker.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		bpm?: number;
		/** Beats in a bar. Four unless you are being clever. */
		beats?: number;
		class?: string;
	}
	let { bpm = 96, beats = 4, class: className }: Props = $props();

	/*
	 * An electric piano, and the choice matters more here than anywhere else in
	 * the course.
	 *
	 * This widget's whole subject is *how long a note lasts*, and the first
	 * version played it on a woodblock — a percussive one-shot that stops
	 * immediately however long you hold it. Every row therefore sounded like a
	 * row of identical clicks at different spacings, and a whole note was
	 * indistinguishable from a quarter note followed by silence, which is
	 * exactly the distinction the reader is here to learn.
	 *
	 * A keyboard voice sustains until its Note Off and then stops, so the bar
	 * you can see and the sound you can hear are the same length. The picker is
	 * offered because the point survives any sustaining instrument, and some
	 * people will want strings or an organ.
	 */
	let program = $state(4);

	interface Row {
		id: string;
		name: string;
		british: string;
		/** How many fit in one beat. */
		per: number;
		note: string;
	}

	const ROWS: Row[] = [
		{
			id: 'whole',
			name: 'Whole note',
			british: 'semibreve',
			per: 0.25,
			note: 'The whole bar, once.'
		},
		{ id: 'half', name: 'Half note', british: 'minim', per: 0.5, note: 'Two to a bar.' },
		{
			id: 'quarter',
			name: 'Quarter note',
			british: 'crotchet',
			per: 1,
			note: 'One beat. The unit MIDI counts time in.'
		},
		{
			id: 'eighth',
			name: 'Eighth note',
			british: 'quaver',
			per: 2,
			note: 'Half a beat. A steady run.'
		},
		{
			id: 'sixteenth',
			name: 'Sixteenth note',
			british: 'semiquaver',
			per: 4,
			note: 'The default grid of every step sequencer.'
		},
		{
			id: 'triplet',
			name: 'Eighth triplets',
			british: 'three in the time of two',
			per: 3,
			note: 'Threes against a beat that is counted in twos. Where swing comes from.'
		}
	];

	let playing = $state<string | null>(null);
	const player = new SequencePlayer();

	/*
	 * Pitch is deliberately fixed and low: the row is about duration, and a
	 * melody would give the ear something more interesting to listen to than
	 * the one thing being demonstrated. Downbeats are accented so the bar keeps
	 * its shape even at sixteen notes to it.
	 */
	function rowNotes(r: Row): NoteSpec[] {
		const step = 1 / r.per;
		const count = Math.round(beats * r.per);
		return Array.from({ length: count }, (_, i) => ({
			note: 60,
			// Each note sounds for almost all of its own written length — never a
			// fixed maximum. An earlier version capped this at 1.6 beats to stop
			// long notes ringing, which made a whole note and a half note come out
			// exactly the same length: the one distinction this entire widget
			// exists to demonstrate. The small gap is only so that repeated
			// pitches re-articulate instead of slurring into one another.
			start: i * step,
			duration: step * 0.9,
			velocity: i === 0 ? 112 : i % r.per === 0 ? 92 : 70,
			channel: 0
		}));
	}

	async function toggle(r: Row) {
		if (playing === r.id) {
			player.stop();
			playing = null;
			return;
		}
		player.stop();
		await engine.wake();
		engine.programChange(program, 0);
		playing = r.id;
		player.play(notesToEvents(rowNotes(r), bpm), { onEnd: () => (playing = null) });
	}
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
	{#each ROWS as r (r.id)}
		{@const count = Math.round(beats * r.per)}
		<div class="flex flex-col gap-1 rounded-lg border p-2.5 sm:flex-row sm:items-center sm:gap-3">
			<button
				class="flex shrink-0 items-center gap-2 text-left"
				onclick={() => toggle(r)}
				aria-label="Play {r.name}"
			>
				<span
					class={cn(
						'grid size-7 shrink-0 place-items-center rounded-md border transition-colors',
						playing === r.id
							? 'border-msg-note bg-msg-note-bg text-msg-note'
							: 'hover:border-foreground/30'
					)}
				>
					<HugeiconsIcon icon={playing === r.id ? StopIcon : PlayIcon} size={13} />
				</span>
				<span class="flex min-w-0 flex-col sm:w-36">
					<span class="truncate text-xs font-medium">{r.name}</span>
					<span class="truncate text-2xs text-muted-foreground">{r.british}</span>
				</span>
			</button>

			<!--
				The bar drawn to scale. Sixteen cells and one cell are the same total
				width on purpose — that equality is the entire point, and any padding
				between rows would quietly undermine it.
			-->
			<!--
				`sm:flex-1`, not `flex-1`. Stacked, this row is a *column* flex
				container, where `flex: 1 1 0%` sets the main size — the height — to
				a basis of zero and then grows it into whatever space is spare. There
				is none, so the bar computed to zero pixels and the entire point of
				the widget vanished on a phone while the labels stayed. It only wants
				to grow along the row once there is a row.
			-->
			<div
				class="flex h-6 w-full gap-px overflow-hidden rounded-sm bg-surface-sunken sm:flex-1"
				aria-hidden="true"
			>
				{#each Array.from({ length: count }, (_, i) => i) as i (i)}
					<div
						class={cn(
							'flex-1 rounded-[2px] transition-colors',
							i === 0 ? 'bg-msg-note/70' : i % r.per === 0 ? 'bg-msg-note/40' : 'bg-msg-note/15'
						)}
					></div>
				{/each}
			</div>

			<span class="tnum shrink-0 text-2xs text-muted-foreground sm:w-14 sm:text-right">
				{count} per bar
			</span>
		</div>
	{/each}
	<div class="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
		<p class="text-xs leading-relaxed text-muted-foreground">
			Every row is the same {beats} beats at {bpm} BPM. Only the number of pieces changes.
		</p>
		<VoicePicker bind:value={program} />
	</div>
</div>
