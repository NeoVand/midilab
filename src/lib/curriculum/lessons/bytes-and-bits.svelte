<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import MessageBuilder from '$lib/components/midi/MessageBuilder.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { binary, hex, Status } from '$lib/midi/messages';
	import { cn } from '$lib/utils';

	const meta = lessonById('bytes-and-bits')!;

	// The bit playground.
	let bits = $state([1, 0, 0, 1, 0, 0, 0, 0]);
	const byte = $derived(bits.reduce((acc, b, i) => acc + (b << (7 - i)), 0));
	const isStatus = $derived(bits[0] === 1);

	const TYPES: Array<[number, string, string]> = [
		[0x8, 'Note Off', 'stop a note'],
		[0x9, 'Note On', 'start a note'],
		[0xa, 'Poly Aftertouch', 'pressure on one note'],
		[0xb, 'Control Change', 'move a controller'],
		[0xc, 'Program Change', 'switch sound'],
		[0xd, 'Channel Aftertouch', 'pressure on the whole channel'],
		[0xe, 'Pitch Bend', 'bend everything on the channel'],
		[0xf, 'System', 'not channel-addressed at all']
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			MIDI messages are almost always one, two or three bytes. A byte is eight bits, and a bit is a
			1 or a 0. That is the entire alphabet.
		</p>
		<p class="text-[15px] leading-relaxed">
			The problem the designers faced in 1983 was this: bytes arrive down a wire one after another,
			with nothing separating them. If you tune in halfway through a stream, how do you know whether
			the byte you just caught is a <em>command</em> or a <em>number</em>? Their answer was to spend
			one bit — the leftmost, most significant one — saying which.
		</p>
	</Section>

	<Callout variant="key" title="The one rule">
		<p>
			If a byte's top bit is <strong>1</strong>, it is a <strong>status byte</strong>: a command.
			Its value is 128–255, or 0x80–0xFF in hex.
		</p>
		<p class="mt-1.5">
			If a byte's top bit is <strong>0</strong>, it is a <strong>data byte</strong>: a value. Its
			range is 0–127, or 0x00–0x7F.
		</p>
		<p class="mt-1.5">
			That is why every value in MIDI — note number, velocity, controller value, program number —
			runs 0 to 127. Seven bits are all that is left once the eighth has been spent on this
			distinction. It is not an arbitrary limit; it is the price of the rule.
		</p>
	</Callout>

	<TryThis title="Flip the bits yourself">
		<p class="text-sm leading-relaxed">
			Toggle any bit. Watch what happens to the byte's meaning when the leftmost one changes.
		</p>
		<div class="flex flex-wrap items-center gap-6">
			<div class="flex gap-1.5">
				{#each bits as bit, i (i)}
					<div class="flex flex-col items-center gap-1">
						<button
							class={cn(
								'grid size-11 place-items-center rounded-lg border font-mono text-lg transition-colors',
								bit === 1
									? i === 0
										? isStatus
											? 'border-msg-note bg-msg-note text-background'
											: ''
										: 'border-foreground/25 bg-foreground/12'
									: 'bg-muted/40 text-muted-foreground/50',
								i === 0 && bit === 0 && 'border-muted-foreground/40 bg-muted text-muted-foreground'
							)}
							onclick={() => (bits[i] = bits[i] ? 0 : 1)}
							aria-label="Toggle bit {7 - i}"
						>
							{bit}
						</button>
						<span class="font-mono text-[9px] text-muted-foreground/60">{2 ** (7 - i)}</span>
					</div>
				{/each}
			</div>

			<div class="flex flex-col gap-1">
				<p class="text-[10px] tracking-wide text-muted-foreground uppercase">This byte is</p>
				<p class="tnum font-mono text-3xl leading-none">
					{hex(byte, true)}
					<span class="text-lg text-muted-foreground">· {byte}</span>
				</p>
				<p
					class={cn(
						'mt-1 text-sm font-medium',
						isStatus ? 'text-msg-note' : 'text-muted-foreground'
					)}
				>
					{#if isStatus}
						A status byte — {TYPES.find(([n]) => n === byte >> 4)?.[1] ?? 'System'} on channel {(byte &
							0xf) +
							1}
					{:else}
						A data byte — the value {byte}
					{/if}
				</p>
			</div>
		</div>
		<div class="flex flex-wrap gap-1.5">
			{#each [[0x90, 'Note On, ch 1'], [0x9f, 'Note On, ch 16'], [0xb0, 'CC, ch 1'], [0x3c, 'the number 60'], [0x7f, 'the number 127'], [0xf8, 'Clock']] as [v, l] (v)}
				<button
					class="rounded border px-2 py-1 font-mono text-[10px] hover:border-foreground/40"
					onclick={() =>
						(bits = binary(v as number)
							.split('')
							.map(Number))}
				>
					{hex(v as number, true)} <span class="text-muted-foreground">{l}</span>
				</button>
			{/each}
		</div>
	</TryThis>

	<Section title="A status byte says two things at once">
		<p class="text-[15px] leading-relaxed">
			Having spent one bit on "I am a command", MIDI splits the remaining seven — well, the
			remaining <em>four and four</em>. A status byte is two hexadecimal digits, and each digit does
			a different job.
		</p>

		<div class="flex flex-col gap-4 rounded-xl border bg-surface-sunken p-5">
			<div class="flex items-center gap-3">
				<code class="font-mono text-3xl text-msg-note">9</code>
				<code class="font-mono text-3xl text-msg-cc">2</code>
				<span class="ml-3 text-sm text-muted-foreground">= 0x92 = 146</span>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<div>
					<p class="text-[11px] font-semibold tracking-wide text-msg-note uppercase">
						High nibble — what
					</p>
					<p class="mt-1 text-sm leading-relaxed">
						<code class="rounded bg-muted px-1 font-mono">9</code> = Note On. Eight possible commands,
						listed below.
					</p>
				</div>
				<div>
					<p class="text-[11px] font-semibold tracking-wide text-msg-cc uppercase">
						Low nibble — who
					</p>
					<p class="mt-1 text-sm leading-relaxed">
						<code class="rounded bg-muted px-1 font-mono">2</code> = channel 3. Sixteen channels, numbered
						0–15 on the wire and 1–16 on every front panel ever made.
					</p>
				</div>
			</div>
		</div>

		<Callout variant="gotcha" title="Zero-based on the wire, one-based on the panel">
			<p>
				The byte contains 0 for channel 1 and 15 for channel 16. Every display, manual and menu
				shows 1–16. When you write code, keep the two lexically distinct — this app calls the raw
				value <code>channel</code> and the display value <code>channel + 1</code>, and never mixes
				them. Off-by-one channel bugs are the single most common MIDI programming error.
			</p>
		</Callout>

		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50 text-[10px] tracking-wide text-muted-foreground uppercase">
					<tr>
						<th class="px-3 py-2 text-left font-medium">Nibble</th>
						<th class="px-3 py-2 text-left font-medium">Status</th>
						<th class="px-3 py-2 text-left font-medium">Message</th>
						<th class="hidden px-3 py-2 text-left font-medium sm:table-cell">Does</th>
						<th class="px-3 py-2 text-right font-medium">Data bytes</th>
					</tr>
				</thead>
				<tbody>
					{#each TYPES as [nibble, name, does] (nibble)}
						<tr class="border-t">
							<td class="px-3 py-2 font-mono">{nibble.toString(16).toUpperCase()}</td>
							<td class="px-3 py-2 font-mono text-xs text-muted-foreground">
								{hex(nibble << 4, true)}–{hex((nibble << 4) | 0xf, true)}
							</td>
							<td class="px-3 py-2">{name}</td>
							<td class="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{does}</td>
							<td class="px-3 py-2 text-right font-mono">
								{nibble === 0xc || nibble === 0xd ? 1 : nibble === 0xf ? '0–many' : 2}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Section>

	<TryThis title="Build a message">
		<p class="text-sm leading-relaxed">
			Turn the knobs. The bytes underneath are what would actually go down the cable — and pressing
			Send does exactly that, to whatever outputs are enabled in the dock.
		</p>
		<MessageBuilder />
	</TryThis>

	<Section title="Reading raw bytes">
		<p class="text-[15px] leading-relaxed">
			With the one rule and the nibble split, you can decode anything a monitor shows you. Here are
			two more, taken apart the same way — cover the captions and work them out first.
		</p>
		<div class="flex flex-col gap-3">
			<ByteInspector bytes={[0x94, 0x40, 0x64]} compact />
			<ByteInspector bytes={[0xb0, 0x07, 0x00]} compact />
		</div>
	</Section>

	<Quiz
		question="You see the bytes 94 40 64 in a MIDI monitor. What happened?"
		options={[
			'Control Change 64 on channel 5',
			'Note On, note 64, velocity 100, on channel 5',
			'Note On, note 148, velocity 64, on channel 4',
			'Program Change to program 64'
		]}
		answer={1}
		explanation="0x94 → high nibble 9 = Note On, low nibble 4 = channel index 4 = channel 5 on the panel. Then 0x40 = 64 (the note, E) and 0x64 = 100 (the velocity). Note the two traps: hex 0x40 is decimal 64, and the channel displays as one higher than the nibble."
	/>

	<Quiz
		question="Could the byte 0x45 ever be a status byte?"
		options={[
			'Yes, it is Note Off on channel 6',
			'No — its top bit is 0, so it can only ever be data',
			'Only inside a System Exclusive message'
		]}
		answer={1}
		explanation="0x45 is 69 in decimal, which is under 128, so its top bit is 0. The rule has no exceptions: a byte below 0x80 is data, always. That is precisely what makes the stream re-synchronisable — a receiver that joins mid-stream just waits for the next byte with a high bit set."
	/>

	<Callout variant="note" title="Why this design has lasted forty years">
		<p>
			Because it is self-synchronising. Pull a cable out mid-message, plug it back in, and the
			receiver recovers on the very next status byte — no handshake, no framing protocol, no
			negotiation. One bit bought that.
		</p>
	</Callout>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="ch10"
			label="Send any message on channel 10"
			hint="Turn the Channel knob in the builder to 10 — its wire value is 9."
			test={(e) => 'channel' in e.message && e.message.channel === 9}
		/>
		<Checkpoint
			lesson={meta.id}
			id="cc-status"
			label="Send a message whose status byte starts with 0xB"
			hint="That is Control Change. Pick it in the builder."
			test={(e) => e.bytes.length > 0 && (e.bytes[0] & 0xf0) === Status.ControlChange}
		/>
		<Checkpoint
			lesson={meta.id}
			id="four-types"
			label="Send four different kinds of message"
			hint="Note On, Control Change, Program Change and Pitch Bend, for instance."
			count={4}
			key={(e) => String(e.bytes[0] & 0xf0)}
			test={(e) => e.bytes.length > 0 && e.bytes[0] >= 0x80 && e.bytes[0] < 0xf0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="max-velocity"
			label="Send a Note On with velocity 127 — the largest a data byte can hold"
			test={(e) => e.message.type === 'noteOn' && e.message.velocity === 127}
		/>
	</Checkpoints>
</LessonShell>
