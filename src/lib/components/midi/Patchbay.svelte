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
	import { engine, INTERNAL_OUTPUT_ID } from '$lib/midi/engine.svelte';
	import { router, newRoute } from '$lib/midi/router.svelte';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Slider } from '$lib/components/ui/slider';
	import * as Select from '$lib/components/ui/select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Add01Icon, Delete02Icon, AlertCircleIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	onMount(() => router.start());

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

	const inputs = $derived(midiAccess.inputs);
	const outputs = $derived(engine.outputs);

	const ROW = 34;
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
		router.add(newRoute(from, INTERNAL_OUTPUT_ID));
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
	<!-- ── the graph ─────────────────────────────────────────────────────── -->
	<div class="panel-sunken overflow-hidden rounded-xl border p-3">
		{#if inputs.length === 0}
			<p class="py-6 text-center text-xs text-muted-foreground">
				No MIDI inputs. Connect hardware in the dock — the graph fills itself in.
			</p>
		{:else}
			<svg
				viewBox="0 0 600 {height}"
				class="w-full"
				style="height: {height}px"
				role="img"
				aria-label="Routing graph"
			>
				{#each inputs as port, i (port.id)}
					<rect
						x="4"
						y={4 + i * ROW}
						width="180"
						height="26"
						rx="5"
						class="fill-card stroke-border"
					/>
					<text x="14" y={21 + i * ROW} font-size="10" class="fill-foreground">
						{port.name.length > 26 ? port.name.slice(0, 25) + '…' : port.name}
					</text>
					<circle
						cx="188"
						cy={17 + i * ROW}
						r="3.5"
						fill={midiAccess.isListening(port.id) ? 'var(--msg-cc)' : 'var(--grid-line-strong)'}
					/>
				{/each}

				{#each outputs as port, i (port.id)}
					<rect
						x="416"
						y={4 + i * ROW}
						width="180"
						height="26"
						rx="5"
						class="fill-card stroke-border"
					/>
					<text x="426" y={21 + i * ROW} font-size="10" class="fill-foreground">
						{port.name.length > 26 ? port.name.slice(0, 25) + '…' : port.name}
					</text>
					<circle
						cx="410"
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
							d="M192,{y1 - 3} C280,{y1 - 3} 320,{y2 - 3} 406,{y2 - 3}"
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
								cx={192 + (1 - h) * 214}
								cy={y1 - 3 + (1 - h) * (y2 - y1)}
							/>
						{/if}
					{/if}
				{/each}
			</svg>
		{/if}
	</div>

	<div class="flex items-center gap-3">
		<Button size="sm" class="gap-1.5" onclick={addRoute} disabled={inputs.length === 0}>
			<HugeiconsIcon icon={Add01Icon} size={14} /> Add a route
		</Button>
		{#if router.routes.length > 0}
			<Button variant="ghost" size="sm" class="text-xs" onclick={() => router.clear()}>
				Remove all
			</Button>
		{/if}
		<span class="text-xs text-muted-foreground">
			Routes are saved in this browser and keep working while you use the rest of the app.
		</span>
	</div>

	<!-- ── the routes ────────────────────────────────────────────────────── -->
	<div class="flex flex-col gap-3">
		{#each router.routes as route (route.id)}
			{@const loop = router.isLoop(route)}
			<div class={cn('flex flex-col gap-3 rounded-xl border p-4', loop && 'border-destructive/50')}>
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
							{midiAccess.inputName(route.fromPortId) || 'Choose an input'}
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
				{/if}

				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="flex flex-col gap-1.5">
						<span class="text-[10px] tracking-wide text-muted-foreground uppercase">
							Channel filter
						</span>
						<div class="flex flex-wrap gap-1">
							{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
								<button
									class={cn(
										'tnum size-5 rounded border font-mono text-[9px] transition-colors',
										route.channels.includes(c)
											? 'border-msg-cc bg-msg-cc-bg text-msg-cc'
											: 'text-muted-foreground/60 hover:border-foreground/40'
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
						<span class="text-[10px] text-muted-foreground">
							{route.channels.length === 0
								? 'all channels pass'
								: `${route.channels.length} selected`}
						</span>
					</div>

					<div class="flex flex-col gap-1.5">
						<span class="text-[10px] tracking-wide text-muted-foreground uppercase">Remap to</span>
						<div class="flex flex-wrap gap-1">
							<button
								class={cn(
									'rounded border px-1.5 text-[10px]',
									route.remapTo === null
										? 'border-msg-note text-msg-note'
										: 'text-muted-foreground/60'
								)}
								onclick={() => router.update(route.id, { remapTo: null })}
							>
								keep
							</button>
							{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
								<button
									class={cn(
										'tnum size-5 rounded border font-mono text-[9px]',
										route.remapTo === c
											? 'border-msg-note bg-msg-note-bg text-msg-note'
											: 'text-muted-foreground/60 hover:border-foreground/40'
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
							<span
								class="flex justify-between text-[10px] tracking-wide text-muted-foreground uppercase"
							>
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
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span
								class="flex justify-between text-[10px] tracking-wide text-muted-foreground uppercase"
							>
								Velocity <span class="tnum font-mono">×{route.velocityScale.toFixed(2)}</span>
							</span>
							<Slider
								type="single"
								value={route.velocityScale}
								min={0}
								max={2}
								step={0.05}
								onValueChange={(v) => router.update(route.id, { velocityScale: v })}
							/>
						</label>
					</div>

					<div class="flex flex-col gap-3">
						<div class="flex flex-col gap-1">
							<span
								class="flex justify-between text-[10px] tracking-wide text-muted-foreground uppercase"
							>
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
							/>
						</div>
						<div class="flex flex-wrap gap-1">
							{#each FILTER_KEYS as [key, label] (key)}
								<button
									class={cn(
										'rounded border px-1.5 py-0.5 text-[10px] transition-colors',
										route.pass[key]
											? 'border-msg-note/60 bg-msg-note-bg text-msg-note'
											: 'text-muted-foreground/50'
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

		{#if router.routes.length === 0}
			<p class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
				No routes yet. Add one to send an input somewhere — with channel remapping, transposition, a
				velocity curve and message filtering on the way.
			</p>
		{/if}
	</div>
</div>
