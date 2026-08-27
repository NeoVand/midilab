<script lang="ts">
	/**
	 * Chords as arithmetic, which is the only way MIDI can see them.
	 *
	 * There is no chord message. A chord is some Note Ons that happen to
	 * overlap, and every name musicians have for one — major, minor, dominant
	 * seventh — is a shorthand for a set of distances from a root note. That is
	 * excellent news for anybody arriving here from programming: the whole
	 * subject is addition, and this widget is the addition table with a speaker
	 * attached.
	 *
	 * Both directions are offered because they teach different things. Playing a
	 * named chord tells you what the name sounds like; moving the root under a
	 * fixed set of intervals tells you that the name is about the *shape*, not
	 * about the notes.
	 */
	import { untrack } from 'svelte';
	import VoicePicker from './VoicePicker.svelte';
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { noteName, intervalName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		/** Where the root slider starts. The reader moves it from there. */
		root?: number;
		class?: string;
	}
	let { root: startRoot = 60, class: className }: Props = $props();

	interface Quality {
		id: string;
		name: string;
		symbol: string;
		steps: number[];
		feel: string;
	}

	/*
	 * Six qualities, not thirty. The list stops where the returns do: these
	 * cover the overwhelming majority of Western popular and classical
	 * harmony, and a longer list would turn a demonstration into a lookup
	 * table — which is what the reference page is for.
	 */
	const QUALITIES: Quality[] = [
		{
			id: 'maj',
			name: 'Major',
			symbol: '',
			steps: [0, 4, 7],
			feel: 'Bright, settled, the default.'
		},
		{
			id: 'min',
			name: 'Minor',
			symbol: 'm',
			steps: [0, 3, 7],
			feel: 'One semitone lower in the middle. Darker, and that is the whole difference.'
		},
		{
			id: 'dim',
			name: 'Diminished',
			symbol: '°',
			steps: [0, 3, 6],
			feel: 'Both upper notes squeezed down. Unstable — it wants to move somewhere.'
		},
		{
			id: 'aug',
			name: 'Augmented',
			symbol: '+',
			steps: [0, 4, 8],
			feel: 'Both upper notes stretched up. Evenly spaced, and therefore rootless and dreamlike.'
		},
		{
			id: 'dom7',
			name: 'Dominant 7th',
			symbol: '7',
			steps: [0, 4, 7, 10],
			feel: 'Major plus a fourth note that leans. The engine of blues and of every cadence.'
		},
		{
			id: 'maj7',
			name: 'Major 7th',
			symbol: 'maj7',
			steps: [0, 4, 7, 11],
			feel: 'One semitone higher than the dominant, and an entirely different mood: soft, hovering.'
		}
	];

	// Seeded once and then owned by the slider; the prop is a starting point,
	// not a binding, so it deliberately does not track later changes.
	let root = $state(untrack(() => startRoot));
	let quality = $state<Quality>(QUALITIES[0]);

	/*
	 * A grand piano. Chord quality is carried by how the notes colour each other
	 * while they overlap, so the voice has to hold them — and a piano is the
	 * instrument almost everybody has heard chords on.
	 */
	let program = $state(0);

	const notes = $derived(quality.steps.map((s) => root + s));
	const name = $derived(
		`${noteName(root, { convention: settings.octaveConvention, octave: false })}${quality.symbol}`
	);

	const player = new SequencePlayer();

	/** Block first, then broken — the same notes as harmony and as a line. */
	function play() {
		const spec: NoteSpec[] = [
			...notes.map((n) => ({ note: n, start: 0, duration: 1.6, velocity: 88, channel: 0 })),
			...notes.map((n, i) => ({
				note: n,
				start: 2 + i * 0.4,
				duration: 0.38,
				velocity: 84,
				channel: 0
			}))
		];
		engine.wake().then(() => {
			engine.programChange(program, 0);
			player.play(notesToEvents(spec, 100));
		});
	}
</script>

<div class={cn('flex flex-col gap-4', className)}>
	<div class="flex flex-wrap gap-1.5">
		{#each QUALITIES as q (q.id)}
			<button
				class={cn(
					'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
					quality.id === q.id
						? 'border-msg-note bg-msg-note-bg text-msg-note'
						: 'hover:border-foreground/30 hover:bg-accent/40'
				)}
				aria-pressed={quality.id === q.id}
				onclick={() => {
					quality = q;
					play();
				}}
			>
				{q.name}
			</button>
		{/each}
	</div>

	<div class="flex flex-col gap-3 rounded-lg border bg-surface-sunken p-4">
		<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<p class="text-2xl font-semibold">{name}</p>
			<div class="flex items-center gap-1.5">
				<VoicePicker bind:value={program} />
				<Button variant="outline" size="sm" class="gap-1.5" onclick={play}>
					<HugeiconsIcon icon={PlayIcon} size={14} />
					Hear it
				</Button>
			</div>
		</div>

		<!--
			The recipe, one row per note. Reading "+7 · perfect 5th · G" across is
			the moment the name and the arithmetic become the same fact.
		-->
		<ul class="flex flex-col gap-1">
			{#each quality.steps as step, i (step)}
				<li class="flex items-baseline gap-3 text-sm">
					<span class="tnum w-10 shrink-0 font-mono text-msg-note">
						{step === 0 ? 'root' : `+${step}`}
					</span>
					<span class="tnum w-12 shrink-0 font-mono text-muted-foreground">{notes[i]}</span>
					<span class="w-14 shrink-0 font-medium">
						{noteName(notes[i], { convention: settings.octaveConvention })}
					</span>
					<span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
						{step === 0 ? 'what the chord is named after' : intervalName(step)}
					</span>
				</li>
			{/each}
		</ul>

		<p class="text-sm leading-relaxed text-muted-foreground">{quality.feel}</p>
	</div>

	<label class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
		<span class="label">Root</span>
		<input
			type="range"
			min="48"
			max="72"
			step="1"
			bind:value={root}
			class="h-1.5 min-w-40 flex-1 accent-msg-note"
		/>
		<span class="tnum w-24 text-right text-xs text-muted-foreground">
			{noteName(root, { convention: settings.octaveConvention })} · {root}
		</span>
	</label>
	<p class="text-xs leading-relaxed text-muted-foreground">
		Move the root and the numbers on the left never change. That is what a chord name is: a shape,
		not a set of notes.
	</p>
</div>
