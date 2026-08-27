<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import MelodyPlayer from '$lib/components/midi/MelodyPlayer.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import Term from '$lib/components/lesson/Term.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { notesToEvents } from '$lib/midi/player.svelte';
	import { melody } from '$lib/music/melodies';
	import { encode } from '$lib/midi/messages';

	const meta = lessonById('control-not-sound')!;

	/*
	 * The demonstration used to run on an invented eight-note figure, which made
	 * the point and was forgotten by the next paragraph. Beethoven makes exactly
	 * the same point and is still in your head an hour later — and "the notes did
	 * not change, the instrument did" is a far harder claim to wave away when you
	 * can hum along with the notes that did not change.
	 */
	const VOICES = [0, 11, 19, 40, 48, 56, 73, 81, 89];

	// Concrete sizes, computed rather than asserted.
	const ODE = melody('ode-to-joy');
	const events = notesToEvents(ODE.notes, ODE.bpm);
	const midiBytes = events.reduce((n, e) => n + encode(e.message).length, 0);
	const seconds = events[events.length - 1].time;
	const audioBytes = Math.round(seconds * 44100 * 2 * 2);
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Here is the single most useful sentence in this entire course, and everything else follows
			from it:
		</p>
		<p class="border-l-2 border-msg-note py-1 pl-4 text-lg leading-relaxed font-medium">
			MIDI never carries sound. It carries instructions about what to play.
		</p>
		<p class="prose-body">
			A MIDI message is a note-sized piece of paper that says <em>press middle C, this hard, now</em
			>. It does not contain a piano. Somewhere downstream there has to be something that reads the
			paper and makes a noise — a synthesiser, a sampler, a software instrument, or the little synth
			built into this page. That thing is what you actually hear.
		</p>
	</Section>

	<TryThis title="Same notes, different instrument">
		<p class="text-sm leading-relaxed">
			You have known these {ODE.notes.length} notes since you were a child. Play them, switch the instrument,
			play them again. The notes never change — the only thing that does is the instruction "use sound
			number <em>n</em>".
		</p>

		<MelodyPlayer id="ode-to-joy" voices={VOICES} credit={false} />

		<p class="text-xs leading-relaxed text-muted-foreground">
			What changed between takes was one two-byte message —
			<code class="rounded-sm bg-muted px-1 font-mono">C0 nn</code> — meaning "channel 1, use
			program
			<em>nn</em>". Not one sample of audio moved. You will meet that message properly in
			<Xref to="programs-and-banks" />.
		</p>
	</TryThis>

	<Section title="Why that difference is enormous">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border border-msg-note/30 bg-msg-note-bg p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">MIDI · the intent</p>
				<p class="tnum font-mono text-2xl">{midiBytes} bytes</p>
				<p class="text-sm leading-relaxed">
					{events.length} messages. Every one of them is editable: change a note, change the tempo, change
					the instrument, transpose the lot, and nothing degrades because there is nothing to degrade.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Audio · the result
				</p>
				<p class="tnum font-mono text-2xl">{(audioBytes / 1_000_000).toFixed(1)} MB</p>
				<p class="text-sm leading-relaxed">
					The same {seconds.toFixed(1)} seconds as uncompressed stereo. Exactly what was played, and almost
					nothing about it can be changed afterwards. You cannot un-play a wrong note.
				</p>
			</div>
		</div>
		<p class="prose-body">
			That is roughly <strong>{Math.round(audioBytes / midiBytes).toLocaleString()}× smaller</strong
			>, which is why a protocol designed in 1983 for a 31,250-bit-per-second cable is still how
			every instrument in your studio talks to every other one. It was never trying to move sound.
		</p>
		<Callout variant="note" title="The comparison is not quite fair, and it does not need to be">
			<p>
				Those {(audioBytes / 1_000_000).toFixed(1)} MB are uncompressed. Encode the same audio as a good
				MP3 and it drops to well under a megabyte — call it a hundredfold advantage rather than a thousandfold.
				The argument does not depend on the exact ratio. It depends on the fact that one side is a
				<em>description</em>
				and the other is a <em>result</em>, and only descriptions can be edited.
			</p>
		</Callout>
	</Section>

	<Callout variant="key" title="The receiver decides">
		<p>
			MIDI says <em>what to do</em>, never <em>what it should sound like</em>. Send "note 60,
			velocity 100" to a grand piano and you get a piano note; send the identical bytes to a drum
			machine and you might get a snare. The message did not change. The instrument reading it did.
		</p>
		<p class="mt-2">
			Nearly every confusing thing about MIDI dissolves once you internalise this. Keep it in your
			pocket — we will come back to it in almost every lesson.
		</p>
	</Callout>

	<Section title="What MIDI cannot do">
		<ul class="prose-body flex flex-col gap-2.5">
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-current text-destructive"></span>
				<span>
					<strong>It cannot carry a sound.</strong> There is no way to send "this exact snare
					sample" over ordinary MIDI. (<Xref to="sysex" label="SysEx" /> can transfer a sample as data,
					but that is a file transfer, not a performance.)
				</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-current text-destructive"></span>
				<span>
					<strong>It cannot guarantee what you hear.</strong> The same file on two devices can sound completely
					different, and both are behaving correctly.
				</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-current text-destructive"></span>
				<span>
					<strong>It cannot describe music theory.</strong> There is no "C minor" message, and no
					<Term>chord</Term>. MIDI knows note number 60, not that you meant the
					<Term>root</Term> of anything.
				</span>
			</li>
		</ul>
		<p class="text-sm leading-relaxed text-muted-foreground">
			None of these are flaws. They are the reason a 1983 protocol still works with instruments
			built in 2026: it deliberately refused to have an opinion about sound.
		</p>
		<p class="prose-body">
			There was an attempt to close the second gap. <em>Downloadable Sounds</em> let a file carry the
			instruments as well as the notes, so that it would sound the same in two places. It shipped, it
			works, and almost nobody used it — which tells you something about how much the industry actually
			wanted MIDI to have an opinion about sound.
		</p>
	</Section>

	<Section title="Your turn">
		<p class="prose-body">
			Play a few notes. Nothing here is a picture — the keys below send real MIDI messages into the
			same engine your hardware will plug into, and the dock at the bottom of the window is
			watching.
		</p>
		<Keyboard low={48} octaves={3} height={120} />
	</Section>

	<Further
		refs={['spec-index', 'wikipedia-midi', 'somascape-spec', 'spec-dls']}
		lead="This course compresses documents that are free to read. Where a lesson makes a claim, this is where the claim came from."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="play-note"
			label="Play any note"
			hint="Click a key above, or type on your computer keyboard."
			test={(e) => e.message.type === 'noteOn'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="two-voices"
			label="Hear the same phrase through two different instruments"
			hint="Pick a voice, play the phrase, pick a different voice, play it again."
			count={2}
			key={(e) => (e.message.type === 'programChange' ? String(e.message.program) : '')}
			test={(e) => e.message.type === 'programChange'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="five-notes"
			label="Play five different pitches"
			hint="Any five distinct notes will do."
			count={5}
			key={(e) => (e.message.type === 'noteOn' ? String(e.message.note) : '')}
			test={(e) => e.message.type === 'noteOn'}
		/>
	</Checkpoints>
</LessonShell>
