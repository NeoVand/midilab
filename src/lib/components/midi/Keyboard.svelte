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
	import { channelColour } from '$lib/midi/channelcolour';
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

	/**
	 * Black-key geometry, taken from the real instrument rather than guessed.
	 *
	 * A white key is 23.5mm at the base and a black key 13.7mm, so the black
	 * key is 0.583 of a white one — not the 0.64 that looks about right and
	 * reads subtly wrong. And black keys are not centred on the boundary
	 * between white keys: the twelve chromatic keys are evenly spaced where
	 * they enter the action, which pushes each one off centre by a different
	 * amount. These are those offsets, in white-key widths.
	 */
	const BLACK_RATIO = 0.583;
	const NUDGE: Record<number, number> = { 1: -0.1, 3: 0.1, 6: -0.15, 8: 0, 10: 0.15 };

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

	/*
	 * Focus a key and press Enter or Space and it should sound. The A–' typing
	 * row is the fast way in, but a key you can Tab to and cannot play is a
	 * dead control, and a keyboard user should not have to know about the
	 * secret row to get a note out of the thing.
	 */
	const keyHeld = new Set<number>();

	function onKeyActivate(e: KeyboardEvent, note: number) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		if (e.repeat || keyHeld.has(note)) return;
		keyHeld.add(note);
		engine.noteOn(note, velocity ?? 96, ch);
		onNoteOn?.(note, velocity ?? 96);
	}

	function onKeyRelease(note: number) {
		if (!keyHeld.delete(note)) return;
		engine.noteOff(note, ch);
		onNoteOff?.(note);
	}

	/**
	 * The "show note numbers" preference from Settings. It is additive: the
	 * name still says what you are playing, the number says what the wire will
	 * carry, and an engineer usually wants both in front of them at once.
	 */
	const numbered = $derived(settings.showNoteNumbers && labels !== 'numbers');

	function labelFor(note: number): string {
		if (labels === 'none') return '';
		if (labels === 'numbers') return String(note);
		if (labels === 'c')
			return pitchClass(note) === 0
				? noteName(note, { convention: settings.octaveConvention })
				: '';
		return noteName(note, { convention: settings.octaveConvention });
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
				class="group relative flex-1 border-r border-black/12 transition-[filter] duration-75 last:border-r-0"
				style:background={active
					? `color-mix(in oklch, ${channelColour(owner ?? ch)} 52%, var(--key-white))`
					: 'linear-gradient(to bottom, color-mix(in oklch, var(--key-white) 92%, #000) 0%, var(--key-white) 8%, var(--key-white) 88%, color-mix(in oklch, var(--key-white) 88%, #000) 100%)'}
				style:box-shadow={active
					? 'inset 0 2px 5px rgba(0,0,0,.28), inset 0 -1px 0 rgba(0,0,0,.2)'
					: 'inset 0 -3px 0 rgba(0,0,0,.16), inset -1px 0 2px -1px rgba(0,0,0,.18)'}
				style:transform={active ? 'translateY(1px)' : 'none'}
				onpointerdown={(e) => onPointerDown(note, e)}
				onpointerenter={(e) => onPointerEnter(note, e)}
				onkeydown={(e) => onKeyActivate(e, note)}
				onkeyup={(e) => {
					if (e.key === 'Enter' || e.key === ' ') onKeyRelease(note);
				}}
				onblur={() => onKeyRelease(note)}
				aria-label={noteName(note, { convention: settings.octaveConvention })}
				aria-pressed={active}
			>
				<!--
					The velocity hint. Hovering a key shades it from top to bottom,
					which is the only way the "press lower to play harder" rule can
					teach itself — a sentence under the keybed never will.
				-->
				{#if velocity === null}
					<span
						class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
						style="background: linear-gradient(to bottom, transparent 12%, color-mix(in oklch, {channelColour(
							ch
						)} 26%, transparent) 100%)"
					></span>
				{/if}
				{#if labelFor(note) || numbered}
					<span
						class="pointer-events-none absolute inset-x-0 bottom-1.5 flex flex-col items-center gap-px font-mono text-2xs leading-none text-black/40"
					>
						{#if labelFor(note)}<span>{labelFor(note)}</span>{/if}
						{#if numbered}<span class="text-black/30">{note}</span>{/if}
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
				style="left: {centre - (w * BLACK_RATIO) / 2}%; width: {w * BLACK_RATIO}%; height: 63%;
					background: {active
					? channelColour(owner ?? ch)
					: 'linear-gradient(to bottom, color-mix(in oklch, var(--key-black) 82%, #fff) 0%, var(--key-black) 34%, var(--key-black) 100%)'};
					box-shadow: {active
					? 'inset 0 2px 5px rgba(0,0,0,.55)'
					: '0 3px 5px -1px rgba(0,0,0,.55), inset 0 -2px 0 rgba(255,255,255,.07)'};
					transform: {active ? 'translateY(1px)' : 'none'};"
				onpointerdown={(e) => onPointerDown(note, e)}
				onpointerenter={(e) => onPointerEnter(note, e)}
				onkeydown={(e) => onKeyActivate(e, note)}
				onkeyup={(e) => {
					if (e.key === 'Enter' || e.key === ' ') onKeyRelease(note);
				}}
				onblur={() => onKeyRelease(note)}
				aria-label={noteName(note, { convention: settings.octaveConvention })}
				aria-pressed={active}
			>
				{#if labels === 'all' || labels === 'numbers' || numbered}
					<span
						class="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center gap-px font-mono text-2xs leading-none text-white/55"
					>
						{#if labels === 'all'}
							<span>{noteName(note, { convention: settings.octaveConvention, octave: false })}</span
							>
						{/if}
						{#if numbered || labels === 'numbers'}<span class="text-white/40">{note}</span>{/if}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

{#if typing}
	<p class="mt-1.5 text-xs text-muted-foreground">
		Play with <kbd class="rounded-sm bg-muted px-1 font-mono">A</kbd>–<kbd
			class="rounded-sm bg-muted px-1 font-mono">'</kbd
		>, shift octave with <kbd class="rounded-sm bg-muted px-1 font-mono">Z</kbd> /
		<kbd class="rounded-sm bg-muted px-1 font-mono">X</kbd>. Press lower on a key for more velocity.
	</p>
{/if}
