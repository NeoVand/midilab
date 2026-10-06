<script lang="ts">
	/** Static, themed previews of the actual tools. The surrounding link supplies the name. */
	interface Props {
		tool:
			| 'monitor'
			| 'patchbay'
			| 'programmer'
			| 'devices'
			| 'jukebox'
			| 'studio'
			| 'mpe'
			| 'diagnostics';
	}
	let { tool }: Props = $props();

	const messages = [
		{ time: '0.000', type: 'Note on', data: '90 3C 64', family: 'note' },
		{ time: '0.021', type: 'Control', data: 'B0 01 2A', family: 'cc' },
		{ time: '0.043', type: 'Pressure', data: 'D0 48', family: 'expr' },
		{ time: '0.480', type: 'Note off', data: '80 3C 40', family: 'note' }
	];
	const ports = [
		{ y: 74, source: 'Keyboard', target: 'Piano' },
		{ y: 113, source: 'Pads', target: 'Drums' },
		{ y: 152, source: 'Sequencer', target: 'Synth' }
	];
	const drumTracks = [
		{ name: 'Kick', hits: [0, 4, 8, 10, 12], velocity: 0.9 },
		{ name: 'Snare', hits: [4, 12], velocity: 0.75 },
		{ name: 'Hat', hits: [0, 2, 4, 6, 8, 10, 12, 14], velocity: 0.5 }
	];
	const steps = Array.from({ length: 16 }, (_, i) => i);
	const knobs = [
		{ x: 62, name: 'Cutoff', value: 'CC 74', angle: 35 },
		{ x: 160, name: 'Resonance', value: 'CC 71', angle: -45 },
		{ x: 258, name: 'Attack', value: 'CC 73', angle: -95 }
	];
	const ticks = Array.from({ length: 11 }, (_, i) => -225 + i * 27);
	/** Pitch lanes for the opening E E F G | G F E D, from highest to lowest. */
	const odePitches = ['G', 'F', 'E', 'D'];
	const ode = [2, 2, 1, 0, 0, 1, 2, 3];
	const bars = Array.from({ length: 8 }, (_, i) => i);
	const studioTracks = ['Melody', 'Chords', 'Bass', 'Drums'];
</script>

<svg viewBox="0 0 320 180" class="tool-preview" aria-hidden="true">
	<rect width="320" height="180" class="inset" />
	<path d="M0 36H320" class="rule" />
	{#if tool === 'monitor'}
		<text x="17" y="23" class="title">Message stream</text>
		<circle cx="265" cy="19" r="3" fill="var(--msg-note)" />
		<text x="276" y="23" class="caption">MIDI</text>
		<g class="caption">
			<text x="17" y="55">Time</text>
			<text x="96" y="55">Message</text>
			<text x="219" y="55">Bytes</text>
		</g>
		{#each messages as message, i (message.time)}
			{@const y = 76 + i * 27}
			<path d="M16 {y + 10}H304" class="rule" />
			<text x="17" {y} class="data muted">{message.time}</text>
			<rect x="88" y={y - 10} width="3" height="12" rx="1.5" fill="var(--msg-{message.family})" />
			<text x="100" {y} class="body">{message.type}</text>
			<text x="219" {y} class="data" fill="var(--msg-{message.family})">{message.data}</text>
		{/each}
	{:else if tool === 'patchbay'}
		<text x="17" y="23" class="title">Routing</text>
		<text x="303" y="23" text-anchor="end" class="caption">3 connections</text>
		<text x="17" y="54" class="caption">Inputs</text>
		<text x="303" y="54" text-anchor="end" class="caption">Outputs</text>
		{#each ports as port (port.source)}
			<rect x="12" y={port.y - 14} width="103" height="28" rx="6" class="panel panel-border" />
			<rect x="205" y={port.y - 14} width="103" height="28" rx="6" class="panel panel-border" />
		{/each}
		<!-- Cable endpoints share socket centers; sockets are painted over the cable. -->
		<g fill="none" stroke-width="2.2" stroke-linecap="round">
			<path d="M104 74C157 74 163 74 216 74" stroke="var(--msg-note)" />
			<path d="M104 113C160 113 159 152 216 152" stroke="var(--msg-cc)" />
			<path d="M104 152C157 152 162 113 216 113" stroke="var(--msg-expr)" />
		</g>
		{#each ports as port (port.source)}
			<text x="22" y={port.y + 4} class="body">{port.source}</text>
			<text x="236" y={port.y + 4} class="body">{port.target}</text>
			<circle cx="104" cy={port.y} r="6.5" class="inset socket" />
			<circle cx="216" cy={port.y} r="6.5" class="inset socket" />
			<circle cx="104" cy={port.y} r="2.5" class="socket-center" />
			<circle cx="216" cy={port.y} r="2.5" class="socket-center" />
		{/each}
	{:else if tool === 'programmer'}
		<text x="17" y="23" class="title">Pattern 01</text>
		<text x="303" y="23" text-anchor="end" class="caption">120 bpm</text>
		{#each [0, 4, 8, 12] as beat (beat)}
			<text x={75 + beat * 14.5} y="55" class="caption">{beat / 4 + 1}</text>
		{/each}
		{#each drumTracks as track, row (track.name)}
			<text x="17" y={79 + row * 33} class="body">{track.name}</text>
			{#each steps as step (step)}
				<rect
					x={74 + step * 14.5}
					y={65 + row * 33}
					width="11.5"
					height="22"
					rx="2.5"
					class={{ 'empty-step': !track.hits.includes(step) }}
					fill={track.hits.includes(step) ? 'var(--msg-note)' : undefined}
					opacity={track.hits.includes(step) ? track.velocity : step % 4 === 0 ? 1 : 0.65}
				/>
			{/each}
		{/each}
		<text x="303" y="169" text-anchor="end" class="caption">16 steps · 1 bar</text>
	{:else if tool === 'devices'}
		<text x="17" y="23" class="title">Control map</text>
		<text x="303" y="23" text-anchor="end" class="caption">3 controls learned</text>
		{#each knobs as knob (knob.name)}
			{#each ticks as tick (tick)}
				{@const angle = (tick * Math.PI) / 180}
				<line
					x1={knob.x + Math.cos(angle) * 32}
					y1={96 + Math.sin(angle) * 32}
					x2={knob.x + Math.cos(angle) * 35}
					y2={96 + Math.sin(angle) * 35}
					class="rule"
				/>
			{/each}
			<circle cx={knob.x} cy="96" r="26" class="panel panel-border" />
			<circle cx={knob.x} cy="96" r="21" class="knob-face" />
			<line
				x1={knob.x + Math.cos((knob.angle * Math.PI) / 180) * 11}
				y1={96 + Math.sin((knob.angle * Math.PI) / 180) * 11}
				x2={knob.x + Math.cos((knob.angle * Math.PI) / 180) * 19}
				y2={96 + Math.sin((knob.angle * Math.PI) / 180) * 19}
				stroke="var(--foreground)"
				stroke-width="2"
				stroke-linecap="round"
			/>
			<text x={knob.x} y="145" text-anchor="middle" class="body">{knob.name}</text>
			<text x={knob.x} y="164" text-anchor="middle" class="data" fill="var(--msg-cc)"
				>{knob.value}</text
			>
		{/each}
	{:else if tool === 'jukebox'}
		<text x="17" y="23" class="title">Ode to Joy</text>
		<text x="303" y="23" text-anchor="end" class="caption">Beethoven</text>
		{#each odePitches as pitch, lane (pitch)}
			<rect x="17" y={55 + lane * 24} width="23" height="22" rx="2" class="panel panel-border" />
			<text
				x="28.5"
				y={66 + lane * 24}
				text-anchor="middle"
				dominant-baseline="central"
				class="pitch-label">{pitch}</text
			>
			<path d="M48 {55 + lane * 24}H303" class="rule" />
		{/each}
		{#each bars as bar (bar)}
			<path d="M{48 + bar * 32} 54V149" class="rule" />
		{/each}
		{#each ode as lane, i (i)}
			<rect
				x={50 + i * 32}
				y={58 + lane * 24}
				width="28"
				height="16"
				rx="3"
				fill="var(--msg-note)"
				opacity="0.8"
			/>
		{/each}
		<text x="17" y="169" class="caption">Opening phrase</text>
		<text x="303" y="169" text-anchor="end" class="caption">116 bpm</text>
	{:else if tool === 'studio'}
		<text x="17" y="23" class="title">First Track Studio</text>
		<text x="303" y="23" text-anchor="end" class="caption">8 bars</text>
		{#each bars as bar (bar)}
			<text x={85 + bar * 28} y="52" class="caption">{bar + 1}</text>
			<path d="M{81 + bar * 28} 60V165" class="rule" />
		{/each}
		{#each studioTracks as track, row (track)}
			<text x="17" y={78 + row * 28} class="body">{track}</text>
			<path d="M81 {60 + row * 28}H305" class="rule" />
		{/each}
		<g fill="var(--msg-note)">
			{#each bars as note (note)}
				<rect
					x={85 + note * 28}
					y={note % 3 === 0 ? 66 : note % 3 === 1 ? 70 : 64}
					width={note % 3 === 0 ? 18 : 10}
					height="5"
					rx="1.5"
					opacity="0.85"
				/>
			{/each}
			{#each [0, 2, 4, 6] as chord (chord)}
				<rect x={85 + chord * 28} y="91" width="50" height="18" rx="3" opacity="0.36" />
				<rect x={85 + chord * 28} y="119" width="31" height="6" rx="2" opacity="0.7" />
				<rect x={122 + chord * 28} y="127" width="13" height="6" rx="2" opacity="0.7" />
			{/each}
			{#each steps as step (step)}
				<rect
					x={85 + step * 14}
					y="147"
					width="7"
					height={step % 2 === 0 ? 12 : 7}
					rx="1.5"
					opacity={step % 2 === 0 ? 0.8 : 0.35}
				/>
			{/each}
		</g>
	{:else if tool === 'mpe'}
		<text x="17" y="23" class="title">Expression Playground</text>
		<text x="303" y="23" text-anchor="end" class="caption">3 voices</text>
		{#each [65, 105, 145] as y (y)}
			<path d="M17 {y}H303" class="rule" />
		{/each}
		{#each [65, 125, 185, 245] as x (x)}
			<path d="M{x} 49V153" class="rule" />
		{/each}
		<g fill="none" stroke-linecap="round" stroke-linejoin="round">
			<path
				d="M35 132C81 132 109 130 146 130S230 130 274 130"
				stroke="var(--msg-note)"
				stroke-width="3"
			/>
			<path
				d="M45 99C93 99 94 78 125 73S169 84 193 69S217 50 258 59"
				stroke="var(--msg-expr)"
				stroke-width="3"
			/>
			<path
				d="M70 114C117 114 120 94 143 97S183 108 205 90S246 82 285 79"
				stroke="var(--msg-cc)"
				stroke-width="3"
			/>
		</g>
		{#each [{ x: 274, y: 130, family: 'note', r: 5 }, { x: 258, y: 59, family: 'expr', r: 9 }, { x: 285, y: 79, family: 'cc', r: 7 }] as voice (voice.family)}
			<circle
				cx={voice.x}
				cy={voice.y}
				r={voice.r + 5}
				fill="var(--msg-{voice.family})"
				opacity="0.12"
			/>
			<circle
				cx={voice.x}
				cy={voice.y}
				r={voice.r}
				fill="var(--msg-{voice.family})"
				class="voice"
			/>
		{/each}
		<text x="17" y="170" class="caption">Pitch · Pressure · Color</text>
	{:else}
		<text x="17" y="23" class="title">Timing analysis</text>
		<text x="303" y="23" text-anchor="end" class="caption">Clock jitter</text>
		{#each [65, 95, 125] as y (y)}
			<path d="M17 {y}H303" class="rule" />
		{/each}
		<path
			d="M17 101L32 96L47 98L62 92L77 103L92 95L107 98L122 90L137 99L152 104L167 96L182 98L197 88L212 96L227 94L242 100L257 91L272 98L287 95L303 97"
			fill="none"
			stroke="var(--msg-clock)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<text x="17" y="164" class="caption">Measure your connection</text>
	{/if}
</svg>

<style>
	.tool-preview {
		display: block;
		width: 100%;
		height: auto;
		font-family: var(--font-sans);
	}
	.inset {
		fill: var(--landing-inset, var(--surface-sunken));
	}
	.panel {
		fill: var(--landing-panel, var(--card));
	}
	.rule {
		fill: none;
		stroke: var(--grid-line-strong);
		stroke-width: 0.75;
	}
	.panel-border {
		stroke: var(--border);
		stroke-width: 1;
	}
	.title {
		fill: var(--foreground);
		font-size: 12px;
		font-weight: 550;
	}
	.body {
		fill: var(--foreground);
		font-size: 11px;
	}
	.pitch-label {
		fill: var(--foreground);
		font-size: 18px;
		font-weight: 500;
	}
	.caption {
		fill: var(--muted-foreground);
		font-size: 10px;
	}
	.data {
		font-family: var(--font-mono);
		font-size: 10.5px;
	}
	.muted {
		fill: var(--muted-foreground);
	}
	.socket {
		stroke: var(--grid-line-strong);
		stroke-width: 1.5;
	}
	.socket-center {
		fill: var(--muted-foreground);
	}
	.empty-step {
		fill: var(--grid-line-strong);
	}
	.knob-face {
		fill: var(--surface-raised);
	}
	.voice {
		stroke: var(--surface-sunken);
		stroke-width: 1.5;
	}
</style>
