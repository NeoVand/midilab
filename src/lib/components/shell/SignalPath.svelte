<script lang="ts">
	/**
	 * The app's own signal path, drawn.
	 *
	 * Every tool in the Lab is a subscriber to one bus, and that is not an
	 * implementation detail you can ignore — it is the reason a lesson can say
	 * "play a C" and know when you did, and the reason the monitor never misses
	 * anything the synth heard. Saying so in a paragraph is forgettable.
	 * Drawing it once, in the same colour language the rest of the app uses,
	 * is not.
	 */
	const taps = [
		{ x: 268, label: 'Monitor' },
		{ x: 384, label: 'Patchbay' },
		{ x: 500, label: 'Checkpoints' }
	];
	const sources = ['Hardware in', 'On-screen widgets', 'Programmer', 'Console'];
</script>

<svg
	viewBox="32 18 792 130"
	class="h-auto w-full text-foreground"
	role="img"
	aria-label="Signal path: hardware, widgets, the Programmer and the Console all emit onto one bus; the Monitor, Patchbay and lesson checkpoints listen to it; the engine sends onward to the internal synth and to hardware outputs."
>
	<defs>
		<!-- The message colour language, laid end to end: one bus, every family. -->
		<linearGradient id="sp-bus" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0%" stop-color="var(--msg-note)" />
			<stop offset="20%" stop-color="var(--msg-cc)" />
			<stop offset="40%" stop-color="var(--msg-expr)" />
			<stop offset="58%" stop-color="var(--msg-program)" />
			<stop offset="76%" stop-color="var(--msg-clock)" />
			<stop offset="100%" stop-color="var(--msg-sysex)" />
		</linearGradient>
		<marker
			id="sp-arrow"
			viewBox="0 0 8 8"
			refX="6.5"
			refY="4"
			markerWidth="6"
			markerHeight="6"
			orient="auto-start-reverse"
		>
			<path d="M 0.5 1 L 7 4 L 0.5 7 z" fill="var(--wire)" />
		</marker>
	</defs>

	<g stroke="var(--wire)" stroke-width="1.25" fill="none" stroke-linecap="round">
		<!-- sources converge onto the bus -->
		{#each sources as _, i (i)}
			<path d="M 140 {32 + i * 26} H 168" />
		{/each}
		<path d="M 168 32 V 110" />
		<path d="M 168 71 H 190" marker-end="url(#sp-arrow)" />

		<!-- taps: subscribers hang off the bus, they do not interrupt it -->
		{#each taps as tap (tap.label)}
			<path d="M {tap.x} 79 V 112" marker-end="url(#sp-arrow)" />
		{/each}

		<!-- bus to engine, engine to the two kinds of destination -->
		<path d="M 556 71 H 596" marker-end="url(#sp-arrow)" />
		<path d="M 682 71 H 700 Q 712 71 712 59 V 50 H 738" marker-end="url(#sp-arrow)" />
		<path d="M 682 71 H 700 Q 712 71 712 83 V 92 H 738" marker-end="url(#sp-arrow)" />
	</g>

	<!-- source labels -->
	<g
		fill="currentColor"
		font-size="11"
		text-anchor="end"
		class="font-sans opacity-70"
		dominant-baseline="middle"
	>
		{#each sources as s, i (s)}
			<text x="132" y={32 + i * 26}>{s}</text>
		{/each}
	</g>

	<!-- the bus itself -->
	<rect x="190" y="63" width="366" height="16" rx="8" fill="url(#sp-bus)" opacity="0.16" />
	<rect
		x="190"
		y="63"
		width="366"
		height="16"
		rx="8"
		fill="none"
		stroke="url(#sp-bus)"
		stroke-width="1"
		opacity="0.55"
	/>
	<text
		x="373"
		y="52"
		text-anchor="middle"
		fill="currentColor"
		font-size="10"
		letter-spacing="0.08em"
		class="font-sans opacity-60"
	>
		ONE BUS — EVERY BYTE, EXACTLY ONCE
	</text>

	<!-- subscriber boxes -->
	{#each taps as tap (tap.label)}
		<g>
			<rect
				x={tap.x - 47}
				y="112"
				width="94"
				height="26"
				rx="6"
				fill="var(--card)"
				stroke="var(--border)"
			/>
			<text
				x={tap.x}
				y="125.5"
				text-anchor="middle"
				dominant-baseline="middle"
				fill="currentColor"
				font-size="11"
				class="font-sans"
			>
				{tap.label}
			</text>
		</g>
	{/each}

	<!-- the engine -->
	<rect x="596" y="55" width="86" height="32" rx="7" fill="var(--card)" stroke="var(--border)" />
	<text
		x="639"
		y="71.5"
		text-anchor="middle"
		dominant-baseline="middle"
		fill="currentColor"
		font-size="11"
		font-weight="500"
		class="font-sans"
	>
		Engine
	</text>

	<!-- destinations -->
	<g fill="currentColor" font-size="11" class="font-sans opacity-70" dominant-baseline="middle">
		<text x="744" y="50">Internal synth</text>
		<text x="744" y="92">Hardware out</text>
	</g>
</svg>
