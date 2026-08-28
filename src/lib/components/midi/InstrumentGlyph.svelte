<script module lang="ts">
	/**
	 * Small drawings of the instruments this course actually offers.
	 *
	 * Hugeicons carries the rest of the application and has no piano, violin,
	 * trumpet, flute, organ or vibraphone in it — a guitar, a drum, a keyboard
	 * and a family of waveforms is the whole of its musical vocabulary. Six of
	 * the nine voices in the first lesson would have had to borrow a glyph
	 * meaning something else, and a guitar standing in for a violin is exactly
	 * the sort of small lie this course spends its time undoing.
	 *
	 * So they are drawn here. Every other figure in this app is hand-drawn SVG,
	 * no dependency is added, and the nine can be exactly the nine that are
	 * needed. They are stroked at the weight and cap style Hugeicons uses, so
	 * they sit beside real icons without announcing that they came from
	 * somewhere else.
	 *
	 * Keyed by General MIDI *family* rather than by program, because that is the
	 * granularity at which the distinctions are real — every program from 0 to 7
	 * is a piano of some kind — and it means an instrument this file has never
	 * heard of still gets something sensible.
	 */

	/** A stroked path, with an optional heavier weight for solid marks. */
	type Stroke = string | { d: string; w: number };

	/** Paths per GM family index (program >> 3). */
	const FAMILY: Record<number, Stroke[]> = {
		// 0 Piano — a keybed, black keys in their two-then-three pattern.
		0: ['M2.5 7.5h19v9h-19z', 'M6 7.5v5.5M9 7.5v5.5M14 7.5v5.5M17 7.5v5.5M20 7.5v5.5'],
		// 1 Chromatic percussion — a bar and the mallet coming down on it.
		//
		// Three graduated bars was the obvious drawing and it is also, exactly,
		// the universal "sort descending" glyph; with a stick beside it the whole
		// thing read as an editing tool. One struck bar cannot be mistaken for
		// anything else in this set, and struck-metal is the thing this family
		// has in common.
		1: [
			{ d: 'M3 18h18', w: 2.8 },
			'M19.5 5 13.8 11.6',
			{ d: 'M12.9 12.6h.01', w: 4.6 },
			'M6.5 14.4 5.2 12.6M9.8 14.1V12'
		],
		// 2 Organ — pipes of four lengths standing on a chest.
		2: ['M3 20h18', 'M6.5 20V9.5M10.5 20V5M14.5 20V11.5M18.5 20V7'],
		// 3 Guitar — a soundhole and a neck.
		3: ['M9 21a5 5 0 1 1 5-5', 'M14 16 21 3', 'M9.5 16.5h.01'],
		// 4 Bass — the same body, one thick string.
		4: ['M9 21a5 5 0 1 1 5-5', 'M14 16 21 3'],
		// 5 Strings — the two bouts of a violin as stacked circles, with a neck
		// and a scroll. The waisted outline is unreadable at eighteen pixels; the
		// silhouette of a big body under a small one is not.
		5: [
			'M12 21.2a3.7 3.7 0 1 1 0-7.4 3.7 3.7 0 0 1 0 7.4z',
			'M12 15.1a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z',
			'M12 9.7V4.4',
			{ d: 'M12 3.9h.01', w: 3 }
		],
		// 6 Ensemble — many of them. Concentric semicircles rather than free
		// curves: three cubics drawn by eye all peaked at the same height and
		// merged into one thick arc.
		6: ['M2.5 19.5a9.5 9.5 0 0 1 19 0', 'M6 19.5a6 6 0 0 1 12 0', 'M9.5 19.5a2.5 2.5 0 0 1 5 0'],
		// 7 Brass — mouthpiece, valves, and a bell that flares.
		7: ['M4.6 12h9.4', 'M7.5 12V8.6M10.5 12V8.6', 'M14 8.5 19.5 5v14L14 15.5z'],
		// 8 Reed — a body with holes and a flared end.
		8: ['M3 10.5h13v3H3z', 'M16 9.5 21 7v10l-5-2.5z', 'M6.5 12h.01M9.5 12h.01M12.5 12h.01'],
		// 9 Pipe — a tube, blown across, with its holes.
		9: ['M2.5 10h19v4h-19z', 'M7 12h.01M10.5 12h.01M14 12h.01M17.5 12h.01'],
		// 10 Synth lead — the sawtooth it is usually made of.
		10: ['M2.5 16.5 7 8v8.5L11.5 8v8.5L16 8v8.5L20.5 8'],
		// 11 Synth pad — two slow waves, layered and warm.
		11: ['M2 11.5c2.6-7 5.4-7 8 0s5.4 7 8 0', 'M2 16.5c2.6-4 5.4-4 8 0s5.4 4 8 0'],
		// 12 Synth effects — a burst.
		12: [
			'M12 4v4M12 16v4M4 12h4M16 12h4',
			'M6.3 6.3 9 9M15 15l2.7 2.7M17.7 6.3 15 9M9 15l-2.7 2.7'
		],
		// 13 Ethnic — a plucked string over a round body.
		13: ['M12 21a5 5 0 1 1 5-5', 'M17 16V3'],
		// 14 Percussive — a drum.
		14: ['M4 8.5h16v7a8 3.5 0 0 1-16 0z', 'M4 8.5a8 3.5 0 1 1 16 0a8 3.5 0 1 1-16 0'],
		// 15 Sound effects — a speaker throwing sound.
		15: ['M4 9.5h3l4.5-3.5v12L7 14.5H4z', 'M15 9.5a4 4 0 0 1 0 5']
	};
</script>

<script lang="ts">
	interface Props {
		/** GM program, 0–127. */
		program: number;
		size?: number;
		class?: string;
	}
	let { program, size = 18, class: className }: Props = $props();

	const paths = $derived(FAMILY[Math.floor((program & 0x7f) / 8)] ?? FAMILY[15]);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	{#each paths as p, i (i)}
		{#if typeof p === 'string'}
			<path d={p} />
		{:else}
			<path d={p.d} stroke-width={p.w} />
		{/if}
	{/each}
</svg>
