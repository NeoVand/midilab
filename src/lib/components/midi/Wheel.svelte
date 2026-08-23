<script lang="ts">
	/**
	 * A performance wheel. Pitch bend springs back to centre when released —
	 * the mod wheel does not, which is the whole difference between them.
	 */
	import { capturePointer, cn } from '$lib/utils';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		centre?: number;
		/** Snap back to `centre` on release, like a real pitch wheel. */
		spring?: boolean;
		label?: string;
		height?: number;
		colour?: string;
		format?: (v: number) => string;
		onChange?: (v: number) => void;
		class?: string;
	}
	let {
		value = $bindable(0),
		min = 0,
		max = 127,
		centre = 0,
		spring = false,
		label,
		height = 120,
		colour = 'var(--msg-expr)',
		format,
		onChange,
		class: className
	}: Props = $props();

	const norm = $derived((value - min) / (max - min));
	let el = $state<HTMLDivElement | null>(null);
	let dragging = $state(false);
	let raf = 0;

	function set(v: number) {
		const c = Math.max(min, Math.min(max, Math.round(v)));
		if (c === value) return;
		value = c;
		onChange?.(c);
	}

	function fromPointer(e: PointerEvent) {
		if (!el) return;
		const r = el.getBoundingClientRect();
		set(min + Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) * (max - min));
	}

	function release() {
		dragging = false;
		if (!spring) return;
		cancelAnimationFrame(raf);
		const step = () => {
			const delta = centre - value;
			if (Math.abs(delta) < 1) {
				set(centre);
				return;
			}
			set(value + delta * 0.35);
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}
</script>

<div class={cn('flex flex-col items-center gap-1.5', className)}>
	<div
		bind:this={el}
		role="slider"
		tabindex="0"
		aria-label={label ?? 'Wheel'}
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
		class="panel-sunken relative w-9 cursor-ns-resize touch-none overflow-hidden rounded-lg border select-none"
		style="height: {height}px"
		onpointerdown={(e) => {
			capturePointer(e.currentTarget as HTMLElement, e.pointerId);
			cancelAnimationFrame(raf);
			dragging = true;
			fromPointer(e);
		}}
		onpointermove={(e) => dragging && fromPointer(e)}
		onpointerup={release}
		onpointercancel={release}
	>
		<!-- centre detent -->
		{#if spring}
			<div class="absolute inset-x-1 top-1/2 h-px bg-border"></div>
		{/if}
		<div
			class="absolute inset-x-0 rounded-md border-y shadow-md transition-none"
			style="height: 26px; bottom: calc({norm *
				100}% - 13px); background: {colour}; border-color: rgba(0,0,0,.25)"
		>
			<div class="absolute inset-x-1.5 top-1/2 h-px -translate-y-1/2 bg-black/25"></div>
		</div>
	</div>
	{#if label}
		<div class="flex flex-col items-center leading-tight">
			<span class="text-xs font-medium">{label}</span>
			<span class="tnum font-mono text-2xs text-muted-foreground">
				{format ? format(value) : value}
			</span>
		</div>
	{/if}
</div>
