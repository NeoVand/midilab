<script lang="ts">
	import LessonShell from './LessonShell.svelte';
	import Section from './Section.svelte';
	import TryThis from './TryThis.svelte';
	import Checkpoint from './Checkpoint.svelte';
	import Checkpoints from './Checkpoints.svelte';
	import Quiz from './Quiz.svelte';
	import NoteValues from '$lib/components/midi/NoteValues.svelte';
	import ChordLab from '$lib/components/midi/ChordLab.svelte';
	import MusicPractice from '$lib/components/midi/MusicPractice.svelte';
	import DissonanceLab from '$lib/components/music/DissonanceLab.svelte';
	import MusicalityLab from '$lib/components/music/MusicalityLab.svelte';
	import CircleOfFifths from '$lib/components/music/CircleOfFifths.svelte';
	import { Button } from '$lib/components/ui/button';
	import { MUSIC_FOUNDATIONS } from '$lib/curriculum/music-foundations';
	import { lessonById } from '$lib/curriculum/registry';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { path } from '$lib/nav';
	import type { Snippet } from 'svelte';
	let { lessonId, children }: { lessonId: string; children?: Snippet } = $props();
	const lesson = $derived(lessonById(lessonId)!);
	const content = $derived(MUSIC_FOUNDATIONS[lessonId]);
</script>

<svelte:head><title>{lesson.title} — MIDI Lab</title></svelte:head>

<LessonShell {lesson}>
	<Section><p class="prose-body">{content.intro}</p></Section>
	{#each content.sections as section (section.title)}
		<Section title={section.title}>
			{#each section.paragraphs as paragraph (paragraph)}<p class="prose-body">
					{paragraph}
				</p>{/each}
		</Section>
		{#if lessonId === 'pulse-and-rhythm' && section.title === 'Divide a beat without speeding up'}
			<TryThis title="Listen to each subdivision"
				><NoteValues bpm={72} />
				<p class="text-sm text-muted-foreground">
					Compare the rows one at a time. The beat stays the same while the number of notes changes.
				</p></TryThis
			>
		{:else if lessonId === 'chords-and-movement' && section.title === 'Build a triad'}
			<TryThis title="Change the third and hear the colour"><ChordLab /></TryThis>
		{:else if lessonId === 'chords-and-movement' && section.title === 'Read the circle as a map of relationships'}
			<TryThis title="Find the way home"><CircleOfFifths /></TryThis>
		{:else if lessonId === 'chords-and-movement' && section.title === 'Tension is more than roughness'}
			<TryThis title="Explore why timbre changes roughness"><DissonanceLab /></TryThis>
		{:else if lessonId === 'pitch-and-melody' && section.title === 'A motif gives the listener something to remember'}
			<TryThis title="Recognise an idea as it changes"
				><MusicalityLab initial="variation" /></TryThis
			>
		{:else if lessonId === 'musical-expression' && section.title === 'Timing needs a reason'}
			<TryThis title="Shape a phrase you can hear"><MusicalityLab /></TryThis>
		{:else if lessonId === 'first-composition' && section.title === 'Choose an intention, then edit toward it'}
			<TryThis title="Give your phrase a direction"><MusicalityLab initial="cadence" /></TryThis>
		{/if}
	{/each}
	{#each content.drills as drill (drill.id)}
		<MusicPractice
			id={`${lessonId}-${drill.id}`}
			title={drill.title}
			description={drill.description}
			notes={drill.notes}
			bpm={drill.bpm}
			program={drill.program}
			assessVelocity={drill.assessVelocity}
			assessDuration={drill.assessDuration}
			oncomplete={() => progress.complete(lessonId, drill.id)}
		/>
	{/each}
	<Quiz
		question={content.question}
		options={content.options}
		answer={content.answer}
		explanation={content.explanation}
	/>
	<TryThis
		title={lessonId === 'first-composition' ? 'Make something you can keep' : 'Use it in a piece'}
	>
		<p class="text-sm leading-relaxed">{content.task}</p>
		<Button href={path(`/lab/studio?example=${content.example}`)} size="lg">Open the Studio</Button>
	</TryThis>
	{@render children?.()}
	<Checkpoints lesson={lessonId}>
		{#each content.drills as drill (drill.id)}<Checkpoint
				lesson={lessonId}
				id={drill.id}
				label={drill.title}
				hint="Complete the guided practice above. Successful playing is verified; a manual check is labelled self-checked."
			/>{/each}
		<Checkpoint
			lesson={lessonId}
			id="apply"
			label={lessonId === 'first-composition'
				? 'Finish, save and replay a named eight-bar piece'
				: 'Try the musical idea in a Studio project'}
			hint="Check this after doing the Studio task. This is your self-assessment, separate from verified practice."
		/>
	</Checkpoints>
</LessonShell>
