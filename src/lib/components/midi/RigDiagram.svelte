<script lang="ts">
	/**
	 * Your rig, drawn.
	 *
	 * The app already knows every port by name, manufacturer, transport and
	 * connection state, and knows the instant traffic runs down each one — and
	 * rendered all of that as two lists of switches. This draws it instead:
	 * each physical device once, with the sockets it actually has, cabled to
	 * this machine, and the cable lights when something goes down it.
	 *
	 * Grouping by device rather than by direction is the point. A list of
	 * inputs and a list of outputs shows "OP-XY" twice and never says they are
	 * the same box on your desk with two sockets on the back — which is the
	 * single idea Act IV spends five lessons on.
	 */
	import { onMount } from 'svelte';
	import { bus } from '$lib/midi/bus';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { engine, INTERNAL_OUTPUT_ID } from '$lib/midi/engine.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	interface Device {
		key: string;
		name: string;
		maker: string;
		/** Only when the port name actually says so — Web MIDI never reports it. */
		transport: string;
		/** Its OUT socket → our IN. Null when the device has no output. */
		outPortId: string | null;
		/** Our OUT → its IN socket. Null when the device has no input. */
		inPortId: string | null;
		present: boolean;
	}

	/**
	 * Web MIDI tells you a port's name and manufacturer and nothing about how it
	 * is attached. Where the name says, we say; where it does not, we say
	 * nothing rather than guess — a diagram captioned DIN under a USB keyboard
	 * is worse than one with no caption.
	 */
	function transportOf(name: string): string {
		const n = name.toLowerCase();
		if (n.includes('bluetooth') || n.includes('ble') || n.includes('widi')) return 'BLUETOOTH';
		if (n.includes('network') || n.includes('rtp')) return 'NETWORK';
		if (n.includes('usb')) return 'USB';
		if (n.includes('iac') || n.includes('virtual') || n.includes('loop')) return 'VIRTUAL';
		return '';
	}

	/** One entry per physical box, not one per direction. */
	const devices = $derived.by((): Device[] => {
		const byName = new Map<string, Device>();
		const take = (name: string, maker: string) => {
			let d = byName.get(name);
			if (!d) {
				d = {
					key: name,
					name,
					maker,
					transport: transportOf(name),
					outPortId: null,
					inPortId: null,
					present: true
				};
				byName.set(name, d);
			}
			if (!d.maker && maker) d.maker = maker;
			return d;
		};
		for (const p of midiAccess.inputs) {
			const d = take(p.name, p.manufacturer);
			d.outPortId = p.id; // their OUT is our IN
			if (p.state !== 'connected') d.present = false;
		}
		for (const o of engine.outputs) {
			if (o.kind === 'internal') continue;
			const d = take(o.name, o.subtitle);
			d.inPortId = o.id; // our OUT is their IN
			if (!o.connected) d.present = false;
		}
		return [...byName.values()];
	});

	const internalOn = $derived(engine.activeOutputs.includes(INTERNAL_OUTPUT_ID));

	/*
	 * Traffic, as a decaying glow per port. A rAF-driven clock rather than a
	 * per-message timer: one loop for the whole diagram, and it stops when the
	 * component goes away.
	 */
	let lit = $state<Record<string, number>>({});
	let now = $state(0);

	onMount(() => {
		const off = bus.subscribe((e) => {
			if (e.portId) lit[e.portId] = e.time;
		});
		let frame = 0;
		const step = () => {
			now = performance.now();
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => {
			off();
			cancelAnimationFrame(frame);
		};
	});

	/** 1 at the moment a message lands, 0 by 500 ms later. */
	function glow(portId: string | null): number {
		if (!portId) return 0;
		const t = lit[portId];
		if (!t) return 0;
		return Math.max(0, 1 - (now - t) / 500);
	}

	// ── geometry ────────────────────────────────────────────────────────
	const ROW = 54;
	const GAP = 9;
	const PAD = 10;
	const DEV_W = 214;
	const DEV_X = 6;
	const APP_X = 402;
	const APP_W = 212;
	const VIEW_W = 620;

	const stackH = $derived(
		Math.max(1, devices.length) * ROW + Math.max(0, devices.length - 1) * GAP
	);
	const appH = 92;
	const viewH = $derived(Math.max(stackH, appH) + PAD * 2);
	const appY = $derived(PAD + (Math.max(stackH, appH) - appH) / 2);

	const rowY = (i: number) => PAD + i * (ROW + GAP);
	/** Their OUT socket, upper; their IN socket, lower. */
	const outSocketY = (i: number) => rowY(i) + 22;
	const inSocketY = (i: number) => rowY(i) + 40;
	const appInY = $derived(appY + 24);
	const appOutY = $derived(appY + 39);

	function cable(x1: number, y1: number, x2: number, y2: number): string {
		const dx = Math.max(40, (x2 - x1) * 0.55);
		return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
	}

	function clip(s: string, n = 22): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}
</script>

<div class={cn('w-full', className)}>
	{#if devices.length === 0}
		<p class="px-1 py-6 text-center text-xs text-muted-foreground">
			{midiAccess.status === 'granted'
				? 'No hardware found. Plug something in — this draws itself.'
				: 'Connect MIDI and your instruments are drawn here, with the cables between them.'}
		</p>
	{:else}
		<svg
			viewBox="0 0 {VIEW_W} {viewH}"
			class="mx-auto block w-full max-w-[640px]"
			role="img"
			aria-label="Your MIDI rig: {devices.map((d) => d.name).join(', ')} connected to MIDI Lab"
		>
			<!-- cables first, so the panels sit on top of where they land -->
			{#each devices as d, i (d.key)}
				{#if d.outPortId}
					{@const open = midiAccess.isListening(d.outPortId)}
					{@const g = glow(d.outPortId)}
					<path
						d={cable(DEV_X + DEV_W, outSocketY(i), APP_X, appInY)}
						fill="none"
						stroke="var(--foreground)"
						stroke-width={open ? 1.6 : 1}
						stroke-dasharray={open ? 'none' : '3 4'}
						opacity={open ? 0.28 + g * 0.72 : 0.14}
						stroke-linecap="round"
					/>
				{/if}
				{#if d.inPortId}
					{@const open = engine.isOutputActive(d.inPortId)}
					{@const g = glow(d.inPortId)}
					<path
						d={cable(APP_X, appOutY, DEV_X + DEV_W, inSocketY(i))}
						fill="none"
						stroke="var(--foreground)"
						stroke-width={open ? 1.6 : 1}
						stroke-dasharray={open ? 'none' : '3 4'}
						opacity={open ? 0.28 + g * 0.72 : 0.14}
						stroke-linecap="round"
					/>
				{/if}
			{/each}

			<!-- devices -->
			{#each devices as d, i (d.key)}
				{@const y = rowY(i)}
				<g opacity={d.present ? 1 : 0.45}>
					<rect
						x={DEV_X}
						{y}
						width={DEV_W}
						height={ROW}
						rx="4"
						class="fill-card stroke-border"
						stroke-width="1"
					/>
					<text x={DEV_X + 12} y={y + 24} class="fill-foreground" font-size="12" font-weight="500">
						{clip(d.name)}
					</text>
					<text x={DEV_X + 12} y={y + 40} class="fill-muted-foreground" font-size="9.5">
						{clip(d.maker || '—', 26)}
					</text>
					{#if d.transport || !d.present}
						<text
							x={DEV_X + 12}
							y={y + 52}
							class="fill-muted-foreground"
							font-size="7.5"
							letter-spacing="1.2"
						>
							{[d.transport, d.present ? '' : 'OFFLINE'].filter(Boolean).join(' · ')}
						</text>
					{/if}

					<!-- sockets on the back of the box -->
					{#if d.outPortId}
						{@const open = midiAccess.isListening(d.outPortId)}
						<circle
							cx={DEV_X + DEV_W}
							cy={outSocketY(i)}
							r="3.5"
							class={open ? 'fill-foreground' : 'fill-muted'}
							stroke="var(--border)"
						/>
						<text
							x={DEV_X + DEV_W - 10}
							y={outSocketY(i) + 3}
							text-anchor="end"
							class="fill-muted-foreground"
							font-size="7.5"
							letter-spacing="0.8"
						>
							OUT
						</text>
					{/if}
					{#if d.inPortId}
						{@const open = engine.isOutputActive(d.inPortId)}
						<circle
							cx={DEV_X + DEV_W}
							cy={inSocketY(i)}
							r="3.5"
							class={open ? 'fill-foreground' : 'fill-muted'}
							stroke="var(--border)"
						/>
						<text
							x={DEV_X + DEV_W - 10}
							y={inSocketY(i) + 3}
							text-anchor="end"
							class="fill-muted-foreground"
							font-size="7.5"
							letter-spacing="0.8"
						>
							IN
						</text>
					{/if}
				</g>
			{/each}

			<!-- this machine -->
			<rect
				x={APP_X}
				y={appY}
				width={APP_W}
				height={appH}
				rx="4"
				class="fill-card stroke-border"
				stroke-width="1"
			/>
			<text x={APP_X + 30} y={appY + 20} class="fill-foreground" font-size="12" font-weight="500">
				MIDI Lab
			</text>
			<circle cx={APP_X} cy={appInY} r="3.5" class="fill-foreground" stroke="var(--border)" />
			<text
				x={APP_X + 10}
				y={appInY + 3}
				class="fill-muted-foreground"
				font-size="7.5"
				letter-spacing="0.8"
			>
				IN
			</text>
			<circle cx={APP_X} cy={appOutY} r="3.5" class="fill-foreground" stroke="var(--border)" />
			<text
				x={APP_X + 10}
				y={appOutY + 3}
				class="fill-muted-foreground"
				font-size="7.5"
				letter-spacing="0.8"
			>
				OUT
			</text>

			<!--
				The synth is not a device on a cable — it is inside this machine, so
				it is drawn inside the box. Hanging it off the right edge also put it
				outside the viewBox and clipped its label.
			-->
			<line
				x1={APP_X + 16}
				y1={appY + 54}
				x2={APP_X + APP_W - 16}
				y2={appY + 54}
				class="stroke-border"
				stroke-width="1"
			/>
			<circle
				cx={APP_X + 21}
				cy={appY + 71}
				r="3"
				class={internalOn ? 'fill-foreground' : 'fill-muted'}
				stroke="var(--border)"
			/>
			<text x={APP_X + 30} y={appY + 74} class="fill-muted-foreground" font-size="9">
				internal synth
			</text>
		</svg>
	{/if}
</div>
