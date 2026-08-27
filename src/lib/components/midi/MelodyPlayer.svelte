<script lang="ts">
	/**
	 * A tune you already know, playing through whatever instrument you point at
	 * it.
	 *
	 * `PhrasePlayer` is the plain version of this and stays where a lesson needs
	 * a purpose-built figure — five notes at five velocities makes a point that
	 * no real music makes as cleanly. This one is for the other case: when the
	 * point lands harder because you have known the tune since you were six.
	 *
	 * It sends the melody's own suggested program before playing, so a piece
	 * arrives on an instrument that suits it rather than on whatever the last
	 * widget left behind — and then hands you the row of alternatives, because
	 * "the notes did not change, the instrument did" is the first claim this
	 * course makes and this is the most direct way to hear it.
	 */
	import { SequencePlayer, notesToEvents } from '$lib/midi/player.svelte';
	import { melody, melodyNotes, round, MELODIES } from '$lib/music/melodies';
	import { engine } from '$lib/midi/engine.svelte';
	import VoicePicker from './VoicePicker.svelte';
	import { gmProgramName } from '$lib/midi/constants';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		/** Melody id. Omit to let the reader choose from the whole library. */
		id?: string;
		/** Offer a row of instruments to hear the same notes through. */
		voices?: number[] | false;
		/** Offer a transpose control. */
		transpose?: boolean;
		/** Show composer, year and the one-line fact. */
		credit?: boolean;
		/**
		 * Play the melody against itself: several entries, each on its own
		 * channel, `delay` beats apart. A round is not a different piece of
		 * music — it is one phrase, addressed several times — which is exactly
		 * the point sixteen channels exists to make.
		 */
		voicesInRound?: { channel: number; delay: number; program?: number; label?: string }[];
		channel?: number;
		loop?: boolean;
		class?: string;
	}
	let {
		id,
		voices = false,
		transpose = false,
		credit = true,
		voicesInRound,
		channel = 0,
		loop = false,
		class: className
	}: Props = $props();

	// Only consulted when no `id` was given, so it does not need to start from one.
	let chosen = $state(MELODIES[0].id);
	const current = $derived(melody(id ?? chosen));

	let program = $state<number | null>(null);
	let shift = $state(0);

	const player = new SequencePlayer();

	const notes = $derived(
		voicesInRound?.length
			? round(
					current.id,
					voicesInRound.map((v) => ({ channel: v.channel, delay: v.delay, transpose: shift }))
				)
			: melodyNotes(current.id, { channel, transpose: shift })
	);
	const events = $derived(notesToEvents(notes, current.bpm));
	const pct = $derived(
		player.duration ? Math.min(100, (player.position / player.duration) * 100) : 0
	);

	/*
	 * The melody's own program is the default, and it applies the moment you
	 * press play rather than when the component mounts — four of these on a page
	 * all setting the channel program on load would leave the last one to mount
	 * holding the instrument, which is not what any of them asked for.
	 */
	async function toggle() {
		if (player.playing) {
			player.stop();
			return;
		}
		await engine.wake();
		if (voicesInRound?.length) {
			for (const v of voicesInRound) {
				engine.programChange(v.program ?? program ?? current.program, v.channel);
			}
		} else {
			engine.programChange(program ?? current.program, channel);
		}
		player.play(events, { loop });
	}

	async function pickVoice(p: number) {
		program = p;
		await engine.wake();
		engine.programChange(p, channel);
	}

	const voiceList = $derived(voices === false ? [] : voices);

	/** Transposition in semitones, named the way a musician would say it. */
	const shiftLabel = $derived(
		shift === 0
			? 'as written'
			: `${shift > 0 ? '+' : ''}${shift} semitone${Math.abs(shift) === 1 ? '' : 's'}`
	);
</script>

<div class={cn('flex flex-col gap-3 rounded-lg border bg-card p-4', className)}>
	<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
		<div class="min-w-0 flex-1">
			{#if id}
				<p class="text-sm font-semibold">{current.title}</p>
			{:else}
				<label class="flex flex-col gap-1">
					<span class="label">Melody</span>
					<select
						bind:value={chosen}
						onchange={() => {
							player.stop();
							program = null;
						}}
						class="w-full rounded-md border bg-surface-sunken px-2 py-1.5 text-sm"
					>
						{#each MELODIES as m (m.id)}
							<option value={m.id}>{m.title} · {m.composer}</option>
						{/each}
					</select>
				</label>
			{/if}
			{#if credit}
				<p class="mt-0.5 text-xs text-muted-foreground">
					{current.composer} · {current.year}
				</p>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-1.5">
			{#if !voicesInRound?.length}
				<VoicePicker value={program ?? current.program} onValue={(p) => (program = p)} {channel} />
			{/if}
			<Button variant="default" size="sm" class="gap-1.5" onclick={toggle}>
				<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={14} />
				{player.playing ? 'Stop' : 'Play'}
			</Button>
		</div>
	</div>

	{#if player.playing}
		<div class="h-1 overflow-hidden rounded-full bg-muted">
			<div class="h-full bg-msg-note transition-[width] duration-75" style="width: {pct}%"></div>
		</div>
	{/if}

	{#if credit}
		<p class="text-sm leading-relaxed text-muted-foreground">{current.note}</p>
	{/if}

	{#if voiceList.length}
		<div class="flex flex-col gap-1.5">
			<span class="label">Same notes, different instrument</span>
			<div class="flex flex-wrap gap-1.5">
				{#each voiceList as p (p)}
					<button
						class={cn(
							'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
							(program ?? current.program) === p
								? 'border-msg-program bg-msg-program-bg text-msg-program'
								: 'hover:border-foreground/30 hover:bg-accent/40'
						)}
						aria-pressed={(program ?? current.program) === p}
						onclick={() => pickVoice(p)}
					>
						{gmProgramName(p)}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if transpose}
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
			<span class="label">Transpose</span>
			<input
				type="range"
				min="-12"
				max="12"
				step="1"
				bind:value={shift}
				aria-label="Transpose in semitones"
				class="h-1.5 min-w-40 flex-1 accent-msg-note"
			/>
			<span class="tnum w-28 text-right text-xs text-muted-foreground">{shiftLabel}</span>
		</div>
	{/if}
</div>
