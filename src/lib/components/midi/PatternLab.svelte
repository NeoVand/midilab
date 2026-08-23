<script lang="ts">
	/**
	 * Live pattern playing.
	 *
	 * Each lane is one line of mini-notation. At every cycle boundary the pattern
	 * is queried for that cycle and every event in it is scheduled at once, with
	 * timestamps — so alternation and Euclidean placement are exact rather than
	 * approximated by a step grid.
	 */
	import { onDestroy, onMount } from 'svelte';
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
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlayIcon,
		StopIcon,
		Add01Icon,
		Delete02Icon,
		VolumeOffIcon,
		VolumeHighIcon
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
		class: className
	}: Props = $props();

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

	function addLane() {
		lanes = [
			...lanes,
			{
				id: `l${Date.now().toString(36)}`,
				source: '~',
				channel: 0,
				root: 60,
				scale: 'minor',
				mute: false
			}
		];
	}
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<div class="flex flex-wrap items-center gap-3">
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
		<Button variant="ghost" size="sm" class="gap-1.5 text-xs" onclick={addLane}>
			<HugeiconsIcon icon={Add01Icon} size={13} /> Lane
		</Button>
	</div>

	<div class="flex flex-col gap-2">
		{#each lanes as lane, i (lane.id)}
			{@const p = parsed[i]}
			<div class="flex flex-col gap-1.5 rounded-lg border p-3">
				<div class="flex flex-wrap items-center gap-2">
					<button
						class={cn('shrink-0', lane.mute ? 'text-muted-foreground/40' : 'text-msg-note')}
						onclick={() => (lane.mute = !lane.mute)}
						aria-label={lane.mute ? 'Unmute' : 'Mute'}
					>
						<HugeiconsIcon icon={lane.mute ? VolumeOffIcon : VolumeHighIcon} size={14} />
					</button>
					<Input bind:value={lane.source} class="h-8 flex-1 font-mono text-xs" spellcheck={false} />
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
					<div class="panel-sunken relative h-8 overflow-hidden rounded border">
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
</div>
