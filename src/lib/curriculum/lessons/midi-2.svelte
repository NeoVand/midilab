<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import Knob from '$lib/components/midi/Knob.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { encode, type MidiMessage } from '$lib/midi/messages';
	import { hexWord, MESSAGE_TYPES, toUmpMidi1, toUmpMidi2 } from '$lib/midi/ump';
	import { Button } from '$lib/components/ui/button';

	const meta = lessonById('midi-2')!;

	let kind = $state<'noteOn' | 'controlChange' | 'pitchBend' | 'programChange'>('noteOn');
	let note = $state(60);
	let velocity = $state(100);
	let controller = $state(74);
	let value = $state(96);
	let bend = $state(9000);
	let program = $state(12);
	let group = $state(0);

	const message = $derived.by((): MidiMessage => {
		switch (kind) {
			case 'controlChange':
				return { type: 'controlChange', channel: 0, controller, value };
			case 'pitchBend':
				return { type: 'pitchBend', channel: 0, value: bend };
			case 'programChange':
				return { type: 'programChange', channel: 0, program };
			default:
				return { type: 'noteOn', channel: 0, note, velocity };
		}
	});

	const ump1 = $derived(toUmpMidi1(message, group));
	const ump2 = $derived(toUmpMidi2(message, group));
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			MIDI 2.0 was ratified in 2020 and is real, shipping, and supported at the operating-system
			level on macOS, Windows and Linux. It is also, in most studios in 2026, not yet the thing your
			instruments actually speak. Both of those statements are true, and this lesson is about
			holding them at the same time.
		</p>
		<p class="prose-body">
			The headline is that MIDI 2.0 is <strong>bidirectional</strong>. MIDI 1.0 is a one-way
			broadcast: a sender shouts into a cable and has no idea whether anything is listening, what it
			is, or what it can do. MIDI 2.0 devices negotiate.
		</p>
	</Section>

	<Section title="The Universal MIDI Packet">
		<p class="prose-body">
			Everything travels as 32-bit words. The first nibble is the <strong>message type</strong>,
			which says how many words the packet occupies; the second is the <strong>group</strong>.
		</p>
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<thead class="label bg-muted/50">
					<tr>
						<th class="w-14 px-3 py-2 text-left font-medium">MT</th>
						<th class="px-3 py-2 text-left font-medium">Type</th>
						<th class="w-16 px-3 py-2 text-right font-medium">Words</th>
						<th class="hidden px-3 py-2 text-left font-medium sm:table-cell">Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each Object.entries(MESSAGE_TYPES) as [mt, info] (mt)}
						<tr class="border-t">
							<td class="px-3 py-2 font-mono text-msg-sysex">
								0x{Number(mt).toString(16).toUpperCase()}
							</td>
							<td class="px-3 py-2">{info.name}</td>
							<td class="px-3 py-2 text-right font-mono">{info.words}</td>
							<td class="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
								{info.note}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Callout variant="key" title="Groups multiply the address space">
			<p>
				Sixteen groups, each with sixteen channels, is 256 addresses on a single connection — and
				MPE zones can live inside a group without consuming everyone else's channels. The
				port-plus-channel thinking from Act IV becomes group-plus-channel, with far more room.
			</p>
		</Callout>
	</Section>

	<TryThis title="The same message, three ways">
		<div class="flex flex-wrap items-end gap-4">
			<div class="flex gap-1">
				{#each [['noteOn', 'Note On'], ['controlChange', 'CC'], ['pitchBend', 'Bend'], ['programChange', 'Program']] as [k, l] (k)}
					<Button
						variant={kind === k ? 'default' : 'outline'}
						size="sm"
						class="h-7 text-xs"
						onclick={() => (kind = k as typeof kind)}
					>
						{l}
					</Button>
				{/each}
			</div>
			{#if kind === 'noteOn'}
				<Knob bind:value={note} min={0} max={127} default={60} label="Note" size={44} />
				<Knob bind:value={velocity} min={1} max={127} default={100} label="Velocity" size={44} />
			{:else if kind === 'controlChange'}
				<Knob bind:value={controller} min={0} max={127} default={74} label="CC" size={44} />
				<Knob bind:value min={0} max={127} default={64} label="Value" size={44} />
			{:else if kind === 'pitchBend'}
				<Knob bind:value={bend} min={0} max={16383} default={8192} label="Bend" bipolar size={44} />
			{:else}
				<Knob bind:value={program} min={0} max={127} default={0} label="Program" size={44} />
			{/if}
			<Knob
				bind:value={group}
				min={0}
				max={15}
				default={0}
				label="Group"
				sub={String(group + 1)}
				size={44}
			/>
		</div>

		<div class="grid gap-4 lg:grid-cols-3">
			<div class="flex flex-col gap-2">
				<p class="label">MIDI 1.0 — on a cable</p>
				<div class="rounded-lg border p-3">
					<code class="font-mono text-sm">
						{encode(message)
							.map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
							.join(' ')}
					</code>
					<p class="mt-2 text-xs text-muted-foreground">
						{encode(message).length} bytes. Values 0–127.
					</p>
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<p class="label">UMP type 2 — MIDI 1.0, wrapped</p>
				<div class="rounded-lg border p-3">
					{#if ump1}
						<code class="font-mono text-sm text-msg-cc">{hexWord(ump1.words[0])}</code>
						<ul class="mt-2 flex flex-col gap-1 text-xs leading-snug text-muted-foreground">
							{#each ump1.notes as n (n)}
								<li>{n}</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<p class="label text-msg-note">UMP type 4 — native MIDI 2.0</p>
				<div class="rounded-lg border border-msg-note/40 p-3">
					{#if ump2}
						<code class="font-mono text-sm text-msg-note">
							{ump2.words.map(hexWord).join(' ')}
						</code>
						<ul class="mt-2 flex flex-col gap-1 text-xs leading-snug text-muted-foreground">
							{#each ump2.notes as n (n)}
								<li>{n}</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>

		<ByteInspector bytes={encode(message)} compact />
	</TryThis>

	<Section title="What actually changes">
		<div class="grid gap-3 sm:grid-cols-2">
			{#each [['Resolution', 'Velocity goes from 7 bits to 16. Controllers go from 7 bits to 32. The zipper-noise problem, the MSB/LSB pairing and the whole NRPN handshake all become unnecessary.'], ['Per-note controllers', 'Pitch bend, pressure and any controller can be addressed to a single note number natively — no channel-per-note trick required. MPE stops being a workaround and becomes a legacy compatibility mode.'], ['Bidirectional discovery', 'MIDI-CI lets two devices ask each other what they are and what they support, then agree on a protocol. This is the genuinely new idea.'], ['Property Exchange', 'A device can publish structured JSON describing its controllers, programs and state. Software can build an editor for an instrument it has never seen.'], ['Profiles', 'A device can declare "I behave as a drawbar organ", and a controller then knows what its knobs should do without a mapping session.'], ['Jitter reduction', 'Optional timestamps let a receiver place events precisely rather than when they happened to arrive.']] as [title, body] (title)}
				<div class="rounded-lg border p-4">
					<p class="text-sm font-semibold">{title}</p>
					<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
				</div>
			{/each}
		</div>
		<Callout variant="key" title="Property Exchange is the interesting one">
			<p>
				Everything in this course about implementation charts, undocumented NRPNs and CC-number
				archaeology exists because a MIDI 1.0 device cannot describe itself. Property Exchange is
				that problem being solved directly — and it is why the device-profile architecture in Act VI
				is worth building even now: it is the same abstraction, filled in by hand until instruments
				can fill it in themselves.
			</p>
		</Callout>
	</Section>

	<Section title="An honest assessment">
		<p class="prose-body">
			MIDI 2.0 is backward compatible by design — a MIDI 2.0 connection carries MIDI 1.0 traffic
			unchanged, and devices fall back automatically. So nothing you own becomes obsolete, and
			nothing you learn here is wasted.
		</p>
		<p class="prose-body">
			What has actually shipped: operating-system support is real on all three desktop platforms —
			CoreMIDI has carried UMP since macOS Monterey, Windows MIDI Services brings a universal USB
			MIDI 2.0 class driver, and Linux carries UMP through ALSA and PipeWire. And the first Profiles
			have moved from drafts to approved documents — Piano, Drum Note Mapping, and Note-On
			Orchestral Articulation — so a compatible controller and a compatible piano instrument can now
			agree on high-resolution velocity and per-note expression without a mapping session.
		</p>
		<p class="prose-body">
			On the hardware side the list is short but it is no longer theoretical. Roland's A-88MK2 took
			UMP and Property Exchange in a firmware update; Native Instruments' Kontrol S-series MK3 and
			Studiologic's SL mk2 speak UMP over USB; CME's WIDI adapters carry it over Bluetooth; and
			Yamaha's Montage M and MODX and Waldorf's Quantum and Iridium handle high-resolution MIDI 2.0
			messages. If you own one of those, the resolution and per-note expression are already there
			waiting for a host that asks for them.
		</p>
		<p class="prose-body">
			What has not: the instruments in most studios still speak MIDI 1.0, and no browser exposes
			MIDI 2.0 through the Web MIDI API. Which means the packets on this page are UMP that this app
			encoded itself, not UMP off a cable — the encoding is real and matches the specification, but
			nothing here has ever seen a MIDI 2.0 device.
		</p>
		<p class="prose-body">
			The right posture is: understand the shape of it, recognise the terminology, and keep building
			on MIDI 1.0 with an architecture that will not need tearing up when 2.0 arrives properly.
			Which is what the rest of this course does.
		</p>
	</Section>

	<Quiz
		question="What is the most fundamental difference between MIDI 1.0 and MIDI 2.0?"
		options={[
			'Higher resolution values',
			'It is bidirectional — devices can query each other and negotiate',
			'It uses USB instead of DIN cables',
			'More channels'
		]}
		answer={1}
		explanation="Resolution, groups and per-note controllers are all real improvements, but they are refinements of a broadcast protocol. Bidirectionality is the change in kind: for the first time a sender can find out what is at the other end, which is what makes Profiles and Property Exchange possible at all."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="ump"
			label="Read a UMP word and identify its message type and group"
			hint="The first two hex digits. Try changing the group knob."
		/>
		<Checkpoint
			lesson={meta.id}
			id="resolution"
			label="Compare a 7-bit velocity with its 16-bit MIDI 2.0 equivalent"
			hint="Watch the second word change as you turn the velocity knob."
		/>
		<Checkpoint
			lesson={meta.id}
			id="decide"
			label="Decide whether MIDI 2.0 matters for your current rig"
			hint="For almost everyone in 2026 the honest answer is 'not yet, and that is fine'."
		/>
	</Checkpoints>
</LessonShell>
