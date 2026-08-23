<script lang="ts">
	/**
	 * Intervals between successive clock ticks, plotted.
	 *
	 * A perfect clock is a flat line. Real ones are not — and the spread, not the
	 * average, is what you hear as timing instability. Average tempo can be
	 * exactly right while every individual tick lands somewhere else.
	 */
	import { cn } from '$lib/utils';

	interface Props {
		intervals: readonly number[];
		height?: number;
		class?: string;
	}
	let { intervals, height = 80, class: className }: Props = $props();

	const stats = $derived.by(() => {
		const xs = intervals.slice(-96);
		if (xs.length < 2) return null;
		const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
		const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
		const min = Math.min(...xs);
		const max = Math.max(...xs);
		return { xs, mean, sd, min, max, spread: Math.max(max - mean, mean - min, 0.001) };
	});
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<div
		class="panel-sunken graph-paper relative overflow-hidden rounded-lg border"
		style="height: {stats ? height : Math.min(height, 56)}px"
	>
		{#if stats}
			<div class="absolute inset-x-0 top-1/2 h-px bg-msg-clock/40"></div>
			<div class="absolute inset-0 flex items-center gap-[1px] px-1">
				{#each stats.xs as v (v)}
					{@const dev = (v - stats.mean) / stats.spread}
					<div class="relative h-full flex-1">
						<div
							class="absolute left-0 w-full rounded-xs bg-msg-clock"
							style="height: {Math.max(1.5, Math.abs(dev) * 45)}%; {dev >= 0
								? `bottom: 50%`
								: `top: 50%`}; opacity: {0.4 + Math.min(1, Math.abs(dev)) * 0.6}"
						></div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="grid h-full place-items-center px-6 text-center text-xs text-muted-foreground">
				No clock arriving. Start one from a device into this page and its steadiness is drawn here.
			</p>
		{/if}
	</div>
	{#if stats}
		<div class="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
			<span>mean <span class="text-foreground">{stats.mean.toFixed(2)}</span> ms</span>
			<span>σ <span class="text-msg-clock">{stats.sd.toFixed(2)}</span> ms</span>
			<span>min {stats.min.toFixed(2)}</span>
			<span>max {stats.max.toFixed(2)}</span>
			<span>≈ {(60000 / (stats.mean * 24)).toFixed(2)} BPM</span>
		</div>
	{/if}
</div>
