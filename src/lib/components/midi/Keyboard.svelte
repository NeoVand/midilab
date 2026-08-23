<script lang="ts">
	/**
	 * A playable keyboard.
	 *
	 * Velocity comes from where on the key you press — near the top is gentle,
	 * near the front edge is hard — which is the closest a mouse gets to the real
	 * thing and makes velocity immediately legible rather than abstract.
	 * Multi-touch is handled per pointer id, so a trackpad or touchscreen plays
	 * chords. Notes arriving from anywhere else (your controller, the sequencer,
	 * a lesson's demo) light up in the sending channel's colour.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { isBlackKey, noteName, pitchClass } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { capturePointer, cn } from '$lib/utils';

	interface Props {
		/** Lowest note shown. Defaults to C two octaves below middle C. */
		low?: number;
		/** Number of octaves. */
		octaves?: number;
		channel?: number;
		/** Fixed velocity; when null, velocity comes from the vertical hit point. */
		velocity?: number | null;
		height?: number;
		labels?: 'none' | 'c' | 'all' | 'numbers';
		/** Type on the computer keyboard to play, Ableton-style. */
		typing?: boolean;
		/** Remap velocity before sending — the response curve in Lesson 3. */
		curve?: (v: number) => number;
		onNoteOn?: (note: number, velocity: number) => void;
		onNoteOff?: (note: number) => void;
		class?: string;
	}

	let {
		low = 48,
		octaves = 3,
		channel = $bindable(undefined),
		velocity = null,
		height = 132,
		labels = 'c',
		typing = true,
		curve,
		onNoteOn,
		onNoteOff,
		class: className
	}: Props = $props();

	const ch = $derived(channel ?? engine.channel);
	const high = $derived(low + octaves * 12);

	const whites = $derived.by(() => {
		const out: number[] = [];
		for (let n = low; n <= high; n++) if (!isBlackKey(n)) out.push(n);
		return out;
	});
	const blacks = $derived.by(() => {
		const out: number[] = [];
		for (let n = low; n <= high; n++) if (isBlackKey(n)) out.push(n);
		return out;
	});

	/** Fine positional nudges so the black keys sit where a real piano's do. */
	const NUDGE: Record<number, number> = { 1: -0.09, 3: 0.09, 6: -0.13, 8: 0, 10: 0.13 };

	function whiteIndexBelow(note: number): number {
		let count = 0;
		for (let n = low; n < note; n++) if (!isBlackKey(n)) count++;
		return count;
	}

	const held = new Map<number, number>(); // pointerId → note
	let down = $state(false);

	function velocityFrom(event: PointerEvent, el: HTMLElement): number {
		if (velocity !== null) return velocity;
		const r = el.getBoundingClientRect();
		const t = Math.min(1, Math.max(0, (event.clientY - r.top) / r.height));
		// A gentle curve: the top third stays soft, the bottom edge is a hammer.
		const raw = Math.max(1, Math.min(127, Math.round(24 + Math.pow(t, 0.85) * 103)));
		return curve ? Math.max(1, Math.min(127, Math.round(curve(raw)))) : raw;
	}

	function press(note: number, event: PointerEvent, el: HTMLElement) {
		const v = velocityFrom(event, el);
		engine.noteOn(note, v, ch);
		onNoteOn?.(note, v);
	}

	function release(note: number) {
		engine.noteOff(note, ch);
		onNoteOff?.(note);
	}

	function onPointerDown(note: number, event: PointerEvent) {
		const el = event.currentTarget as HTMLElement;
		capturePointer(el, event.pointerId);
		down = true;
		held.set(event.pointerId, note);
		press(note, event, el);
	}

	function onPointerEnter(note: number, event: PointerEvent) {
		if (!down || event.buttons === 0) return;
		const prev = held.get(event.pointerId);
		if (prev === note) return;
		if (prev !== undefined) release(prev);
		held.set(event.pointerId, note);
		press(note, event, event.currentTarget as HTMLElement);
	}

	function onPointerUp(event: PointerEvent) {
		const note = held.get(event.pointerId);
		if (note !== undefined) {
			release(note);
			held.delete(event.pointerId);
		}
		if (held.size === 0) down = false;
	}

	// ── computer keyboard ──────────────────────────────────────────────────
	const TYPE_MAP: Record<string, number> = {
		a: 0,
		w: 1,
		s: 2,
		e: 3,
		d: 4,
		f: 5,
		t: 6,
		g: 7,
		y: 8,
		h: 9,
		u: 10,
		j: 11,
		k: 12,
		o: 13,
		l: 14,
		p: 15,
		';': 16,
		"'": 17
	};
	let typingOctave = $state(0);
	const typed = new Set<string>();

	function onKeyDown(e: KeyboardEvent) {
		if (!typing || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
		const target = e.target as HTMLElement | null;
		if (target && /input|textarea|select/i.test(target.tagName)) return;
		if (e.key === 'z') return void (typingOctave = Math.max(-2, typingOctave - 1));
		if (e.key === 'x') return void (typingOctave = Math.min(2, typingOctave + 1));
		const offset = TYPE_MAP[e.key.toLowerCase()];
		if (offset === undefined) return;
		e.preventDefault();
		const note = low + 12 + typingOctave * 12 + offset;
		if (typed.has(e.key)) return;
		typed.add(e.key);
		engine.noteOn(note, velocity ?? 96, ch);
		onNoteOn?.(note, velocity ?? 96);
	}

	function onKeyUp(e: KeyboardEvent) {
		if (!typing) return;
		const offset = TYPE_MAP[e.key.toLowerCase()];
		if (offset === undefined) return;
		typed.delete(e.key);
		const note = low + 12 + typingOctave * 12 + offset;
		engine.noteOff(note, ch);
		onNoteOff?.(note);
	}

	function labelFor(note: number): string {
		if (labels === 'none') return '';
		if (labels === 'numbers') return String(note);
		if (labels === 'c')
			return pitchClass(note) === 0
				? noteName(note, { convention: settings.octaveConvention })
				: '';
		return noteName(note, { convention: settings.octaveConvention });
	}

	const CHANNEL_HUES = [150, 262, 318, 75, 197, 20, 220, 100, 285, 340, 45, 175, 240, 300, 60, 210];
	function channelColour(c: number): string {
		return `oklch(0.7 0.17 ${CHANNEL_HUES[c % 16]})`;
	}
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} onpointerup={onPointerUp} />

<div
	class={cn(
		'panel-sunken relative w-full touch-none overflow-hidden rounded-lg border select-none',
		className
	)}
	style="height: {height}px"
	role="application"
	aria-label="Musical keyboard"
>
	<!-- white keys -->
	<div class="absolute inset-0 flex">
		{#each whites as note (note)}
			{@const active = noteState.isHeld(note)}
			{@const owner = noteState.channelOf(note)}
			<button
				class="group relative flex-1 border-r border-b-[3px] border-black/15 first:rounded-bl-md last:rounded-br-md last:border-r-0"
				style:background={active
					? `color-mix(in oklch, ${channelColour(owner ?? ch)} 55%, var(--key-white))`
					: 'var(--key-white)'}
				style:box-shadow={active
					? 'inset 0 -2px 6px rgba(0,0,0,.18)'
					: 'inset 0 -6px 10px -8px rgba(0,0,0,.35)'}
				style:transform={active ? 'translateY(1px)' : 'none'}
				onpointerdown={(e) => onPointerDown(note, e)}
				onpointerenter={(e) => onPointerEnter(note, e)}
				aria-label={noteName(note, { convention: settings.octaveConvention })}
			>
				{#if labelFor(note)}
					<span
						class="pointer-events-none absolute inset-x-0 bottom-1.5 text-center font-mono text-[9px] text-black/45"
					>
						{labelFor(note)}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- black keys -->
	<div class="pointer-events-none absolute inset-0">
		{#each blacks as note (note)}
			{@const w = 100 / whites.length}
			{@const centre = (whiteIndexBelow(note) + NUDGE[pitchClass(note)]) * w}
			{@const active = noteState.isHeld(note)}
			{@const owner = noteState.channelOf(note)}
			<button
				class="pointer-events-auto absolute top-0 rounded-b-[3px]"
				style="left: {centre - w * 0.32}%; width: {w * 0.64}%; height: 62%;
					background: {active ? channelColour(owner ?? ch) : 'var(--key-black)'};
					box-shadow: {active ? 'inset 0 -2px 5px rgba(0,0,0,.4)' : '0 3px 4px -1px rgba(0,0,0,.5)'};
					transform: {active ? 'translateY(1px)' : 'none'};"
				onpointerdown={(e) => onPointerDown(note, e)}
				onpointerenter={(e) => onPointerEnter(note, e)}
				aria-label={noteName(note, { convention: settings.octaveConvention })}
			>
				{#if labels === 'all' || labels === 'numbers'}
					<span
						class="pointer-events-none absolute inset-x-0 bottom-1 text-center font-mono text-[8px] text-white/55"
					>
						{labels === 'numbers'
							? note
							: noteName(note, { convention: settings.octaveConvention, octave: false })}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

{#if typing}
	<p class="mt-1.5 text-[11px] text-muted-foreground">
		Play with <kbd class="rounded bg-muted px-1 font-mono">A</kbd>–<kbd
			class="rounded bg-muted px-1 font-mono">'</kbd
		>, shift octave with <kbd class="rounded bg-muted px-1 font-mono">Z</kbd> /
		<kbd class="rounded bg-muted px-1 font-mono">X</kbd>. Press lower on a key for more velocity.
	</p>
{/if}
