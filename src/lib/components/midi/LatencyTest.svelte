<script lang="ts">
	/**
	 * Round-trip latency, measured rather than guessed.
	 *
	 * Connect a MIDI output back to a MIDI input — a physical loopback cable, or
	 * a virtual port such as macOS IAC or loopMIDI — and this sends a note and
	 * times how long it takes to come back. That figure is the true cost of
	 * getting a message out of the browser, through the interface, along the
	 * cable and back in.
	 */
	import { onMount } from 'svelte';
	import { bus } from '$lib/midi/bus';
	import { engine } from '$lib/midi/engine.svelte';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { StopWatchIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	const PROBE_NOTE = 126;
	const PROBE_CHANNEL = 15;

	let samples = $state<number[]>([]);
	let running = $state(false);
	let sentAt = 0;
	let remaining = 0;

	const stats = $derived.by(() => {
		if (samples.length === 0) return null;
		const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
		const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
		return { mean, sd, min: Math.min(...samples), max: Math.max(...samples), n: samples.length };
	});

	onMount(() =>
		bus.subscribe((e) => {
			if (!running || e.direction !== 'in') return;
			const m = e.message;
			if (m.type !== 'noteOn' || m.note !== PROBE_NOTE || m.channel !== PROBE_CHANNEL) return;
			samples = [...samples, e.time - sentAt].slice(-40);
			next();
		})
	);

	function next() {
		if (remaining <= 0) {
			running = false;
			return;
		}
		remaining--;
		setTimeout(() => {
			sentAt = performance.now();
			engine.send({ type: 'noteOn', channel: PROBE_CHANNEL, note: PROBE_NOTE, velocity: 1 });
			engine.send({ type: 'noteOff', channel: PROBE_CHANNEL, note: PROBE_NOTE, velocity: 0 });
		}, 90);
	}

	function start() {
		samples = [];
		remaining = 24;
		running = true;
		next();
		// If nothing ever comes back, do not spin forever.
		setTimeout(() => (running = false), 6000);
	}

	const ready = $derived(midiAccess.listening.length > 0 && engine.activeOutputs.length > 0);
</script>

<div class={cn('flex flex-col gap-4 rounded-xl border p-4', className)}>
	<div class="flex flex-wrap items-center gap-3">
		<Button size="sm" class="gap-1.5" onclick={start} disabled={running || !ready}>
			<HugeiconsIcon icon={StopWatchIcon} size={14} />
			{running ? 'Measuring…' : 'Measure round trip'}
		</Button>
		{#if !ready}
			<span class="text-xs text-muted-foreground">
				Enable a hardware output and an input in the dock first, then loop one back into the other.
			</span>
		{/if}
	</div>

	{#if stats}
		<div class="flex flex-wrap gap-x-8 gap-y-2">
			<div>
				<p class="text-[10px] tracking-wide text-muted-foreground uppercase">Mean round trip</p>
				<p class="tnum font-mono text-3xl leading-none text-readout">
					{stats.mean.toFixed(2)}<span class="text-base"> ms</span>
				</p>
			</div>
			<div>
				<p class="text-[10px] tracking-wide text-muted-foreground uppercase">Jitter (σ)</p>
				<p class="tnum font-mono text-3xl leading-none">
					{stats.sd.toFixed(2)}<span class="text-base"> ms</span>
				</p>
			</div>
			<div>
				<p class="text-[10px] tracking-wide text-muted-foreground uppercase">Range</p>
				<p class="tnum font-mono text-lg leading-none">
					{stats.min.toFixed(1)} – {stats.max.toFixed(1)} ms
				</p>
				<p class="mt-1 font-mono text-[10px] text-muted-foreground">{stats.n} samples</p>
			</div>
		</div>

		<div class="panel-sunken flex h-16 items-end gap-[3px] rounded-lg border p-2">
			{#each samples as s (s)}
				<div
					class="min-w-[3px] flex-1 rounded-[1px] bg-msg-clock"
					style="height: {Math.min(100, (s / Math.max(1, stats.max)) * 100)}%"
				></div>
			{/each}
		</div>

		<p class="text-xs leading-relaxed text-muted-foreground">
			The mean is <strong>latency</strong> — a constant delay, which you can compensate for by
			playing or scheduling that much earlier. The spread is <strong>jitter</strong>, and you cannot
			compensate for it, because it is different every time. A tight rig has a σ under a millisecond
			or two.
		</p>
	{:else if !running}
		<p class="text-xs leading-relaxed text-muted-foreground">
			No measurement yet. This needs a loop: connect a MIDI Out back to a MIDI In physically, or
			create a virtual port (IAC Driver on macOS, loopMIDI on Windows) and enable both ends in the
			dock.
		</p>
	{/if}
</div>
