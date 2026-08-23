<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { hexBytes } from '$lib/midi/messages';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { DangerIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	const meta = lessonById('note-on-off')!;

	function strand() {
		engine.wake();
		// Deliberately orphaned: a Note On with no Note Off coming.
		const note = 55 + Math.floor(Math.random() * 12);
		engine.send({ type: 'noteOn', channel: 0, note, velocity: 88 });
	}

	const held = $derived(noteState.channel(0).notes.size);

	// A four-note run, shown with and without running status.
	const RUN = [
		[0x90, 60, 100],
		[0x90, 64, 96],
		[0x90, 67, 92],
		[0x90, 72, 108]
	];
	const withRunning = [0x90, 60, 100, 64, 96, 67, 92, 72, 108];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			There is no "play a note for half a second" message. There is only <strong>start</strong> and
			<strong>stop</strong>, sent separately, with the duration living in the gap between them. A
			note is not an event; it is a state you switch on and later switch off.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<p class="mb-2 text-xs font-semibold tracking-wide text-msg-note uppercase">
					Press the key
				</p>
				<ByteInspector bytes={[0x90, 0x3c, 0x64]} compact />
			</div>
			<div>
				<p class="mb-2 text-xs font-semibold tracking-wide text-msg-note uppercase">
					Release the key
				</p>
				<ByteInspector bytes={[0x80, 0x3c, 0x40]} compact />
			</div>
		</div>
		<p class="prose-body">
			This design is why MIDI can express a note held for eleven minutes without sending anything in
			between, and also why the most famous MIDI failure mode exists.
		</p>
	</Section>

	<Section title="The stuck note">
		<p class="prose-body">
			If a Note On arrives and its matching Note Off never does — the cable was pulled, the software
			crashed, a channel got remapped mid-note, the sequencer was stopped between the two — the
			instrument has no way to know. It was told to hold the note. It is holding the note. It will
			hold it forever, correctly.
		</p>

		<TryThis title="Create one on purpose">
			<p class="text-sm leading-relaxed">
				The button below sends a Note On and simply never sends the Note Off. Press it a few times.
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<Button variant="outline" onclick={strand}>Send a Note On with no Note Off</Button>
				<span
					class={cn(
						'tnum font-mono text-sm',
						held > 0 ? 'text-destructive' : 'text-muted-foreground'
					)}
				>
					{held} note{held === 1 ? '' : 's'} stuck on channel 1
				</span>
				<div class="flex-1"></div>
				<Button
					variant={held > 0 ? 'default' : 'outline'}
					class="gap-1.5"
					onclick={() => engine.panic()}
				>
					<HugeiconsIcon icon={DangerIcon} size={15} />
					Panic
				</Button>
			</div>
			<p class="text-xs leading-relaxed text-muted-foreground">
				Panic sends All Notes Off and All Sound Off on all sixteen channels — the same thing the red
				button in the dock does. Every MIDI application you have ever used has one of these, and now
				you know exactly why.
			</p>
		</TryThis>

		<Callout variant="key" title="The rule that prevents most of them">
			<p>
				Whatever sends a Note On owns the responsibility for its Note Off. In code, that means
				tracking held notes and releasing them on stop, on disconnect, on channel change, and on
				error — never assuming the pair will complete itself. The scheduler you build in
				<Xref to="building-a-sequencer" /> does exactly this bookkeeping.
			</p>
		</Callout>
	</Section>

	<Section title="Note Off has two spellings">
		<p class="prose-body">
			There is a real Note Off status — <code class="rounded-sm bg-muted px-1 font-mono">0x8n</code>
			— and there is a Note On whose velocity happens to be zero, which is
			<em>defined</em> to mean the same thing. Both are correct. Most hardware sends the second.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border p-4">
				<p class="text-sm font-semibold">The explicit form</p>
				<code class="rounded-sm bg-muted px-2 py-1 font-mono text-sm">80 3C 40</code>
				<p class="text-xs leading-relaxed text-muted-foreground">
					Status 0x80, note 60, release velocity 64. Unambiguous, and carries release velocity if
					anything cares.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border p-4">
				<p class="text-sm font-semibold">The velocity-zero form</p>
				<code class="rounded-sm bg-muted px-2 py-1 font-mono text-sm">90 3C 00</code>
				<p class="text-xs leading-relaxed text-muted-foreground">
					Status 0x90 — Note <em>On</em> — with velocity 0. Identical effect. Looks wrong; is right.
				</p>
			</div>
		</div>
		<p class="prose-body">
			The second form exists because of a bandwidth trick, which is worth understanding because you
			will see it in MIDI files and on real cables.
		</p>
	</Section>

	<Section title="Running status">
		<p class="prose-body">
			On a 31,250-bit-per-second wire, each byte takes 320 microseconds. A three-byte note takes
			about a millisecond, and a ten-note chord takes ten — enough to hear as a strum. So the spec
			allows a sender to <strong>omit a repeated status byte</strong>. Once it has said "Note On,
			channel 1", it can keep sending pairs of data bytes and the receiver assumes the status still
			applies.
		</p>

		<div class="grid gap-3 lg:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Four notes, spelled out — {RUN.flat().length} bytes
				</p>
				<code
					class="overflow-x-auto rounded-sm bg-muted px-2 py-1.5 font-mono text-xs whitespace-nowrap"
				>
					{RUN.map((m) => hexBytes(m)).join('  ')}
				</code>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border border-msg-note/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					With running status — {withRunning.length} bytes
				</p>
				<code
					class="overflow-x-auto rounded-sm bg-muted px-2 py-1.5 font-mono text-xs whitespace-nowrap"
				>
					{hexBytes(withRunning)}
				</code>
				<p class="text-xs text-muted-foreground">
					{Math.round((1 - withRunning.length / RUN.flat().length) * 100)}% fewer bytes, and the
					chord tightens up audibly.
				</p>
			</div>
		</div>

		<p class="prose-body">
			Now the two ideas connect. Under running status, sending a real Note Off would mean re-sending
			a status byte and breaking the run. Sending "note 60, velocity 0" keeps the run going. That is
			the entire reason velocity-zero Note Off exists.
		</p>

		<Callout variant="note" title="You will not meet it in the browser">
			<p>
				The Web MIDI API always hands you complete messages with their status byte restored, so you
				never have to implement running status to receive. You <em>do</em> need it to parse a Standard
				MIDI File, which uses the same trick — that is Lesson 18.
			</p>
		</Callout>
	</Section>

	<TryThis title="Watch the pairs">
		<p class="text-sm leading-relaxed">
			Open the dock's Monitor tab, then play. Every key produces two rows. Hold a key for a long
			time and watch the delta column: the gap between the two messages <em>is</em> the note length.
		</p>
		<Keyboard low={48} octaves={2} height={120} />
	</TryThis>

	<Quiz
		question="A sequencer is stopped halfway through a long held note. What does the instrument do?"
		options={[
			'Nothing — it stops when the sequencer stops',
			'Holds the note indefinitely, because no Note Off was ever sent',
			'Fades the note out after a few seconds'
		]}
		answer={1}
		explanation="The instrument has no concept of a sequencer, a transport or a stop button. It received an instruction to start a note and has not received one to stop it. This is why well-behaved sequencers send All Notes Off when you press stop — and why the ones that forget give you a drone until you hit panic."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="pair"
			label="Play a note and release it — send both halves of the pair"
			test={(e) => e.message.type === 'noteOff'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="stick"
			label="Create a stuck note on purpose"
			hint="Use the button above."
			test={() => noteState.heldCount > 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="rescue"
			label="Clear it with All Notes Off"
			hint="Press Panic here, or the red button in the dock."
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 123}
		/>
		<Checkpoint
			lesson={meta.id}
			id="long-note"
			label="Hold a note for more than two seconds"
			hint="The engine is timing the gap between your Note On and Note Off."
			test={(() => {
				const starts = new Map<number, number>();
				return (e) => {
					if (e.message.type === 'noteOn') {
						starts.set(e.message.note, e.time);
						return false;
					}
					if (e.message.type === 'noteOff') {
						const t = starts.get(e.message.note);
						starts.delete(e.message.note);
						return t !== undefined && e.time - t > 2000;
					}
					return false;
				};
			})()}
		/>
	</Checkpoints>
</LessonShell>
