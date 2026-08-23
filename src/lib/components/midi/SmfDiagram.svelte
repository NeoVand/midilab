<script lang="ts">
	/**
	 * What is actually inside a .mid file, drawn once.
	 *
	 * A Standard MIDI File is not a recording — it is a header chunk and some
	 * track chunks, and inside a track chunk it is nothing but pairs of "wait
	 * this long" and "then send these bytes". Once you have seen that, the
	 * whole format stops being mysterious.
	 */
</script>

<svg viewBox="0 0 420 96" class="h-auto w-full text-foreground" aria-hidden="true">
	<!-- the chunks -->
	<g font-size="10" class="font-mono">
		<rect
			x="1"
			y="6"
			width="56"
			height="24"
			rx="4"
			fill="var(--msg-sysex-bg)"
			stroke="var(--msg-sysex)"
			opacity="0.9"
		/>
		<text x="29" y="21" text-anchor="middle" fill="var(--msg-sysex)">MThd</text>

		{#each [63, 245] as x (x)}
			<rect
				{x}
				y="6"
				width="156"
				height="24"
				rx="4"
				fill="var(--msg-note-bg)"
				stroke="var(--msg-note)"
				opacity="0.9"
			/>
			<text x={x + 78} y="21" text-anchor="middle" fill="var(--msg-note)">MTrk</text>
		{/each}
	</g>

	<!-- the zoom into one track chunk -->
	<path
		d="M 63 32 L 20 52 M 219 32 L 370 52"
		stroke="var(--wire)"
		stroke-width="1"
		stroke-dasharray="2 2"
		fill="none"
	/>

	<g font-size="9" class="font-mono">
		{#each [[20, 34, 'Δ'], [58, 76, '90 3C 40'], [138, 34, 'Δ'], [176, 76, '80 3C 00'], [256, 34, 'Δ'], [294, 76, 'FF 2F 00']] as [x, w, text], i (i)}
			<rect
				{x}
				y="52"
				width={w}
				height="22"
				rx="3"
				fill={i % 2 === 0 ? 'var(--surface-sunken)' : 'var(--card)'}
				stroke="var(--border)"
			/>
			<text
				x={Number(x) + Number(w) / 2}
				y="66"
				text-anchor="middle"
				fill="currentColor"
				opacity={i % 2 === 0 ? '0.55' : '0.85'}
			>
				{text}
			</text>
		{/each}
	</g>

	<text x="210" y="90" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.55">
		wait this long · then send these bytes · repeat until End of Track
	</text>
</svg>
