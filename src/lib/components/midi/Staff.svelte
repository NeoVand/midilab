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

	/**
	 * Both staves, side by side.
	 *
	 * A grand staff stacks them because a score runs left to right in time and
	 * the two hands have to line up. Nothing here runs in time: there is one
	 * chord, in one column, and that is all there will ever be. Stacked, the
	 * two staves cost twice the height for no benefit; side by side they cost
	 * none, and both hands are visible at once instead of one clef having to
	 * be guessed at.
	 */
	/*
	 * Everything below is in VexFlow's own units, where a staff space is ten,
	 * and the whole drawing is then scaled once on the way out.
	 *
	 * This matters: the glyph metrics are global to the library, not read from
	 * whatever line spacing a stave was given. Setting the spacing to seven and
	 * leaving the glyphs alone drew noteheads sized for ten — half again taller
	 * than the space they sit in, which is the first thing a reader notices and
	 * cannot name. Scaling the context keeps lines, clefs, noteheads and ledger
	 * lines in the proportions the font was drawn in.
	 */
	const SPACING = 10;
	/**
	 * How much of natural size the whole drawing is rendered at. A staff space
	 * lands just under eight pixels, which is about as small as Bravura's
	 * clefs stay legible.
	 */
	const SCALE = 0.78;

	const STAVE_U = 142;
	const GAP_U = 24;
	/**
	 * Room left after the chord, so the last notehead on the left-hand staff
	 * does not run into the clef of the right-hand one.
	 */
	const TRAIL = 30;
	/** Room for ledger lines, and for the clefs, which overshoot their staff. */
	const ABOVE = 3.2;
	const BELOW = 3.2;

	const WIDTH_U = STAVE_U * 2 + GAP_U;
	const HEIGHT_U = SPACING * (4 + ABOVE + BELOW);
	const WIDTH = Math.round(WIDTH_U * SCALE);
	const HEIGHT = Math.round(HEIGHT_U * SCALE);

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

		/*
		 * Three weights, quietest first: the lines are structure, the clefs say
		 * which lines those are, and the noteheads are the only thing that
		 * changes as you play. Noteheads used to carry the sending channel's
		 * colour, which put a bright green chord on a staff where every printed
		 * score anyone has read is black — the keyboard and the monitor already
		 * say which channel it is.
		 */
		const cs = getComputedStyle(el);
		const rule = cs.getPropertyValue('--staff-line').trim() || cs.color;
		const clefInk = cs.getPropertyValue('--muted-foreground').trim() || cs.color;
		const ink = cs.getPropertyValue('--foreground').trim() || cs.color;

		const renderer = new V.Renderer(el, V.Renderer.Backends.SVG);
		renderer.resize(WIDTH, HEIGHT);
		const ctx = renderer.getContext();
		ctx.scale(SCALE, SCALE);

		const opts = {
			spacingBetweenLinesPx: SPACING,
			spaceAboveStaffLn: ABOVE,
			spaceBelowStaffLn: BELOW
		};

		// Spelled from the chord rather than from the note numbers: three
		// semitones above C is an E flat in a C minor chord and a D sharp in a
		// B major one, and that is which line the notehead sits on.
		const spelled = spellNotes(held, flats).map(vexKey);

		// Middle C is the hinge, which is where a pianist puts it.
		const parts = [
			{ clef: 'treble', x: 1, keep: (n: number) => n >= 60 },
			{ clef: 'bass', x: STAVE_U + GAP_U, keep: (n: number) => n < 60 }
		];

		for (const part of parts) {
			const stave = new V.Stave(part.x, 0, STAVE_U - 2, opts).addClef(part.clef);
			stave.setStyle({ strokeStyle: rule, fillStyle: rule });
			ctx.setFillStyle(clefInk);
			ctx.setStrokeStyle(clefInk);
			stave.setContext(ctx).draw();

			const keys = held.map((n, i) => [n, spelled[i]] as const).filter(([n]) => part.keep(n));
			if (!keys.length) continue;

			/*
			 * Filled noteheads, no stem.
			 *
			 * Nothing here has a duration — it is whichever notes are down at
			 * this instant — so any note value would be a claim the panel cannot
			 * make. Whole notes were the least wrong of them, but Bravura draws
			 * a whole note wider than a black one, and a row of big open ovals
			 * is the loudest thing on a small staff. A black notehead with the
			 * stem hidden is the shape a pitch display wants: compact, quiet,
			 * and saying nothing about rhythm.
			 */
			const note = new V.StaveNote({
				keys: keys.map(([, k]) => k.key),
				duration: 'q',
				clef: part.clef
			});
			note.getStem()?.setVisibility(false);
			keys.forEach(([, k], i) => {
				if (k.acc) note.addModifier(new V.Accidental(k.acc), i);
			});
			note.setStyle({ fillStyle: ink, strokeStyle: ink });

			// Formatted into less than the full note area rather than justified
			// across it: the chord then sits after the clef with room behind it,
			// instead of being pushed hard against the right-hand edge.
			const voice = new V.Voice({ numBeats: 4, beatValue: 4 })
				.setStrict(false)
				.addTickables([note]);
			const area = stave.getNoteEndX() - stave.getNoteStartX();
			new V.Formatter().joinVoices([voice]).format([voice], Math.max(20, area - TRAIL));
			// Formatting rebuilds the stem, so it is hidden again on the way out.
			note.getStem()?.setVisibility(false);
			voice.draw(ctx, stave);
		}
	}

	$effect(() => {
		// Read what the drawing depends on, then draw outside the tracking pass
		// so nothing VexFlow touches on the way through becomes a dependency.
		void vex;
		void held;
		void flats;
		void themeTick;
		untrack(draw);
	});
</script>

<div
	bind:this={host}
	class={cn('[&_svg]:block', className)}
	style="width: {WIDTH}px; height: {HEIGHT}px"
	role="img"
	aria-label={held.length
		? `${held.length} notes sounding, on the treble and bass staves`
		: 'Treble and bass staves, nothing sounding'}
></div>
