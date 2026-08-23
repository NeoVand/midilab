<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import MidiFileLab from '$lib/components/midi/MidiFileLab.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { encodeVlq, explainVlq } from '$lib/midi/smf';
	import { Slider } from '$lib/components/ui/slider';

	const meta = lessonById('midi-files')!;

	let vlq = $state(480);
	const explained = $derived(explainVlq(vlq));
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-base leading-relaxed">
			A live MIDI cable has no memory. A Standard MIDI File is the same messages written down, with
			one thing added that the cable never needed: <strong
				>how long to wait before the next one</strong
			>.
		</p>
		<div class="flex flex-col gap-3 rounded-lg border bg-surface-sunken p-5">
			<div class="flex flex-wrap items-center gap-2 font-mono text-sm">
				<span class="text-msg-sysex">MThd</span>
				<span class="text-xs text-muted-foreground">header — format, track count, resolution</span>
			</div>
			<div class="flex flex-wrap items-center gap-2 font-mono text-sm">
				<span class="text-msg-note">MTrk</span>
				<span class="text-xs text-muted-foreground">
					track — a stream of (delta time, event) pairs, ending in End of Track
				</span>
			</div>
			<div class="flex flex-wrap items-center gap-2 font-mono text-sm">
				<span class="text-msg-note">MTrk</span>
				<span class="text-xs text-muted-foreground">…as many as the header said</span>
			</div>
		</div>
		<p class="text-base leading-relaxed">
			Three formats exist. <strong>Format 0</strong> squeezes everything into a single track —
			simple to play, awkward to edit. <strong>Format 1</strong> keeps parallel tracks that share
			one timeline, which is what almost everything writes today. <strong>Format 2</strong> holds independent
			sequences that do not share a timeline, and is essentially extinct.
		</p>
	</Section>

	<Section title="Variable-length quantities">
		<p class="text-base leading-relaxed">
			Delta times need to span from zero to hundreds of thousands of ticks, but most of them are
			small. Spending four bytes on every one would be wasteful, so MIDI files use a
			<strong>variable-length quantity</strong>: seven bits of number per byte, with the top bit
			meaning "another byte follows".
		</p>
		<p class="text-base leading-relaxed">
			This is the same seven-bit thinking as everywhere else in the protocol, applied to a different
			problem. Values up to 127 take one byte; up to 16,383 take two; the maximum is four bytes.
		</p>

		<div class="flex flex-col gap-4 rounded-lg border p-4">
			<div class="flex items-center gap-4">
				<span class="w-16 text-xs text-muted-foreground">Value</span>
				<div class="flex-1">
					<Slider type="single" bind:value={vlq} min={0} max={200000} step={1} />
				</div>
				<span class="tnum w-20 text-right font-mono text-sm">{vlq}</span>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				{#each explained.bytes as b, i (i)}
					{@const cont = (b & 0x80) !== 0}
					<div class="min-w-24 rounded-lg border bg-card p-2.5">
						<p class="font-mono text-lg leading-none text-msg-sysex">
							{b.toString(16).toUpperCase().padStart(2, '0')}
						</p>
						<p class="mt-1 font-mono text-2xs">
							<span class={cont ? 'font-bold text-msg-note' : 'text-muted-foreground'}>
								{cont ? '1' : '0'}
							</span><span class="text-muted-foreground">
								{(b & 0x7f).toString(2).padStart(7, '0')}
							</span>
						</p>
						<p class="mt-1 text-2xs text-muted-foreground">
							{cont ? 'more follows' : 'last byte'} · {b & 0x7f}
						</p>
					</div>
				{/each}
				<span class="ml-2 text-xs text-muted-foreground">
					{explained.bytes.length} byte{explained.bytes.length === 1 ? '' : 's'} for the number {vlq}
				</span>
			</div>
			<div class="flex flex-wrap gap-1.5">
				{#each [0, 127, 128, 480, 8192, 16383, 100000] as v (v)}
					<button
						class="rounded-md border px-2 py-0.5 font-mono text-xs hover:border-foreground/40"
						onclick={() => (vlq = v)}
					>
						{v} → {encodeVlq(v).length}B
					</button>
				{/each}
			</div>
		</div>
	</Section>

	<Callout variant="note" title="Two things carry over from the cable">
		<p>
			MIDI files use <strong>running status</strong> exactly as a live stream does — a repeated status
			byte is simply omitted. And a track's events are stored in time order with no timestamps, only deltas,
			so a corrupted byte early in a track shifts everything after it. Both facts mean a file parser has
			to be a proper streaming parser, not a series of fixed offsets.
		</p>
	</Callout>

	<Section title="Meta events">
		<p class="text-base leading-relaxed">
			Files also carry things that make no sense on a cable: the tempo, the time signature, track
			names, lyrics, markers, copyright. These are <strong>meta events</strong>, always beginning
			<code class="rounded-sm bg-muted px-1 font-mono">FF</code>, and they exist only inside files.
		</p>
		<Callout variant="gotcha" title="Tempo is stored inside out">
			<p>
				A Set Tempo meta event does not contain BPM. It contains <em
					>microseconds per quarter note</em
				> — 500,000 for 120 BPM. Dividing 60,000,000 by that number gets you back to BPM. Storing it this
				way keeps the arithmetic exact for the tick-to-seconds conversion a player has to do.
			</p>
		</Callout>
	</Section>

	<TryThis title="Open one, or write one">
		<p class="text-sm leading-relaxed">
			Drop in any .mid file from your machine — an export from your DAW, something from the internet
			— and it will be parsed here, byte by byte, by the codec in this app. Or write one out and
			open it somewhere else to prove it round-trips.
		</p>
		<MidiFileLab />
	</TryThis>

	<Section title="What a file does not tell you">
		<p class="text-base leading-relaxed">
			A MIDI file contains program numbers, not sounds. Open the same file on two systems and you
			get two different pieces of music — the note data is identical and the timbre is entirely at
			the mercy of whatever is playing it. This is the "control, not sound" lesson from Act I,
			arriving as a practical problem rather than a principle.
		</p>
		<p class="text-base leading-relaxed">
			If you want a file to sound approximately right elsewhere, write General MIDI program numbers
			and keep drums on channel 10. If you want it to sound <em>exactly</em> right, you need the audio,
			or the instrument, or both.
		</p>
	</Section>

	<Quiz
		question="A Set Tempo meta event contains the bytes 07 A1 20. What tempo is that?"
		options={['120 BPM', '150 BPM', '500,000 BPM', '96 BPM']}
		answer={0}
		explanation="0x07A120 is 500,000 — microseconds per quarter note, not BPM. 60,000,000 ÷ 500,000 = 120. The inversion is the trap: a bigger number in the file means a slower tempo."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="vlq"
			label="Find a value that needs three bytes as a VLQ"
			hint="Anything above 16,383."
		/>
		<Checkpoint
			lesson={meta.id}
			id="open"
			label="Open a real .mid file and read its header"
			hint="Any file will do. Tick by hand if you have none."
		/>
		<Checkpoint
			lesson={meta.id}
			id="play"
			label="Play a file through the engine"
			test={(e) => e.message.type === 'noteOn' && e.direction === 'out'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="write"
			label="Write a file and open it in something else"
			hint="The download button writes one with this app's own codec."
		/>
	</Checkpoints>
</LessonShell>
