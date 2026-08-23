<script lang="ts">
	/**
	 * The patchbay: a signal-flow graph you can actually route with.
	 *
	 * Left column is every input the operating system reports; right column is
	 * every output plus the internal synth. Each curve is a live route, and it
	 * lights up when a message passes through it — so the picture is not a
	 * diagram of your intent but a display of what is really happening.
	 */
	import { onMount } from 'svelte';
	import { midiAccess } from '$lib/midi/access.svelte';
	import {
		engine,
		INTERNAL_OUTPUT_ID,
		VIRTUAL_INPUT_ID,
		VIRTUAL_INPUT_NAME
	} from '$lib/midi/engine.svelte';
	import { router, newRoute } from '$lib/midi/router.svelte';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import EmptyState from '$lib/components/shell/EmptyState.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { Slider } from '$lib/components/ui/slider';
	import * as Select from '$lib/components/ui/select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Add01Icon,
		Delete02Icon,
		AlertCircleIcon,
		Route02Icon
	} from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	let now = $state(performance.now());
	onMount(() => {
		let frame = 0;
		const tick = () => {
			now = performance.now();
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	/*
	 * The app's own controls are the first input, always. Without them a laptop
	 * with nothing plugged in has an empty patchbay and an unreachable lesson —
	 * and it is not a stand-in: the keyboard, pads, sequencer and console on
	 * these pages are the controller in this rig.
	 */
	const inputs = $derived([
		{ id: VIRTUAL_INPUT_ID, name: VIRTUAL_INPUT_NAME, manufacturer: '', state: 'connected' },
		...midiAccess.inputs
	]);
	const outputs = $derived(engine.outputs);

	/*
	 * The graph is laid out at the width it is given, one unit to one pixel,
	 * rather than drawn at a fixed width and centred. A 600-unit drawing in a
	 * 900-pixel panel is a diagram stranded in a field of nothing with a
	 * hundred and fifty pixels of margin either side; the boxes should stay the
	 * size they are and the cables between them should get longer.
	 */
	let boxW = $state(0);
	const ROW = 34;
	const PORT_W = 180;
	const VIEW_W = $derived(Math.max(PORT_W * 2 + 140, Math.min(boxW || 600, 960)));
	const OUT_X = $derived(VIEW_W - PORT_W - 4);
	const height = $derived(Math.max(inputs.length, outputs.length, 1) * ROW + 24);

	function inputY(id: string): number {
		const i = inputs.findIndex((p) => p.id === id);
		return i < 0 ? -100 : 20 + i * ROW;
	}
	function outputY(id: string): number {
		const i = outputs.findIndex((p) => p.id === id);
		return i < 0 ? -100 : 20 + i * ROW;
	}

	/** 0–1, decaying over 400 ms after a message passed. */
	function heat(routeId: string): number {
		const t = router.activity[routeId];
		if (!t) return 0;
		return Math.max(0, 1 - (now - t) / 400);
	}

	function addRoute() {
		const from = inputs[0]?.id ?? '';
		const hardwareOut = engine.outputs.find((o) => o.kind === 'hardware' && o.connected);
		const to = hardwareOut?.id ?? INTERNAL_OUTPUT_ID;
		const route = newRoute(from, to);
		// A first route that plays every note twice in unison sounds broken. An
		// octave up is unmistakably deliberate, and it is the layer example from
		// the lesson, working on the first click.
		if (from === VIRTUAL_INPUT_ID && to === INTERNAL_OUTPUT_ID) route.transpose = 12;
		router.add(route);
	}

	const FILTER_KEYS = [
		['notes', 'Notes'],
		['cc', 'CC'],
		['pitchBend', 'Bend'],
		['aftertouch', 'Pressure'],
		['program', 'Program'],
		['clock', 'Clock'],
		['sysex', 'SysEx']
	] as const;
</script>

<div class={cn('flex flex-col gap-4', className)}>
	<!--
		── the graph ──────────────────────────────────────────────────────────
		
		Only once there is something to draw. With no routes it was two columns
		of port names with a gap between them — the same names the Ports list
		below and the Devices tray already carry, in a panel whose whole job is
		the cables it did not have.
	-->
	{#if router.routes.length > 0}
		<div class="panel-sunken overflow-hidden rounded-lg border p-3" bind:clientWidth={boxW}>
			<svg
				viewBox="0 0 {VIEW_W} {height}"
				width={VIEW_W}
				{height}
				class="mx-auto block max-w-full"
				role="img"
				aria-label="Routing graph"
			>
				{#each inputs as port, i (port.id)}
					<rect
						x="4"
						y={4 + i * ROW}
						width={PORT_W}
						height="26"
						rx="5"
						class="fill-card stroke-border"
					/>
					<text x="14" y={21 + i * ROW} font-size="10" class="fill-foreground">
						{port.name.length > 26 ? port.name.slice(0, 25) + '…' : port.name}
					</text>
					<circle
						cx={PORT_W + 8}
						cy={17 + i * ROW}
						r="3.5"
						fill={midiAccess.isListening(port.id) ? 'var(--msg-cc)' : 'var(--grid-line-strong)'}
					/>
				{/each}

				{#each outputs as port, i (port.id)}
					<rect
						x={OUT_X}
						y={4 + i * ROW}
						width={PORT_W}
						height="26"
						rx="5"
						class="fill-card stroke-border"
					/>
					<text x={OUT_X + 10} y={21 + i * ROW} font-size="10" class="fill-foreground">
						{port.name.length > 26 ? port.name.slice(0, 25) + '…' : port.name}
					</text>
					<circle
						cx={OUT_X - 6}
						cy={17 + i * ROW}
						r="3.5"
						fill={engine.isOutputActive(port.id) ? 'var(--msg-note)' : 'var(--grid-line-strong)'}
					/>
				{/each}

				{#each router.routes as route (route.id)}
					{@const y1 = inputY(route.fromPortId)}
					{@const y2 = outputY(route.toPortId)}
					{#if y1 > 0 && y2 > 0}
						{@const h = heat(route.id)}
						<path
							d="M{PORT_W + 12},{y1 - 3} C{PORT_W + 100},{y1 - 3} {OUT_X - 100},{y2 - 3} {OUT_X -
								10},{y2 - 3}"
							fill="none"
							stroke={route.enabled ? 'var(--msg-note)' : 'var(--grid-line-strong)'}
							stroke-width={1.5 + h * 2}
							opacity={route.enabled ? 0.35 + h * 0.65 : 0.25}
						/>
						{#if h > 0}
							<circle
								r={2 + h * 1.5}
								fill="var(--msg-note)"
								opacity={h}
								cx={PORT_W + 12 + (1 - h) * (OUT_X - PORT_W - 22)}
								cy={y1 - 3 + (1 - h) * (y2 - y1)}
							/>
						{/if}
					{/if}
				{/each}
			</svg>
		</div>
	{/if}

	<div class="flex flex-col gap-2">
		<!-- While the list is empty the empty state below carries the call to
		     action; two "Add a route" buttons on one screen is one too many. -->
		{#if router.routes.length > 0}
			<div class="flex flex-wrap items-center gap-2">
				<Button size="sm" class="gap-1.5" onclick={addRoute}>
					<HugeiconsIcon icon={Add01Icon} size={14} /> Add a route
				</Button>
				<Button variant="ghost" size="sm" class="text-xs" onclick={() => router.clear()}>
					Remove all
				</Button>
			</div>
		{/if}
		<p class="measure text-xs leading-relaxed text-muted-foreground">
			{#if midiAccess.inputs.length === 0}
				With nothing plugged in you can still route <em>{VIRTUAL_INPUT_NAME}</em> — the keyboards, pads
				and sequencer on these pages are the controller in this rig. Hardware inputs join the left column
				the moment you connect.
			{:else}
				Routes are saved in this browser and keep working while you use the rest of the app.
			{/if}
		</p>
	</div>

	<!-- ── the routes ────────────────────────────────────────────────────── -->
	<div class="flex flex-col gap-3">
		{#each router.routes as route (route.id)}
			{@const loop = router.isLoop(route)}
			{@const unison = router.isUnisonDouble(route)}
			<div class={cn('flex flex-col gap-3 rounded-lg border p-4', loop && 'border-destructive/50')}>
				<div class="flex flex-wrap items-center gap-3">
					<Switch
						checked={route.enabled}
						onCheckedChange={(v) => router.update(route.id, { enabled: v })}
					/>
					<Select.Root
						type="single"
						value={route.fromPortId}
						onValueChange={(v) => router.update(route.id, { fromPortId: v })}
					>
						<Select.Trigger class="h-8 w-52 text-xs">
							{inputs.find((p) => p.id === route.fromPortId)?.name ?? 'Choose an input'}
						</Select.Trigger>
						<Select.Content>
							{#each inputs as p (p.id)}
								<Select.Item value={p.id}>{p.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>

					<span class="text-muted-foreground">→</span>

					<Select.Root
						type="single"
						value={route.toPortId}
						onValueChange={(v) => router.update(route.id, { toPortId: v })}
					>
						<Select.Trigger class="h-8 w-52 text-xs">
							{outputs.find((o) => o.id === route.toPortId)?.name ?? 'Choose an output'}
						</Select.Trigger>
						<Select.Content>
							{#each outputs as p (p.id)}
								<Select.Item value={p.id}>{p.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>

					<div class="flex-1"></div>
					<Button
						variant="ghost"
						size="icon"
						class="size-7 text-muted-foreground hover:text-destructive"
						onclick={() => router.remove(route.id)}
						aria-label="Delete route"
					>
						<HugeiconsIcon icon={Delete02Icon} size={14} />
					</Button>
				</div>

				{#if loop}
					<p class="flex items-center gap-2 text-xs text-destructive">
						<HugeiconsIcon icon={AlertCircleIcon} size={14} />
						This route sends a port straight back to itself. It is disabled to prevent a feedback loop.
					</p>
				{:else if unison}
					<p class="flex items-start gap-2 text-xs text-warn">
						<HugeiconsIcon icon={AlertCircleIcon} size={14} class="mt-px shrink-0" />
						<span>
							Every note now reaches the synth twice, at the same pitch — once directly and once
							through this route. That is phase cancellation, not a layer. Transpose it, remap the
							channel, or narrow the note range to make it a part rather than a double.
						</span>
					</p>
				{/if}

				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="flex flex-col gap-1.5">
						<span class="label"> Channel filter </span>
						<div class="flex flex-wrap gap-1">
							{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
								<button
									class={cn(
										'tnum size-5 rounded-md border font-mono text-2xs transition-colors',
										route.channels.includes(c)
											? 'border-msg-cc bg-msg-cc-bg text-msg-cc'
											: 'text-muted-foreground hover:border-foreground/40'
									)}
									onclick={() =>
										router.update(route.id, {
											channels: route.channels.includes(c)
												? route.channels.filter((x) => x !== c)
												: [...route.channels, c]
										})}
								>
									{c + 1}
								</button>
							{/each}
						</div>
						<span class="text-2xs text-muted-foreground">
							{route.channels.length === 0
								? 'all channels pass'
								: `${route.channels.length} selected`}
						</span>
					</div>

					<div class="flex flex-col gap-1.5">
						<span class="label">Remap to</span>
						<div class="flex flex-wrap gap-1">
							<button
								class={cn(
									'rounded-md border px-1.5 text-2xs',
									route.remapTo === null ? 'border-msg-note text-msg-note' : 'text-muted-foreground'
								)}
								onclick={() => router.update(route.id, { remapTo: null })}
							>
								keep
							</button>
							{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
								<button
									class={cn(
										'tnum size-5 rounded-md border font-mono text-2xs',
										route.remapTo === c
											? 'border-msg-note bg-msg-note-bg text-msg-note'
											: 'text-muted-foreground hover:border-foreground/40'
									)}
									onclick={() => router.update(route.id, { remapTo: c })}
								>
									{c + 1}
								</button>
							{/each}
						</div>
					</div>

					<div class="flex flex-col gap-3">
						<label class="flex flex-col gap-1">
							<span class="label flex justify-between">
								Transpose <span class="tnum font-mono"
									>{route.transpose > 0 ? '+' : ''}{route.transpose}</span
								>
							</span>
							<Slider
								type="single"
								value={route.transpose}
								min={-36}
								max={36}
								step={1}
								onValueChange={(v) => router.update(route.id, { transpose: v })}
								aria-label="Transpose, in semitones"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="label flex justify-between">
								Velocity <span class="tnum font-mono">×{route.velocityScale.toFixed(2)}</span>
							</span>
							<Slider
								type="single"
								value={route.velocityScale}
								min={0}
								max={2}
								step={0.05}
								onValueChange={(v) => router.update(route.id, { velocityScale: v })}
								aria-label="Velocity scale"
							/>
						</label>
					</div>

					<div class="flex flex-col gap-3">
						<div class="flex flex-col gap-1">
							<span class="label flex justify-between">
								Note range
								<span class="tnum font-mono">
									{noteName(route.noteRange[0], {
										convention: settings.octaveConvention
									})}–{noteName(route.noteRange[1], { convention: settings.octaveConvention })}
								</span>
							</span>
							<Slider
								type="multiple"
								value={route.noteRange}
								min={0}
								max={127}
								step={1}
								onValueChange={(v) => router.update(route.id, { noteRange: [v[0], v[1]] })}
								thumbLabels={['Lowest note passed', 'Highest note passed']}
							/>
						</div>
						<div class="flex flex-wrap gap-1">
							{#each FILTER_KEYS as [key, label] (key)}
								<button
									class={cn(
										'rounded-md border px-1.5 py-0.5 text-2xs transition-colors',
										route.pass[key]
											? 'border-msg-note/60 bg-msg-note-bg text-msg-note'
											: 'text-muted-foreground'
									)}
									onclick={() =>
										router.update(route.id, { pass: { ...route.pass, [key]: !route.pass[key] } })}
								>
									{label}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/each}

		{#if router.routes.length === 0 && inputs.length > 0}
			<EmptyState
				icon={Route02Icon}
				title="No routes yet"
				body="Add one to send an input somewhere — with channel remapping, transposition, a velocity
					curve, a note-range split and message filtering on the way."
			>
				{#snippet action()}
					<Button size="sm" onclick={addRoute}>
						<HugeiconsIcon icon={Add01Icon} size={14} /> Add a route
					</Button>
				{/snippet}
			</EmptyState>
		{/if}
	</div>
</div>
