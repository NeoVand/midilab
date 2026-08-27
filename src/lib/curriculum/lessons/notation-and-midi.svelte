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
	import Staff from '$lib/components/midi/Staff.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import PianoRoll from '$lib/components/midi/PianoRoll.svelte';
	import MelodyPlayer from '$lib/components/midi/MelodyPlayer.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { melody } from '$lib/music/melodies';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { NoteSpec } from '$lib/midi/player.svelte';

	const meta = lessonById('notation-and-midi')!;

	const MINUET = melody('minuet-in-g');

	/*
	 * The same four bars, played rather than typeset. Nothing lands exactly on
	 * a beat and no two notes are the same length — which is what a performance
	 * is, and precisely what makes it unengravable without cleaning up first.
	 */
	const PLAYED: NoteSpec[] = MINUET.notes.map((n, i) => ({
		...n,
		start: n.start + (i % 3 === 0 ? 0.04 : i % 3 === 1 ? -0.03 : 0.017),
		duration: n.duration * (0.82 + ((i * 37) % 30) / 100)
	}));

	let showFlats = $state(false);
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			A score and a MIDI file are both "the music written down", and they are almost completely
			different documents. A score is a set of <em>instructions to a player</em>, full of things a
			human has to interpret. A MIDI file is a record of
			<em>what happened</em>, exact to the millisecond and empty of intent.
		</p>
		<p class="prose-body">
			Converting either into the other therefore loses something, every time, and the useful skill
			is knowing exactly what — because that tells you which format to reach for.
		</p>
	</Section>

	<Section title="What each one knows">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border border-msg-note/30 bg-msg-note-bg p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					Only the score knows
				</p>
				<ul class="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed">
					<li>Whether that black key is an F♯ or a G♭</li>
					<li>The <Term>key</Term> and the time signature</li>
					<li>Which hand, which voice, which staff</li>
					<li>Slurs, phrasing, fingering, bowing, pedalling</li>
					<li>"Andante", "dolce", "poco rit." — every instruction in words</li>
					<li>Repeats, first and second endings, D.C. al Fine</li>
				</ul>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Only the MIDI knows
				</p>
				<ul class="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed">
					<li>That this note came 11 ms after the beat</li>
					<li>That it was struck at velocity 93 and the next at 71</li>
					<li>Exactly how long the pedal was down</li>
					<li>Every controller movement, continuously</li>
					<li>The bend, the pressure, the modulation</li>
				</ul>
			</div>
		</div>
		<Callout variant="key" title="Prescriptive and descriptive">
			<p>
				This is the whole distinction. A score <em>prescribes</em> — it tells a player what to do
				and leaves the doing to them. MIDI <em>describes</em> — it records what a player did and says
				nothing about why. Neither is a superset of the other, and no converter can invent the half that
				is missing.
			</p>
		</Callout>
	</Section>

	<Section title="The enharmonic problem">
		<p class="prose-body">
			Note 66 is one number. On a page it is either F♯ or G♭, and which one is correct depends on
			the key and on where the music is going next. To a player those are different notes with
			different meanings; to MIDI they are the same byte.
		</p>
		<div class="flex flex-wrap items-center gap-3">
			<Button
				variant={showFlats ? 'outline' : 'default'}
				size="sm"
				onclick={() => (showFlats = false)}
			>
				Sharps
			</Button>
			<Button
				variant={showFlats ? 'default' : 'outline'}
				size="sm"
				onclick={() => (showFlats = true)}
			>
				Flats
			</Button>
			<span class="text-xs text-muted-foreground">Same notes. Same bytes. Different page.</span>
		</div>
		<Staff notes={[66, 70, 73]} flats={showFlats} />
		<p class="text-sm leading-relaxed text-muted-foreground">
			Both spellings are correct engravings of notes 66, 70 and 73. A notation program has to pick
			one, and with no key signature in the file it is guessing.
		</p>
		<p class="prose-body">
			A Standard MIDI File can carry a <em>Key Signature</em> meta event, which is exactly the hint
			a converter needs — and which nothing on a cable ever transmits. That asymmetry is the subject
			of
			<Xref to="midi-files" />.
		</p>
	</Section>

	<TryThis title="Play something and watch it get engraved">
		<Keyboard low={48} octaves={3} height={130} />
		<Staff flats={showFlats} />
		<p class="text-sm leading-relaxed text-muted-foreground">
			Hold a chord. The staff draws whatever is sounding, spelled by the toggle above rather than by
			any understanding of what you meant. Your setting is currently
			<strong>{settings.octaveConvention === 'c3' ? 'C3' : 'C4'}</strong> for middle C, which is
			another place where one number has two names — see <Xref to="notes-and-pitch" />.
		</p>
	</TryThis>

	<Section title="Why raw MIDI engraves badly">
		<p class="prose-body">
			Import an unquantised performance into a notation program and the result is unreadable: a
			thicket of thirty-second notes, ties across every barline, rests you never played. Nothing is
			wrong with the software. It is being asked to write down the literal truth, and the literal
			truth of human playing is not made of clean note values.
		</p>
		<PianoRoll
			notes={PLAYED}
			bpm={MINUET.bpm}
			beatsPerBar={MINUET.beatsPerBar ?? 4}
			division={2}
			height={170}
		/>
		<p class="text-sm leading-relaxed text-muted-foreground">
			The Minuet again, this time as somebody actually played it. Every start time is a few
			milliseconds off the grid and every length is different. As a performance it is better than
			the typed version. As something to engrave it is a nightmare.
		</p>
		<Callout variant="gotcha" title="Quantise before you notate, and only then">
			<p>
				This is the one case where heavy quantisation is unambiguously right: you are producing a
				document for a human to read, and the deviations are noise in that document. Keep the
				unquantised original — see <Xref to="in-the-daw" /> — because it is the one you will want back
				when you go to render audio.
			</p>
		</Callout>
	</Section>

	<Section title="MusicXML, and when to use it instead">
		<p class="prose-body">
			There is a format for the other half. <strong>MusicXML</strong> describes a score rather than a
			performance: spellings, clefs, beams, slurs, lyrics, repeats, articulation marks, the lot. Every
			serious notation program reads and writes it, and it is the right answer whenever the deliverable
			is something a musician will read.
		</p>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[32rem] border-collapse text-sm">
				<thead>
					<tr class="border-b text-left">
						<th class="py-2 pr-4 font-medium">If you want to…</th>
						<th class="py-2 font-medium">Use</th>
					</tr>
				</thead>
				<tbody class="text-muted-foreground">
					{#each [['Move a performance between DAWs', 'MIDI'], ['Send a part to a player to read', 'MusicXML'], ['Drive a synthesiser, live or sequenced', 'MIDI'], ['Move a score between Sibelius, Dorico and MuseScore', 'MusicXML'], ['Keep the exact timing and velocity of a take', 'MIDI'], ['Keep the spelling, slurs and dynamics markings', 'MusicXML'], ['Archive a piece so it can be re-engraved later', 'MusicXML']] as [want, use] (want)}
						<tr class="border-b border-border/50">
							<td class="py-2 pr-4">{want}</td>
							<td class="py-2 font-medium text-foreground">{use}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Callout variant="note" title="Notation programs export MIDI, and it sounds like it">
			<p>
				Going the other way is easier but still lossy in an interesting direction. A score has no
				velocities, so the exporter invents them from the dynamic markings — every note under a
				<em>mf</em> gets the same number. That is why MIDI exported from notation software has the
				flat, mechanical quality described in <Xref to="programming-drums" />: it is not badly made,
				it is faithfully reproducing a document that never contained the information.
			</p>
		</Callout>
	</Section>

	<TryThis title="Both at once">
		<MelodyPlayer id="jesu" voices={[73, 0, 48, 19]} />
		<Staff />
		<p class="text-sm leading-relaxed text-muted-foreground">
			Bach wrote this as a score in 1723 and it survived three hundred years as one. What is being
			sent to your speakers is a description of a performance of it — and neither document could
			have been reconstructed from the other.
		</p>
	</TryThis>

	<Quiz
		question="You import a piano performance into a notation program and get an unreadable mess of ties and tiny rests. What went wrong?"
		options={[
			'The MIDI file is corrupt',
			'Nothing — the performance is not quantised, and notation can only write exact note values',
			'The tempo map is missing'
		]}
		answer={1}
		explanation="Notation has no way to write 'a sixteenth note, but eleven milliseconds late and held for 91% of its length'. It must round everything to a note value it can draw, and unquantised input forces it to use very small ones. Quantise a copy first."
	/>

	<Quiz
		question="What does a Standard MIDI File carry that helps a notation program spell black keys correctly?"
		options={[
			'Nothing — MIDI has no concept of spelling',
			'A Key Signature meta event',
			'The note names, alongside the numbers'
		]}
		answer={1}
		explanation="Files can carry key and time signature meta events, which is exactly the hint an engraver needs to decide between F♯ and G♭. Note names are never transmitted, and nothing on a cable carries the key at all — this is one of the few things a file knows that the wire does not."
	/>

	<Further
		refs={['spec-smf', 'somascape-mfile', 'imslp', 'mutopia']}
		lead="The file format that carries the performance, and two libraries where the same music exists as a score."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="enharmonic"
			label="Play a black key and see it spelled both ways"
			hint="Hold any black key, then switch the sharps/flats toggle."
			test={(e) => e.message.type === 'noteOn' && [1, 3, 6, 8, 10].includes(e.message.note % 12)}
		/>
		<Checkpoint
			lesson={meta.id}
			id="chord"
			label="Hold three notes and read them off the staff"
			hint="Any triad. The engraving follows what is sounding."
			test={() => noteState.heldCount >= 3}
		/>
		<Checkpoint
			lesson={meta.id}
			id="choose"
			label="Say which format you would send to a session player, and why"
			hint="One of them carries slurs and dynamics. The other carries milliseconds."
		/>
	</Checkpoints>
</LessonShell>
