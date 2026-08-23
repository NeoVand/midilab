<script lang="ts">
	/**
	 * A diagnostic tree, ordered by cost.
	 *
	 * The point is the ordering: check the things that are free and commonly
	 * wrong before the things that are expensive and rarely wrong. Most MIDI
	 * problems are settled in the first three questions, and almost nobody starts
	 * there — they start by swapping cables.
	 */
	import { onMount } from 'svelte';
	import { bus } from '$lib/midi/bus';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Tick02Icon,
		Cancel01Icon,
		Refresh01Icon,
		ActivityCircleIcon
	} from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Node {
		question: string;
		why?: string;
		yes: string;
		no: string;
	}
	interface Leaf {
		diagnosis: string;
		fix: string;
		tone?: 'ok' | 'warn';
	}
	type Step = Node | Leaf;

	const TREE: Record<string, Step> = {
		start: {
			question: 'Does the receiving device show ANY sign of incoming MIDI?',
			why: 'Most instruments have a MIDI activity indicator, or a monitor page. This one question splits the problem in half: is it a delivery problem or an interpretation problem?',
			yes: 'arrives',
			no: 'nothing'
		},

		// ── nothing arriving ───────────────────────────────────────────────
		nothing: {
			question: 'Is the cable in MIDI OUT at the sender and MIDI IN at the receiver?',
			why: 'Out-to-Out does nothing. So does In-to-In. And a cable in the sender’s Thru carries only what the sender received, not what it is playing.',
			yes: 'trs',
			no: 'wrong-sockets'
		},
		'wrong-sockets': {
			diagnosis: 'The cable is in the wrong sockets.',
			fix: 'Sender’s OUT → receiver’s IN. If you want to pass a signal along a chain, that is the sender’s THRU, not its OUT.'
		},
		trs: {
			question: 'Is this a 3.5 mm TRS connection?',
			why: 'TRS Type A and Type B are incompatible and fail completely silently. This is the most common physical-layer failure on modern gear.',
			yes: 'trs-type',
			no: 'usb-host'
		},
		'trs-type': {
			question: 'Have you confirmed BOTH ends are the same TRS type — usually Type A?',
			why: 'Confirmed means checked in the manuals, not assumed from the fact that the plug fits. Every 3.5 mm plug fits every 3.5 mm socket.',
			yes: 'usb-host',
			no: 'trs-mismatch'
		},
		'trs-mismatch': {
			diagnosis: 'Probable TRS Type A/B mismatch.',
			fix: 'Check both manuals. Korg, Teenage Engineering and the MIDI Association standard use Type A; Arturia, Novation and older 1010music use Type B. A switchable adapter solves it permanently.'
		},
		'usb-host': {
			question: 'Is this a USB connection between two devices that can both be hosts?',
			why: 'Exactly one end of a USB link must be the host. Two hosts will not talk no matter which way the cable goes.',
			yes: 'two-hosts',
			no: 'port-open'
		},
		'two-hosts': {
			diagnosis: 'Two USB hosts cannot communicate directly.',
			fix: 'Put one into device mode if it offers that, or connect them with DIN or TRS instead.'
		},
		'port-open': {
			question: 'On the computer side, is the correct port actually open and enabled?',
			why: 'Software will happily sit there with no port selected. In this app, that is the Devices tab in the dock.',
			yes: 'cable',
			no: 'port-closed'
		},
		'port-closed': {
			diagnosis: 'The port is not open.',
			fix: 'Enable the input in your software. If the port is not even listed, unplug and replug the device and rescan — hot-plug detection is not always instant.'
		},
		cable: {
			diagnosis: 'Now suspect the cable — and only now.',
			fix: 'Swap it for a known-good one. MIDI cables fail rarely, which is exactly why they should be near the end of the list rather than the start.',
			tone: 'warn'
		},

		// ── something arriving ─────────────────────────────────────────────
		arrives: {
			question: 'Do the sender’s transmit channel and the receiver’s receive channel match?',
			why: 'The single most common cause of "MIDI arrives but nothing happens". The monitor tells you what channel is actually being used, which is often not what you set.',
			yes: 'local',
			no: 'channel'
		},
		channel: {
			diagnosis: 'Channel mismatch.',
			fix: 'Set them to match. Do not fix this by switching the receiver to Omni — that works today and breaks the moment you add a second instrument.'
		},
		local: {
			question: 'Is the receiver making no sound at all, even from its own keys?',
			why: 'A synth that is silent from its own keyboard is not a MIDI problem.',
			yes: 'local-off',
			no: 'volume'
		},
		'local-off': {
			diagnosis: 'Local Control is probably off.',
			fix: 'Turn it back on in the device’s global menu, or send CC 122 = 127. Local Control off survives a power cycle, which is why this catches people weeks later.'
		},
		volume: {
			question: 'Have you checked the receiver’s channel volume and expression?',
			why: 'CC 7 or CC 11 left at zero by an earlier session looks exactly like a dead channel.',
			yes: 'program',
			no: 'reset-controllers'
		},
		'reset-controllers': {
			diagnosis: 'A controller may be stuck from an earlier session.',
			fix: 'Send Reset All Controllers (CC 121), and check CC 7 and CC 11 on the receiving channel. A stuck pitch bend or mod wheel produces the same kind of mystery.'
		},
		program: {
			question:
				'Is the right sound loaded — did a Program or Bank Change land somewhere unexpected?',
			why: 'A stray Program Change can select a silent or extremely quiet preset. Bank Select without a following Program Change leaves a pending value that fires later.',
			yes: 'timing',
			no: 'program-fix'
		},
		'program-fix': {
			diagnosis: 'Wrong program or bank.',
			fix: 'Send a known-good Program Change. Remember the off-by-one: program 5 on a front panel is very often byte value 4.'
		},
		timing: {
			question:
				'Is the problem timing rather than absence — doubled notes, stuck notes, or a stumbling groove?',
			yes: 'loop-or-jitter',
			no: 'implementation'
		},
		'loop-or-jitter': {
			diagnosis: 'Suspect a MIDI loop first, then clock.',
			fix: 'Play one note and count the rows in the monitor. One note should be one Note On. If it is more, something is echoing — Thru left on, MIDI echo in software, or Local Control. If the count is right, look at the clock: two devices sending clock, or a follower that follows badly.'
		},
		implementation: {
			diagnosis: 'It is probably doing exactly what it was told.',
			fix: 'Open the device’s MIDI implementation chart and check that it actually receives the message you are sending, on that channel, in that mode. Many "faults" are a device correctly ignoring something it never claimed to support.',
			tone: 'ok'
		}
	};

	let path = $state<string[]>(['start']);
	const current = $derived(TREE[path[path.length - 1]]);
	const isLeaf = $derived('diagnosis' in current);

	function answer(next: string) {
		path = [...path, next];
	}
	function back() {
		if (path.length > 1) path = path.slice(0, -1);
	}
	function restart() {
		path = ['start'];
	}

	// A live probe: is anything arriving at all, right now?
	let lastIncoming = $state(0);
	let now = $state(performance.now());
	onMount(() => {
		const off = bus.subscribe((e) => {
			if (e.direction === 'in') lastIncoming = e.time;
		});
		const timer = setInterval(() => (now = performance.now()), 250);
		return () => {
			off();
			clearInterval(timer);
		};
	});
	const receiving = $derived(lastIncoming > 0 && now - lastIncoming < 2000);
</script>

<div class="flex flex-col gap-4">
	<div
		class={cn(
			'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
			receiving ? 'border-ok/40 bg-ok/8' : 'text-muted-foreground'
		)}
	>
		<HugeiconsIcon
			icon={ActivityCircleIcon}
			size={16}
			class={receiving ? 'text-ok' : 'text-muted-foreground'}
		/>
		{#if midiAccess.status !== 'granted'}
			<span>No MIDI access yet — connect in the dock to use this as a live probe.</span>
		{:else if midiAccess.listening.length === 0}
			<span>No inputs are open. Enable one in the dock, then play something.</span>
		{:else if receiving}
			<span class="text-ok">Messages are arriving right now.</span>
		{:else}
			<span
				>Listening on {midiAccess.listening.length} input(s) — nothing has arrived recently.</span
			>
		{/if}
	</div>

	<div class="rounded-lg border p-5">
		{#if isLeaf}
			{@const leaf = current as Leaf}
			<p
				class={cn(
					'text-lg font-medium',
					leaf.tone === 'ok' ? 'text-ok' : leaf.tone === 'warn' ? 'text-warn' : 'text-msg-note'
				)}
			>
				{leaf.diagnosis}
			</p>
			<p class="prose-body mt-2">{leaf.fix}</p>
			<div class="mt-4 flex gap-2">
				<Button variant="outline" size="sm" onclick={back}>Back one step</Button>
				<Button variant="ghost" size="sm" class="gap-1.5" onclick={restart}>
					<HugeiconsIcon icon={Refresh01Icon} size={13} /> Start again
				</Button>
			</div>
		{:else}
			{@const node = current as Node}
			<p class="prose-body font-medium">{node.question}</p>
			{#if node.why}
				<p class="mt-2 text-sm leading-relaxed text-muted-foreground">{node.why}</p>
			{/if}
			<div class="mt-4 flex flex-wrap gap-2">
				<Button size="sm" class="gap-1.5" onclick={() => answer(node.yes)}>
					<HugeiconsIcon icon={Tick02Icon} size={13} /> Yes
				</Button>
				<Button variant="outline" size="sm" class="gap-1.5" onclick={() => answer(node.no)}>
					<HugeiconsIcon icon={Cancel01Icon} size={13} /> No
				</Button>
				{#if path.length > 1}
					<Button variant="ghost" size="sm" onclick={back}>Back</Button>
				{/if}
			</div>
		{/if}
	</div>

	{#if path.length > 1}
		<p class="text-xs text-muted-foreground">
			Step {path.length} · you have eliminated {path.length - 1}
			{path.length === 2 ? 'possibility' : 'possibilities'}.
		</p>
	{/if}
</div>
