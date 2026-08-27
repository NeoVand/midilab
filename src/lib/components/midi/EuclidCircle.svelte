<script lang="ts">
	/**
	 * A Euclidean rhythm on a circle, which is the only shape that makes the
	 * point.
	 *
	 * Drawn as a row of boxes, E(3,8) is a pattern you have to trust somebody
	 * about. Drawn as twelve o'clock positions with the hits joined into a
	 * polygon, the *reason* is visible: the algorithm is trying to make the
	 * shape as close to a regular polygon as a discrete grid allows, and it
	 * cannot quite manage it, and that near-miss is the syncopation. Three hits
	 * over eight steps wants to be an equilateral triangle and cannot be, so it
	 * comes out lopsided — and lopsided is the whole reason the tresillo has
	 * outlived every rhythm that divides evenly.
	 *
	 * A row of boxes also hides the wrap: the gap between the last hit and the
	 * first is a real gap, and on a line it is invisible.
	 *
	 * Rotation is offered because it is free here and it is how these patterns
	 * are actually used — the son clave is a rotation of the same eight-step
	 * set, not a different rhythm.
	 */
	import { euclid } from '$lib/patterns';
	import { engine } from '$lib/midi/engine.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { onDestroy, onMount } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		pulses?: number;
		steps?: number;
		rotation?: number;
		/** GM percussion note to strike. */
		note?: number;
		/**
		 * Draw the sliders. Off where the page already has its own — the patterns
		 * lesson shows the same rhythm as a row of boxes right above this, and two
		 * sets of pulses-and-steps controls one under the other is furniture, not
		 * a second opinion. Bind the values instead and they move together.
		 */
		controls?: boolean;
		class?: string;
	}
	let {
		pulses = $bindable(3),
		steps = $bindable(8),
		rotation = $bindable(0),
		note = $bindable(37),
		controls = true,
		class: className
	}: Props = $props();

	const pattern = $derived(euclid(pulses, steps, rotation));

	/**
	 * The names are the payoff: these are not invented shapes, they are what a
	 * great deal of the world's music already plays. Keyed by pulses-over-steps
	 * so a rotation still finds its family.
	 */
	const NAMED: Record<string, string> = {
		'2/5': 'a Persian and Korean pattern',
		'3/4': 'the Cuban cinquillo’s cousin',
		'3/8': 'the tresillo — Cuban, and under an enormous amount of pop',
		'4/9': 'the Turkish aksak',
		'5/8': 'the Cuban cinquillo, and Korean and Ghanaian patterns',
		'5/12': 'a South African and Rumanian bell pattern',
		'5/16': 'the Brazilian bossa nova clave',
		'7/8': 'a Tuareg rhythm of Libya',
		'7/12': 'a West African bell pattern',
		'7/16': 'a Brazilian samba pattern',
		'9/16': 'a Central African and Balkan pattern',
		'11/24': 'a Central African bell pattern'
	};
	const named = $derived(NAMED[`${pulses}/${steps}`]);

	const SIZE = 260;
	const C = SIZE / 2;
	const R = 96;

	function at(i: number, r = R) {
		const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
		return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
	}

	/** The hits, joined in order — the shape the algorithm is reaching for. */
	const polygon = $derived(
		pattern
			.map((on, i) => (on ? at(i) : null))
			.filter((v): v is { x: number; y: number } => v !== null)
			.map((v) => `${v.x},${v.y}`)
			.join(' ')
	);

	let playing = $state(false);
	let current = $state(-1);
	let unsub: (() => void) | undefined;

	onMount(() => {
		unsub = transport.onTick((t) => {
			if (!playing) return;
			const per = 24 / 4; // a sixteenth-note grid
			if (t.tick % per !== 0) return;
			const i = Math.floor(t.tick / per) % steps;
			current = i;
			if (!pattern[i]) return;
			engine.send({ type: 'noteOn', channel: 9, note, velocity: i === 0 ? 112 : 92 });
			setTimeout(() => engine.send({ type: 'noteOff', channel: 9, note, velocity: 0 }), 120);
		});
		return () => unsub?.();
	});

	async function toggle() {
		if (playing) {
			playing = false;
			current = -1;
			transport.stop();
			return;
		}
		await engine.wake();
		playing = true;
		if (!transport.playing) transport.start();
	}

	onDestroy(() => {
		playing = false;
		engine.send({ type: 'noteOff', channel: 9, note, velocity: 0 });
	});

	/** The pattern as the notation the Programmer speaks. */
	const asText = $derived(pattern.map((on) => (on ? 'x' : '·')).join(''));
</script>

<div class={cn('flex flex-col gap-4 sm:flex-row sm:items-center', className)}>
	<svg
		viewBox="0 0 {SIZE} {SIZE}"
		class="h-auto w-full max-w-[16rem] shrink-0 self-center"
		role="img"
		aria-label="Euclidean rhythm E({pulses},{steps}) drawn on a circle of {steps} positions: {asText}"
	>
		<circle cx={C} cy={C} r={R} fill="none" class="stroke-border" stroke-width="1" />

		<!-- The shape the hits make. Nearly regular, never quite. -->
		{#if pulses > 1}
			<polygon
				points={polygon}
				fill="var(--msg-note)"
				fill-opacity="0.1"
				stroke="var(--msg-note)"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
		{/if}

		{#each pattern as on, i (i)}
			{@const pt = at(i)}
			{@const label = at(i, R + 18)}
			<circle
				cx={pt.x}
				cy={pt.y}
				r={on ? 9 : 4.5}
				fill={on ? 'var(--msg-note)' : 'var(--muted)'}
				stroke={current === i ? 'var(--foreground)' : 'transparent'}
				stroke-width="2"
			/>
			{#if steps <= 16}
				<text
					x={label.x}
					y={label.y + 3}
					text-anchor="middle"
					font-size="8"
					class={cn('fill-muted-foreground', i === 0 && 'fill-foreground')}
				>
					{i + 1}
				</text>
			{/if}
		{/each}

		<text
			x={C}
			y={C - 4}
			text-anchor="middle"
			font-size="20"
			font-weight="600"
			class="fill-foreground"
		>
			E({pulses},{steps})
		</text>
		<text x={C} y={C + 12} text-anchor="middle" font-size="8" class="fill-muted-foreground">
			starts at the top, clockwise
		</text>
	</svg>

	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<div class="flex items-center gap-2">
			<Button variant={playing ? 'default' : 'outline'} size="sm" class="gap-1.5" onclick={toggle}>
				<HugeiconsIcon icon={playing ? StopIcon : PlayIcon} size={14} />
				{playing ? 'Stop' : 'Play'}
			</Button>
			<code class="tnum truncate font-mono text-sm text-msg-note">{asText}</code>
		</div>

		{#if controls}
			{#each [{ label: 'Pulses', get: () => pulses, set: (v: number) => (pulses = Math.min(v, steps)), min: 1, max: 16 }, { label: 'Steps', get: () => steps, set: (v: number) => {
						steps = v;
						if (pulses > v) pulses = v;
					}, min: 2, max: 16 }, { label: 'Rotate', get: () => rotation, set: (v: number) => (rotation = v), min: 0, max: 15 }] as ctl (ctl.label)}
				<label class="flex items-center gap-3">
					<span class="label w-14 shrink-0">{ctl.label}</span>
					<input
						type="range"
						min={ctl.min}
						max={ctl.max}
						step="1"
						value={ctl.get()}
						oninput={(e) => ctl.set(Number(e.currentTarget.value))}
						class="h-1.5 min-w-0 flex-1 accent-msg-note"
					/>
					<span class="tnum w-6 shrink-0 text-right text-xs text-muted-foreground">
						{ctl.get()}
					</span>
				</label>
			{/each}
		{/if}

		<label class="flex items-center gap-3">
			<span class="label w-14 shrink-0">Sound</span>
			<select
				bind:value={note}
				class="min-w-0 flex-1 rounded-md border bg-surface-sunken px-2 py-1 text-xs"
			>
				{#each [35, 37, 38, 42, 46, 39, 56, 76] as n (n)}
					<option value={n}>{GM_DRUMS[n]}</option>
				{/each}
			</select>
		</label>

		<p class="min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
			{#if named}
				This one is <strong class="text-foreground">{named}</strong>. Nobody designed it from the
				algorithm — the algorithm was found to produce it.
			{:else}
				Move the hits as far apart as a grid of {steps} allows. Most settings are just even; the famous
				ones are where even is impossible.
			{/if}
		</p>
	</div>
</div>
