<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import ClockLab from '$lib/components/midi/ClockLab.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { transport } from '$lib/midi/clock.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { Button } from '$lib/components/ui/button';

	const meta = lessonById('midi-clock')!;

	const REALTIME: Array<[number, string, string]> = [
		[0xf8, 'Timing Clock', 'One tick. Twenty-four per quarter note, sent continuously.'],
		[0xfa, 'Start', 'Begin playing from the very beginning.'],
		[0xfb, 'Continue', 'Resume from wherever the song position left off.'],
		[0xfc, 'Stop', 'Stop playing. Position is retained.'],
		[0xfe, 'Active Sensing', 'A heartbeat. If it stops, assume the cable was pulled.'],
		[0xff, 'System Reset', 'Return to power-on state. Rarely used.']
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Here is the surprising thing about MIDI synchronisation: <strong
				>no tempo number is ever transmitted</strong
			>. There is no "set BPM to 128" message. Instead the leader sends a single byte —
			<code class="rounded-sm bg-muted px-1 font-mono">F8</code> — twenty-four times per quarter note,
			and every follower infers the tempo from how fast they arrive.
		</p>
		<ByteInspector bytes={[0xf8]} />
		<p class="prose-body">
			One byte. No channel, no data, nothing to decode. If you speed up, the ticks come closer
			together and everyone follows within a beat, because they are not reading a number — they are
			feeling a pulse.
		</p>
	</Section>

	<Callout variant="key" title="Twenty-four is not a resolution">
		<p>
			24 ticks per quarter note is a <em>transmission</em> rate, not a sequencing resolution. Your OP-XY
			sequences at 1920 PPQN internally; a DAW might use 960. They all still send and receive clock at
			24. The follower interpolates between ticks to place events more finely than the clock itself.
		</p>
		<p class="mt-2">
			At 120 BPM, 24 ticks per quarter is 48 messages per second — before a single note is played.
			This is why the monitor hides clock by default, and why leaving clock enabled on a busy cable
			has a real cost.
		</p>
	</Callout>

	<TryThis title="Watch the pulse">
		<ClockLab />
	</TryThis>

	<Section title="The System Real-Time messages">
		<p class="prose-body">
			Clock belongs to a small family of single-byte messages with an unusual privilege: they may
			appear <em>anywhere</em>, including in the middle of another message's data bytes. A receiver
			must handle a clock byte arriving between a Note On's note number and its velocity, and carry
			on as if nothing happened.
		</p>
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<thead class="label bg-muted/50">
					<tr>
						<th class="w-16 px-3 py-2 text-left font-medium">Byte</th>
						<th class="px-3 py-2 text-left font-medium">Message</th>
						<th class="px-3 py-2 text-left font-medium">Means</th>
					</tr>
				</thead>
				<tbody>
					{#each REALTIME as [b, name, what] (b)}
						<tr class="border-t">
							<td class="px-3 py-2 font-mono text-msg-clock">
								{b.toString(16).toUpperCase()}
							</td>
							<td class="px-3 py-2">{name}</td>
							<td class="px-3 py-2 text-xs leading-snug text-muted-foreground">{what}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-sm leading-relaxed text-muted-foreground">
			This privilege is why the streaming parser in this app checks for bytes ≥ 0xF8 before anything
			else, and why yours should too.
		</p>
	</Section>

	<Section title="Start, Continue, and the difference that matters">
		<p class="prose-body">
			<strong>Start</strong> means "from the top". <strong>Continue</strong> means "from where we were".
			Sending Start when you meant Continue is why a follower sometimes jumps back to bar one in the middle
			of a jam.
		</p>
		<p class="prose-body">
			"Where we were" is communicated by <strong>Song Position Pointer</strong> — a 14-bit count of
			<em>sixteenth notes</em> from the start of the song. The correct sequence for locating is: send
			Song Position Pointer, then send Continue. Position first, then go.
		</p>
		<div class="flex flex-col gap-2 rounded-lg border bg-surface-sunken p-4 font-mono text-xs">
			<div class="flex gap-4">
				<code class="w-24 text-msg-clock">F2 40 00</code>
				<span class="font-sans text-muted-foreground">
					Song Position = 64 sixteenths = bar 5 in 4/4
				</span>
			</div>
			<div class="flex gap-4">
				<code class="w-24 text-msg-clock">FB</code>
				<span class="font-sans text-muted-foreground">Continue — start playing from there</span>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={() => engine.sendBytes([0xfa])}
				>Send Start</Button
			>
			<Button variant="outline" size="sm" onclick={() => engine.sendBytes([0xfc])}>Send Stop</Button
			>
			<Button variant="outline" size="sm" onclick={() => engine.sendBytes([0xf2, 0x40, 0x00])}>
				Send Song Position 64
			</Button>
			<Button variant="outline" size="sm" onclick={() => engine.sendBytes([0xfb])}>
				Send Continue
			</Button>
		</div>
		<Callout variant="gotcha" title="Song Position has a ceiling">
			<p>
				14 bits of sixteenth notes is 16,384 sixteenths — about 1,024 bars of 4/4, roughly half an
				hour at 120 BPM. Long-form pieces exceed it, which is one of several reasons professional
				video and film work uses MIDI Time Code instead.
			</p>
		</Callout>
	</Section>

	<Section title="Deciding who is in charge">
		<p class="prose-body">
			Exactly one device in a rig should generate clock. Everything else follows. There is no
			negotiation in MIDI 1.0 — no election, no handshake — so if two devices both send clock, both
			will also be trying to follow, and the result is not a compromise but a mess.
		</p>
		<p class="prose-body">
			The bad outcome is not choosing wrongly. It is choosing <em>accidentally</em>, because some
			device shipped with clock output enabled and nobody noticed. Decide per session, write it
			down, and check it before you wonder why the groove feels drunk.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Good leader</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					The device whose sequencer you are actually playing. A groovebox with a tight internal
					clock; the DAW when the DAW is the arrangement.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Good follower</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					Anything with an arpeggiator, an LFO you want in time, a delay you want synced, or its own
					sequencer running a subordinate part.
				</p>
			</div>
		</div>
		<Callout variant="convention" title="Followers are not all equal">
			<p>
				Some devices follow clock beautifully. Some — including, by widely reported experience,
				several standalone grooveboxes — introduce noticeable instability when slaved. If your rig
				feels loose, try making the wobbly device the <em>leader</em> instead of fighting it. The jitter
				plot above is how you find out which one it is, rather than guessing.
			</p>
		</Callout>
	</Section>

	<Quiz
		question="Your synth's arpeggiator is running at the wrong speed even though clock is connected. What is the first thing to check?"
		options={[
			'Whether the synth is set to internal clock rather than external',
			'Whether the MIDI cable supports clock',
			'Whether both devices are on the same channel',
			'Whether the tempo is above 120 BPM'
		]}
		answer={0}
		explanation="Clock is not channel-addressed, so channels are irrelevant here, and every MIDI cable carries it. The near-universal cause is a device still set to its own internal clock — it is receiving the ticks and ignoring them. Look for a Sync or Clock Source setting."
	/>

	<Further
		refs={['spec-summary', 'somascape-spec', 'ableton-link']}
		lead="Clock as specified, and the modern alternative that answers &quot;who is in charge of time&quot; with &quot;nobody&quot;."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="run"
			label="Start the transport"
			test={(e) => e.message.type === 'start' || e.message.type === 'continue'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="clock-out"
			label="Send MIDI Clock — at least one full beat of it"
			hint="Switch on Send MIDI Clock, then play."
			count={24}
			key={(e) => String(e.id)}
			test={(e) => e.message.type === 'clock' && e.direction === 'out'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="spp"
			label="Locate with a Song Position Pointer"
			test={(e) => e.message.type === 'songPosition'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="continue"
			label="Use Continue rather than Start"
			test={(e) => e.message.type === 'continue'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="tempo"
			label="Change the tempo and watch the tick rate follow"
			hint="Drag the BPM slider while the transport runs."
			count={2}
			key={() => String(Math.round(transport.bpm))}
			test={() => transport.playing}
		/>
	</Checkpoints>
</LessonShell>
