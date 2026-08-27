<script lang="ts">
	/**
	 * A knob with inertia-free, predictable drag: vertical movement changes the
	 * value, Shift makes it fine, double-click returns to the default. It can run
	 * in 7-bit mode (0–127, the MIDI default) or 14-bit mode, which is how you
	 * hear the stepping problem rather than being told about it.
	 */
	import { capturePointer, cn } from '$lib/utils';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		/** Value restored by double-click. */
		default?: number;
		label?: string;
		/** Text under the value, e.g. "CC 74". */
		sub?: string;
		size?: number;
		/**
		 * Footprint of the whole cell, caption included.
		 *
		 * The caption is the widest part of a knob and it changes as you turn
		 * it — "CC 74 · 64" becomes "CC 74 · 127" — so a cell sized to its
		 * contents grows by a character mid-drag and shunts every knob to its
		 * right along with it. Fixing the width costs nothing and stops the
		 * row moving under the hand that is using it. Widen it at the call
		 * site when the caption is genuinely long.
		 */
		width?: number;
		/**
		 * Let the container decide the width instead of the knob.
		 *
		 * The fixed cell exists so a caption cannot shove its neighbours around
		 * mid-drag. Inside a grid that is the grid's job already, and a fixed cell
		 * narrower than the column leaves a bank of knobs adrift in the middle of
		 * the row with all the air pooled at one end.
		 *
		 * This used to say `w-full`, which is correct in a grid cell and a
		 * disaster in a flex row: 100% of the container is the whole row, so
		 * every knob claimed the full width and wrapped, and a bank of four
		 * controls silently became four centred knobs stacked down the page with
		 * a screenful of air around them. `flex-1` shares a flex row and is inert
		 * in a grid, where the cell stretches its child anyway.
		 */
		fill?: boolean;
		colour?: string;
		/** Show the raw integer instead of a formatted unit. */
		format?: (v: number) => string;
		bipolar?: boolean;
		/**
		 * Replaces the drag hint in the tooltip. For when there is something
		 * more useful to say about this control than how to turn it — such as
		 * that the thing at the other end has nowhere to put its value.
		 */
		hint?: string;
		disabled?: boolean;
		onChange?: (v: number) => void;
		class?: string;
	}

	let {
		value = $bindable(0),
		min = 0,
		max = 127,
		default: dflt,
		label,
		sub,
		size = 52,
		width,
		fill = false,
		colour = 'var(--msg-cc)',
		format,
		bipolar = false,
		hint,
		disabled = false,
		onChange,
		class: className
	}: Props = $props();

	const ARC = 270; // degrees of travel
	const START = -135;

	const norm = $derived((value - min) / (max - min));
	const angle = $derived(START + norm * ARC);

	let dragging = $state(false);
	let startY = 0;
	let startValue = 0;

	function set(v: number) {
		const clamped = Math.max(min, Math.min(max, Math.round(v)));
		if (clamped === value) return;
		value = clamped;
		onChange?.(clamped);
	}

	function onPointerDown(e: PointerEvent) {
		if (disabled) return;
		capturePointer(e.currentTarget as HTMLElement, e.pointerId);
		dragging = true;
		startY = e.clientY;
		startValue = value;
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const range = max - min;
		// 180 px of travel spans the range; Shift slows it to a quarter.
		const scale = (e.shiftKey ? 0.25 : 1) * (range / 180);
		set(startValue + (startY - e.clientY) * scale);
	}

	function onPointerUp(e: PointerEvent) {
		dragging = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
	}

	/**
	 * Only while focused. On the web the wheel is how you move down the page,
	 * and a knob that eats it is a knob that silently retunes itself every time
	 * you scroll past. Click it first and the gesture is yours.
	 */
	function onWheel(e: WheelEvent) {
		if (disabled || document.activeElement !== e.currentTarget) return;
		e.preventDefault();
		set(value + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 1 : coarse));
	}

	const coarse = $derived(Math.max(1, (max - min) / 64));

	function onKeyDown(e: KeyboardEvent) {
		if (disabled) return;
		const step = e.shiftKey ? 1 : coarse;
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + step);
		else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - step);
		else if (e.key === 'PageUp') set(value + coarse * 8);
		else if (e.key === 'PageDown') set(value - coarse * 8);
		else if (e.key === 'Home') set(min);
		else if (e.key === 'End') set(max);
		else if ((e.key === 'Enter' || e.key === ' ') && dflt !== undefined) set(dflt);
		else return;
		e.preventDefault();
	}

	const r = $derived(size / 2 - 4);
	const c = $derived(size / 2);

	function polar(deg: number, radius: number) {
		const rad = ((deg - 90) * Math.PI) / 180;
		return { x: c + radius * Math.cos(rad), y: c + radius * Math.sin(rad) };
	}

	function arcPath(from: number, to: number, radius: number): string {
		const a = polar(from, radius);
		const b = polar(to, radius);
		const large = Math.abs(to - from) > 180 ? 1 : 0;
		const sweep = to > from ? 1 : 0;
		return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} ${sweep} ${b.x} ${b.y}`;
	}

	const cell = $derived(fill ? null : (width ?? Math.max(size, 76)));
	const fillFrom = $derived(bipolar ? START + ARC / 2 : START);
	const display = $derived(format ? format(value) : String(value));
</script>

<div
	class={cn('flex flex-col items-center gap-1', fill ? 'min-w-0 flex-1' : 'shrink-0', className)}
	style={cell === null ? undefined : `width: ${cell}px`}
>
	<div
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label={label ?? 'Knob'}
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuetext={format ? display : undefined}
		aria-orientation="vertical"
		aria-disabled={disabled || undefined}
		title={hint ??
			(dflt !== undefined
				? 'Drag to change · Shift for fine · double-click to reset'
				: 'Drag to change · Shift for fine')}
		class={cn(
			'relative cursor-ns-resize touch-none select-none',
			disabled && 'cursor-not-allowed opacity-50'
		)}
		style="width: {size}px; height: {size}px"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		ondblclick={() => dflt !== undefined && set(dflt)}
		onwheel={onWheel}
		onkeydown={onKeyDown}
	>
		<svg width={size} height={size} class="overflow-visible">
			<path
				d={arcPath(START, START + ARC, r)}
				fill="none"
				stroke="var(--grid-line-strong)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{#if Math.abs(angle - fillFrom) > 0.5}
				<path
					d={arcPath(fillFrom, angle, r)}
					fill="none"
					stroke={colour}
					stroke-width="3"
					stroke-linecap="round"
				/>
			{/if}
			<circle cx={c} cy={c} r={r - 5} class="fill-card stroke-border" stroke-width="1" />
			<line
				x1={polar(angle, r - 15).x}
				y1={polar(angle, r - 15).y}
				x2={polar(angle, r - 6).x}
				y2={polar(angle, r - 6).y}
				stroke={colour}
				stroke-width="2.5"
				stroke-linecap="round"
			/>
		</svg>
		{#if dragging}
			<span
				class="tnum pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md border bg-popover px-1.5 py-0.5 font-mono text-xs text-popover-foreground shadow-sm"
			>
				{display}
			</span>
		{/if}
	</div>
	{#if label || sub}
		<div class="flex w-full min-w-0 flex-col items-center leading-tight">
			{#if label}
				<span class="w-full truncate text-center text-xs font-medium" title={label}>{label}</span>
			{/if}
			<span
				class="tnum w-full truncate text-center font-mono text-2xs text-muted-foreground"
				title={sub ?? display}
			>
				{sub ?? display}
			</span>
		</div>
	{/if}
</div>
