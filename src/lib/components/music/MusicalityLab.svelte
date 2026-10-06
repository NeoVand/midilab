<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { cn } from '$lib/utils';
	import { engine } from '$lib/midi/engine.svelte';
	import { bus } from '$lib/midi/bus';
	import { NOTE_NAMES_SHARP } from '$lib/midi/notes';
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';

	type Comparison = 'expression' | 'cadence' | 'variation';
	interface Phrase {
		id: string;
		label: string;
		caption: string;
		notes: NoteSpec[];
		harmony?: NoteSpec[];
		harmonyLabel?: string;
	}
	interface Contrast {
		id: Comparison;
		label: string;
		title: string;
		explanation: string;
		listenFor: string;
		phrases: [Phrase, Phrase];
	}
	let { initial = 'expression' }: { initial?: Comparison } = $props();
	const uid = $props.id();
	const BPM = 96;
	const beats = [0, 1, 2, 3, 4, 5, 6, 7, 8];
	const player = new SequencePlayer();
	let mode = $state(untrack(() => initial));
	let active = $state<string | null>(null);
	let error = $state('');
	let session = 0;

	function phrase(
		pitches: number[],
		starts: number[],
		durations: number[],
		velocities: number[]
	): NoteSpec[] {
		return pitches.map((note, index) => ({
			note,
			start: starts[index],
			duration: durations[index],
			velocity: velocities[index],
			channel: 0
		}));
	}
	function chord(pitches: number[], start: number, duration: number): NoteSpec[] {
		return pitches.map((note) => ({ note, start, duration, velocity: 38, channel: 1 }));
	}
	const contour = [60, 64, 67, 69, 67, 65, 64, 62, 60];
	const starts = [0, 0.5, 1, 2, 3, 4, 4.5, 5, 6];
	const cadenceStarts = [0, 0.5, 1, 2, 4, 4.5, 5, 6];
	const cadenceDurations = [0.35, 0.35, 0.7, 1.2, 0.35, 0.35, 0.7, 1.6];
	const cadenceTouch = [76, 81, 88, 94, 81, 72, 67, 59];
	const harmonyStart = [...chord([48, 52, 55], 0, 3.7), ...chord([43, 50, 53, 59], 4, 1.85)];
	const CONTRASTS: Contrast[] = [
		{
			id: 'expression',
			label: 'Touch & space',
			title: 'The same notes can tell a different story',
			explanation:
				'Both versions use the same pitches in the same order. The shaped phrase leans into its high note, gives the ending time, and leaves air between gestures.',
			listenFor:
				'Follow the rise to A. Listen to how the stronger arrival and quieter, longer ending change the direction of the phrase.',
			phrases: [
				{
					id: 'even',
					label: 'Even delivery',
					caption: 'Straight entrances, equally short notes, one velocity.',
					notes: phrase(
						contour,
						starts,
						contour.map(() => 0.42),
						contour.map(() => 80)
					)
				},
				{
					id: 'shaped',
					label: 'Shaped phrase',
					caption: 'Small timing shifts, varied lengths, a rise and fall in touch.',
					notes: phrase(
						contour,
						[0, 0.53, 1.02, 2, 3.08, 4, 4.48, 5.04, 6],
						[0.35, 0.4, 0.7, 0.8, 0.6, 0.34, 0.36, 0.65, 1.5],
						[74, 80, 88, 104, 80, 70, 76, 68, 56]
					)
				}
			]
		},
		{
			id: 'cadence',
			label: 'Question & answer',
			title: 'An ending gets its meaning from the journey',
			explanation:
				'The first bar is identical. In C major, the question stays on G7; the answer moves from G7 back to C while the melody approaches C from B. The quieter chords underneath give the ending its context.',
			listenFor:
				'Hear the last two melody notes against the changing chords. Does one ending invite another phrase? Your response can depend on what music you know.',
			phrases: [
				{
					id: 'question',
					label: 'Leave a question',
					caption: 'The second bar ends over the dominant, G7.',
					harmonyLabel: 'C → G7 → G7',
					notes: phrase(
						[60, 62, 64, 67, 65, 64, 62, 67],
						cadenceStarts,
						cadenceDurations,
						cadenceTouch
					),
					harmony: [...harmonyStart, ...chord([43, 50, 53, 59], 6, 1.7)]
				},
				{
					id: 'answer',
					label: 'Give an answer',
					caption: 'B rises to C as the harmony returns to the tonic.',
					harmonyLabel: 'C → G7 → C',
					notes: phrase(
						[60, 62, 64, 67, 65, 64, 59, 60],
						cadenceStarts,
						cadenceDurations,
						cadenceTouch
					),
					harmony: [...harmonyStart, ...chord([48, 52, 55], 6, 1.7)]
				}
			]
		},
		{
			id: 'variation',
			label: 'Repeat & vary',
			title: 'Give the listener something to recognise',
			explanation:
				'A four-note idea returns in the second bar. Exact repetition makes it familiar. The variation keeps the entrance pattern and reshapes the last two notes, so you hear both the connection and a new destination.',
			listenFor:
				'The first bar stays the same. In the second, find the two changed pitches and the longer final note. Try singing your own answer afterward.',
			phrases: [
				{
					id: 'repeat',
					label: 'Repeat the idea',
					caption: 'The same rhythm, contour and ending return.',
					notes: phrase(
						[60, 64, 67, 64, 60, 64, 67, 64],
						[0, 0.5, 1.5, 2.5, 4, 4.5, 5.5, 6.5],
						[0.35, 0.7, 0.7, 0.8, 0.35, 0.7, 0.7, 0.8],
						[88, 80, 94, 76, 88, 80, 94, 76]
					)
				},
				{
					id: 'vary',
					label: 'Change the destination',
					caption: 'The rhythm returns; the new ending reaches A, then G.',
					notes: phrase(
						[60, 64, 67, 64, 60, 64, 69, 67],
						[0, 0.5, 1.5, 2.5, 4, 4.5, 5.5, 6.5],
						[0.35, 0.7, 0.7, 0.8, 0.35, 0.7, 0.7, 1.15],
						[88, 80, 94, 76, 88, 80, 102, 68]
					)
				}
			]
		}
	];
	const contrast = $derived(CONTRASTS.find((item) => item.id === mode)!);
	const position = $derived(Math.min(8, (player.position * BPM) / 60));
	const x = (beat: number) => 48 + beat * 88;
	const y = (pitch: number) => 163 - (pitch - 59) * 10;
	function contourPath(notes: NoteSpec[]) {
		return notes
			.map((note, index) => `${index === 0 ? 'M' : 'L'}${x(note.start + 0.08)},${y(note.note)}`)
			.join(' ');
	}
	function stop() {
		session++;
		player.stop();
		active = null;
	}
	function select(value: Comparison) {
		stop();
		error = '';
		mode = value;
	}
	async function listen(selected: Phrase) {
		stop();
		error = '';
		const token = session;
		try {
			await engine.wake();
			if (token !== session) return;
			for (const channel of [0, 1]) {
				engine.send(
					{ type: 'controlChange', channel, controller: 64, value: 0 },
					undefined,
					undefined,
					'demo'
				);
				engine.send({ type: 'programChange', channel, program: 0 }, undefined, undefined, 'demo');
			}
			active = selected.id;
			await player.play(notesToEvents([...selected.notes, ...(selected.harmony ?? [])], BPM));
		} catch {
			if (token !== session) return;
			stop();
			error = 'Sound could not start. Select a phrase to try again.';
		}
	}
	onMount(() => {
		const unsubscribe = bus.subscribe((event) => {
			if (event.message.type === 'controlChange' && event.message.controller === 120) stop();
		});
		return () => {
			unsubscribe();
			stop();
		};
	});
</script>

<svelte:window onblur={stop} />
<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) stop();
	}}
/>

<section class="musicality-lab" aria-labelledby={`${uid}-title`}>
	<Field.Field>
		<Field.Label>Phrase comparison</Field.Label>
		<ToggleGroup.Root
			type="single"
			variant="outline"
			value={mode}
			spacing={2}
			class="flex-wrap"
			aria-label="Phrase comparison"
			onValueChange={(value) => {
				if (value) select(value as Comparison);
			}}
		>
			{#each CONTRASTS as item (item.id)}
				<ToggleGroup.Item value={item.id}>{item.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</Field.Field>
	<header>
		<h3 id={`${uid}-title`}>{contrast.title}</h3>
		<p>{contrast.explanation}</p>
	</header>
	<div class="phrase-pair">
		{#each contrast.phrases as selected, index (selected.id)}
			<figure
				class={cn(
					'phrase',
					`phrase-${index}`,
					player.playing && active === selected.id && 'sounding'
				)}
			>
				<div class="phrase-heading">
					<div>
						<span class="phrase-letter" aria-hidden="true">{index === 0 ? 'A' : 'B'}</span><strong
							>{selected.label}</strong
						>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={() => void listen(selected)}
						aria-label={`Hear ${index === 0 ? 'A' : 'B'}: ${selected.label}`}
						>{player.playing && active === selected.id ? 'Hear again' : 'Hear phrase'}</Button
					>
				</div>
				<svg
					viewBox="0 0 800 210"
					role="img"
					aria-label={`${selected.label}. ${selected.caption} Pitch rises vertically; time runs left to right. Ribbon length shows note duration, thickness and opacity show velocity.`}
				>
					{#each beats as beat (beat)}<line
							x1={x(beat)}
							x2={x(beat)}
							y1="25"
							y2="177"
							class={beat === 4 ? 'bar-divider' : 'beat-line'}
						/>{#if beat < 8}<text x={x(beat)} y="198" class="beat-label">{(beat % 4) + 1}</text
							>{/if}{/each}
					<text x="48" y="16" class="bar-label">Bar 1</text><text x={x(4)} y="16" class="bar-label"
						>Bar 2</text
					>
					<path d={contourPath(selected.notes)} class="contour" />
					{#each selected.notes as note (`${note.start}-${note.note}`)}
						{@const thickness = 7 + ((note.velocity ?? 80) / 127) * 10}
						<rect
							x={x(note.start)}
							y={y(note.note) - thickness / 2}
							width={note.duration * 88}
							height={thickness}
							rx="4"
							class="ribbon"
							fill-opacity={0.35 + ((note.velocity ?? 80) / 127) * 0.65}
						/>
						<text x={x(note.start) + 3} y={y(note.note) - thickness / 2 - 7} class="note-label"
							>{NOTE_NAMES_SHARP[note.note % 12]}</text
						>
					{/each}
					{#if player.playing && active === selected.id}<line
							x1={x(position)}
							x2={x(position)}
							y1="25"
							y2="177"
							class="playhead"
						/>{/if}
				</svg>
				<figcaption>
					<span>{selected.caption}</span>{#if selected.harmonyLabel}<strong
							>Harmony: {selected.harmonyLabel}</strong
						>{/if}
				</figcaption>
			</figure>
		{/each}
	</div>
	<div class="listening-guide">
		<p><strong>Listen for it.</strong> {contrast.listenFor}</p>
		<Button variant="outline" size="sm" onclick={stop} disabled={!player.playing}
			>Stop phrases</Button
		>
	</div>
	<p class="visual-key">
		Two original bars at {BPM} BPM. Higher ribbons = higher pitches; longer ribbons = longer notes; thicker,
		more opaque ribbons = stronger touch. The connecting line shows the melodic contour.
	</p>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.musicality-lab {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	h3 {
		font-size: 1.35rem;
		line-height: 1.35;
		font-weight: 650;
		letter-spacing: -0.035em;
	}
	header p {
		max-width: 68ch;
		font-size: 0.875rem;
		line-height: 1.75;
		color: var(--muted-foreground);
		margin-top: 0.5rem;
	}
	.phrase-pair {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.phrase {
		--phrase-color: var(--msg-cc);
		--phrase-bg: color-mix(in oklch, var(--msg-cc) 7%, var(--card));
		border: 1px solid var(--border);
		border-radius: 0.7rem;
		overflow: hidden;
	}
	.phrase-1 {
		--phrase-color: var(--msg-expr);
		--phrase-bg: color-mix(in oklch, var(--msg-expr) 7%, var(--card));
	}
	.phrase-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		padding: 0.8rem 1rem;
		gap: 0.7rem;
	}
	.phrase-heading > div {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.phrase-heading strong {
		font-size: 0.9rem;
		font-weight: 550;
	}
	.phrase-letter {
		color: var(--phrase-color);
		background: var(--phrase-bg);
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.phrase svg {
		display: block;
		width: 100%;
		height: auto;
		min-height: 130px;
		background: var(--phrase-bg);
	}
	.beat-line {
		stroke: var(--phrase-color);
		stroke-opacity: 0.2;
		stroke-dasharray: 2 5;
	}
	.bar-divider {
		stroke: var(--phrase-color);
		stroke-opacity: 0.3;
	}
	.beat-label,
	.bar-label {
		fill: var(--muted-foreground);
		font-size: 11px;
	}
	.note-label {
		fill: var(--phrase-color);
		font-size: 11px;
		font-weight: 650;
	}
	.ribbon {
		fill: var(--phrase-color);
		stroke: var(--phrase-color);
		stroke-width: 0.5;
	}
	.contour {
		fill: none;
		stroke: var(--phrase-color);
		stroke-width: 1.7;
		stroke-opacity: 0.45;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.playhead {
		stroke: var(--msg-program);
		stroke-width: 2;
	}
	.phrase figcaption {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.phrase figcaption strong {
		font-weight: 550;
		color: var(--phrase-color);
	}
	.sounding {
		border-color: var(--phrase-color);
	}
	.listening-guide {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		justify-content: space-between;
	}
	.listening-guide p {
		max-width: 60ch;
		font-size: 0.85rem;
		line-height: 1.7;
	}
	.listening-guide strong {
		font-weight: 600;
	}
	.visual-key {
		font-size: 0.75rem;
		line-height: 1.7;
		color: var(--muted-foreground);
	}
	.error {
		font-size: 0.8rem;
		color: var(--destructive);
	}
	@media (max-width: 520px) {
		.note-label {
			font-size: 24px;
		}
		.bar-label,
		.beat-label {
			font-size: 22px;
		}
		.listening-guide {
			flex-direction: column;
		}
		.phrase-heading {
			padding: 0.7rem;
		}
		.phrase svg {
			min-height: 145px;
		}
	}
</style>
