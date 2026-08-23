<script lang="ts">
	import { capturePointer, cn } from '$lib/utils';

	interface Props {
		x: number;
		y: number;
		xMin?: number;
		xMax?: number;
		yMin?: number;
		yMax?: number;
		xLabel?: string;
		yLabel?: string;
		springX?: boolean;
		springY?: boolean;
		height?: number;
		onChange?: (x: number, y: number) => void;
		class?: string;
	}
	let {
		x = $bindable(64),
		y = $bindable(64),
		xMin = 0,
		xMax = 127,
		yMin = 0,
		yMax = 127,
		xLabel = 'X',
		yLabel = 'Y',
		springX = false,
		springY = false,
		height = 160,
		onChange,
		class: className
	}: Props = $props();

	let el = $state<HTMLDivElement | null>(null);
	let dragging = $state(false);
	const nx = $derived((x - xMin) / (xMax - xMin));
	const ny = $derived((y - yMin) / (yMax - yMin));

	function fromPointer(e: PointerEvent) {
		if (!el) return;
		const r = el.getBoundingClientRect();
		const tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
		const ty = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
		x = Math.round(xMin + tx * (xMax - xMin));
		y = Math.round(yMin + ty * (yMax - yMin));
		onChange?.(x, y);
	}

	function release() {
		dragging = false;
		if (springX) x = Math.round((xMin + xMax) / 2);
		if (springY) y = yMin;
		if (springX || springY) onChange?.(x, y);
	}
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
	<div
		bind:this={el}
		role="application"
		aria-label="{xLabel} and {yLabel} pad"
		class="panel-sunken graph-paper relative touch-none rounded-lg border select-none"
		style="height: {height}px"
		onpointerdown={(e) => {
			capturePointer(e.currentTarget as HTMLElement, e.pointerId);
			dragging = true;
			fromPointer(e);
		}}
		onpointermove={(e) => dragging && fromPointer(e)}
		onpointerup={release}
		onpointercancel={release}
	>
		<div class="absolute inset-y-0 w-px bg-msg-expr/25" style="left: {nx * 100}%"></div>
		<div class="absolute inset-x-0 h-px bg-msg-cc/25" style="bottom: {ny * 100}%"></div>
		<div
			class="absolute size-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background shadow"
			style="left: {nx * 100}%; bottom: {ny *
				100}%; background: linear-gradient(135deg, var(--msg-expr), var(--msg-cc))"
		></div>
	</div>
	<div class="flex justify-between font-mono text-[10px] text-muted-foreground">
		<span><span class="text-msg-expr">{xLabel}</span> {x}</span>
		<span><span class="text-msg-cc">{yLabel}</span> {y}</span>
	</div>
</div>
