<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import NoteExplorer from '$lib/components/midi/NoteExplorer.svelte';
	import PhrasePlayer from '$lib/components/midi/PhrasePlayer.svelte';
	import Harmonics from '$lib/components/midi/Harmonics.svelte';
	import Scope from '$lib/components/midi/Scope.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { intervalName, noteToFrequency } from '$lib/midi/notes';
	import type { NoteSpec } from '$lib/midi/player.svelte';
	import { Button } from '$lib/components/ui/button';

	const meta = lessonById('notes-and-pitch')!;
	let explored = $state(60);
	let labels = $state<'c' | 'all' | 'numbers'>('c');

	const OCTAVES: NoteSpec[] = [24, 36, 48, 60, 72, 84, 96].map((note, i) => ({
		note,
		start: i * 0.55,
		duration: 0.5,
		velocity: 96
	}));

	const CHORD: NoteSpec[] = [
		{ note: 60, start: 0, duration: 1.4 },
		{ note: 64, start: 0, duration: 1.4 },
		{ note: 67, start: 0, duration: 1.4 },
		{ note: 60, start: 1.6, duration: 1.4 },
		{ note: 63, start: 1.6, duration: 1.4 },
		{ note: 67, start: 1.6, duration: 1.4 }
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			MIDI has no idea what a chord is, what key you are in, or whether a note is sharp or flat. It
			has one integer per pitch, from <strong>0 to 127</strong>, and that is the whole system. Note
			number 60 is middle C. Add 12 and you go up an octave. Add 1 and you go up a semitone — the
			distance from any key to the next key, black or white.
		</p>
		<div
			class="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border bg-surface-sunken p-4"
		>
			<div>
				<p class="label">Lowest</p>
				<p class="tnum font-mono text-lg">
					0 <span class="text-xs text-muted-foreground">≈ 8.2 Hz</span>
				</p>
			</div>
			<div>
				<p class="label">Middle C</p>
				<p class="tnum font-mono text-lg text-msg-note">
					60 <span class="text-xs text-muted-foreground">261.6 Hz</span>
				</p>
			</div>
			<div>
				<p class="label">Concert A</p>
				<p class="tnum font-mono text-lg">
					69 <span class="text-xs text-muted-foreground">440 Hz</span>
				</p>
			</div>
			<div>
				<p class="label">Highest</p>
				<p class="tnum font-mono text-lg">
					127 <span class="text-xs text-muted-foreground">{noteToFrequency(127).toFixed(0)} Hz</span
					>
				</p>
			</div>
		</div>
		<p class="prose-body">
			A grand piano has 88 keys, from note 21 to note 108. MIDI's 128 notes cover more than any
			acoustic instrument, with room to spare at both ends where the numbers stop being musically
			useful and start being useful as triggers instead.
		</p>
	</Section>

	<TryThis title="One number, many names">
		<NoteExplorer bind:note={explored} />
		<p class="text-xs leading-relaxed text-muted-foreground">
			Drag through the range. Notice that the <em>number</em> never becomes ambiguous, but the
			<em>name</em> does — which is the subject of the next section.
		</p>
	</TryThis>

	<Section title="The C3 versus C4 argument">
		<p class="prose-body">
			Everyone agrees middle C is note 60. Nobody agrees what to call it. Yamaha and Roland
			historically label it <strong>C3</strong>; scientific pitch notation, and therefore Steinberg,
			Ableton and Logic, call it <strong>C4</strong>. Some manufacturers even use C5.
		</p>
		<Callout variant="gotcha" title="What this actually costs you">
			<p>
				Nothing, as long as you think in numbers. Everything, the moment you type a note name into
				one device and read it off another. If your sequencer says C3 and your synth's manual says
				C4 for the same sound, neither is broken — they are using different rulers on the same wall. <strong
					>Trust note numbers; treat names as labels.</strong
				>
			</p>
		</Callout>
		<div class="flex flex-wrap items-center gap-3">
			<span class="text-sm text-muted-foreground">Show names as</span>
			<div class="flex gap-1.5">
				<Button
					variant={settings.octaveConvention === 'c3' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (settings.octaveConvention = 'c3')}
				>
					C3 (Yamaha/Roland)
				</Button>
				<Button
					variant={settings.octaveConvention === 'c4' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (settings.octaveConvention = 'c4')}
				>
					C4 (scientific)
				</Button>
			</div>
			<span class="text-xs text-muted-foreground">Applies everywhere in the app.</span>
		</div>
	</Section>

	<TryThis title="Octaves are just +12">
		<PhrasePlayer notes={OCTAVES} bpm={110} label="Play seven C's" program={0} />
		<p class="text-sm leading-relaxed">
			Notes 24, 36, 48, 60, 72, 84 and 96 — every one of them a C, each twice the frequency of the
			last. Doubling the frequency and adding 12 to the note number are the same operation, which is
			why octaves feel like "the same note again".
		</p>
	</TryThis>

	<Section title="Just enough theory">
		<p class="prose-body">
			You do not need music theory to work with MIDI, but three ideas will save you a lot of
			counting.
		</p>
		<div class="grid gap-3 sm:grid-cols-3">
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">Semitone</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					+1. The gap between adjacent keys. Twelve of them make an octave.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">Interval</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					The distance between two notes. +7 is a {intervalName(7)}, +4 a {intervalName(4)}, +3 a {intervalName(
						3
					)}.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">Triad</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					Three notes at once. Root, +4, +7 sounds major; root, +3, +7 sounds minor. One semitone
					apart, entirely different mood.
				</p>
			</div>
		</div>
		<!-- Strings, because the difference between major and minor is in two
		     notes sounding *together* for long enough to colour each other. -->
		<PhrasePlayer notes={CHORD} bpm={100} label="Hear C major, then C minor" program={48} />
		<p class="text-sm leading-relaxed text-muted-foreground">
			60-64-67, then 60-63-67. The middle note moved down by one. That is the entire difference
			between happy and sad, expressed as arithmetic.
		</p>
	</Section>

	<Section title="One note is not one frequency">
		<p class="prose-body">
			Play a low note and watch the analyser: it lights up in half a dozen places, not one. That is
			not the analyser being confused. An instrument sounding a single note puts out a whole series
			of them, at whole-number multiples of the fundamental, and the balance between those is most
			of what makes a trumpet sound like a trumpet and not like a flute playing the same note.
		</p>
		<Scope label="Whatever is sounding" height={120} />
		<p class="prose-body">
			The series is also where the intervals in the last section came from. The second harmonic is
			an octave. The third is a fifth above that. The fifth is a major third. Every interval a
			musician names is already sitting inside one note, which is why they sound like anything at
			all rather than like arbitrary distances.
		</p>
		<Harmonics />
		<Callout
			variant="gotcha"
			title="The keyboard is a compromise, and this is where you can see it"
		>
			The ratios are exact; the keys are not. An equal-tempered keyboard divides the octave into
			twelve identical steps so that every key works in every key signature, and pays for it by
			putting almost every interval slightly off its pure ratio. The seventh harmonic is the extreme
			case — a third of a semitone flat of the note everyone calls it, which is why it sounds wrong
			on a piano and right on a horn.
		</Callout>
	</Section>

	<TryThis title="Play it yourself">
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-xs text-muted-foreground">Labels:</span>
			{#each [['c', 'C only'], ['all', 'Note names'], ['numbers', 'Note numbers']] as [v, l] (v)}
				<Button
					variant={labels === v ? 'default' : 'outline'}
					size="sm"
					class="h-7 text-xs"
					onclick={() => (labels = v as typeof labels)}
				>
					{l}
				</Button>
			{/each}
			<span class="tnum ml-auto text-xs text-muted-foreground">{noteState.heldCount} held</span>
		</div>
		<Keyboard low={48} octaves={3} height={140} {labels} />
	</TryThis>

	<Quiz
		question="Your synth's manual says its lowest key is C1. Your sequencer shows that same key as C2. Which note number is it?"
		options={[
			'C1 and C2 are different notes, so one of them is wrong',
			'You cannot tell from the names alone — check the number',
			'Always 24, because C1 is always 24'
		]}
		answer={1}
		explanation="Names are labels applied by each device's convention; only the number is transmitted. The synth is probably labelling with middle C = C3 and the sequencer with middle C = C4, which shifts every name by one octave. Look at the number the two agree on."
	/>

	<Further
		refs={['spec-summary', 'somascape-spec', 'scala']}
		lead="Note numbers are the easy part of pitch. The last of these is where the argument about what a note *is* has been going on for four hundred years."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="middle-c"
			label="Play middle C — note number 60"
			hint="Switch the labels to note numbers if that helps you find it."
			test={(e) => e.message.type === 'noteOn' && e.message.note === 60}
		/>
		<Checkpoint
			lesson={meta.id}
			id="octave"
			label="Play note 72 — the C an octave above"
			test={(e) => e.message.type === 'noteOn' && e.message.note === 72}
		/>
		<Checkpoint
			lesson={meta.id}
			id="triad"
			label="Hold three notes at the same time"
			hint="Click and hold with one finger while typing with the other hand, or hold three computer keys at once."
			test={() => noteState.heldCount >= 3}
		/>
		<Checkpoint
			lesson={meta.id}
			id="octave-span"
			label="Play a note in three different octaves"
			hint="Same pitch class, twelve apart: 48, 60 and 72 for example."
			count={3}
			key={(e) => (e.message.type === 'noteOn' ? String(Math.floor(e.message.note / 12)) : '')}
			test={(e) => e.message.type === 'noteOn'}
		/>
	</Checkpoints>
</LessonShell>
