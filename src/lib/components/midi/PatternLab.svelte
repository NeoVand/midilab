<script lang="ts">
	/**
	 * Live pattern playing.
	 *
	 * Each lane is one line of mini-notation. At every cycle boundary the pattern
	 * is queried for that cycle and every event in it is scheduled at once, with
	 * timestamps — so alternation and Euclidean placement are exact rather than
	 * approximated by a step grid.
	 */
	import { onDestroy, onMount, untrack } from 'svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { transport, PPQ, audioToPerf } from '$lib/midi/clock.svelte';
	import {
		DRUM_ALIASES,
		degreeToNote,
		parsePattern,
		queryCycle,
		SCALES,
		type Hap,
		type Node
	} from '$lib/patterns';
	import { parseNoteName } from '$lib/midi/notes';
	import { load, save } from '$lib/stores/persist';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlayIcon,
		StopIcon,
		Add01Icon,
		Delete02Icon,
		VolumeOffIcon,
		VolumeHighIcon,
		HelpCircleIcon
	} from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Lane {
		id: string;
		source: string;
		channel: number;
		root: number;
		scale: string;
		mute: boolean;
	}

	interface Props {
		lanes?: Lane[];
		beatsPerCycle?: number;
		/** Remember these lanes under this key. Set by the Lab, not by lessons. */
		persistKey?: string;
		class?: string;
	}

	let {
		lanes = $bindable([
			{ id: 'l1', source: 'bd ~ [bd bd] ~', channel: 9, root: 60, scale: 'minor', mute: false },
			{ id: 'l2', source: '~ sd ~ sd', channel: 9, root: 60, scale: 'minor', mute: false },
			{ id: 'l3', source: 'hh(7,8)', channel: 9, root: 60, scale: 'minor', mute: false },
			{
				id: 'l4',
				source: '<0 3> 5 [7 10] <2 7>',
				channel: 0,
				root: 36,
				scale: 'minorPentatonic',
				mute: false
			}
		]),
		beatsPerCycle = 4,
		persistKey,
		class: className
	}: Props = $props();

	const saved = untrack(() =>
		persistKey ? load<Lane[] | null>(`patterns-${persistKey}`, null) : null
	);
	if (saved?.length) lanes = saved;

	$effect(() => {
		if (!persistKey) return;
		save(`patterns-${persistKey}`, $state.snapshot(lanes));
	});

	let phase = $state(0);
	let lastCycle = $state(0);

	const ticksPerCycle = $derived(PPQ * beatsPerCycle);
	const cycleSeconds = $derived((60 / transport.bpm) * beatsPerCycle);

	interface Parsed {
		node: Node | null;
		error: string | null;
		haps: Hap[];
	}

	const parsed = $derived.by((): Parsed[] =>
		lanes.map((lane) => {
			try {
				const node = parsePattern(lane.source);
				return { node, error: null, haps: queryCycle(node, lastCycle) };
			} catch (err) {
				return { node: null, error: err instanceof Error ? err.message : String(err), haps: [] };
			}
		})
	);

	function toNote(value: string, lane: Lane): number | null {
		const drum = DRUM_ALIASES[value.toLowerCase()];
		if (drum !== undefined) return drum;
		const named = parseNoteName(value);
		if (named !== null) return named;
		const n = Number(value);
		if (Number.isFinite(n)) return degreeToNote(n, lane.root, lane.scale);
		return null;
	}

	onMount(() =>
		transport.onTick((t) => {
			phase = (t.tick % ticksPerCycle) / ticksPerCycle;
			if (t.tick % ticksPerCycle !== 0) return;
			const cycle = Math.floor(t.tick / ticksPerCycle);
			lastCycle = cycle;

			lanes.forEach((lane) => {
				if (lane.mute) return;
				let haps: Hap[];
				try {
					haps = queryCycle(parsePattern(lane.source), cycle);
				} catch {
					return;
				}
				for (const hap of haps) {
					const note = toNote(hap.value, lane);
					if (note === null) continue;
					const at = t.audioTime + hap.begin * cycleSeconds;
					const off = t.audioTime + Math.min(hap.end, hap.begin + 0.24) * cycleSeconds;
					engine.send(
						{
							type: 'noteOn',
							channel: lane.channel,
							note,
							velocity: lane.channel === 9 ? 104 : 92
						},
						audioToPerf(at),
						at
					);
					engine.send(
						{ type: 'noteOff', channel: lane.channel, note, velocity: 0 },
						audioToPerf(off),
						off
					);
				}
			});
		})
	);

	onDestroy(() => engine.panic());

	/*
	 * The syntax is the whole feature, and it is unguessable. `hh(7,8)` means
	 * nothing to anyone who has not met Bjorklund, so the notation ships with
	 * the lab rather than living in a paragraph somewhere else — and every line
	 * of it is a working pattern you can drop straight into a lane.
	 */
	const SYNTAX: Array<[string, string]> = [
		['bd sd hh hh', 'Four events, one per quarter of the cycle.'],
		['~', 'A rest. Holds its slot and stays silent.'],
		['[bd sd]', 'Subdivide one slot into two.'],
		['bd*3', 'Three of them inside one slot.'],
		['<bd sd>', 'Alternate: bd this cycle, sd the next.'],
		['bd(3,8)', 'Euclidean — three hits spread as evenly as possible over eight.'],
		['bd(3,8,2)', 'The same, rotated two steps later.'],
		['bd,hh*8', 'Stack: both at once, in one lane.']
	];

	const DRUM_WORDS = Object.entries(DRUM_ALIASES);

	function addLane(source = '~', channel = 0) {
		lanes = [
			...lanes,
			{
				id: `l${Date.now().toString(36)}`,
				source,
				channel,
				root: 60,
				scale: 'minor',
				mute: false
			}
		];
	}
</script>

<div class={cn('flex flex-col overflow-hidden rounded-lg border bg-card', className)}>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
		<Button
			variant={transport.playing ? 'default' : 'outline'}
			size="sm"
			class="gap-1.5"
			onclick={async () => {
				await engine.wake();
				transport.toggle();
			}}
		>
			<HugeiconsIcon icon={transport.playing ? StopIcon : PlayIcon} size={14} />
			{transport.playing ? 'Stop' : 'Play'}
		</Button>
		<span class="tnum font-mono text-sm text-readout">{transport.bpm.toFixed(1)} BPM</span>
		<span class="tnum font-mono text-xs text-muted-foreground">cycle {lastCycle}</span>
		<div class="flex-1"></div>

		<Popover.Root>
			<Popover.Trigger
				class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<HugeiconsIcon icon={HelpCircleIcon} size={13} /> Notation
			</Popover.Trigger>
			<Popover.Content class="flex w-[26rem] flex-col gap-3" align="end">
				<div class="flex flex-col gap-1">
					<p class="text-sm font-medium">A pattern is not a list of events</p>
					<p class="text-xs leading-relaxed text-muted-foreground">
						It is a function from a cycle number to the events in that cycle. That is what lets
						<code class="font-mono">&lt;a b&gt;</code> alternate, and why a lane can be infinite and still
						fit on one line. Click any line to try it.
					</p>
				</div>
				<div class="flex flex-col">
					{#each SYNTAX as [src, meaning], i (src)}
						<button
							class={cn(
								'grid grid-cols-[7.5rem_1fr] items-baseline gap-3 rounded-sm px-1.5 py-1.5 text-left transition-colors hover:bg-accent',
								i > 0 && 'border-t'
							)}
							onclick={() => addLane(src, src.includes('bd') || src.includes('hh') ? 9 : 0)}
						>
							<code class="font-mono text-xs text-msg-note">{src}</code>
							<span class="text-xs leading-snug text-muted-foreground">{meaning}</span>
						</button>
					{/each}
				</div>
				<div class="flex flex-col gap-1.5 border-t pt-3">
					<p class="label">Drum words (channel 10)</p>
					<div class="flex flex-wrap gap-x-3 gap-y-1">
						{#each DRUM_WORDS as [word, note] (word)}
							<span class="font-mono text-2xs text-muted-foreground">
								{word}<span class="text-muted-foreground">·{note}</span>
							</span>
						{/each}
					</div>
					<p class="text-2xs leading-relaxed text-muted-foreground">
						On a melodic channel, bare numbers are scale degrees — <code class="font-mono">0</code>
						is the root, <code class="font-mono">7</code> is an octave up in a seven-note scale.
						Note names like <code class="font-mono">c3</code> work anywhere.
					</p>
				</div>
			</Popover.Content>
		</Popover.Root>

		<Button variant="ghost" size="sm" class="gap-1.5 text-xs" onclick={() => addLane()}>
			<HugeiconsIcon icon={Add01Icon} size={13} /> Lane
		</Button>
	</div>

	<div class="panel-sunken flex flex-col">
		<!--
			One ruler for every lane. It sits over the same inner width the lane
			timelines use, so beat 3 in the ruler is beat 3 in every pattern below it.
		-->
		<div class="border-b px-3 pt-2 pb-1">
			<div class="tnum relative font-mono text-2xs text-muted-foreground">
				{#each Array.from({ length: beatsPerCycle }, (_, b) => b) as b (b)}
					<span class="absolute" style="left: {(b / beatsPerCycle) * 100}%">{b + 1}</span>
				{/each}
				<span class="invisible">1</span>
			</div>
		</div>

		{#each lanes as lane, i (lane.id)}
			{@const p = parsed[i]}
			<div class={cn('flex flex-col gap-1.5 px-3 py-2.5', i > 0 && 'border-t')}>
				<div class="flex flex-wrap items-center gap-2">
					<button
						class={cn(
							'shrink-0 transition-colors',
							lane.mute ? 'text-muted-foreground/40' : 'text-msg-note'
						)}
						onclick={() => (lane.mute = !lane.mute)}
						aria-label={lane.mute ? 'Unmute lane' : 'Mute lane'}
					>
						<HugeiconsIcon icon={lane.mute ? VolumeOffIcon : VolumeHighIcon} size={14} />
					</button>
					<Input
						bind:value={lane.source}
						class={cn('h-8 flex-1 font-mono text-xs', p.error && 'border-destructive')}
						spellcheck={false}
						aria-invalid={p.error ? 'true' : undefined}
					/>
					<Select.Root
						type="single"
						value={String(lane.channel)}
						onValueChange={(v) => (lane.channel = Number(v))}
					>
						<Select.Trigger class="h-8 w-24 text-xs">
							ch {lane.channel + 1}
						</Select.Trigger>
						<Select.Content>
							{#each Array.from({ length: 16 }, (_, c) => c) as c (c)}
								<Select.Item value={String(c)}>
									ch {c + 1}{c === 9 ? ' · drums' : ''}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if lane.channel !== 9}
						<Select.Root type="single" value={lane.scale} onValueChange={(v) => (lane.scale = v)}>
							<Select.Trigger class="h-8 w-32 text-xs">{lane.scale}</Select.Trigger>
							<Select.Content>
								{#each Object.keys(SCALES) as s (s)}
									<Select.Item value={s}>{s}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						class="size-7 text-muted-foreground hover:text-destructive"
						onclick={() => (lanes = lanes.filter((l) => l.id !== lane.id))}
						aria-label="Remove lane"
					>
						<HugeiconsIcon icon={Delete02Icon} size={13} />
					</Button>
				</div>

				{#if p.error}
					<p class="font-mono text-xs text-destructive">{p.error}</p>
				{:else}
					<div
						class={cn(
							'relative h-8 overflow-hidden rounded-md border bg-background transition-opacity',
							lane.mute && 'opacity-40'
						)}
					>
						{#each Array.from({ length: beatsPerCycle * 4 }, (_, s) => s) as s (s)}
							<div
								class={cn(
									'absolute inset-y-0 w-px',
									s % 4 === 0 ? 'bg-grid-line-strong' : 'bg-grid-line'
								)}
								style="left: {(s / (beatsPerCycle * 4)) * 100}%"
							></div>
						{/each}
						{#each p.haps as hap, hi (hi)}
							<div
								class="absolute inset-y-1 rounded-xs bg-msg-note"
								style="left: {hap.begin * 100}%; width: {Math.max(
									1.2,
									Math.min(hap.end - hap.begin, 0.24) * 100 * 0.8
								)}%"
								title={hap.value}
							>
								<span
									class="absolute inset-0 truncate px-1 font-mono text-2xs leading-6 text-background"
								>
									{hap.value}
								</span>
							</div>
						{/each}
						{#if transport.playing}
							<div
								class="absolute inset-y-0 w-px bg-foreground/70"
								style="left: {phase * 100}%"
							></div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<p class="border-t px-3 py-2 text-xs text-muted-foreground">
		Each lane is one line of notation, queried once per cycle and scheduled all at once with
		timestamps — so a Euclidean placement lands where the maths says it does, not where the browser
		happened to wake up.
	</p>
</div>
