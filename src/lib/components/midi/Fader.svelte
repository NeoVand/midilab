<script lang="ts">
	import { capturePointer, cn } from '$lib/utils';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		label?: string;
		sub?: string;
		height?: number;
		colour?: string;
		horizontal?: boolean;
		onChange?: (v: number) => void;
		class?: string;
	}
	let {
		value = $bindable(0),
		min = 0,
		max = 127,
		label,
		sub,
		height = 120,
		colour = 'var(--msg-cc)',
		horizontal = false,
		onChange,
		class: className
	}: Props = $props();

	const norm = $derived((value - min) / (max - min));
	let el = $state<HTMLDivElement | null>(null);
	let dragging = $state(false);

	function set(v: number) {
		const c = Math.max(min, Math.min(max, Math.round(v)));
		if (c === value) return;
		value = c;
		onChange?.(c);
	}

	function fromPointer(e: PointerEvent) {
		if (!el) return;
		const r = el.getBoundingClientRect();
		const t = horizontal ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
		set(min + Math.max(0, Math.min(1, t)) * (max - min));
	}
</script>

<div class={cn('flex flex-col items-center gap-1.5', className)}>
	<div
		bind:this={el}
		role="slider"
		tabindex="0"
		aria-label={label ?? 'Fader'}
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
		class={cn(
			'panel-sunken relative touch-none rounded-md border select-none',
			horizontal ? 'h-4 w-full cursor-ew-resize' : 'w-4 cursor-ns-resize'
		)}
		style={horizontal ? '' : `height: ${height}px`}
		onpointerdown={(e) => {
			capturePointer(e.currentTarget as HTMLElement, e.pointerId);
			dragging = true;
			fromPointer(e);
		}}
		onpointermove={(e) => dragging && fromPointer(e)}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
		onkeydown={(e) => {
			const step = e.shiftKey ? 1 : 4;
			if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + step);
			else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - step);
			else return;
			e.preventDefault();
		}}
	>
		<div
			class="absolute rounded-[3px] transition-none"
			style={horizontal
				? `left:1px; top:1px; bottom:1px; width: calc(${norm * 100}% - 2px); background:${colour}`
				: `left:1px; right:1px; bottom:1px; height: calc(${norm * 100}% - 2px); background:${colour}`}
		></div>
		<div
			class="absolute rounded-sm border border-foreground/20 bg-card shadow-sm"
			style={horizontal
				? `left: calc(${norm * 100}% - 5px); top:-3px; bottom:-3px; width:10px`
				: `bottom: calc(${norm * 100}% - 5px); left:-3px; right:-3px; height:10px`}
		></div>
	</div>
	{#if label || sub}
		<div class="flex flex-col items-center leading-tight">
			{#if label}<span class="text-[11px] font-medium">{label}</span>{/if}
			<span class="tnum font-mono text-[10px] text-muted-foreground">{sub ?? value}</span>
		</div>
	{/if}
</div>
