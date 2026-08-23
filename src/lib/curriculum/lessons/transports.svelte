<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import CableFigure from '$lib/components/midi/CableFigure.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { midiAccess } from '$lib/midi/access.svelte';

	const meta = lessonById('transports')!;
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			Everything so far has been about the messages. This act is about the wire — and the wire is
			where most real-world MIDI problems actually live. The protocol is the same over every
			transport; what changes is the speed, the number of addresses available, and the ways it can
			fail.
		</p>
	</Section>

	<Section title="Five-pin DIN">
		<p class="text-[15px] leading-relaxed">
			The original, from 1983, and still on the back of most hardware. 31,250 bits per second, one
			direction per cable, and an electrical design that has aged remarkably well.
		</p>
		<CableFigure kind="din" />
		<Callout variant="note" title="One cable, one direction, one port">
			<p>
				A DIN cable carries data one way only. Two-way communication needs two cables. And a single
				DIN port carries exactly sixteen channels — if you need more addresses, you need more
				<em>ports</em>, which is why multi-port interfaces exist.
			</p>
		</Callout>
	</Section>

	<Section title="TRS: the failure that looks like nothing">
		<p class="text-[15px] leading-relaxed">
			Modern compact gear replaced the bulky DIN socket with a 3.5 mm jack. Unfortunately two
			incompatible wirings became common before the MIDI Association standardised one of them.
		</p>
		<CableFigure kind="trs" />
		<Callout variant="gotcha" title="It does not half-work. It does nothing.">
			<p>
				Plug Type A gear into a Type B adapter and there is no error, no light, no partial function
				— simply silence. This is the single most common "my MIDI is broken" cause on modern
				equipment, and it costs people hours because silence looks like every other problem.
			</p>
			<p class="mt-2">
				It is not dangerous: the current loop simply does not complete. But before you debug
				anything else on a TRS connection, confirm the type at both ends. Some adapters and cables
				are switchable, which is worth paying for.
			</p>
		</Callout>
		<p class="text-[15px] leading-relaxed">
			Type A is now the standard, and Korg and Teenage Engineering both use it — so an OP-XY driving
			a Korg needs one straight Type A adapter at each end and nothing else.
		</p>
	</Section>

	<Section title="USB: who is the host?">
		<p class="text-[15px] leading-relaxed">
			USB MIDI is much faster than DIN and carries multiple virtual ports down one cable. It
			introduces one concept that DIN never had, and it trips people constantly: exactly one end of
			a USB connection must be the <strong>host</strong>, and the other must be the
			<strong>device</strong>.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-xl border p-4">
				<p class="text-[11px] font-semibold tracking-wide uppercase">Host</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					Supplies power, enumerates what is attached, and manages the connection. Computers are
					always hosts. Some hardware — grooveboxes, samplers, some keyboards — can also be one,
					usually through a full-size USB-A socket or a switchable USB-C port.
				</p>
			</div>
			<div class="rounded-xl border p-4">
				<p class="text-[11px] font-semibold tracking-wide uppercase">Device</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					Announces itself and waits. Most controllers are device-only, which is why plugging a
					controller directly into a synth usually does nothing unless that synth is a host.
				</p>
			</div>
		</div>
		<Callout variant="gotcha" title="Two hosts cannot talk to each other">
			<p>
				A computer and a groovebox that are both hosts will not communicate over a plain USB cable,
				no matter which way round you plug it. One of them must be switched to device mode, or you
				need a DIN or TRS connection between them instead. When a USB-C link between two capable
				boxes does nothing, this is almost always why.
			</p>
		</Callout>
		<p class="text-[15px] leading-relaxed">
			<strong>Class-compliant</strong> is the other word worth knowing: it means the device works with
			the operating system's built-in driver and needs nothing installed. Almost all modern MIDI hardware
			is class-compliant, which is also why it works with a browser.
		</p>
	</Section>

	<Section title="Bluetooth LE MIDI and network MIDI">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-xl border p-4">
				<p class="text-[11px] font-semibold tracking-wide uppercase">Bluetooth LE MIDI</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					No cable, and genuinely convenient for sketching. The trade-off is latency and jitter that
					vary with radio conditions — fine for playing notes, less good as a clock source, and
					worth measuring rather than assuming. Pairing is at the operating-system level, after
					which the port appears like any other.
				</p>
			</div>
			<div class="rounded-xl border p-4">
				<p class="text-[11px] font-semibold tracking-wide uppercase">Network / RTP-MIDI</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					MIDI over IP, built into macOS and iOS and available on Windows and Linux through
					third-party software. Excellent between computers on a wired network; dependent on the
					network's own behaviour, which is not something MIDI can compensate for.
				</p>
			</div>
		</div>
	</Section>

	<Section title="What the browser can see">
		<p class="text-[15px] leading-relaxed">
			Web MIDI does not care which transport a port uses. A DIN interface, a USB keyboard, a
			Bluetooth device and a virtual loopback port all appear in the same list, with the same API.
			If the operating system can see it, the browser can — with your permission.
		</p>
		<DevicePanel />
		<p class="text-sm leading-relaxed text-muted-foreground">
			Port names come from the operating system, and they are often more informative than they look:
			multi-port interfaces name their ports individually, and virtual ports announce themselves as
			such.
		</p>
	</Section>

	<Quiz
		question="You connect your OP-XY to a Korg with a TRS-to-DIN adapter and nothing happens. What do you check first?"
		options={[
			'That both devices are on the same MIDI channel',
			'That the adapter is Type A, matching both devices',
			'That the Korg supports MIDI',
			'That the cable is not too long'
		]}
		answer={1}
		explanation="Both those manufacturers use Type A, so a Type B adapter produces exactly this symptom: complete silence with no other clue. Channel mismatch is the other classic cause, but it is worth eliminating the physical layer first because it fails so completely and so invisibly."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="pins"
			label="Say which two DIN pins carry the signal, and what pin 2 does"
			hint="4 and 5 form the current loop; 2 is the shield."
		/>
		<Checkpoint
			lesson={meta.id}
			id="trs"
			label="Identify the TRS type your own gear uses"
			hint="Check the manual, or the MIDI Association's Type A standard."
		/>
		<Checkpoint
			lesson={meta.id}
			id="ports"
			label="Connect and list your actual MIDI ports"
			test={() => midiAccess.status === 'granted'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="host"
			label="Work out which of your devices can act as a USB host"
			hint="Usually the ones with a full-size USB-A socket, or a menu setting on a USB-C port."
		/>
	</Checkpoints>
</LessonShell>
