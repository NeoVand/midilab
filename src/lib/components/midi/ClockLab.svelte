<script lang="ts">
	/**
	 * The transport and clock, made visible: 24 ticks per quarter note, sent
	 * whether or not anything is playing, carrying no tempo number at all.
	 */
	import { onMount } from 'svelte';
	import { bus } from '$lib/midi/bus';
	import { transport, CLOCK_PPQ } from '$lib/midi/clock.svelte';
	import JitterPlot from './JitterPlot.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon, BackwardIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	let phase = $state(0);
	let ticks = $state(0);
	let beats = $state(0);

	onMount(() =>
		bus.subscribe((e) => {
			const m = e.message;
			if (m.type === 'clock') {
				ticks++;
				phase = ticks % CLOCK_PPQ;
				if (phase === 0) beats++;
			} else if (m.type === 'start') {
				ticks = 0;
				phase = 0;
				beats = 0;
			}
		})
	);
</script>

<div class={cn('flex flex-col gap-5 rounded-xl border p-4', className)}>
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-1">
			<Button variant="ghost" size="icon" class="size-8" onclick={() => transport.rewind()}>
				<HugeiconsIcon icon={BackwardIcon} size={15} />
			</Button>
			<Button
				variant={transport.playing ? 'default' : 'outline'}
				size="icon"
				class="size-8"
				onclick={() => transport.toggle()}
			>
				<HugeiconsIcon icon={transport.playing ? StopIcon : PlayIcon} size={15} />
			</Button>
		</div>

		<div class="flex items-center gap-3">
			<span class="tnum font-mono text-lg text-readout">{transport.positionLabel}</span>
			<div class="w-40">
				<Slider type="single" bind:value={transport.bpm} min={40} max={220} step={0.5} />
			</div>
			<span class="tnum font-mono text-sm">{transport.bpm.toFixed(1)} BPM</span>
			<Button variant="outline" size="sm" class="h-7 text-xs" onclick={() => transport.tap()}>
				Tap
			</Button>
		</div>

		<div class="flex items-center gap-2">
			<Switch id="sendclock" bind:checked={transport.sendClock} />
			<Label for="sendclock" class="text-xs font-normal">Send MIDI Clock</Label>
		</div>
	</div>

	<!-- 24 ticks to the quarter note -->
	<div class="flex flex-col gap-2">
		<div class="flex items-baseline justify-between">
			<p class="text-[10px] tracking-wide text-muted-foreground uppercase">
				One quarter note = 24 clock ticks
			</p>
			<p class="tnum font-mono text-[11px] text-muted-foreground">
				{ticks} ticks · {beats} beats
			</p>
		</div>
		<div class="flex gap-[3px]">
			{#each Array.from({ length: CLOCK_PPQ }, (_, i) => i) as i (i)}
				<div
					class={cn(
						'h-5 flex-1 rounded-[2px] transition-colors duration-75',
						i === 0 ? 'ring-1 ring-msg-clock/40' : ''
					)}
					style:background={i === phase
						? 'var(--msg-clock)'
						: i < phase
							? 'color-mix(in oklch, var(--msg-clock) 25%, transparent)'
							: 'var(--muted)'}
				></div>
			{/each}
		</div>
		<p class="text-[11px] leading-relaxed text-muted-foreground">
			Each block is one <code class="rounded bg-muted px-1 font-mono">F8</code> byte. Twenty-four of them
			make a beat — that is the entire tempo mechanism. Change the BPM slider and the ticks simply arrive
			faster; no number describing the tempo is ever transmitted.
		</p>
	</div>

	<div class="flex flex-col gap-2">
		<div class="flex items-baseline justify-between">
			<p class="text-[10px] tracking-wide text-muted-foreground uppercase">
				Incoming clock stability
			</p>
			{#if transport.externalPresent}
				<p class="tnum font-mono text-[11px] text-msg-clock">
					external source: {transport.externalBpm.toFixed(2)} BPM ±{transport.externalJitter.toFixed(
						2
					)} ms
				</p>
			{/if}
		</div>
		<JitterPlot intervals={transport.clockIntervals} />
		<p class="text-[11px] leading-relaxed text-muted-foreground">
			This measures clock arriving <em>into</em> this page. Enable a hardware input in the dock and start
			your OP-XY, MPC or DAW — the plot shows how steady its clock actually is.
		</p>
	</div>
</div>
