<script lang="ts">
	/**
	 * A small drawing of what each lab tool does, in place of a generic icon.
	 *
	 * Four tools behind four interchangeable glyphs is four identical boxes;
	 * you have to read every label to tell them apart. A figure of the actual
	 * thing — a stream of messages, two patch cables, a row of steps, a panel
	 * of unknown controls — is recognisable before you read anything, and it is
	 * the tool's own screen in miniature rather than a decoration bolted on.
	 */
	interface Props {
		tool: 'monitor' | 'patchbay' | 'programmer' | 'devices' | 'jukebox';
	}
	let { tool }: Props = $props();

	/**
	 * The Jukebox figure is a real tune rather than a plausible-looking squiggle:
	 * the first phrase of the Ode to Joy, as scale degrees, drawn the way a
	 * piano roll would draw it. Anybody who recognises the shape gets a small
	 * private joke, and everybody else gets an accurate picture of the tool.
	 */
	const ODE = [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1];

	/** Deterministic, so the figure is stable across renders and reloads. */
	const STREAM = [
		{ w: 78, fam: 'note' },
		{ w: 44, fam: 'note' },
		{ w: 96, fam: 'cc' },
		{ w: 58, fam: 'note' },
		{ w: 70, fam: 'bend' },
		{ w: 38, fam: 'note' }
	];
	const STEPS = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0];
	/** Positions a real panel would be found in — none of them at zero. */
	const KNOBS = [-58, 24, 112, -20, 76];
</script>

<svg viewBox="0 0 200 44" class="block h-auto w-full" aria-hidden="true">
	{#if tool === 'monitor'}
		<!-- Messages arriving, newest at the top, coloured by family. -->
		{#each STREAM as row, i (i)}
			{@const y = i * 7.4}
			<rect x="0" {y} width="20" height="4" rx="1.4" class="fill-border" />
			<rect x="26" {y} width="10" height="4" rx="1.4" class="fill-border" />
			<rect
				x="42"
				{y}
				width={row.w}
				height="4"
				rx="1.4"
				fill="var(--msg-{row.fam})"
				opacity={1 - i * 0.11}
			/>
		{/each}
	{:else if tool === 'patchbay'}
		<!-- Ports down each side, and what is patched between them. -->
		{#each [10, 22, 34] as y (y)}
			<circle cx="7" cy={y} r="3.4" class="fill-muted stroke-border" />
			<circle cx="193" cy={y} r="3.4" class="fill-muted stroke-border" />
		{/each}
		<path
			d="M 11 10 C 70 10, 130 34, 189 34"
			fill="none"
			stroke="var(--msg-note)"
			stroke-width="1.6"
			stroke-linecap="round"
		/>
		<path
			d="M 11 34 C 70 34, 130 22, 189 22"
			fill="none"
			stroke="var(--msg-cc)"
			stroke-width="1.6"
			stroke-linecap="round"
			opacity="0.8"
		/>
		<path
			d="M 11 22 C 70 22, 130 10, 189 10"
			fill="none"
			class="stroke-border"
			stroke-width="1.6"
			stroke-dasharray="2.5 3.5"
			stroke-linecap="round"
		/>
	{:else if tool === 'programmer'}
		<!-- Sixteen steps in a bar, some on, the downbeats taller. -->
		{#each STEPS as on, i (i)}
			{@const tall = i % 4 === 0}
			<rect
				x={i * 12.5}
				y={tall ? 8 : 12}
				width="10"
				height={tall ? 28 : 20}
				rx="2"
				fill={on ? 'var(--msg-note)' : 'var(--muted)'}
				opacity={on ? 0.9 : 1}
			/>
		{/each}
	{:else if tool === 'jukebox'}
		<!-- A melody as a piano roll draws it: one block per note, height is pitch. -->
		{#each ODE as degree, i (i)}
			<rect
				x={i * 14.2}
				y={34 - degree * 7}
				width="12"
				height="6"
				rx="1.6"
				fill="var(--msg-note)"
				opacity={0.55 + degree * 0.1}
			/>
		{/each}
	{:else}
		<!-- An unknown panel: controls whose numbers you have to find out. -->
		{#each KNOBS as a, i (i)}
			{@const cx = 22 + i * 39}
			<circle {cx} cy="22" r="12" class="fill-surface-sunken stroke-border" />
			<line
				x1={cx}
				y1="22"
				x2={cx + Math.cos(((a - 90) * Math.PI) / 180) * 9}
				y2={22 + Math.sin(((a - 90) * Math.PI) / 180) * 9}
				class="stroke-foreground"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
		{/each}
	{/if}
</svg>
