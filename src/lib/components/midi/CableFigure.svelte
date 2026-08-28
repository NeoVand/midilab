<script lang="ts">
	/**
	 * Connector diagrams, drawn rather than photographed, so the pin assignments
	 * are readable rather than implied.
	 */
	import { cn } from '$lib/utils';

	interface Props {
		kind: 'din' | 'trs' | 'topology';
		class?: string;
	}
	let { kind, class: className }: Props = $props();

	/*
	 * DIN-5 as you see it looking into a socket: left to right 3, 5, 2, 4, 1. On
	 * a plug, looking at the pins, that order mirrors to 1, 4, 2, 5, 3.
	 *
	 * Positions are angles on the pin circle rather than hand-placed points,
	 * because that is what they are: five contacts on an arc that dips a little
	 * below the horizontal at each end, which is the shape your eye uses to tell
	 * a DIN from every other round connector. The source/sink roles are named
	 * from the sending end.
	 */
	const DIN_PINS = [
		{ n: 3, deg: 192, use: 'unused', note: 'not connected in MIDI' },
		{ n: 5, deg: 137, use: 'sink', note: 'current sink — the data line' },
		{ n: 2, deg: 90, use: 'shield', note: 'shield / ground' },
		{ n: 4, deg: 43, use: 'source', note: 'current source, +5 V through a resistor' },
		{ n: 1, deg: -12, use: 'unused', note: 'not connected in MIDI' }
	];

	/** Where a pin sits on the face, in the 160-unit drawing below. */
	const CX = 80;
	const CY = 84;
	const PIN_R = 38;
	const pin = (deg: number) => ({
		x: CX + PIN_R * Math.cos((deg * Math.PI) / 180),
		y: CY - PIN_R * Math.sin((deg * Math.PI) / 180)
	});

	const USE_COLOUR: Record<string, string> = {
		sink: 'var(--msg-note)',
		source: 'var(--msg-cc)',
		shield: 'var(--muted-foreground)',
		unused: 'var(--grid-line-strong)'
	};
</script>

{#if kind === 'din'}
	<!--
		Socket and key together, prose underneath.
		
		The two were in one row, so the five short legend rows sat in a
		five-hundred-pixel column with three hundred pixels of nothing to their
		right, and the paragraph that belongs to the whole figure was trapped in
		the same column as if it belonged only to the list. Grouping the drawing
		with its key and running the prose under both closes the gap and puts the
		explanation where it applies.
	-->
	<div class={cn('flex flex-col gap-4 rounded-lg border p-5', className)}>
		<div class="flex flex-wrap items-center gap-x-8 gap-y-4">
			<!--
			The socket, drawn as a socket.
			
			It used to be a 55-pixel circle with five dots in it, sitting beside a
			legend three times its size — the subject of the figure was the
			smallest thing in it, and it did not look like the object it names. A
			DIN connector is recognisable by three things: a metal shell, a keyway
			notch at the bottom, and five contacts on an arc that dips below the
			horizontal at the ends. Draw those and it stops being a diagram of a
			circle.
		-->
			<svg
				viewBox="0 0 160 160"
				class="h-44 w-44 shrink-0 self-center"
				role="img"
				aria-label="A five-pin DIN socket seen face on. Reading left to right across the arc, the pins
				are 3, 5, 2, 4 and 1. MIDI uses pin 4 as the current source, pin 5 as the sink and pin 2 as
				the shield; pins 1 and 3 are not connected."
			>
				<!-- The shell, and the shadow it casts into the panel it is set into. -->
				<circle cx={CX} cy={CY} r="66" class="fill-surface-sunken stroke-border" stroke-width="1" />
				<circle cx={CX} cy={CY} r="60" class="fill-card stroke-border" stroke-width="2.5" />
				<!--
				The keyway. On a real socket it is a step in the shell at the bottom,
				and it is the only thing telling you which way up the plug goes.
			-->
				<path
					d="M {CX - 17} {CY + 58.5} A 60 60 0 0 0 {CX + 17} {CY + 58.5}
				   L {CX + 14} {CY + 49} A 51 51 0 0 1 {CX - 14} {CY + 49} Z"
					class="fill-surface-sunken stroke-border"
					stroke-width="1"
				/>
				<!-- The recessed face the contacts sit in. -->
				<circle cx={CX} cy={CY} r="50" class="panel-sunken fill-surface-sunken" />
				<circle cx={CX} cy={CY} r="50" fill="none" class="stroke-border" stroke-width="1" />

				{#each DIN_PINS as p (p.n)}
					{@const pt = pin(p.deg)}
					<!--
					Unused pins read as hollow rather than as a faded solid: a number in
					the page background colour on a 35%-opacity grey disc was legible in
					neither theme.
				-->
					<circle
						cx={pt.x}
						cy={pt.y}
						r="10.5"
						fill={p.use === 'unused' ? 'var(--surface-sunken)' : USE_COLOUR[p.use]}
						stroke={p.use === 'unused' ? 'var(--grid-line-strong)' : 'none'}
						stroke-width="1.5"
					/>
					<text
						x={pt.x}
						y={pt.y + 4}
						text-anchor="middle"
						font-size="11"
						class={p.use === 'unused' ? 'fill-muted-foreground' : 'fill-background'}
						font-weight="600"
					>
						{p.n}
					</text>
				{/each}

				<text x={CX} y="152" text-anchor="middle" font-size="8.5" class="fill-muted-foreground">
					looking into the socket
				</text>
			</svg>
			<div class="flex flex-col gap-2">
				{#each DIN_PINS.slice().sort((a, b) => a.n - b.n) as p (p.n)}
					<div class="flex items-baseline gap-3 text-sm">
						<span
							class="size-2.5 shrink-0 translate-y-0.5 rounded-full border"
							style={p.use === 'unused'
								? 'background: var(--surface-sunken); border-color: var(--grid-line-strong)'
								: `background: ${USE_COLOUR[p.use]}; border-color: ${USE_COLOUR[p.use]}`}
						></span>
						<span class="w-10 shrink-0 font-mono text-xs">pin {p.n}</span>
						<span class="text-xs text-muted-foreground">{p.note}</span>
					</div>
				{/each}
			</div>
		</div>
		<p class="text-xs leading-relaxed text-muted-foreground">
			MIDI is a <strong>current loop</strong>, not a voltage signal: at the sending end pin 4 pushes
			about 5 mA through the cable and pin 5 receives it back. The receiver's end drives an
			<strong>opto-isolator</strong> — an LED shining on a phototransistor — so the two devices share
			no electrical connection at all. That is why you can chain gear on different circuits without a
			ground loop, and why a MIDI cable cannot damage anything.
		</p>
	</div>
{:else if kind === 'trs'}
	<div class={cn('grid gap-4 sm:grid-cols-2', className)}>
		{#each [{ type: 'A', tip: 5, ring: 4, makers: 'Korg, Teenage Engineering, Make Noise, Boss — and the MIDI Association standard' }, { type: 'B', tip: 4, ring: 5, makers: 'Arturia, Novation, older 1010music — pre-standard' }] as v (v.type)}
			<div
				class={cn(
					'flex flex-col gap-3 rounded-lg border p-4',
					v.type === 'A' && 'border-msg-note/40'
				)}
			>
				<p class={cn('text-sm font-semibold', v.type === 'A' ? 'text-msg-note' : 'text-warn')}>
					TRS Type {v.type}
				</p>
				<svg viewBox="0 0 220 44" class="w-full" role="img" aria-label="TRS Type {v.type} plug">
					<rect
						x="4"
						y="16"
						width="34"
						height="12"
						rx="6"
						fill={v.tip === 5 ? 'var(--msg-note)' : 'var(--msg-cc)'}
					/>
					<rect x="40" y="16" width="6" height="12" class="fill-border" />
					<rect
						x="48"
						y="16"
						width="24"
						height="12"
						fill={v.ring === 5 ? 'var(--msg-note)' : 'var(--msg-cc)'}
					/>
					<rect x="74" y="16" width="6" height="12" class="fill-border" />
					<rect x="82" y="14" width="70" height="16" rx="3" class="fill-muted-foreground" />
					<rect
						x="152"
						y="8"
						width="64"
						height="28"
						rx="4"
						class="fill-surface-sunken stroke-border"
					/>
					<text x="21" y="12" text-anchor="middle" font-size="8" class="fill-muted-foreground"
						>tip</text
					>
					<text x="60" y="12" text-anchor="middle" font-size="8" class="fill-muted-foreground"
						>ring</text
					>
					<text x="117" y="12" text-anchor="middle" font-size="8" class="fill-muted-foreground"
						>sleeve</text
					>
				</svg>
				<div class="flex flex-col gap-1 font-mono text-xs">
					<div class="flex gap-3">
						<span class="w-12 text-muted-foreground">tip</span>
						<span style="color: {v.tip === 5 ? 'var(--msg-note)' : 'var(--msg-cc)'}">
							DIN pin {v.tip} — {v.tip === 5 ? 'sink' : 'source'}
						</span>
					</div>
					<div class="flex gap-3">
						<span class="w-12 text-muted-foreground">ring</span>
						<span style="color: {v.ring === 5 ? 'var(--msg-note)' : 'var(--msg-cc)'}">
							DIN pin {v.ring} — {v.ring === 5 ? 'sink' : 'source'}
						</span>
					</div>
					<div class="flex gap-3">
						<span class="w-12 text-muted-foreground">sleeve</span>
						<span class="text-muted-foreground">DIN pin 2 — shield</span>
					</div>
				</div>
				<p class="text-xs leading-relaxed text-muted-foreground">{v.makers}</p>
			</div>
		{/each}
	</div>
{:else}
	<div class={cn('grid gap-4 lg:grid-cols-2', className)}>
		<div class="flex flex-col gap-3 rounded-lg border p-4">
			<p class="text-sm font-semibold">Daisy chain — Thru to In</p>
			<svg viewBox="0 0 340 70" class="w-full" role="img" aria-label="Daisy chain topology">
				<defs>
					<marker id="ch-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
						<path d="M0,0 L6,3 L0,6 z" fill="var(--msg-note)" />
					</marker>
				</defs>
				{#each [0, 1, 2, 3] as i (i)}
					<rect
						x={i * 86 + 4}
						y="22"
						width="60"
						height="26"
						rx="5"
						class="fill-card stroke-border"
					/>
					<text x={i * 86 + 34} y="39" text-anchor="middle" font-size="9" class="fill-foreground">
						{i === 0 ? 'Source' : `Synth ${i}`}
					</text>
					{#if i < 3}
						<line
							x1={i * 86 + 64}
							y1="35"
							x2={i * 86 + 86}
							y2="35"
							stroke="var(--msg-note)"
							stroke-width="1.6"
							marker-end="url(#ch-arrow)"
							opacity={1 - i * 0.22}
						/>
					{/if}
				{/each}
			</svg>
			<p class="text-xs leading-relaxed text-muted-foreground">
				Each Thru port regenerates the signal through another opto-isolator, and each stage adds a
				little delay and a little waveform smearing. Three hops is comfortable; five starts to be a
				gamble; the failure is intermittent stuck notes rather than silence, which makes it hard to
				diagnose.
			</p>
		</div>
		<div class="flex flex-col gap-3 rounded-lg border p-4">
			<p class="text-sm font-semibold">Star — one Thru box, everyone equal</p>
			<svg viewBox="0 0 340 70" class="w-full" role="img" aria-label="Star topology">
				<rect x="4" y="22" width="60" height="26" rx="5" class="fill-card stroke-border" />
				<text x="34" y="39" text-anchor="middle" font-size="9" class="fill-foreground">Source</text>
				<rect x="110" y="22" width="60" height="26" rx="5" class="fill-card stroke-msg-note" />
				<text x="140" y="39" text-anchor="middle" font-size="9" class="fill-foreground"
					>Thru box</text
				>
				<line x1="64" y1="35" x2="108" y2="35" stroke="var(--msg-note)" stroke-width="1.6" />
				{#each [0, 1, 2] as i (i)}
					<rect
						x="250"
						y={6 + i * 22}
						width="60"
						height="18"
						rx="4"
						class="fill-card stroke-border"
					/>
					<text x="280" y={18 + i * 22} text-anchor="middle" font-size="8" class="fill-foreground">
						Synth {i + 1}
					</text>
					<path
						d="M170,35 C210,35 210,{15 + i * 22} 248,{15 + i * 22}"
						fill="none"
						stroke="var(--msg-note)"
						stroke-width="1.6"
					/>
				{/each}
			</svg>
			<p class="text-xs leading-relaxed text-muted-foreground">
				Every device is one hop from the source, so they all get the same signal at the same time. A
				Thru box costs less than an afternoon of debugging a five-deep chain, and it is the single
				best hardware purchase for a DIN-based rig.
			</p>
		</div>
	</div>
{/if}
