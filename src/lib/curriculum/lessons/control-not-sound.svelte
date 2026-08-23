<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import PhrasePlayer from '$lib/components/midi/PhrasePlayer.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import { encode } from '$lib/midi/messages';
	import { gmProgramName } from '$lib/midi/constants';
	import { cn } from '$lib/utils';

	const meta = lessonById('control-not-sound')!;

	const PHRASE: NoteSpec[] = [
		{ note: 60, start: 0, duration: 0.45, velocity: 88 },
		{ note: 64, start: 0.5, duration: 0.45, velocity: 74 },
		{ note: 67, start: 1, duration: 0.45, velocity: 80 },
		{ note: 71, start: 1.5, duration: 0.45, velocity: 70 },
		{ note: 72, start: 2, duration: 0.9, velocity: 104 },
		{ note: 69, start: 3, duration: 0.45, velocity: 78 },
		{ note: 65, start: 3.5, duration: 0.45, velocity: 72 },
		{ note: 64, start: 4, duration: 1.6, velocity: 90 }
	];

	const VOICES = [0, 11, 19, 40, 48, 56, 73, 81, 89];
	let program = $state(0);

	function choose(p: number) {
		program = p;
		engine.wake();
		engine.programChange(p, 0);
	}

	// Concrete sizes, computed rather than asserted.
	const events = notesToEvents(PHRASE, 108);
	const midiBytes = events.reduce((n, e) => n + encode(e.message).length, 0);
	const seconds = events[events.length - 1].time + 1.6;
	const audioBytes = Math.round(seconds * 44100 * 2 * 2);
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			Here is the single most useful sentence in this entire course, and everything else follows
			from it:
		</p>
		<p class="border-l-2 border-msg-note py-1 pl-4 text-lg leading-relaxed font-medium">
			MIDI never carries sound. It carries instructions about what to play.
		</p>
		<p class="text-[15px] leading-relaxed">
			A MIDI message is a note-sized piece of paper that says <em>press middle C, this hard, now</em
			>. It does not contain a piano. Somewhere downstream there has to be something that reads the
			paper and makes a noise — a synthesiser, a sampler, a software instrument, or the little synth
			built into this page. That thing is what you actually hear.
		</p>
	</Section>

	<TryThis title="Same notes, different instrument">
		<p class="text-sm leading-relaxed">
			The eight notes below never change. Only the instruction "use sound number <em>n</em>" does.
			Play it, switch voices, play it again.
		</p>

		<div class="flex flex-wrap gap-1.5">
			{#each VOICES as p (p)}
				<button
					class={cn(
						'rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
						program === p
							? 'border-msg-program bg-msg-program-bg text-msg-program'
							: 'hover:border-foreground/30'
					)}
					onclick={() => choose(p)}
				>
					{gmProgramName(p)}
				</button>
			{/each}
		</div>

		<PhrasePlayer notes={PHRASE} bpm={108} label="Play the phrase" variant="default" />

		<p class="text-xs leading-relaxed text-muted-foreground">
			What you just sent was 8 notes, and what changed between takes was one three-byte message:
			<code class="rounded bg-muted px-1 font-mono"
				>C0 {program.toString(16).toUpperCase().padStart(2, '0')}</code
			>
			— "channel 1, use program {program}". Not one sample of audio moved.
		</p>
	</TryThis>

	<Section title="Why that difference is enormous">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-xl border border-msg-note/30 bg-msg-note-bg p-4">
				<p class="text-[11px] font-semibold tracking-wide text-msg-note uppercase">
					MIDI · the intent
				</p>
				<p class="tnum font-mono text-2xl">{midiBytes} bytes</p>
				<p class="text-sm leading-relaxed">
					{events.length} messages. Every one of them is editable: change a note, change the tempo, change
					the instrument, transpose the lot, and nothing degrades because there is nothing to degrade.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-xl border bg-muted/40 p-4">
				<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
					Audio · the result
				</p>
				<p class="tnum font-mono text-2xl">{(audioBytes / 1_000_000).toFixed(1)} MB</p>
				<p class="text-sm leading-relaxed">
					The same {seconds.toFixed(1)} seconds as uncompressed stereo. Exactly what was played, and almost
					nothing about it can be changed afterwards. You cannot un-play a wrong note.
				</p>
			</div>
		</div>
		<p class="text-[15px] leading-relaxed">
			That is roughly <strong>{Math.round(audioBytes / midiBytes).toLocaleString()}× smaller</strong
			>, which is why a protocol designed in 1983 for a 31,250-bit-per-second cable is still how
			every instrument in your studio talks to every other one. It was never trying to move sound.
		</p>
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
		<ul class="flex flex-col gap-2.5 text-[15px] leading-relaxed">
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-current text-destructive"></span>
				<span>
					<strong>It cannot carry a sound.</strong> There is no way to send "this exact snare sample"
					over ordinary MIDI. (SysEx can transfer a sample as data, but that is a file transfer, not a
					performance.)
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
					<strong>It cannot describe music theory.</strong> There is no "C minor" message. MIDI knows
					note number 60, not that you meant the tonic.
				</span>
			</li>
		</ul>
		<p class="text-sm leading-relaxed text-muted-foreground">
			None of these are flaws. They are the reason a 1983 protocol still works with instruments
			built in 2026: it deliberately refused to have an opinion about sound.
		</p>
	</Section>

	<Section title="Your turn">
		<p class="text-[15px] leading-relaxed">
			Play a few notes. Nothing here is a picture — the keys below send real MIDI messages into the
			same engine your hardware will plug into, and the dock at the bottom of the window is
			watching.
		</p>
		<Keyboard low={48} octaves={3} height={120} />
	</Section>

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
