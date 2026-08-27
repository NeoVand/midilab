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
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import NoteValues from '$lib/components/midi/NoteValues.svelte';
	import ChordLab from '$lib/components/midi/ChordLab.svelte';
	import CircleOfFifths from '$lib/components/midi/CircleOfFifths.svelte';
	import MelodyPlayer from '$lib/components/midi/MelodyPlayer.svelte';
	import PhrasePlayer from '$lib/components/midi/PhrasePlayer.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { phrase } from '$lib/music/notation';

	const meta = lessonById('just-enough-music')!;

	/** The same eight notes as a scale, then as the chord hiding inside it. */
	const SCALE = phrase('C4/0.4 D4 E4 F4 G4 A4 B4 C5/1.2');
	const MAJOR_MINOR = phrase('C4+E4+G4/1.6 _/0.4 C4+Eb4+G4/1.6');
	const FIFTH_STACK = phrase('C3+G3/1.4 _/0.3 C3+E3/1.4 _/0.3 C3+Db3/1.4');
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			This lesson is here because the rest of the course kept assuming things. "Twenty-four ticks a
			quarter note" is a fact about MIDI and a wall for anybody who has never been told what a
			quarter note is. "Bend a fifth" is a precise instruction that means nothing without the word.
		</p>
		<p class="prose-body">
			So: everything musical the other thirty-seven lessons lean on, in one place. It is not a music
			theory course — it is the specific vocabulary, and no more of it than you need. If you already
			play, skip to <Xref to="notes-and-pitch" />; nothing here will be new.
		</p>
		<Callout variant="key" title="Musical words are almost all measurements">
			<p>
				Nearly every term below turns out to name a <em>number</em> — a count of beats, a count of semitones,
				a ratio between durations. That is why MIDI can carry music at all without understanding any of
				it, and it is why this vocabulary is much smaller than it looks from outside.
			</p>
		</Callout>
	</Section>

	<Section title="Time: beats, bars and note values">
		<p class="prose-body">
			A <Term>beat</Term> is the pulse you tap your foot to.
			<Term>Tempo</Term> is how many go past in a minute, written BPM. Beats come in repeating groups
			called <Term>bars</Term>, and almost always in groups of four.
		</p>
		<p class="prose-body">
			Everything else about musical time is a fraction of a beat, and the names are literal
			fractions of a bar. A <Term>quarter note</Term> is a quarter of a four-beat bar — one beat. An
			<Term>eighth note</Term> is half of that. The British names are completely different words for exactly
			the same durations, which is a historical accident you will meet in manuals and can safely ignore.
		</p>
		<NoteValues bpm={96} />
		<Callout variant="key" title="This is where MIDI's timing numbers come from">
			<p>
				MIDI Clock sends 24 ticks per quarter note. Twenty-four because it divides evenly by 2, 3,
				4, 6, 8 and 12 — so eighths, sixteenths and
				<Term>triplets</Term> all land on a tick and none of them needs a fraction. Play the triplet row
				against the eighth-note row above and you are hearing exactly why that number was chosen.
			</p>
			<p class="mt-2">
				The full story is in <Xref to="midi-clock" /> and
				<Xref to="ppqn-and-groove" />.
			</p>
		</Callout>
	</Section>

	<Section title="Pitch: semitones and intervals">
		<p class="prose-body">
			A <Term>semitone</Term> is the distance from any key to the very next key, black or white. It is
			the smallest step a normal keyboard offers, and in MIDI it is simply <strong>+1</strong>.
			Twelve of them make an <Term>octave</Term>, which is <strong>+12</strong>, and two notes an
			octave apart sound so alike that every musical culture on earth gives them the same name.
		</p>
		<p class="prose-body">
			The distance between any two notes is an <Term>interval</Term>, and musicians name intervals
			rather than counting semitones — but the names <em>are</em> the counts. Here are the ones that earn
			their keep:
		</p>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each [['+12', 'Octave', 'The same note again, higher.'], ['+7', 'Perfect fifth', 'The most consonant interval after the octave. Power chords are nothing else.'], ['+5', 'Perfect fourth', 'A fifth upside down. Stable, slightly hollow.'], ['+4', 'Major third', 'The interval that makes a chord sound happy.'], ['+3', 'Minor third', 'One semitone smaller. Makes it sound sad.'], ['+1', 'Semitone', 'Adjacent keys. Grinding, tense, the horror-film interval.']] as [n, label, note] (label)}
				<div class="flex gap-3 rounded-lg border p-3">
					<span class="tnum w-9 shrink-0 font-mono text-sm text-msg-note">{n}</span>
					<span class="min-w-0">
						<span class="block text-sm font-medium">{label}</span>
						<span class="block text-xs leading-relaxed text-muted-foreground">{note}</span>
					</span>
				</div>
			{/each}
		</div>
		<!--
			Strings, and this is the one demonstration in the course where the
			instrument is not a matter of taste. Consonance is two notes sharing
			harmonics while they overlap, so a voice that sustains is the whole
			mechanism: on anything percussive the two notes have stopped before
			they can beat against each other and every interval sounds the same.
		-->
		<PhrasePlayer
			notes={FIFTH_STACK}
			bpm={96}
			label="Hear a fifth, a third, and a semitone"
			variant="default"
			program={48}
		/>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Same bottom note every time. Only the distance changes — and consonance falls off a cliff
			between the second one and the third.
		</p>
		<Callout variant="note" title="Why some distances sound better than others">
			<p>
				Not taste, and not convention. A single note is already a stack of frequencies at
				whole-number multiples of its pitch — the <Term>harmonic series</Term> — and an interval sounds
				consonant when the two notes share a lot of that stack. A fifth is a 3:2 frequency ratio and shares
				a great deal. A semitone is roughly 18:17 and shares almost nothing. There is a widget for this
				in <Xref to="notes-and-pitch" />.
			</p>
		</Callout>
	</Section>

	<Section title="Scales: which twelve notes you are using">
		<p class="prose-body">
			There are twelve pitches in an octave, and almost no music uses all of them. A
			<Term>scale</Term> is the subset a piece draws from, and the note it treats as home is the
			<Term>root</Term>. Together they make the <Term>key</Term>.
		</p>
		<p class="prose-body">
			The major scale is the pattern <strong>0, 2, 4, 5, 7, 9, 11</strong> semitones above its root. Start
			on C and that pattern lands on exactly the white keys, which is not a coincidence — the keyboard
			was designed around it.
		</p>
		<PhrasePlayer notes={SCALE} bpm={132} label="Play a C major scale" program={0} />
		<p class="prose-body">
			Start on any note and take twelve steps of a perfect fifth — seven semitones each time — and
			you arrive back where you began. That closed loop is the circle of fifths, and it is worth
			more than any other single diagram in music: neighbours on it share almost all their notes,
			which is why chord progressions and key changes overwhelmingly move between neighbours.
		</p>
		<CircleOfFifths />
		<Callout variant="convention" title="MIDI has no idea what key you are in">
			<p>
				There is no key message, no scale message and no chord message on the wire. A Standard MIDI
				File can note a key signature as metadata, and instruments that offer "scale lock" are
				filtering your playing locally before they transmit. The cable carries note numbers and
				nothing else — which is exactly the point of
				<Xref to="control-not-sound" />.
			</p>
		</Callout>
	</Section>

	<TryThis title="Chords are addition">
		<p class="text-sm leading-relaxed">
			A <Term>chord</Term> is more than one note at once. Every chord name you have ever seen is a set
			of distances from a root — so the difference between the happiest and the saddest sound in Western
			music is one semitone in the middle.
		</p>
		<ChordLab />
	</TryThis>

	<Section title="Loud, and how long: dynamics and articulation">
		<p class="prose-body">
			<Term>Dynamics</Term> means how loud, as a performance decision rather than a mixing one. MIDI expresses
			it with velocity, which is the subject of
			<Xref to="velocity" />.
		</p>
		<p class="prose-body">
			<Term>Legato</Term> means notes joined with no gap between them; staccato means notes cut short
			and separated. In MIDI both are entirely a matter of where you put the Note Off relative to the
			next Note On — which is why <Xref to="note-on-off" /> insists that a note is two messages rather
			than one.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					Words for how loud
				</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					<em>pp</em> through <em>ff</em>: very quiet to very loud. Six or so steps, mapped onto
					1–127 by whoever wrote your software, differently every time.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">Words for how</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					<Term>Vibrato</Term> is a pitch wobble; <Term>portamento</Term> is a slide between notes. Both
					are usually <em>asked for</em> with a controller rather than performed, because the instrument
					does them better than a stream of messages could.
				</p>
			</div>
		</div>
	</Section>

	<TryThis title="One semitone, two moods">
		<PhrasePlayer
			notes={MAJOR_MINOR}
			bpm={100}
			label="C major, then C minor"
			variant="default"
			program={48}
		/>
		<p class="text-sm leading-relaxed">
			60-64-67, then 60-63-67. One note moved down by one. Now hear the same idea used for real —
			Beethoven's most famous four notes are a minor third apart, and the whole symphony is built on
			the fact that they are minor.
		</p>
		<MelodyPlayer id="fate" />
	</TryThis>

	<Section title="The vocabulary, in one table">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[34rem] border-collapse text-sm">
				<thead>
					<tr class="border-b text-left">
						<th class="py-2 pr-4 font-medium">Word</th>
						<th class="py-2 pr-4 font-medium">Is really</th>
						<th class="py-2 font-medium">In MIDI</th>
					</tr>
				</thead>
				<tbody class="text-muted-foreground">
					{#each [['Beat', 'the pulse', 'nothing — inferred from clock timing'], ['Bar', 'four beats, usually', 'nothing on the wire; metadata in a file'], ['Quarter note', 'one beat', '24 MIDI Clock ticks'], ['Semitone', 'adjacent keys', '+1 on the note number'], ['Octave', 'twelve semitones', '+12 on the note number'], ['Fifth', 'seven semitones', '+7 on the note number'], ['Major chord', 'root, +4, +7', 'three overlapping Note Ons'], ['Minor chord', 'root, +3, +7', 'three overlapping Note Ons'], ['Key', 'home note plus scale', 'nothing at all'], ['Dynamics', 'how loud you played it', 'velocity, 1–127'], ['Legato', 'no gap between notes', 'Note Off after the next Note On']] as [word, is, midi] (word)}
						<tr class="border-b border-border/50">
							<td class="py-2 pr-4 font-medium text-foreground">{word}</td>
							<td class="py-2 pr-4">{is}</td>
							<td class="py-2">{midi}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="prose-body">
			Look down the right-hand column. Four of these eleven words correspond to nothing MIDI
			transmits. That is not an oversight — it is the design decision the whole protocol rests on,
			and every one of those blanks is a place where some other layer has to carry the meaning.
		</p>
	</Section>

	<TryThis title="Find them on the keys">
		<p class="text-sm leading-relaxed">
			Play any note, then the key seven to the right of it. That is a fifth, and it should sound
			immediately stable. Then play a note and the key directly beside it.
		</p>
		<Keyboard low={48} octaves={3} height={140} labels="numbers" />
		<p class="text-xs text-muted-foreground">{noteState.heldCount} held</p>
	</TryThis>

	<Quiz
		question="A tune is in 4/4 at 120 BPM. How long is one sixteenth note?"
		options={['125 milliseconds', '62.5 milliseconds', '250 milliseconds']}
		answer={0}
		explanation="At 120 BPM a beat — a quarter note — is half a second. A sixteenth is a quarter of that: 125 ms. Worth being able to do in your head, because it is exactly the arithmetic a sequencer does for every event it schedules."
	/>

	<Quiz
		question="You hold notes 62, 66 and 69 together. What have you played?"
		options={[
			'A minor chord, because the notes are close together',
			'A major chord — the gaps are +4 and +7 from the bottom note',
			'Not a chord, because MIDI has no chord message'
		]}
		answer={1}
		explanation="66 − 62 = 4 and 69 − 62 = 7, which is the major recipe on a root of D. The third option is true about the protocol and false about the music: MIDI transmits three overlapping Note Ons, and the chord exists in the air regardless."
	/>

	<Further
		refs={['imslp', 'mutopia', 'wikipedia-euclid']}
		lead="Two libraries of public-domain music worth knowing about, and the rhythm article that Act VII builds on."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="fifth"
			label="Play two notes seven semitones apart — a perfect fifth"
			hint="Hold one key, then the seventh key to the right of it counting black keys too."
			test={() => {
				const held = noteState.held;
				return held.some((a) => held.some((b) => b - a === 7));
			}}
		/>
		<Checkpoint
			lesson={meta.id}
			id="major"
			label="Play a major triad — root, +4, +7"
			hint="Any root will do. 60, 64 and 67 together, for example."
			test={() => {
				const held = noteState.held;
				return held.some((r) => held.includes(r + 4) && held.includes(r + 7));
			}}
		/>
		<Checkpoint
			lesson={meta.id}
			id="minor"
			label="Play a minor triad — root, +3, +7"
			hint="Take the major triad you just played and move the middle note down one key."
			test={() => {
				const held = noteState.held;
				return held.some((r) => held.includes(r + 3) && held.includes(r + 7));
			}}
		/>
		<Checkpoint
			lesson={meta.id}
			id="octave"
			label="Play two notes exactly an octave apart"
			hint="Twelve semitones — the same letter name, twice."
			test={() => {
				const held = noteState.held;
				return held.some((a) => held.includes(a + 12));
			}}
		/>
	</Checkpoints>
</LessonShell>
