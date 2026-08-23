<script lang="ts">
	/**
	 * Velocity pads. Defaults to the General MIDI kit on channel 10 — which is
	 * a *convention*, not a rule, and the labels say so by falling back to note
	 * names on any other channel.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { capturePointer, cn } from '$lib/utils';

	interface Props {
		/** Note numbers, laid out left-to-right, top-to-bottom. */
		notes?: number[];
		columns?: number;
		channel?: number;
		velocity?: number | null;
		colour?: string;
		onTrigger?: (note: number, velocity: number) => void;
		class?: string;
	}

	// The classic 4×4 laid out with the kick at bottom-left, MPC-style.
	const DEFAULT_NOTES = [48, 49, 50, 51, 44, 45, 46, 47, 40, 41, 42, 43, 36, 37, 38, 39];

	let {
		notes = DEFAULT_NOTES,
		columns = 4,
		channel = 9,
		velocity = null,
		colour = 'var(--msg-note)',
		onTrigger,
		class: className
	}: Props = $props();

	const held = new Map<number, number>();

	function label(note: number): string {
		if (channel === 9)
			return GM_DRUMS[note] ?? noteName(note, { convention: settings.octaveConvention });
		return noteName(note, { convention: settings.octaveConvention });
	}

	function hit(note: number, e: PointerEvent) {
		const el = e.currentTarget as HTMLElement;
		capturePointer(el, e.pointerId);
		const r = el.getBoundingClientRect();
		const v =
			velocity ??
			Math.max(1, Math.min(127, Math.round(30 + ((e.clientY - r.top) / r.height) * 97)));
		held.set(e.pointerId, note);
		engine.noteOn(note, v, channel);
		onTrigger?.(note, v);
	}

	function lift(e: PointerEvent) {
		const note = held.get(e.pointerId);
		if (note === undefined) return;
		engine.noteOff(note, channel);
		held.delete(e.pointerId);
	}

	/*
	 * A pad that only listens for pointerdown is a dead control for anyone
	 * driving the page from the keyboard: Enter and Space fire `click`, which
	 * nothing here was listening to. Held while the key is down, released when
	 * it comes up — the same shape as the pointer path, at a fixed velocity
	 * because a keyboard has no strike position.
	 */
	const keyHeld = new Set<number>();

	function keyDown(e: KeyboardEvent, note: number) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		if (e.repeat || keyHeld.has(note)) return;
		const v = velocity ?? 100;
		keyHeld.add(note);
		engine.noteOn(note, v, channel);
		onTrigger?.(note, v);
	}

	function keyUp(e: KeyboardEvent, note: number) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (!keyHeld.delete(note)) return;
		engine.noteOff(note, channel);
	}
</script>

<div
	class={cn('grid gap-1.5', className)}
	style="grid-template-columns: repeat({columns}, minmax(0, 1fr))"
>
	{#each notes as note (note)}
		{@const active = noteState.isHeld(note, channel)}
		{@const vel = noteState.velocityOf(note, channel)}
		<button
			class="panel-sunken relative flex aspect-square touch-none flex-col items-start justify-end gap-0.5 overflow-hidden rounded-lg border p-2 text-left transition-[background,transform] select-none active:translate-y-px"
			style:background={active
				? `color-mix(in oklch, ${colour} ${25 + (vel / 127) * 55}%, transparent)`
				: ''}
			style:border-color={active ? colour : ''}
			onpointerdown={(e) => hit(note, e)}
			onpointerup={lift}
			onpointercancel={lift}
			onkeydown={(e) => keyDown(e, note)}
			onkeyup={(e) => keyUp(e, note)}
			onblur={() => {
				if (keyHeld.delete(note)) engine.noteOff(note, channel);
			}}
			aria-label="{label(note)}, note {note}"
			aria-pressed={active}
		>
			<span class="absolute top-1.5 right-2 font-mono text-2xs text-muted-foreground">{note}</span>
			<span class="line-clamp-2 text-2xs leading-tight font-medium">{label(note)}</span>
		</button>
	{/each}
</div>
