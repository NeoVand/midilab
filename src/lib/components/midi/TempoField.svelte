<script lang="ts">
	/**
	 * Tempo, behaving the way tempo behaves in every serious sequencer:
	 * drag it, type it, or tap it.
	 *
	 * A number you can only read is a readout; a number you can only click
	 * through a dialog to change is a form. Tempo is neither — it is a control
	 * you reach for mid-take, so all three gestures have to be there and none
	 * of them may need a mouse trip to a menu.
	 */
	import { transport } from '$lib/midi/clock.svelte';
	import { capturePointer, cn } from '$lib/utils';
	import { tick } from 'svelte';

	interface Props {
		/** Compact drops the BPM suffix, for the dock. */
		compact?: boolean;
		class?: string;
	}
	let { compact = false, class: className }: Props = $props();

	let editing = $state(false);
	let draft = $state('');
	let input = $state<HTMLInputElement | null>(null);
	let dragging = $state(false);
	let startY = 0;
	let startBpm = 0;

	function clamp(v: number): number {
		return Math.min(300, Math.max(20, Math.round(v * 10) / 10));
	}

	async function beginEdit() {
		draft = transport.bpm.toFixed(1);
		editing = true;
		await tick();
		input?.select();
	}

	function commit() {
		const v = Number.parseFloat(draft);
		if (Number.isFinite(v)) transport.bpm = clamp(v);
		editing = false;
	}

	function onPointerDown(e: PointerEvent) {
		if (editing) return;
		capturePointer(e.currentTarget as HTMLElement, e.pointerId);
		dragging = true;
		startY = e.clientY;
		startBpm = transport.bpm;
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		// Two pixels to the BPM, or twenty to the BPM with Shift held.
		const perPixel = e.shiftKey ? 0.05 : 0.5;
		transport.bpm = clamp(startBpm + (startY - e.clientY) * perPixel);
	}

	function onKeyDown(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.1 : 1;
		if (e.key === 'ArrowUp') transport.bpm = clamp(transport.bpm + step);
		else if (e.key === 'ArrowDown') transport.bpm = clamp(transport.bpm - step);
		else if (e.key === 'Enter' || e.key === ' ') beginEdit();
		else return;
		e.preventDefault();
	}
</script>

<div class={cn('flex items-baseline gap-1', className)}>
	{#if editing}
		<input
			bind:this={input}
			bind:value={draft}
			class="tnum w-14 rounded-sm border border-ring bg-background px-1 text-right font-mono text-sm outline-none"
			inputmode="decimal"
			onblur={commit}
			onkeydown={(e) => {
				if (e.key === 'Enter') commit();
				if (e.key === 'Escape') editing = false;
			}}
		/>
	{:else}
		<button
			class="tnum cursor-ns-resize rounded-sm px-0.5 font-mono text-sm tabular-nums hover:bg-accent"
			title="Drag to change · click to type · double-click to tap"
			aria-label="Tempo, {transport.bpm.toFixed(1)} beats per minute"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={() => (dragging = false)}
			onpointercancel={() => (dragging = false)}
			onclick={() => !dragging && beginEdit()}
			ondblclick={beginEdit}
			onkeydown={onKeyDown}
		>
			{transport.bpm.toFixed(1)}
		</button>
	{/if}
	{#if !compact}
		<span class="label">bpm</span>
	{/if}
	<button
		class="rounded-sm px-1 py-0.5 text-2xs text-muted-foreground uppercase hover:bg-accent hover:text-foreground"
		title="Tap four times in time"
		onclick={() => transport.tap()}
	>
		tap
	</button>
</div>
