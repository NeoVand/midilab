<script lang="ts">
	/**
	 * The piano roll, with the messages showing through it.
	 *
	 * Every DAW draws MIDI this way and none of them ever says what a rectangle
	 * is. It is exactly four numbers — pitch, start, length, velocity — and
	 * three of those are drawn as geometry while the fourth is exiled to a lane
	 * underneath. That is the entire mapping, and once a reader has clicked one
	 * rectangle and seen `90 40 64` come out of it, every editing tool they will
	 * ever meet stops being magic and becomes arithmetic on a list.
	 *
	 * So: the same grid their DAW draws, plus the one thing their DAW hides.
	 * Selecting a note is the whole interaction, because the point is the
	 * correspondence rather than the editing.
	 */
	import { untrack } from 'svelte';
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import VoicePicker from './VoicePicker.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { encode } from '$lib/midi/messages';
	import { noteName, isBlackKey } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		notes: NoteSpec[];
		bpm?: number;
		/** Beats per bar, for the heavier grid line. */
		beatsPerBar?: number;
		/** Grid subdivisions per beat. Four is a sixteenth-note grid. */
		division?: number;
		height?: number;
		/** Show the velocity lane under the grid. */
		velocityLane?: boolean;
		/**
		 * Hide the roll's own play button, for a caller that already has one.
		 * Two transports over one set of notes is two things to stop.
		 */
		controls?: boolean;
		/**
		 * Playhead position, 0 to 1, when the caller owns the transport.
		 * Ignored while the roll's own player is running.
		 */
		progress?: number | null;
		/**
		 * General MIDI program to play and audition through, sent every time.
		 * Without it the roll inherits whatever the previous widget on the page
		 * left on the channel, which for a lesson about what a rectangle *is*
		 * can mean the Minuet arriving on a woodblock. `null` leaves the
		 * instrument alone, for a caller that has already chosen one.
		 */
		program?: number | null;
		class?: string;
	}
	let {
		notes,
		bpm = 100,
		beatsPerBar = 4,
		division = 4,
		height = 200,
		velocityLane = true,
		controls = true,
		progress = null,
		program = 0,
		class: className
	}: Props = $props();

	// Seeded from the prop, then owned by the picker.
	let voice = $state(untrack(() => program ?? 0));
	const fixedVoice = $derived(program === null);

	let selected = $state<number | null>(null);

	const player = new SequencePlayer();
	const events = $derived(notesToEvents(notes, bpm));

	/*
	 * The drawn pitch range is the range actually used, padded by a couple of
	 * semitones. A fixed range wastes most of the height on silence, and a
	 * range with no padding puts the top and bottom notes flush against the
	 * edge where they read as clipped.
	 */
	const lowest = $derived(Math.min(...notes.map((n) => n.note)) - 2);
	const highest = $derived(Math.max(...notes.map((n) => n.note)) + 2);
	const rows = $derived(highest - lowest + 1);
	const totalBeats = $derived(
		Math.ceil(Math.max(...notes.map((n) => n.start + n.duration)) / beatsPerBar) * beatsPerBar
	);

	const rowHeight = $derived(height / rows);
	const pct = (v: number) => `${v * 100}%`;

	const current = $derived(selected === null ? null : notes[selected]);
	const onBytes = $derived(
		current
			? encode({
					type: 'noteOn',
					channel: current.channel ?? 0,
					note: current.note,
					velocity: current.velocity ?? 96
				})
			: null
	);
	const offBytes = $derived(
		current
			? encode({
					type: 'noteOff',
					channel: current.channel ?? 0,
					note: current.note,
					velocity: 0
				})
			: null
	);

	const hex = (b: number[]) =>
		b.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

	async function toggle() {
		if (player.playing) return player.stop();
		await engine.wake();
		if (!fixedVoice) engine.programChange(voice, 0);
		player.play(events);
	}

	async function audition(i: number) {
		selected = i;
		const n = notes[i];
		await engine.wake();
		if (!fixedVoice) engine.programChange(voice, n.channel ?? 0);
		engine.noteOn(n.note, n.velocity ?? 96, n.channel ?? 0);
		setTimeout(() => engine.noteOff(n.note, n.channel ?? 0), 350);
	}

	/*
	 * Either transport can drive the playhead, and neither has to know about the
	 * other: the roll's own player wins while it is running, and otherwise the
	 * caller's `progress` does. A page that plays these notes itself therefore
	 * gets a moving playhead for free rather than a stationary one that makes
	 * the roll look broken.
	 */
	const playheadPct = $derived(
		player.playing && player.duration
			? Math.min(100, (player.position / (totalBeats * (60 / bpm))) * 100)
			: progress === null
				? null
				: Math.min(100, Math.max(0, progress * 100))
	);
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<div class="flex flex-wrap items-center justify-between gap-2">
		{#if controls}
			<Button variant="outline" size="sm" class="gap-1.5" onclick={toggle}>
				<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={13} />
				{player.playing ? 'Stop' : 'Play'}
			</Button>
		{:else}
			<span></span>
		{/if}
		<span class="flex items-center gap-2">
			<span class="tnum text-xs text-muted-foreground">
				{notes.length} notes · {totalBeats / beatsPerBar} bars · {bpm} BPM
			</span>
			{#if !fixedVoice}
				<VoicePicker bind:value={voice} audition={false} />
			{/if}
		</span>
	</div>

	<div class="overflow-hidden rounded-lg border">
		<div class="flex">
			<!--
				The keybed down the side, which is the only reason it is called a
				piano roll — so it is drawn in the keybed's own colours rather than
				in a tint of the page. Those two tokens deliberately do not follow
				the theme: ivory stays ivory when the page goes dark, which is what
				makes this read instantly as a keyboard instead of as a column of
				grey bars.
			-->
			<div class="w-11 shrink-0 border-r bg-key-white" style="height: {height}px">
				{#each Array.from({ length: rows }, (_, i) => highest - i) as note (note)}
					<div
						class={cn(
							'flex items-center justify-end pr-1.5 text-2xs',
							isBlackKey(note) ? 'bg-key-black text-white/55' : 'text-black/45'
						)}
						style="height: {rowHeight}px; line-height: {rowHeight}px"
					>
						{#if rowHeight > 9 && note % 12 === 0}
							{noteName(note, { convention: settings.octaveConvention })}
						{/if}
					</div>
				{/each}
			</div>

			<div class="panel-sunken relative flex-1" style="height: {height}px">
				<!-- Rows first, so the black-key stripes sit under everything. -->
				{#each Array.from({ length: rows }, (_, i) => highest - i) as note, i (note)}
					{#if isBlackKey(note)}
						<div
							class="absolute right-0 left-0 bg-foreground/[0.035]"
							style="top: {i * rowHeight}px; height: {rowHeight}px"
							aria-hidden="true"
						></div>
					{/if}
				{/each}

				{#each Array.from({ length: totalBeats * division + 1 }, (_, i) => i) as i (i)}
					<div
						class={cn(
							'absolute top-0 bottom-0 w-px',
							i % (division * beatsPerBar) === 0
								? 'bg-grid-line-strong'
								: i % division === 0
									? 'bg-grid-line'
									: 'bg-grid-line/50'
						)}
						style="left: {pct(i / (totalBeats * division))}"
						aria-hidden="true"
					></div>
				{/each}

				{#each notes as n, i (i)}
					<button
						class={cn(
							'absolute rounded-[2px] border transition-colors',
							selected === i
								? 'border-foreground bg-msg-note'
								: 'border-msg-note/60 bg-msg-note/70 hover:bg-msg-note'
						)}
						style="
							left: {pct(n.start / totalBeats)};
							width: max(3px, {pct(n.duration / totalBeats)});
							top: {(highest - n.note) * rowHeight}px;
							height: {Math.max(3, rowHeight - 1)}px;
						"
						aria-label="{noteName(n.note, {
							convention: settings.octaveConvention
						})}, velocity {n.velocity ?? 96}"
						aria-pressed={selected === i}
						onclick={() => audition(i)}
					></button>
				{/each}

				{#if playheadPct !== null}
					<div
						class="absolute top-0 bottom-0 w-px bg-foreground/70"
						style="left: {playheadPct}%"
						aria-hidden="true"
					></div>
				{/if}
			</div>
		</div>

		{#if velocityLane}
			<!--
				The fourth number, in the place every DAW puts it: below, smaller,
				and easy to forget about. That placement is itself worth pointing at
				— it is why so much programmed music arrives with every note at the
				same velocity.
			-->
			<div class="flex border-t">
				<div
					class="flex w-11 shrink-0 items-end justify-end border-r bg-surface-sunken pr-1.5 pb-1"
				>
					<span class="label">Vel</span>
				</div>
				<div class="panel-sunken relative h-14 flex-1">
					{#each notes as n, i (i)}
						<button
							class={cn(
								'absolute bottom-0 w-[3px] rounded-t-[1px] transition-colors',
								selected === i ? 'bg-foreground' : 'bg-msg-note/60 hover:bg-msg-note'
							)}
							style="left: {pct(n.start / totalBeats)}; height: {((n.velocity ?? 96) / 127) * 100}%"
							aria-label="Velocity {n.velocity ?? 96}"
							onclick={() => audition(i)}
						></button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!--
		The reveal. Fixed height whether or not anything is selected, so clicking
		a note does not shove the rest of the lesson down the page.
	-->
	<div class="flex min-h-[4.5rem] flex-col justify-center rounded-lg border bg-surface-sunken p-3">
		{#if current && onBytes && offBytes}
			<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
				<div>
					<p class="label">Pitch</p>
					<p class="tnum font-mono text-sm">
						{current.note}
						<span class="text-muted-foreground">
							· {noteName(current.note, { convention: settings.octaveConvention })}
						</span>
					</p>
				</div>
				<div>
					<p class="label">Start · length</p>
					<p class="tnum font-mono text-sm">
						beat {(current.start + 1).toFixed(2)} · {current.duration.toFixed(2)}
					</p>
				</div>
				<div>
					<p class="label">Velocity</p>
					<p class="tnum font-mono text-sm">{current.velocity ?? 96}</p>
				</div>
			</div>
			<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
				On the wire that rectangle is two messages, not one:
				<code class="rounded-sm bg-muted px-1 font-mono text-msg-note">{hex(onBytes)}</code>
				when it starts and
				<code class="rounded-sm bg-muted px-1 font-mono">{hex(offBytes)}</code>
				when it ends. Its <em>length</em> is the gap between them, and exists nowhere in the data.
			</p>
		{:else}
			<p class="text-sm text-muted-foreground">
				Click any rectangle to hear it and see the bytes it becomes.
			</p>
		{/if}
	</div>
</div>
