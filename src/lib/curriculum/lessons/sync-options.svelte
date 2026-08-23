<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { load, save } from '$lib/stores/persist';

	const meta = lessonById('sync-options')!;

	let policy = $state<string>(
		load(
			'clock-policy',
			`OP-XY jam            → OP-XY is clock leader
MPC production       → MPC is clock leader
Ableton / Push       → Live is clock leader
Browser experiment   → this machine is leader

Everything else set to EXTERNAL sync.
Local Control OFF on anything being sequenced.`
		)
	);
	$effect(() => save('clock-policy', policy));

	const MTC_PARTS = [
		'frame count, low nibble',
		'frame count, high nibble',
		'seconds, low nibble',
		'seconds, high nibble',
		'minutes, low nibble',
		'minutes, high nibble',
		'hours, low nibble',
		'hours high nibble + rate'
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			MIDI Clock answers "what tempo are we at?" It does not answer "what time is it?" — and for
			anything involving tape, video or a fixed timeline, that second question is the one that
			matters. There are three common answers to synchronisation, and they solve different problems.
		</p>
	</Section>

	<div class="grid gap-4 lg:grid-cols-3">
		<div class="flex flex-col gap-2 rounded-lg border border-msg-clock/40 p-4">
			<p class="text-xs font-semibold tracking-wide text-msg-clock uppercase">MIDI Clock</p>
			<p class="text-sm leading-relaxed">
				Musical time. Tempo-relative, 24 ticks per quarter note, no absolute position except via
				Song Position Pointer.
			</p>
			<p class="mt-auto pt-2 text-xs leading-relaxed text-muted-foreground">
				<strong>Use for:</strong> drum machines, arpeggiators, synced delays, grooveboxes — anything that
				thinks in bars and beats.
			</p>
		</div>
		<div class="flex flex-col gap-2 rounded-lg border p-4">
			<p class="text-sm font-semibold">MIDI Time Code</p>
			<p class="text-sm leading-relaxed">
				Wall-clock time. Hours, minutes, seconds, frames — SMPTE timecode carried over MIDI.
				Completely independent of tempo.
			</p>
			<p class="mt-auto pt-2 text-xs leading-relaxed text-muted-foreground">
				<strong>Use for:</strong> video, film, tape machines, anything where a cue happens at 00:04:12:07
				regardless of what the tempo is doing.
			</p>
		</div>
		<div class="flex flex-col gap-2 rounded-lg border p-4">
			<p class="text-sm font-semibold">Ableton Link</p>
			<p class="text-sm leading-relaxed">
				Peer-to-peer tempo and phase over a local network. No leader: any participant can change the
				tempo and everyone follows, staying phase-aligned.
			</p>
			<p class="mt-auto pt-2 text-xs leading-relaxed text-muted-foreground">
				<strong>Use for:</strong> jamming between laptops, phones and Link-capable hardware, where nominating
				a permanent leader is the wrong shape.
			</p>
		</div>
	</div>

	<Section title="What MIDI Time Code actually looks like">
		<p class="prose-body">
			MTC is delivered in a peculiar way. A full timecode position is eight
			<strong>quarter-frame</strong> messages, each carrying one nibble, sent in sequence — so it takes
			two frames to spell out one position, and the receiver is always slightly behind and interpolating.
		</p>
		<ByteInspector bytes={[0xf1, 0x24]} />
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<thead class="label bg-muted/50">
					<tr>
						<th class="w-16 px-3 py-2 text-left font-medium">Piece</th>
						<th class="px-3 py-2 text-left font-medium">Carries</th>
					</tr>
				</thead>
				<tbody>
					{#each MTC_PARTS as part, i (part)}
						<tr class="border-t">
							<td class="px-3 py-2 font-mono text-msg-clock">{i}</td>
							<td class="px-3 py-2 text-xs text-muted-foreground">{part}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Eight messages, four bits of payload each: 32 bits to say what time it is. There is also a
			Full Time Code message, sent as SysEx, used for locating while stopped — quarter frames only
			flow while running.
		</p>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={() => engine.sendBytes([0xf1, 0x00])}>
				Send a quarter frame
			</Button>
			<span class="self-center text-xs text-muted-foreground">
				Watch it in the monitor — the clock-family colour, but not a clock tick.
			</span>
		</div>
	</Section>

	<Callout variant="gotcha" title="Clock and MTC do different jobs, and you may need both">
		<p>
			They are not alternatives so much as different axes. A film composer's rig often runs MTC from
			the video machine to lock absolute position, while MIDI Clock keeps the musical devices in
			tempo. Sending both is normal; expecting one to do the other's job is not.
		</p>
	</Callout>

	<Section title="Choosing a leader, deliberately">
		<p class="prose-body">
			There is no election in MIDI. Whoever is sending clock is the leader, and if two devices are
			sending it you have two leaders and no followers. The failure mode is subtle: everything
			starts, everything is roughly in time, and the groove is just slightly wrong in a way nobody
			can point at.
		</p>
		<p class="prose-body">
			The fix is a written policy. Not a metaphorical one — an actual note you keep, so that when a
			session feels off you can check reality against intention in thirty seconds.
		</p>

		<TryThis title="Write yours">
			<p class="text-sm leading-relaxed">
				Edit this to match your own rig. It is saved in this browser and will still be here next
				time.
			</p>
			<Textarea bind:value={policy} rows={8} class="font-mono text-xs" spellcheck={false} />
			<p class="text-xs leading-relaxed text-muted-foreground">
				Three things worth stating explicitly for every session: who sends clock, who follows, and
				which devices have Local Control off. Almost every "MIDI is being weird" problem is one of
				those three being different from what you assumed.
			</p>
		</TryThis>
	</Section>

	<Section title="When to change the leader">
		<p class="prose-body">
			Some devices follow external clock less well than they lead. If the rig feels unstable, the
			most effective single change is usually to <em>invert the relationship</em> — make the wobbly device
			the leader and let the steadier ones follow. This is not a workaround so much as an acknowledgement
			that clock-following quality varies enormously between devices and is rarely documented.
		</p>
		<p class="prose-body">
			The jitter plot in the previous lesson is how you find out which device is which, rather than
			arguing about it. Connect each candidate leader in turn, watch the spread, and pick the
			narrowest.
		</p>
	</Section>

	<Quiz
		question="You are scoring a video. A cue must land exactly at 2 minutes 14 seconds regardless of tempo. What syncs the two machines?"
		options={['MIDI Clock', 'MIDI Time Code', 'Song Position Pointer', 'Ableton Link']}
		answer={1}
		explanation="MIDI Clock and Song Position Pointer both measure musical time — beats and sixteenths — which moves when the tempo does. MTC carries hours, minutes, seconds and frames, which do not. Link syncs tempo and phase between peers but is also musical, not absolute."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="mtc"
			label="Send an MTC quarter frame and find it in the monitor"
			test={(e) => e.message.type === 'mtcQuarterFrame'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="policy"
			label="Write a clock policy for your own rig"
			hint="Edit the box above. Tick this once it describes your actual gear."
		/>
		<Checkpoint
			lesson={meta.id}
			id="explain"
			label="Explain to yourself why Link is not simply better than MIDI Clock"
			hint="It needs a network, it does not carry position, and most hardware does not speak it."
		/>
	</Checkpoints>
</LessonShell>
