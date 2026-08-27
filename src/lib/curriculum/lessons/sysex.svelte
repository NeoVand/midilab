<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import SysExLab from '$lib/components/midi/SysExLab.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { knownManufacturers, rolandChecksum } from '$lib/midi/sysex';
	import { midiAccess } from '$lib/midi/access.svelte';

	const meta = lessonById('sysex')!;
	const makers = knownManufacturers().slice(0, 18);
	const sample = [0x41, 0x10, 0x42, 0x12, 0x40, 0x00, 0x7f, 0x00];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Every message so far has been tiny, fixed in length, and understood by everything. System
			Exclusive is the deliberate exception: an arbitrarily long block of bytes addressed to one
			manufacturer, meaning whatever that manufacturer decided it means.
		</p>
		<div
			class="flex flex-wrap items-center gap-2 rounded-lg border bg-surface-sunken p-4 font-mono text-sm"
		>
			<span class="text-msg-sysex">F0</span>
			<span class="text-xs text-muted-foreground">start</span>
			<span class="text-muted-foreground">·</span>
			<span class="text-msg-sysex">41</span>
			<span class="text-xs text-muted-foreground">manufacturer (Roland)</span>
			<span class="text-muted-foreground">·</span>
			<span>10 42 12 40 00 7F 00</span>
			<span class="text-xs text-muted-foreground">whatever Roland says</span>
			<span class="text-muted-foreground">·</span>
			<span class="text-msg-sysex">F7</span>
			<span class="text-xs text-muted-foreground">end</span>
		</div>
		<p class="prose-body">
			Only <code class="rounded-sm bg-muted px-1 font-mono">F0</code>, the manufacturer identifier
			and
			<code class="rounded-sm bg-muted px-1 font-mono">F7</code> are standardised. Everything between
			is private. A Korg receiving a Roland SysEx will read the first byte, see that it is not addressed
			to Korg, and discard the whole thing — which is exactly how a shared cable stays sane.
		</p>
	</Section>

	<Callout variant="key" title="One rule inside the envelope">
		<p>
			Every byte between F0 and F7 must be a <strong>data byte</strong>, 0x00–0x7F. Nothing with the
			top bit set may appear inside, because that would look like the start of a new message and
			terminate the SysEx early. This is why transferring 8-bit data — a sample, a firmware image —
			requires an encoding scheme that packs eight bits into seven-bit bytes, and why patch dumps
			are always larger than the data they contain.
		</p>
	</Callout>

	<Section title="Who gets which number">
		<p class="prose-body">
			Manufacturer IDs are assigned by the MIDI Association. The early ones are a single byte;
			latecomers get three, beginning with <code class="rounded-sm bg-muted px-1 font-mono">00</code
			>. The single-byte numbers are a fossil record of the 1980s synthesiser industry.
		</p>
		<div class="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border p-4 text-sm sm:grid-cols-3">
			{#each makers as m (m.id)}
				<div class="flex items-baseline gap-2">
					<code class="w-16 shrink-0 font-mono text-xs text-msg-sysex">{m.id}</code>
					<span class="truncate">{m.name}</span>
				</div>
			{/each}
		</div>
		<p class="text-sm text-muted-foreground">
			Two IDs are special: <code class="rounded-sm bg-muted px-1 font-mono">7E</code> is Universal
			Non-Real Time and <code class="rounded-sm bg-muted px-1 font-mono">7F</code> is Universal Real Time.
			These are not owned by anyone — they carry messages every compliant device should understand.
		</p>
	</Section>

	<Section title="Checksums">
		<p class="prose-body">
			Many manufacturers append a checksum so a corrupted patch dump is rejected rather than loaded.
			The common Roland-style scheme is simple: sum the addressed bytes, take it modulo 128, and
			send whatever value makes the total come out to zero.
		</p>
		<div class="flex flex-col gap-2 rounded-lg border bg-surface-sunken p-4 font-mono text-xs">
			<div>
				bytes &nbsp;= {sample
					.slice(4)
					.map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
					.join(' ')}
			</div>
			<div>sum &nbsp;&nbsp;&nbsp;= {sample.slice(4).reduce((a, b) => a + b, 0)}</div>
			<div>
				checksum = (128 − sum mod 128) mod 128 =
				<span class="text-msg-sysex">
					{rolandChecksum(sample.slice(4)).toString(16).toUpperCase().padStart(2, '0')}
				</span>
			</div>
		</div>
		<p class="text-sm text-muted-foreground">
			Yamaha uses the same arithmetic over a different span of bytes. Others use none at all. The
			implementation chart says which.
		</p>
	</Section>

	<Section title="Why your browser asks twice">
		<p class="prose-body">
			SysEx is how firmware updates are delivered to a great many instruments. A web page with
			unrestricted SysEx access could, in principle, write bad firmware to a synthesiser and brick
			it. So the <Xref to="web-midi" label="Web MIDI" /> API treats it as a second, separate capability:
			you request
			<code class="rounded-sm bg-muted px-1 font-mono">{'{ sysex: true }'}</code> and the browser asks
			the user again.
		</p>
		<Callout variant="danger" title="Treat it with the respect it deserves">
			<p>
				Do not send SysEx you do not understand to hardware you care about. In particular, do not
				paste blocks of hex from forums into a real instrument to see what happens. Identity
				requests and the universal messages below are safe; manufacturer messages are only as safe
				as your understanding of them.
			</p>
			<p class="mt-2">
				This app keeps SysEx off until you ask for it, refuses to transmit malformed messages, and
				never sends anything without a click.
			</p>
		</Callout>
	</Section>

	<TryThis title="Ask a device what it is">
		<p class="text-sm leading-relaxed">
			<code class="rounded-sm bg-muted px-1 font-mono">F0 7E 7F 06 01 F7</code> is the Universal Identity
			Request — "everyone on this cable, please say who you are". It is the one SysEx message you can
			send to anything without knowing anything about it.
		</p>
		<SysExLab />
	</TryThis>

	<Section title="What SysEx is actually good for">
		<div class="grid gap-3 sm:grid-cols-2">
			{#each [['Patch dumps', 'Save and restore an entire sound, or a whole bank, as a file. Often the only way to back up a hardware synth.'], ['Deep editing', 'Parameters the manufacturer never exposed as CC or NRPN. Every hardware editor app works this way.'], ['Global settings', 'MIDI channel assignments, tuning tables, pad sensitivity — things no channel message can reach.'], ['Firmware', 'The reason for the permission prompt.']] as [title, body] (title)}
				<div class="rounded-lg border p-4">
					<p class="text-sm font-semibold">{title}</p>
					<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
				</div>
			{/each}
		</div>
		<p class="prose-body">
			And one thing it is <em>not</em> good for: real-time performance. A long SysEx message monopolises
			a 31,250-baud cable for as long as it takes to send — a 4 KB patch dump is over a second of solid
			traffic, during which your notes are queued behind it. Send patch data between songs, never during
			one.
		</p>
	</Section>

	<Quiz
		question="Why can a sample or firmware image not simply be placed inside a SysEx message as-is?"
		options={[
			'SysEx messages are limited to 256 bytes',
			'Any byte with its top bit set would look like a new status byte and end the message',
			'SysEx only supports text',
			'Because of the checksum'
		]}
		answer={1}
		explanation="Everything between F0 and F7 must be 0x00–0x7F. Arbitrary binary data contains bytes above 0x7F, so it has to be re-packed — commonly seven 8-bit bytes into eight 7-bit ones. This is why a 1 MB firmware file becomes roughly 1.15 MB of SysEx."
	/>

	<Further
		refs={['spec-universal-sysex', 'somascape-spec', 'w3c-webmidi']}
		lead="The manufacturer-neutral SysEx blocks, and the browser specification that explains why this one capability is gated separately."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="build"
			label="Send a well-formed SysEx message"
			test={(e) => e.message.type === 'sysex'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="identity"
			label="Send a Universal Identity Request"
			hint="F0 7E 7F 06 01 F7 — the preset button loads it."
			test={(e) =>
				e.message.type === 'sysex' &&
				e.message.data[0] === 0x7e &&
				e.message.data[2] === 0x06 &&
				e.message.data[3] === 0x01}
		/>
		<Checkpoint
			lesson={meta.id}
			id="universal"
			label="Send a universal message that is not the identity request"
			hint="GM System On, or the master volume message."
			test={(e) =>
				e.message.type === 'sysex' &&
				(e.message.data[0] === 0x7e || e.message.data[0] === 0x7f) &&
				e.message.data[2] !== 0x06}
		/>
		<Checkpoint
			lesson={meta.id}
			id="permission"
			label="Understand the permission model — enable SysEx, or read why you would not"
			hint="Either enable it in the panel, or tick this by hand if you would rather not."
			test={() => midiAccess.sysexEnabled}
		/>
	</Checkpoints>
</LessonShell>
