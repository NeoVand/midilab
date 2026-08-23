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
	import { rovingGrid } from '$lib/a11y/roving';
	import { momentary } from '$lib/a11y/momentary';
	import { device } from '$lib/stores/device.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

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

	/*
	 * Z and X scroll the keybed, and the letters stay where they are.
	 *
	 * They used to change only which notes the A–' row sent. Nothing moved, so
	 * the sole evidence the shortcut had worked was a different pitch — and
	 * once the row had passed the end of the drawn keys, the key you played did
	 * not even light.
	 *
	 * So more keys are drawn than fit, and the strip slides. The letters are
	 * painted on the notes the typing row currently plays, which means that as
	 * the strip moves an octave the letters hold their place on screen while
	 * the piano runs underneath them — which is exactly the thing that changed.
	 */
	const MAX_SHIFT = 2;
	const stripLow = $derived(Math.max(0, low - MAX_SHIFT * 12));
	const stripHigh = $derived(Math.min(127, low + octaves * 12 + MAX_SHIFT * 12));

	/**
	 * How many octaves are actually on screen, which is not the same question
	 * as how many the caller asked for.
	 *
	 * `octaves` describes the instrument — the span you can reach without
	 * moving. What fits in front of you is a matter of arithmetic: three
	 * octaves across a phone is a white key 10 pixels wide, and a fingertip is
	 * about nine millimetres, so a key you can hit is one you can see. The
	 * window narrows until the keys are wide enough and the rest of the range
	 * stays where it was, one octave button away.
	 *
	 * A piano key is a tall thin target rather than a square one, so it does
	 * not need the full 44: the hard direction is horizontal, and 34 is what
	 * a phone piano that people actually play uses.
	 */
	const MIN_WHITE = 34;
	let bedWidth = $state(0);
	const view = $derived.by(() => {
		if (!device.coarse || bedWidth === 0) return octaves;
		for (let o = octaves; o > 1; o--) if (bedWidth / (o * 7 + 1) >= MIN_WHITE) return o;
		return 1;
	});

	/** How far the octave controls can go before the strip runs out either side. */
	const shiftDown = $derived(Math.floor((low - stripLow) / 12));
	const shiftUp = $derived(Math.floor((stripHigh - view * 12 - low) / 12));

	let shift = $state(0);
	// Narrowing the window can strand the view past the end of the strip.
	$effect(() => {
		if (shift > shiftUp) shift = shiftUp;
		if (shift < -shiftDown) shift = -shiftDown;
	});
	const viewLow = $derived(low + shift * 12);
	const high = $derived(viewLow + view * 12);

	const whites = $derived.by(() => {
		const out: number[] = [];
		for (let n = stripLow; n <= stripHigh; n++) if (!isBlackKey(n)) out.push(n);
		return out;
	});
	const blacks = $derived.by(() => {
		const out: number[] = [];
		for (let n = stripLow; n <= stripHigh; n++) if (isBlackKey(n)) out.push(n);
		return out;
	});

	/**
	 * White keys in the window. Constant as the strip scrolls, because a shift
	 * is a whole octave and an octave is seven of them.
	 */
	const windowWhites = $derived.by(() => {
		let n = 0;
		for (let x = low; x <= low + view * 12; x++) if (!isBlackKey(x)) n++;
		return n;
	});
	/** The strip is this much wider than what you can see. */
	const stripPct = $derived((whites.length / windowWhites) * 100);
	/** And slid this far left, as a fraction of its own width. */
	const offsetPct = $derived(-(whites.findIndex((n) => n >= viewLow) / whites.length) * 100);

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
		for (let n = stripLow; n < note; n++) if (!isBlackKey(n)) count++;
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
	/**
	 * The reverse of the map above: which key cap to print on each note of the
	 * typing row, so you can see where your hands go without being told.
	 */
	const TYPE_CAP: Record<number, string> = Object.fromEntries(
		Object.entries(TYPE_MAP).map(([k, offset]) => [offset, k.toUpperCase()])
	);
	/** Below this the keys are too short to print on without crowding them. */
	const CAP_MIN_HEIGHT = 108;
	const showCaps = $derived(typing && !device.coarse && height >= CAP_MIN_HEIGHT);

	function capFor(note: number): string {
		return showCaps ? (TYPE_CAP[note - (viewLow + 12)] ?? '') : '';
	}

	/*
	 * Which note each held computer key actually started.
	 *
	 * Not recomputed on release: shifting the octave while a key is down would
	 * otherwise send the Note Off to a note an octave away and leave the real
	 * one sounding forever. A note is released by the number it was started
	 * with, which is the same rule the pointer path follows.
	 */
	const typed = new Map<string, number>();

	function onKeyDown(e: KeyboardEvent) {
		if (!typing || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
		const target = e.target as HTMLElement | null;
		if (target && /input|textarea|select/i.test(target.tagName)) return;
		if (e.key === 'z') return void (shift = Math.max(-shiftDown, shift - 1));
		if (e.key === 'x') return void (shift = Math.min(shiftUp, shift + 1));
		const offset = TYPE_MAP[e.key.toLowerCase()];
		if (offset === undefined) return;
		e.preventDefault();
		if (typed.has(e.key)) return;
		const note = viewLow + 12 + offset;
		typed.set(e.key, note);
		engine.noteOn(note, velocity ?? 96, ch);
		onNoteOn?.(note, velocity ?? 96);
	}

	function onKeyUp(e: KeyboardEvent) {
		if (!typing) return;
		const note = typed.get(e.key);
		if (note === undefined) return;
		typed.delete(e.key);
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
	bind:clientWidth={bedWidth}
	class={cn(
		'panel-sunken relative w-full touch-none overflow-hidden rounded-lg border select-none',
		className
	)}
	style="height: {height}px"
	role="application"
	aria-label="Musical keyboard"
	use:rovingGrid={{
		columns: 12,
		order: 'visual',
		items: 'button[data-playable]',
		revision: viewLow
	}}
>
	<!--
		The strip. Wider than the box it sits in, and slid so the window lands on
		the octave you are playing. Transitioning the transform rather than
		swapping the keys is what makes it read as one keyboard moving instead of
		two keyboards trading places — and `reduce-motion` already flattens the
		duration for anyone who has asked for that.
	-->
	<div
		class="absolute inset-y-0 left-0 transition-transform duration-300 ease-out"
		style="width: {stripPct}%; transform: translateX({offsetPct}%)"
	>
		<!-- white keys -->
		<div class="absolute inset-0 flex">
			{#each whites as note (note)}
				{@const active = noteState.isHeld(note)}
				{@const owner = noteState.channelOf(note)}
				{@const cap = capFor(note)}
				<button
					use:momentary
					tabindex="-1"
					data-playable={note >= viewLow && note <= high ? '' : undefined}
					class="group focus-key-white relative flex-1 border-r border-black/12 transition-[filter] duration-75 last:border-r-0"
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
					<!--
					The computer key that plays this note. Quiet enough to read past
					when you are using the mouse, present enough to find your hands
					by when you are not.
				-->
					{#if cap}
						<span
							class="pointer-events-none absolute inset-x-0 bottom-7 text-center font-mono text-2xs leading-none text-black/30"
						>
							{cap}
						</span>
					{/if}
					{#if labelFor(note) || numbered}
						<span
							class="pointer-events-none absolute inset-x-0 bottom-1.5 flex flex-col items-center gap-px font-mono text-2xs leading-none text-black/70"
						>
							<!-- Black at 55% on an ivory key is 4.4:1 at 10px — just under the
						     line, and these labels are the only thing telling you which C
						     you are looking at. The black keys' white labels already pass. -->
							{#if labelFor(note)}<span>{labelFor(note)}</span>{/if}
							{#if numbered}<span class="text-black/60">{note}</span>{/if}
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
				{@const cap = capFor(note)}
				<button
					use:momentary
					tabindex="-1"
					data-playable={note >= viewLow && note <= high ? '' : undefined}
					class="focus-key-black pointer-events-auto absolute top-0 rounded-b-[3px]"
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
					{#if cap}
						<span
							class="pointer-events-none absolute inset-x-0 bottom-1.5 text-center font-mono text-2xs leading-none text-white/35"
						>
							{cap}
						</span>
					{/if}
					{#if labels === 'all' || labels === 'numbers' || numbered}
						<span
							class="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-px font-mono text-2xs leading-none text-white/70"
							class:bottom-1={!cap}
							class:bottom-6={!!cap}
						>
							{#if labels === 'all'}
								<span
									>{noteName(note, { convention: settings.octaveConvention, octave: false })}</span
								>
							{/if}
							{#if numbered || labels === 'numbers'}<span class="text-white/55">{note}</span>{/if}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>

<!--
	Two ways of saying the same thing, to two different readers.
	
	At a desk the octave moves with Z and X and the caption says so. A finger
	has no Z and no X, and cannot be told to swipe either — a swipe across a
	keybed is a glissando, and the instrument has to believe you meant it. So
	on a touch screen the shift becomes what it always is on hardware: two
	buttons, either side of the range they move.
-->
{#if device.coarse}
	<div class="mt-1.5 flex items-center gap-2">
		<button
			type="button"
			onclick={() => (shift = Math.max(-shiftDown, shift - 1))}
			disabled={shift <= -shiftDown}
			use:momentary
			class="grid size-11 shrink-0 place-items-center rounded-md border text-muted-foreground transition-colors active:bg-accent disabled:opacity-30"
			aria-label="Down an octave"
		>
			<HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={2} />
		</button>
		<p class="tnum min-w-0 flex-1 text-center font-mono text-xs text-muted-foreground">
			{noteName(viewLow, { convention: settings.octaveConvention })} – {noteName(high, {
				convention: settings.octaveConvention
			})}
		</p>
		<button
			type="button"
			onclick={() => (shift = Math.min(shiftUp, shift + 1))}
			disabled={shift >= shiftUp}
			use:momentary
			class="grid size-11 shrink-0 place-items-center rounded-md border text-muted-foreground transition-colors active:bg-accent disabled:opacity-30"
			aria-label="Up an octave"
		>
			<HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2} />
		</button>
	</div>
{:else if typing}
	<p class="mt-1.5 text-xs text-muted-foreground">
		Play with <kbd class="rounded-sm bg-muted px-1 font-mono">A</kbd>–<kbd
			class="rounded-sm bg-muted px-1 font-mono">'</kbd
		>, shift octave with <kbd class="rounded-sm bg-muted px-1 font-mono">Z</kbd> /
		<kbd class="rounded-sm bg-muted px-1 font-mono">X</kbd>. Press lower on a key for more velocity.
		{#if shift !== 0}
			<span class="tnum text-foreground">
				Shifted {shift > 0 ? '+' : '−'}{Math.abs(shift)} octave{Math.abs(shift) === 1 ? '' : 's'}.
			</span>
		{/if}
	</p>
{/if}
