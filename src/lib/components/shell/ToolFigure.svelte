<script lang="ts">
	/**
	 * A small drawing of what each lab tool does, in place of a generic icon.
	 *
	 * Five tools behind five interchangeable glyphs is five identical boxes; you
	 * have to read every label to tell them apart. A figure of the actual thing —
	 * a stream of messages, patch cables hanging between ports, a grid of steps,
	 * a panel of unknown controls — is recognisable before you read anything, and
	 * it is the tool's own screen in miniature rather than a decoration bolted
	 * on.
	 *
	 * ## Why it is square
	 *
	 * It used to be a 200×44 strip, which made every card wide and short. Five
	 * wide cards will not tile: four sat in a row and the fifth hung underneath
	 * on its own, which reads as a layout that broke rather than a set of five
	 * tools. Square figures make square-ish cards, five of them fit one row, and
	 * the set reads as a set.
	 *
	 * A square is also simply more room. The step grid can be a grid rather than
	 * one row of sixteen slivers, the patch cables can hang the way real cables
	 * hang, and the device panel can be a panel instead of a line of knobs.
	 *
	 * Everything is drawn inside a 100×100 box with roughly six units of margin,
	 * so the five figures sit on a common grid and look like one family.
	 */
	interface Props {
		tool: 'monitor' | 'patchbay' | 'programmer' | 'devices' | 'jukebox';
	}
	let { tool }: Props = $props();

	/**
	 * The Jukebox figure is a real tune rather than a plausible-looking squiggle:
	 * the opening of the Ode to Joy — E E F G G F E D — as scale degrees, drawn
	 * the way a piano roll would draw it. Anybody who recognises the shape gets a
	 * small private joke, and everybody else gets an accurate picture of the
	 * tool.
	 *
	 * Eight notes rather than the whole fourteen-note phrase. Fourteen blocks
	 * across a hundred units are six units each, which is a scatter of specks
	 * you read as noise; eight are chunky enough to be a melody with a shape.
	 * The arch is in the first eight anyway — the rest is the answering phrase.
	 */
	const ODE = [1, 1, 2, 3, 3, 2, 1, 0];

	/**
	 * A monitor's worth of traffic. Deterministic, so the figure is stable
	 * across renders and reloads.
	 *
	 * The families are the real ones. An earlier version reached for a `bend`
	 * colour, and since there is no `--msg-bend` token that row rendered pure
	 * black and vanished into the panel. Pitch bend lives in the expression
	 * family, like every other continuous gesture.
	 */
	const STREAM: Array<{ w: number; fam: 'note' | 'cc' | 'expr' | 'clock' }> = [
		{ w: 50, fam: 'note' },
		{ w: 29, fam: 'note' },
		{ w: 54, fam: 'cc' },
		{ w: 37, fam: 'note' },
		{ w: 44, fam: 'expr' },
		{ w: 24, fam: 'clock' },
		{ w: 47, fam: 'cc' },
		{ w: 33, fam: 'note' }
	];

	/** Six tracks of eight steps — a drum grid, not an abstract row of blocks. */
	const STEPS = [
		[1, 0, 0, 0, 1, 0, 0, 0],
		[0, 0, 1, 0, 0, 0, 1, 0],
		[1, 0, 1, 1, 0, 1, 1, 0],
		[0, 0, 0, 0, 1, 0, 0, 1],
		[0, 1, 0, 0, 0, 0, 1, 0],
		[1, 0, 0, 1, 0, 0, 0, 0]
	];

	/** Positions a real panel would be found in — none of them at zero. */
	const KNOBS = [-58, 24, 112, -20, 76, 8, 140, -104, 46];

	// ── Shared geometry, so the five figures share a margin ─────────────────
	const PAD = 6;
	const SPAN = 100 - PAD * 2;

	// Monitor: eight rows down the box.
	const ROW_H = 6;
	const ROW_GAP = 4.6;

	// Programmer: eight steps across, six tracks down.
	const CELL_W = 8.5;
	const CELL_GAP_X = 3.2;
	const CELL_H = 8.5;
	const CELL_GAP_Y = 4;
	const GRID_X = (100 - (8 * CELL_W + 7 * CELL_GAP_X)) / 2;
	const GRID_Y = (100 - (6 * CELL_H + 5 * CELL_GAP_Y)) / 2;

	// Jukebox: eight notes across four lanes.
	const NOTE_GAP = 2;
	const NOTE_W = (SPAN - 7 * NOTE_GAP) / 8;
	const NOTE_H = 13;
	const LANE_H = 18;
	/** Degree 0 sits low, degree 3 high — the way a piano roll reads. */
	const laneY = (degree: number) => (100 - (3 * LANE_H + NOTE_H)) / 2 + (3 - degree) * LANE_H;

	/**
	 * Patchbay: three sockets down each side, and three cables — so every socket
	 * is in use and the square has no stranded corner. Four a side meant one
	 * pair on each edge sat unpatched, and the bottom of the drawing read as
	 * empty rather than as spare capacity.
	 */
	const PORT_Y = [20, 50, 80];
</script>

<svg viewBox="0 0 100 100" class="block h-auto w-full" aria-hidden="true">
	{#if tool === 'monitor'}
		<!-- Messages arriving, newest at the top, coloured by family. -->
		{#each STREAM as row, i (i)}
			{@const y = PAD + 2 + i * (ROW_H + ROW_GAP)}
			<rect x={PAD} {y} width="13" height={ROW_H} rx="2" class="fill-border" />
			<rect x={PAD + 17} {y} width="9" height={ROW_H} rx="2" class="fill-border" />
			<rect
				x={PAD + 31}
				{y}
				width={row.w}
				height={ROW_H}
				rx="2"
				fill="var(--msg-{row.fam})"
				opacity={1 - i * 0.075}
			/>
		{/each}
	{:else if tool === 'patchbay'}
		<!--
			Sockets down each side and the cables between them. The cables sag,
			because that is what a cable does and because a straight line between
			two sockets reads as a wiring diagram rather than a patchbay.
		-->
		{#each PORT_Y as y (y)}
			<circle cx="12" cy={y} r="5.5" class="fill-muted stroke-border" stroke-width="1.3" />
			<circle cx="88" cy={y} r="5.5" class="fill-muted stroke-border" stroke-width="1.3" />
		{/each}
		<path
			d="M 17.5 20 C 40 52, 62 68, 82.5 80"
			fill="none"
			stroke="var(--msg-note)"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
		<path
			d="M 17.5 80 C 38 92, 64 64, 82.5 50"
			fill="none"
			stroke="var(--msg-cc)"
			stroke-width="2.2"
			stroke-linecap="round"
			opacity="0.85"
		/>
		<path
			d="M 17.5 50 C 40 72, 62 40, 82.5 20"
			fill="none"
			class="stroke-border"
			stroke-width="2.2"
			stroke-dasharray="3 4"
			stroke-linecap="round"
		/>
	{:else if tool === 'programmer'}
		<!-- Six tracks of eight steps, with the downbeats holding their column. -->
		{#each STEPS as track, row (row)}
			{#each track as on, i (i)}
				<rect
					x={GRID_X + i * (CELL_W + CELL_GAP_X)}
					y={GRID_Y + row * (CELL_H + CELL_GAP_Y)}
					width={CELL_W}
					height={CELL_H}
					rx="2"
					fill={on ? 'var(--msg-note)' : 'var(--muted)'}
					opacity={on ? 0.9 : i % 4 === 0 ? 1 : 0.55}
				/>
			{/each}
		{/each}
	{:else if tool === 'jukebox'}
		<!--
			A melody as a piano roll draws it: one block per note, height is pitch.
			The lanes go behind the notes, so they only show in the gaps and read as
			a piano roll's grid rather than as a stave the notes are sitting on.
		-->
		{#each [0, 1, 2, 3] as degree (degree)}
			<line
				x1={PAD}
				y1={laneY(degree) + NOTE_H / 2}
				x2={100 - PAD}
				y2={laneY(degree) + NOTE_H / 2}
				class="stroke-border"
				stroke-width="0.9"
			/>
		{/each}
		{#each ODE as degree, i (i)}
			<rect
				x={PAD + i * (NOTE_W + NOTE_GAP)}
				y={laneY(degree)}
				width={NOTE_W}
				height={NOTE_H}
				rx="2.4"
				fill="var(--msg-note)"
				opacity={0.62 + degree * 0.12}
			/>
		{/each}
	{:else}
		<!-- An unknown panel: controls whose numbers you have to find out. -->
		{#each KNOBS as a, i (i)}
			{@const cx = PAD + 8 + (i % 3) * ((SPAN - 16) / 2)}
			{@const cy = PAD + 8 + Math.floor(i / 3) * ((SPAN - 16) / 2)}
			<circle {cx} {cy} r="11.5" class="fill-surface-sunken stroke-border" stroke-width="1.2" />
			<line
				x1={cx}
				y1={cy}
				x2={cx + Math.cos(((a - 90) * Math.PI) / 180) * 8.5}
				y2={cy + Math.sin(((a - 90) * Math.PI) / 180) * 8.5}
				class="stroke-foreground"
				stroke-width="1.8"
				stroke-linecap="round"
			/>
		{/each}
	{/if}
</svg>
