<script lang="ts">
	/**
	 * The Jukebox.
	 *
	 * Every other tool in the Lab is here because a lesson needed it. This one
	 * is here because an app about music that never plays any is a strange
	 * object — and because the fastest way to understand that MIDI is a
	 * description rather than a recording is to take a tune you have known since
	 * childhood, hand it to a harpsichord, then a marimba, then a church organ,
	 * and hear that not one note moved.
	 *
	 * It is deliberately a toy. There is no checkpoint, nothing to complete, and
	 * no next page. You press things and music comes out, and the monitor
	 * underneath shows exactly what went down the wire while it did.
	 */
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import PianoRoll from '$lib/components/midi/PianoRoll.svelte';
	import Staff from '$lib/components/midi/Staff.svelte';
	import Scope from '$lib/components/midi/Scope.svelte';
	import { MELODIES, melody, melodyNotes, round } from '$lib/music/melodies';
	import { phraseBeats } from '$lib/music/notation';
	import { SequencePlayer, notesToEvents } from '$lib/midi/player.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { GM_FAMILIES, GM_PROGRAMS } from '$lib/midi/constants';
	import { Button } from '$lib/components/ui/button';
	import {
		NativeSelect,
		NativeSelectOption,
		NativeSelectOptGroup
	} from '$lib/components/ui/native-select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon, ShuffleIcon, RepeatIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	let chosen = $state(MELODIES[0].id);
	const current = $derived(melody(chosen));

	let program = $state<number | null>(null);
	let shift = $state(0);
	let tempo = $state<number | null>(null);
	let loop = $state(false);
	/** Layer the melody against itself, a bar or two apart. */
	let canon = $state(false);

	const player = new SequencePlayer();

	const bpm = $derived(tempo ?? current.bpm);
	const voice = $derived(program ?? current.program);

	/*
	 * A round is not a special melody, it is the same melody entered twice. The
	 * two voices go on different channels so the monitor colours them apart and
	 * so each can hold its own program — which is also exactly how you would do
	 * it on real hardware.
	 */
	const notes = $derived(
		canon
			? round(current.id, [
					{ channel: 0, delay: 0, transpose: shift },
					{
						channel: 1,
						delay: Math.max(4, Math.round(phraseBeats(current.notes) / 4)),
						transpose: shift
					}
				])
			: melodyNotes(current.id, { channel: 0, transpose: shift })
	);

	const events = $derived(notesToEvents(notes, bpm));

	async function toggle() {
		if (player.playing) return player.stop();
		await engine.wake();
		engine.programChange(voice, 0);
		if (canon) engine.programChange(voice, 1);
		player.play(events, { loop });
	}

	async function pick(id: string) {
		const wasPlaying = player.playing;
		player.stop();
		chosen = id;
		program = null;
		tempo = null;
		shift = 0;
		if (wasPlaying) {
			await engine.wake();
			engine.programChange(melody(id).program, 0);
			player.play(notesToEvents(melodyNotes(id, { channel: 0 }), melody(id).bpm), { loop });
		}
	}

	/** Anything but the one already playing. */
	function surprise() {
		const others = MELODIES.filter((m) => m.id !== chosen);
		pick(others[Math.floor(Math.random() * others.length)].id);
	}

	const pct = $derived(
		player.duration ? Math.min(100, (player.position / player.duration) * 100) : 0
	);
</script>

<svelte:head>
	<title>Jukebox — MIDI Lab</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
	<PageHeader
		title="Jukebox"
		lead="Music old enough to be nobody's property, played by describing it. Change the instrument, the key or the speed — the notes never move."
	/>

	<div class="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
		<!--
			The shelf. Composer and date carry their weight: half the pleasure is
			noticing how old some of this is.

			Second on a phone and first on a wide screen. Stacked, a list of
			thirteen is a whole screenful before you reach the thing that plays
			them — so on a phone the player comes first and the shelf scrolls
			inside itself underneath. Side by side there is no such conflict, and
			reading order and visual order agree again.
		-->
		<div class="order-2 flex flex-col gap-1.5 lg:order-1">
			<div class="flex items-center justify-between">
				<span class="label">{MELODIES.length} pieces</span>
				<Button variant="ghost" size="sm" class="h-7 gap-1.5 text-xs" onclick={surprise}>
					<HugeiconsIcon icon={ShuffleIcon} size={13} />
					Surprise me
				</Button>
			</div>
			<ul
				class="flex max-h-[17rem] scrollbar-thin flex-col gap-1 overflow-y-auto pr-1 lg:max-h-[38rem]"
			>
				{#each MELODIES as m (m.id)}
					<li>
						<button
							class={cn(
								'flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
								m.id === chosen
									? 'border-msg-note/50 bg-msg-note-bg'
									: 'hover:border-foreground/25 hover:bg-accent/40'
							)}
							aria-pressed={m.id === chosen}
							onclick={() => pick(m.id)}
						>
							<span class={cn('text-sm font-medium', m.id === chosen && 'text-msg-note')}>
								{m.title}
							</span>
							<span class="text-xs text-muted-foreground">{m.composer} · {m.year}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>

		<div class="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
			<div class="flex flex-col gap-3 rounded-lg border bg-card p-4">
				<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
					<div class="min-w-0">
						<h2 class="text-lg font-semibold">{current.title}</h2>
						<p class="text-sm text-muted-foreground">{current.composer} · {current.year}</p>
					</div>
					<div class="flex shrink-0 items-center gap-1.5">
						<Button
							variant={loop ? 'default' : 'outline'}
							size="sm"
							class="gap-1.5"
							aria-pressed={loop}
							onclick={() => (loop = !loop)}
						>
							<HugeiconsIcon icon={RepeatIcon} size={13} />
							Loop
						</Button>
						<Button variant="default" size="sm" class="gap-1.5" onclick={toggle}>
							<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={14} />
							{player.playing ? 'Stop' : 'Play'}
						</Button>
					</div>
				</div>

				<p class="text-sm leading-relaxed text-muted-foreground">{current.note}</p>

				{#if current.verified}
					<p class="text-2xs text-muted-foreground">
						Transcription checked against {current.verified}.
					</p>
				{/if}

				<div class="h-1 overflow-hidden rounded-full bg-muted">
					<div
						class="h-full bg-msg-note transition-[width] duration-75"
						style="width: {player.playing ? pct : 0}%"
					></div>
				</div>
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1.5 rounded-lg border p-3">
					<span class="label">Instrument</span>
					<NativeSelect
						value={String(voice)}
						onchange={(e) => {
							program = Number((e.currentTarget as HTMLSelectElement).value);
							engine.wake().then(() => {
								engine.programChange(program!, 0);
								if (canon) engine.programChange(program!, 1);
							});
						}}
					>
						{#each GM_FAMILIES as family, f (family)}
							<NativeSelectOptGroup label={family}>
								{#each Array.from({ length: 8 }, (_, i) => f * 8 + i) as p (p)}
									<NativeSelectOption value={String(p)}>{GM_PROGRAMS[p]}</NativeSelectOption>
								{/each}
							</NativeSelectOptGroup>
						{/each}
					</NativeSelect>
					<span class="text-2xs text-muted-foreground">
						One Program Change. Not a sample of audio moves.
					</span>
				</label>

				<div class="flex flex-col gap-3 rounded-lg border p-3">
					<label class="flex items-center gap-3">
						<span class="label w-16 shrink-0">Key</span>
						<input
							type="range"
							min="-12"
							max="12"
							step="1"
							bind:value={shift}
							aria-label="Transpose in semitones"
							class="h-1.5 min-w-0 flex-1 accent-msg-note"
						/>
						<span class="tnum w-16 shrink-0 text-right text-xs text-muted-foreground">
							{shift === 0 ? 'as written' : `${shift > 0 ? '+' : ''}${shift}`}
						</span>
					</label>
					<label class="flex items-center gap-3">
						<span class="label w-16 shrink-0">Tempo</span>
						<input
							type="range"
							min="40"
							max="220"
							step="1"
							value={bpm}
							oninput={(e) => (tempo = Number(e.currentTarget.value))}
							aria-label="Tempo in beats per minute"
							class="h-1.5 min-w-0 flex-1 accent-msg-note"
						/>
						<span class="tnum w-16 shrink-0 text-right text-xs text-muted-foreground">
							{bpm} BPM
						</span>
					</label>
					<label class="flex items-center gap-2 text-xs text-muted-foreground">
						<input
							type="checkbox"
							bind:checked={canon}
							onchange={() => player.stop()}
							class="accent-msg-note"
						/>
						Play it against itself, a phrase apart — a round, on two channels
					</label>
				</div>
			</div>

			<PianoRoll
				{notes}
				{bpm}
				height={190}
				controls={false}
				progress={player.playing && player.duration ? player.position / player.duration : null}
			/>

			<div class="grid gap-3 sm:grid-cols-2">
				<Staff />
				<Scope label="What is coming out" height={120} />
			</div>

			<p class="text-sm leading-relaxed text-muted-foreground">
				Every one of these is typed out from the score as note numbers and durations — the
				compositions are centuries out of copyright, and nothing here was taken from anybody's file.
				Reach for the transpose slider while it plays: transposition in MIDI is adding a constant to
				an integer, which is why it costs nothing and never degrades.
			</p>
		</div>
	</div>
</div>
