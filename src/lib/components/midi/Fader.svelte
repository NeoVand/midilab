<script lang="ts">
	import { capturePointer, cn } from '$lib/utils';
	import { device } from '$lib/stores/device.svelte';

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

	/**
	 * A phone gets the horizontal one, whatever the caller asked for.
	 *
	 * Vertical is the right shape on a mixer and on a desk: it is how the
	 * control is drawn on the hardware and it stacks beside its neighbours. On
	 * a phone it is a four-pixel column a hundred and twenty pixels tall,
	 * marooned at the left of a card with the rest of the width empty — hard to
	 * hit, and it reads as something that failed to load. Turned on its side it
	 * spans the card, which is both a bigger target and an obviously deliberate
	 * one.
	 */
	const lying = $derived(horizontal || device.narrow);

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
		const t = lying ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
		set(min + Math.max(0, Math.min(1, t)) * (max - min));
	}

	function onKeyDown(e: KeyboardEvent) {
		const step = e.shiftKey ? 1 : 4;
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + step);
		else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - step);
		else if (e.key === 'PageUp') set(value + 16);
		else if (e.key === 'PageDown') set(value - 16);
		else if (e.key === 'Home') set(min);
		else if (e.key === 'End') set(max);
		else return;
		e.preventDefault();
	}
</script>

<div
	class={cn('flex flex-col gap-1.5', lying ? 'w-full items-stretch' : 'items-center', className)}
>
	<div
		bind:this={el}
		role="slider"
		tabindex="0"
		aria-label={label ?? 'Fader'}
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-orientation={lying ? 'horizontal' : 'vertical'}
		class={cn(
			'panel-sunken relative touch-none rounded-md border select-none',
			lying ? 'h-4 w-full cursor-ew-resize' : 'w-4 cursor-ns-resize'
		)}
		style={lying ? '' : `height: ${height}px`}
		onpointerdown={(e) => {
			capturePointer(e.currentTarget as HTMLElement, e.pointerId);
			dragging = true;
			fromPointer(e);
		}}
		onpointermove={(e) => dragging && fromPointer(e)}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
		onkeydown={onKeyDown}
	>
		<div
			class="absolute rounded-xs transition-none"
			style={lying
				? `left:1px; top:1px; bottom:1px; width: calc(${norm * 100}% - 2px); background:${colour}`
				: `left:1px; right:1px; bottom:1px; height: calc(${norm * 100}% - 2px); background:${colour}`}
		></div>
		<div
			class="absolute rounded-sm border border-foreground/20 bg-card shadow-sm"
			style={lying
				? `left: calc(${norm * 100}% - 5px); top:-3px; bottom:-3px; width:10px`
				: `bottom: calc(${norm * 100}% - 5px); left:-3px; right:-3px; height:10px`}
		></div>
	</div>
	{#if label || sub}
		<div class={cn('flex leading-tight', lying ? 'items-baseline gap-2' : 'flex-col items-center')}>
			{#if label}<span class="text-xs font-medium">{label}</span>{/if}
			<span class="tnum font-mono text-2xs text-muted-foreground">{sub ?? value}</span>
		</div>
	{/if}
</div>
