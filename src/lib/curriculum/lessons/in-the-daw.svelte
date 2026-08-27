<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import Term from '$lib/components/lesson/Term.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import PianoRoll from '$lib/components/midi/PianoRoll.svelte';
	import CcPanel from '$lib/components/midi/CcPanel.svelte';
	import CcLearn from '$lib/components/midi/CcLearn.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { melody } from '$lib/music/melodies';
	import { Button } from '$lib/components/ui/button';
	import type { NoteSpec } from '$lib/midi/player.svelte';

	const meta = lessonById('in-the-daw')!;

	const MINUET = melody('minuet-in-g');

	/*
	 * A deliberately human take: nothing lands on the grid and no two notes
	 * share a velocity. Quantising it is the demonstration, so it has to be
	 * worth quantising — a pattern that was already square would prove nothing.
	 */
	const RAW: NoteSpec[] = [
		{ note: 60, start: 0.03, duration: 0.42, velocity: 104 },
		{ note: 63, start: 0.47, duration: 0.4, velocity: 71 },
		{ note: 67, start: 0.98, duration: 0.44, velocity: 88 },
		{ note: 70, start: 1.56, duration: 0.36, velocity: 63 },
		{ note: 72, start: 1.97, duration: 0.9, velocity: 116 },
		{ note: 67, start: 2.94, duration: 0.4, velocity: 79 },
		{ note: 63, start: 3.44, duration: 0.4, velocity: 68 },
		{ note: 60, start: 3.91, duration: 1.1, velocity: 96 }
	];

	type Take = 'raw' | 'quantised' | 'flattened';
	let take = $state<Take>('raw');

	/** Snap to the nearest sixteenth. Exactly what a DAW's quantise button does. */
	const quantised: NoteSpec[] = RAW.map((n) => ({
		...n,
		start: Math.round(n.start * 4) / 4
	}));

	/** What a mouse-drawn part looks like: on the grid, and all one velocity. */
	const flattened: NoteSpec[] = quantised.map((n) => ({ ...n, velocity: 100 }));

	const shown = $derived(take === 'raw' ? RAW : take === 'quantised' ? quantised : flattened);

	const TAKES: { id: Take; label: string; note: string }[] = [
		{
			id: 'raw',
			label: 'As played',
			note: 'Nothing lands on a grid line and every velocity is different. This is what a performance looks like.'
		},
		{
			id: 'quantised',
			label: 'Quantised to 1/16',
			note: 'Every start time snapped to the nearest sixteenth. Tighter — and the tiny rushes and drags that made it breathe are gone for good.'
		},
		{
			id: 'flattened',
			label: 'Drawn with a mouse',
			note: 'On the grid and all one velocity, which is what you get when you click notes in rather than play them. Correct, and dead.'
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Most people meet MIDI inside a <Term>DAW</Term> — Ableton, Logic, FL Studio, Reaper, Bitwig, Cubase
			— and meet it as a grid of coloured rectangles. Everything in the previous three acts is underneath
			that grid, and this lesson is the join.
		</p>
		<p class="prose-body">
			Here is the whole of it in one sentence: <strong
				>a rectangle in a piano roll is a Note On, a Note Off, and the gap between them.</strong
			>
			Its vertical position is the note number. Its left edge is when the Note On is sent. Its right edge
			is when the Note Off is sent. Its colour intensity, or a bar in the lane underneath, is the velocity.
			That is four numbers, and there is no fifth.
		</p>
	</Section>

	<TryThis title="Click a rectangle. Watch it turn into bytes.">
		<PianoRoll notes={MINUET.notes} bpm={MINUET.bpm} height={200} />
		<p class="text-sm leading-relaxed">
			Petzold's Minuet in G, 1725, drawn the way your DAW would draw it. Every rectangle you click
			shows the two messages it becomes — and notice that the <em>length</em> of a note is nowhere
			in the data. It is the distance between two events that each know nothing about the other,
			which is exactly why notes get stuck when one of them goes missing. That is
			<Xref to="note-on-off" /> in picture form.
		</p>
	</TryThis>

	<Section title="Quantise: what the button actually does">
		<p class="prose-body">
			<Term>Quantise</Term> rounds every note's start time to the nearest grid position. That is the whole
			operation — it is one line of arithmetic per note, and it is destructive, because the original time
			is overwritten.
		</p>
		<div class="flex flex-wrap gap-1.5">
			{#each TAKES as t (t.id)}
				<Button
					variant={take === t.id ? 'default' : 'outline'}
					size="sm"
					onclick={() => (take = t.id)}
				>
					{t.label}
				</Button>
			{/each}
		</div>
		<PianoRoll notes={shown} bpm={92} height={150} />
		<p class="text-sm leading-relaxed text-muted-foreground">
			{TAKES.find((t) => t.id === take)?.note}
		</p>
		<Callout variant="gotcha" title="This is why programmed parts sound programmed">
			<p>
				Compare the velocity lane on the first take with the third. A real player never strikes two
				notes at exactly the same strength, and the difference between those two lanes is most of
				what people mean when they say a part sounds "fake". It is not the samples. It is a column
				of identical numbers.
			</p>
			<p class="mt-2">
				Every DAW offers quantise <em>by percentage</em> — 50% moves each note half way to the grid —
				precisely because 100% is usually too much. Reach for that slider before you reach for the button.
			</p>
		</Callout>
	</Section>

	<Section title="The lanes underneath">
		<p class="prose-body">
			Under the notes, a DAW keeps one lane per controller. Draw a curve in it and the DAW emits a
			stream of Control Change messages as the playhead crosses it — that is all
			<Term>automation</Term> is. A filter sweep in your arrangement is thirty or forty CC 74 messages
			a second going down the same cable as the notes.
		</p>
		<CcPanel controllers={[74, 71, 1, 7, 11, 91]} />
		<p class="text-sm leading-relaxed text-muted-foreground">
			Turn these and watch the dock at the bottom of the window. Each one is a lane you could have
			drawn instead. The nine worth knowing by number are in <Xref to="control-change" />.
		</p>
		<Callout variant="note" title="Automation has a bandwidth cost, and it is real">
			<p>
				A DIN cable carries about 3,125 bytes a second. One CC message is three of them. Automate
				four parameters at sixty updates a second on eight channels and you have spent more than
				half the cable on knobs — and the notes queue behind them. Over USB there is far more room,
				which is why this bites on hardware rigs and almost never in the box. The measurements are
				in <Xref to="latency-and-jitter" />.
			</p>
		</Callout>
	</Section>

	<Section title="Why your controller “does not work”">
		<p class="prose-body">
			Almost every "my knob does nothing" report is one of five things, and they are worth having in
			this order because the cheap checks come first.
		</p>
		<ol class="prose-body flex list-decimal flex-col gap-2.5 pl-5">
			<li>
				<strong>The track is not armed or not selected.</strong> Most DAWs route MIDI only to the record-armed
				track. Nothing else in this list matters until that is true.
			</li>
			<li>
				<strong>The channel does not match.</strong> The controller transmits on channel 1, the
				track listens on channel 3. See <Xref to="channels" />.
			</li>
			<li>
				<strong>The port is claimed by something else.</strong> On Windows a MIDI input can usually only
				be opened by one application at a time. A forgotten synth editor in the background will silently
				take it.
			</li>
			<li>
				<strong>The CC number means nothing to that plugin.</strong> The knob sends CC 74; the
				plugin was never told what CC 74 is. This is not a fault — see
				<Xref to="control-change" />.
			</li>
			<li>
				<strong>The plugin expects to be taught.</strong>
				<Term>MIDI Learn</Term>: right-click the parameter, choose Learn, move the knob. The plugin
				remembers the number so you never have to.
			</li>
		</ol>
		<Callout variant="key" title="The monitor settles it in ten seconds">
			<p>
				Every item on that list is answered by one question: <em
					>are the messages arriving at all?</em
				>
				If they show up here, the controller and the cable are fine and the problem is in the DAW's routing.
				If they do not, stop looking at the DAW.
			</p>
		</Callout>
		<MidiMonitor />
	</Section>

	<TryThis title="Teach something a controller number">
		<p class="text-sm leading-relaxed">
			This is MIDI Learn, in the same shape every plugin implements it. Arm it, move a knob on your
			hardware — or turn one above — and it binds.
		</p>
		<CcLearn />
	</TryThis>

	<Section title="Where the DAW is not just a piano roll">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">MIDI effects</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					Arpeggiators, chord generators, scale filters and note repeaters sit between your playing
					and the instrument and rewrite the stream. They are ordinary MIDI processors — nothing
					they do could not be done by the code in <Xref to="patterns" />.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Instruments as plugins</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					A <Term>virtual instrument</Term> receives exactly the messages a hardware synth would. The
					cable is a function call instead of five metres of DIN, and nothing else about the conversation
					changes.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Control surfaces</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					A <Term>control surface</Term> drives the DAW rather than an instrument, usually by speaking
					Mackie Control — which is ordinary MIDI messages given completely different meanings. A note
					number becomes a button; a <Xref to="pitch-bend" label="pitch bend" /> becomes a fader.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Export</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					Dragging a clip out of a DAW writes a Standard MIDI File — the same chunks and delta times
					you take apart by hand in <Xref to="midi-files" />.
				</p>
			</div>
		</div>
	</Section>

	<TryThis title="Play something in">
		<p class="text-sm leading-relaxed">
			Press keys with different force — near the front edge of a key is harder — and watch the
			velocity numbers move in the dock. That variation is the thing a mouse cannot give you and a
			quantise button cannot give back.
		</p>
		<Keyboard low={48} octaves={3} height={140} />
	</TryThis>

	<Quiz
		question="You lengthen a note in the piano roll by dragging its right edge. What changed in the MIDI data?"
		options={[
			'A duration field on the note',
			'The time at which the Note Off is sent',
			'Both the Note On and the Note Off'
		]}
		answer={1}
		explanation="There is no duration field anywhere in MIDI. A note's length is the gap between two independent messages, so dragging the right edge moves only the Note Off. Drag the left edge instead and only the Note On moves."
	/>

	<Quiz
		question="A pad controller works in one DAW and does nothing in another, on the same computer, right now."
		options={[
			'The second DAW needs a driver for the controller',
			'The first DAW has the port open, and on Windows that usually excludes everyone else',
			'The controller is transmitting on the wrong channel'
		]}
		answer={1}
		explanation="A class-compliant device needs no driver, and a wrong channel would fail in both hosts equally. Exclusive port access is the classic culprit for 'works in one program, not the other, at the same time' — close the first application and try again."
	/>

	<Further
		refs={['spec-summary', 'spec-cc', 'wikipedia-gm']}
		lead="Two tables worth having open while you map a controller, and the program list every DAW's built-in GM instrument follows."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="inspect"
			label="Click a note in the piano roll and read its two messages"
			hint="Any rectangle. The panel below the grid shows the Note On and the Note Off."
		/>
		<Checkpoint
			lesson={meta.id}
			id="velocity-range"
			label="Play notes covering three different velocity bands"
			hint="Press near the top of a key for gentle, near the front edge for hard."
			count={3}
			key={(e) =>
				e.message.type === 'noteOn' ? String(Math.floor((e.message.velocity - 1) / 43)) : ''}
			test={(e) => e.message.type === 'noteOn' && e.message.velocity > 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="automate"
			label="Move a controller under a held note — automation, by hand"
			hint="Hold a key with one hand and turn one of the knobs above with the other."
			test={(e) => e.message.type === 'controlChange'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="learn"
			label="Bind a control with Learn"
			hint="Arm the Learn panel, then move any knob or controller."
			test={(e) => e.message.type === 'controlChange'}
			count={4}
			key={(e) => (e.message.type === 'controlChange' ? String(e.message.value) : '')}
		/>
	</Checkpoints>
</LessonShell>
