<script lang="ts">
	/**
	 * How full the cable actually is.
	 *
	 * MIDI's rate on a DIN cable has not changed since 1983: 31,250 bits a
	 * second, ten bits a byte with the start and stop bits, so 320 microseconds
	 * per byte and 3,125 bytes a second — total. That number is the reason a
	 * dense controller sweep arrives late, why running status exists, and why a
	 * SysEx dump blocks everything behind it, and the course says all three in
	 * words. This says it as a fraction of a cable.
	 *
	 * It is a *hypothetical* cable, and the label says so: over USB or a
	 * network port none of this applies, and pretending otherwise would be
	 * teaching a limit the user is not actually hitting. What it measures is
	 * real — the bytes are counted as they pass — and the point is what those
	 * bytes would have cost on the wire the protocol was designed for.
	 */
	import { onMount } from 'svelte';
	import { bus } from '$lib/midi/bus';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	/** A DIN cable: 31,250 baud, ten bits to the byte. */
	const BYTES_PER_SECOND = 3125;
	/** The window the average is taken over. */
	const WINDOW_MS = 1000;

	let bytesPerSecond = $state(0);
	let peak = $state(0);

	onMount(() => {
		/** `[time, byteCount]` for the last second of traffic. */
		let recent: [number, number][] = [];
		const off = bus.subscribe((e) => {
			// Every byte on the wire counts, including the clock — which is the
			// whole point: twenty-four clock bytes a beat is a real cost.
			recent.push([e.time, e.bytes.length]);
		});

		let frame = 0;
		let decayFrom = 0;
		const tick = () => {
			frame = requestAnimationFrame(tick);
			const now = performance.now();
			const cutoff = now - WINDOW_MS;
			if (recent.length && recent[0][0] < cutoff) {
				recent = recent.filter(([t]) => t >= cutoff);
			}
			let total = 0;
			for (const [, n] of recent) total += n;
			bytesPerSecond = total;
			if (total >= peak) {
				peak = total;
				decayFrom = now;
			} else if (now - decayFrom > 2000) {
				// Hold the peak long enough to read, then let it fall back.
				peak = Math.max(total, peak * 0.98);
			}
		};
		frame = requestAnimationFrame(tick);

		return () => {
			off();
			cancelAnimationFrame(frame);
		};
	});

	const load = $derived(Math.min(1, bytesPerSecond / BYTES_PER_SECOND));
	const peakLoad = $derived(Math.min(1, peak / BYTES_PER_SECOND));
	/** Milliseconds a note message would wait behind one second of this. */
	const full = $derived(load >= 0.98);
</script>

<div class={cn('flex items-center gap-3', className)}>
	<span class="label shrink-0">DIN load</span>
	<div class="relative h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-muted">
		<div
			class={cn(
				'absolute inset-y-0 left-0 rounded-full transition-[width] duration-100',
				full ? 'bg-destructive' : load > 0.6 ? 'bg-warn' : 'bg-msg-note'
			)}
			style="width: {load * 100}%"
		></div>
		{#if peakLoad > 0.02}
			<!-- Where it got to, so a burst that has already passed still shows. -->
			<div
				class="absolute inset-y-0 w-px bg-foreground/60"
				style="left: {Math.min(99.5, peakLoad * 100)}%"
			></div>
		{/if}
	</div>
	<span class="tnum shrink-0 text-2xs text-muted-foreground">
		{Math.round(load * 100)}% · {bytesPerSecond} B/s
	</span>
</div>
