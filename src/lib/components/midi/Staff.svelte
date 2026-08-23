<script lang="ts">
	/**
	 * What you are playing, engraved.
	 *
	 * The clefs, noteheads, accidentals and ledger lines here are VexFlow's,
	 * using the Bravura music font — the same engraving conventions every
	 * printed score follows. An earlier version of this drew its own clefs from
	 * Bézier curves, which is the sort of thing that looks fine to whoever drew
	 * it and wrong to everyone who reads music.
	 *
	 * The one thing that is ours: a MIDI note number does not know how it is
	 * spelled. 61 is a C sharp or a D flat depending on the music, and the
	 * protocol has no opinion, so the caller picks.
	 */
	import { onMount, untrack } from 'svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { channelColour } from '$lib/midi/channelcolour';
	import { spellNotes, vexKey } from '$lib/midi/harmony';
	import { cn } from '$lib/utils';

	interface Props {
		/** Explicit notes to draw. Defaults to whatever is sounding right now. */
		notes?: number[];
		/** Spell black keys as flats rather than sharps. */
		flats?: boolean;
		class?: string;
	}
	let { notes, flats = false, class: className }: Props = $props();

	const WIDTH = 166;
	/** Line spacing, and from it the whole thing's height. */
	const SPACING = 8;
	/** Room for ledger lines, and for the clefs, which overshoot their staff. */
	const ABOVE = 3.4;
	const BELOW = 3.4;
	const HEIGHT = SPACING * (4 + ABOVE + BELOW);

	/**
	 * One staff, and the clef that costs the fewest ledger lines.
	 *
	 * A grand staff is what a pianist reads, but it is twice the height for
	 * something that is showing at most a handful of notes at once — and beside
	 * the analyser, height is the scarce thing. So: one staff, and the clef
	 * chosen the way a copyist would choose it, by which one keeps the notes
	 * nearest their lines. Treble sits around B4, bass around D3.
	 */
	const clef = $derived.by(() => {
		if (!held.length) return 'treble';
		const cost = (centre: number) => held.reduce((a, n) => a + Math.abs(n - centre), 0);
		return cost(71) <= cost(50) ? 'treble' : 'bass';
	});

	const held = $derived.by(() => {
		if (notes) return [...notes].sort((a, b) => a - b);
		void noteState.version;
		const out: number[] = [];
		for (let n = 0; n < 128; n++) if (noteState.isHeld(n)) out.push(n);
		return out;
	});

	let host = $state<HTMLDivElement | null>(null);
	/** Nothing renders until the library has arrived; it is loaded on demand. */
	let vex = $state<typeof import('vexflow/bravura') | null>(null);

	onMount(() => {
		void import('vexflow/bravura').then((m) => (vex = m));
		/*
		 * The colours are read out of the computed style, so a theme change has
		 * to redraw — otherwise the staff keeps yesterday's ink until the next
		 * note happens to arrive. Nothing announces a theme change, so watch.
		 */
		const watch = new MutationObserver(() => themeTick++);
		watch.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'style', 'data-theme']
		});
		return () => watch.disconnect();
	});

	let themeTick = $state(0);

	function draw() {
		const V = vex;
		const el = host;
		if (!V || !el) return;
		el.replaceChildren();

		const cs = getComputedStyle(el);
		const rule = cs.getPropertyValue('--staff-line').trim() || cs.color;
		const ink = cs.getPropertyValue('--foreground').trim() || cs.color;

		const renderer = new V.Renderer(el, V.Renderer.Backends.SVG);
		renderer.resize(WIDTH, HEIGHT);
		const ctx = renderer.getContext();

		const stave = new V.Stave(1, 0, WIDTH - 2, {
			spacingBetweenLinesPx: SPACING,
			spaceAboveStaffLn: ABOVE,
			spaceBelowStaffLn: BELOW
		}).addClef(clef);

		// The staff lines are structure and sit back at rule weight; the clef
		// is read, so it takes the context's ink.
		stave.setStyle({ strokeStyle: rule, fillStyle: rule });
		ctx.setFillStyle(ink);
		ctx.setStrokeStyle(ink);
		stave.setContext(ctx).draw();

		if (held.length === 0) return;

		// Spelled from the chord rather than from the note numbers: three
		// semitones above C is an E flat in a C minor chord and a D sharp in a
		// B major one, and that is which line the notehead sits on.
		const spelled = spellNotes(held, flats).map(vexKey);
		// Not centred: a chord centred in a stave this narrow ends up sitting on
		// top of the clef. Let the formatter place it after the clef, where the
		// first note of a bar goes anyway.
		const note = new V.StaveNote({ keys: spelled.map((s) => s.key), duration: 'w', clef });
		spelled.forEach((s, i) => {
			if (s.acc) note.addModifier(new V.Accidental(s.acc), i);
		});
		const colour = channelColour(noteState.channelOf(held[0]) ?? 0);
		note.setStyle({ fillStyle: colour, strokeStyle: colour });
		V.Formatter.FormatAndDraw(ctx, stave, [note]);
	}

	$effect(() => {
		// Read what the drawing depends on, then draw outside the tracking pass
		// so nothing VexFlow touches on the way through becomes a dependency.
		void vex;
		void held;
		void flats;
		void clef;
		void themeTick;
		untrack(draw);
	});
</script>

<div
	bind:this={host}
	class={cn('[&_svg]:block', className)}
	style="width: {WIDTH}px; height: {HEIGHT}px"
	role="img"
	aria-label={held.length ? `${held.length} notes sounding` : 'Staff, nothing sounding'}
></div>
