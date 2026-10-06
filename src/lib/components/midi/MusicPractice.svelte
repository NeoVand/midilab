<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import Keyboard from './Keyboard.svelte';
	import PadGrid from './PadGrid.svelte';
	import { bus } from '$lib/midi/bus';
	import type { MidiMessage } from '$lib/midi/messages';
	import type { MidiOrigin } from '$lib/midi/bus';
	import { engine } from '$lib/midi/engine.svelte';
	import { SequencePlayer, notesToEvents } from '$lib/midi/player.svelte';
	import { audio } from '$lib/audio/engine';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { GM_DRUMS } from '$lib/midi/constants';
	import {
		evaluatePractice,
		completeHeldNotes,
		practiceBeats,
		type PracticeNote,
		type PlayedNote,
		type PracticeResult
	} from '$lib/music/practice';

	interface Props {
		id: string;
		title: string;
		notes: PracticeNote[];
		bpm?: number;
		program?: number;
		description?: string;
		assessVelocity?: boolean;
		assessDuration?: boolean;
		oncomplete?: () => void;
	}
	let {
		id,
		title,
		notes,
		bpm = 80,
		program = 0,
		description = 'Listen once, then play the same phrase after four count-in beats.',
		assessVelocity = false,
		assessDuration = false,
		oncomplete
	}: Props = $props();
	let tempo = $state(untrack(() => bpm));
	let offset = $state(0);
	let phase = $state<'idle' | 'counting' | 'playing' | 'done'>('idle');
	let beat = $state(0);
	let played = $state<PlayedNote[]>([]);
	let result = $state<PracticeResult | null>(null);
	let error = $state('');
	let instrumentArea: HTMLDivElement | undefined;
	const player = new SequencePlayer();
	const length = $derived(practiceBeats(notes));
	const drums = $derived(notes.every((note) => note.channel === 9));
	const pads = $derived([...new Set(notes.map((note) => note.note))]);
	const low = $derived(
		Math.max(0, Math.floor(Math.min(...notes.map((note) => note.note)) / 12) * 12 - 12)
	);
	const active = $derived(phase === 'counting' || phase === 'playing');
	let startsAt = 0;
	let endsAt = 0;
	let frame = 0;
	let session = 0;
	let clicks: OscillatorNode[] = [];

	function stop() {
		session++;
		cancelAnimationFrame(frame);
		frame = 0;
		for (const click of clicks) {
			try {
				click.stop();
			} catch {
				/* already ended */
			}
			click.disconnect();
		}
		clicks = [];
		player.stop();
		phase = 'idle';
	}

	function click(at: number, accent: boolean) {
		const context = audio.context;
		const destination = audio.destination;
		if (!context || !destination) return;
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.frequency.value = accent ? 1500 : 1000;
		gain.gain.setValueAtTime(0.13, at);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
		oscillator.connect(gain).connect(destination);
		oscillator.start(at);
		oscillator.stop(at + 0.07);
		oscillator.onended = () => {
			oscillator.disconnect();
			gain.disconnect();
		};
		clicks.push(oscillator);
	}

	async function listen() {
		stop();
		error = '';
		const token = session;
		try {
			await engine.wake();
			if (token !== session) return;
			if (!drums)
				engine.send(
					{ type: 'controlChange', channel: 0, controller: 64, value: 0 },
					undefined,
					undefined,
					'demo'
				);
			if (!drums)
				engine.send({ type: 'programChange', channel: 0, program }, undefined, undefined, 'demo');
			await player.play(notesToEvents(notes, tempo));
		} catch {
			error = 'Sound could not start. Try Listen again.';
		}
	}

	async function attempt() {
		stop();
		const token = session;
		error = '';
		result = null;
		played = [];
		try {
			await engine.wake();
		} catch {
			error = 'Sound could not start. Try again.';
			return;
		}
		if (token !== session) return;
		if (!drums)
			engine.send(
				{ type: 'controlChange', channel: 0, controller: 64, value: 0 },
				undefined,
				undefined,
				'demo'
			);
		if (!drums)
			engine.send({ type: 'programChange', channel: 0, program }, undefined, undefined, 'demo');
		const secondsPerBeat = 60 / tempo;
		const countAt = audio.now + 0.15;
		const perfAt = performance.now() + 150;
		startsAt = perfAt + 4 * secondsPerBeat * 1000;
		endsAt = startsAt + length * secondsPerBeat * 1000;
		for (let i = 0; i < length + 4; i++) click(countAt + i * secondsPerBeat, i % 4 === 0);
		phase = 'counting';
		instrumentArea?.querySelector<HTMLElement>('[role="group"]')?.focus();
		const update = () => {
			const now = performance.now();
			if (now >= endsAt) {
				const inputDelay = Math.min(300, Math.max(0, Number(offset) || 0));
				const finished = completeHeldNotes(played, (endsAt - startsAt - inputDelay) / 1000);
				result = evaluatePractice(notes, finished, tempo, assessVelocity, assessDuration);
				phase = 'done';
				if (result.passed) oncomplete?.();
				return;
			}
			phase = now < startsAt ? 'counting' : 'playing';
			beat = Math.max(
				1,
				Math.floor((now - (phase === 'counting' ? perfAt : startsAt)) / (secondsPerBeat * 1000)) + 1
			);
			frame = requestAnimationFrame(update);
		};
		frame = requestAnimationFrame(update);
	}

	function capture(message: MidiMessage, at: number, origin?: MidiOrigin) {
		if (!active || origin !== 'performer' || at < startsAt - 300 || at > endsAt) return;
		const inputDelay = Math.min(300, Math.max(0, Number(offset) || 0));
		const time = (at - startsAt - inputDelay) / 1000;
		if (message.type === 'noteOn' && message.velocity > 0)
			played = [
				...played,
				{ note: message.note, start: time, velocity: message.velocity, channel: message.channel }
			];
		else if (message.type === 'noteOff' || (message.type === 'noteOn' && message.velocity === 0)) {
			const index = played.findLastIndex(
				(note) =>
					note.note === message.note &&
					note.channel === message.channel &&
					note.duration === undefined
			);
			if (index >= 0)
				played = played.map((note, i) =>
					i === index ? { ...note, duration: time - note.start } : note
				);
		}
	}
	onMount(() => {
		// The local tap fires once even when a note is routed to several outputs.
		const stopLocal = engine.onLocalSend((message, at, _audioTime, origin) =>
			capture(message, at ?? performance.now(), origin)
		);
		const stopIncoming = bus.subscribe((event) => {
			if (event.direction === 'in') capture(event.message, event.time, event.origin);
		});
		return () => {
			stopLocal();
			stopIncoming();
		};
	});
	onDestroy(stop);
</script>

<Card.Root data-practice={id}>
	<Card.Header>
		<Card.Title>{title}</Card.Title>
		<Card.Description>{description}</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<div class="flex flex-wrap gap-2">
			{#each notes as note, i (`${note.start}-${note.note}-${i}`)}
				<span class="rounded-md border px-2 py-1 text-xs"
					><strong
						>{drums
							? GM_DRUMS[note.note]
							: noteName(note.note, { convention: settings.octaveConvention })}</strong
					><span class="ml-2 text-muted-foreground"
						>beat {note.start + 1}{#if assessDuration}
							· hold {note.duration} beats{/if}{#if assessVelocity}
							· {note.velocity && note.velocity < 65 ? 'soft' : 'strong'}{/if}</span
					></span
				>
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Button variant="outline" onclick={listen} disabled={active}
				>{player.playing ? 'Listen again' : 'Listen'}</Button
			>
			<Button onclick={attempt} disabled={active}>Play it back</Button>
			{#if active}<Button variant="outline" onclick={stop}>Cancel</Button>{/if}
			<Button
				variant="ghost"
				disabled={active}
				onclick={() => {
					tempo = Math.max(40, tempo - 10);
				}}>Slower retry</Button
			>
			<Badge variant="secondary">{tempo} BPM</Badge>
		</div>
		<div class="min-h-8 text-lg font-medium" aria-live="polite">
			{#if phase === 'counting'}Count in: {beat} of 4
			{:else if phase === 'playing'}Play — beat {((beat - 1) % 4) + 1}, bar {Math.ceil(beat / 4)}
			{:else if result}{result.passed
					? 'You played the whole phrase in time.'
					: `${result.correct} of ${result.total} notes matched. Listen to the tricky part and try again.`}
			{:else}Your turn starts after four clicks.{/if}
		</div>
		<div
			{@attach (element) => {
				instrumentArea = element;
				return () => {
					instrumentArea = undefined;
				};
			}}
		>
			{#if drums}<PadGrid notes={pads} columns={Math.min(4, pads.length)} channel={9} />
			{:else}<Keyboard {low} octaves={2} channel={0} labels="all" height={115} />{/if}
		</div>
		<p class="text-xs leading-relaxed text-muted-foreground">
			MIDI input: channel {drums ? 10 : 1}. {assessVelocity
				? 'For soft and strong notes, use pointer position or a velocity-sensitive MIDI controller.'
				: ''}
		</p>
		{#if assessDuration}<p class="text-xs leading-relaxed text-muted-foreground">
				This exercise also checks how long you hold each physical key. Lift for the rests; the sound
				may continue briefly through the instrument's release. The sustain pedal is released when
				the attempt starts.
			</p>{/if}
		{#if result}
			<ul class="flex flex-col gap-1 text-xs">
				{#each result.notes as feedback, i (`${feedback.expected.start}-${feedback.expected.note}-${i}`)}
					<li>
						<strong
							>{drums
								? GM_DRUMS[feedback.expected.note]
								: noteName(feedback.expected.note, {
										convention: settings.octaveConvention
									})}</strong
						>: {feedback.problem === 'correct'
							? assessDuration
								? 'in time; key length matched'
								: 'in time'
							: feedback.problem === 'wrong-note'
								? `expected this note; heard ${feedback.played ? noteName(feedback.played.note, { convention: settings.octaveConvention }) : 'nothing'}`
								: feedback.problem === 'missing'
									? 'missing — leave the rests, then play this note'
									: feedback.problem === 'velocity'
										? 'change the strength: aim for the indicated soft or strong note'
										: feedback.problem === 'too-short'
											? 'released too soon — hold the key for the indicated length'
											: feedback.problem === 'too-long'
												? 'held too long — lift the key before the rest or next entrance'
												: `${Math.abs(feedback.timingMs ?? 0)} ms ${feedback.problem}`}
					</li>
				{/each}
				{#if result.extra}<li>
						{result.extra} extra {result.extra === 1 ? 'note' : 'notes'} — try leaving more space.
					</li>{/if}
			</ul>
		{/if}
		{#if error}<p role="alert" class="text-sm text-destructive">{error}</p>{/if}
		<details class="text-xs text-muted-foreground">
			<summary class="cursor-pointer">Timing adjustment</summary>
			<Field.Group class="mt-2"
				><Field.Field
					><Field.FieldLabel for={`${id}-offset`}>Input delay in milliseconds</Field.FieldLabel
					><Input
						id={`${id}-offset`}
						type="number"
						min="0"
						max="300"
						bind:value={offset}
						disabled={active}
					/><Field.FieldDescription
						>Leave at zero unless your controller consistently arrives late. This compensates the
						input delay when comparing your notes.</Field.FieldDescription
					></Field.Field
				></Field.Group
			>
		</details>
	</Card.Content>
</Card.Root>
