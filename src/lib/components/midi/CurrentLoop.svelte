<script lang="ts">
	/**
	 * The circuit, drawn.
	 *
	 * MIDI's electrical design is the reason a forty-year-old protocol is still
	 * the most physically robust connection in a studio: it sends a *current*
	 * rather than a voltage, and the receiving end is an LED shining at a
	 * phototransistor, so the two devices share no electrical path at all. That
	 * is why MIDI cannot hum, cannot make a ground loop, and cannot damage the
	 * thing you plug it into.
	 *
	 * The course asserted all of that in a sentence and never showed it, which
	 * is a shame — the whole argument is visible in one picture the moment you
	 * can see that the loop is a closed rectangle and that it stops dead at a
	 * gap. So: a real schematic, with the current path lit while it is flowing,
	 * and a switch to make it flow.
	 *
	 * ## The layout is the argument
	 *
	 * Left to right: sending device, cable, receiving device. The loop occupies
	 * the first two and only the *first few millimetres* of the third — it turns
	 * around at the LED and goes home. Everything past the barrier is the
	 * receiving device's own electronics, reached only by light. Drawing the
	 * phototransistor anywhere left of that barrier, which an earlier version of
	 * this did, quietly destroys the one thing the picture exists to say.
	 *
	 * Values are the specification's reference circuit: 5 mA, three 220 Ω
	 * resistors, and — the part everybody gets backwards — logic 0 is current
	 * ON.
	 */
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	/** A MIDI line idles at logic 1, which is no current at all. */
	let bit = $state<0 | 1>(1);
	const flowing = $derived(bit === 0);

	/**
	 * The loop as a single path, so the moving dashes and the lit copper cannot
	 * disagree about where the circuit goes: out along pin 4 at the top, down
	 * through the receiver's resistor and LED, back along pin 5 at the bottom.
	 */
	const LOOP = 'M 78 92 L 78 64 L 352 64 L 352 176 L 78 176 L 78 148';

	const BARRIER_X = 386;
</script>

<div class={cn('flex flex-col overflow-hidden rounded-lg border', className)}>
	<div class="overflow-x-auto">
		<svg
			viewBox="0 0 500 250"
			class="h-auto w-full min-w-[31rem]"
			role="img"
			aria-label="A MIDI connection drawn as a circuit. The sending device pushes about five
				milliamps out of DIN pin 4, along the cable, down through a resistor and the light-emitting
				diode of an opto-isolator just inside the receiving device, and back along pin 5 — a closed
				loop. The diode's light crosses an isolation barrier to a phototransistor, which drives the
				receiving device's input. No conductor crosses that barrier, so the two devices share no
				electrical connection."
		>
			<!-- ── The three zones ─────────────────────────────────────────── -->
			<rect
				x="14"
				y="34"
				width="118"
				height="182"
				rx="8"
				class="fill-surface-sunken stroke-border"
				stroke-width="1.25"
			/>
			<rect
				x="168"
				y="34"
				width="140"
				height="182"
				rx="8"
				fill="none"
				class="stroke-border"
				stroke-width="1"
				stroke-dasharray="4 4"
			/>
			<rect
				x="326"
				y="34"
				width="160"
				height="182"
				rx="8"
				class="fill-surface-sunken stroke-border"
				stroke-width="1.25"
			/>

			{#each [{ x: 73, t: 'SENDING DEVICE' }, { x: 238, t: 'FIVE-PIN DIN CABLE' }, { x: 406, t: 'RECEIVING DEVICE' }] as z (z.x)}
				<text x={z.x} y="27" text-anchor="middle" font-size="9" class="fill-muted-foreground">
					{z.t}
				</text>
			{/each}

			<!-- ── The loop itself ─────────────────────────────────────────── -->
			<path d={LOOP} fill="none" stroke="var(--wire)" stroke-width="2" stroke-linejoin="round" />
			{#if flowing}
				<path
					d={LOOP}
					fill="none"
					stroke="var(--msg-note)"
					stroke-width="2.2"
					stroke-linejoin="round"
				/>
				<!--
					Current, moving. Electrons are not dots and this is not to scale,
					but "is anything going round the loop" is the only question the
					picture has to answer, and a dashed line in motion answers it
					before any label does.
				-->
				<path
					d={LOOP}
					fill="none"
					stroke="var(--surface-sunken)"
					stroke-width="2.6"
					stroke-dasharray="3 14"
					stroke-linecap="round"
				>
					<animate
						attributeName="stroke-dashoffset"
						from="34"
						to="0"
						dur="0.85s"
						repeatCount="indefinite"
					/>
				</path>
			{/if}

			<!-- ── Sending end ─────────────────────────────────────────────── -->
			<rect
				x="40"
				y="92"
				width="76"
				height="56"
				rx="4"
				class="fill-card stroke-border"
				stroke-width="1.25"
			/>
			<text x="78" y="112" text-anchor="middle" font-size="9" class="fill-foreground">UART</text>
			<text x="78" y="125" text-anchor="middle" font-size="7.5" class="fill-muted-foreground">
				31,250 baud
			</text>
			<text
				x="78"
				y="141"
				text-anchor="middle"
				font-size="10"
				font-family="var(--font-mono)"
				fill={flowing ? 'var(--msg-note)' : 'var(--muted-foreground)'}
			>
				sends {bit}
			</text>

			{#each [64, 176] as y (y)}
				<rect
					x="128"
					y={y - 6}
					width="26"
					height="12"
					rx="2"
					class="fill-card stroke-border"
					stroke-width="1.25"
				/>
				<text
					x="141"
					y={y === 64 ? y - 11 : y + 18}
					text-anchor="middle"
					font-size="7.5"
					class="fill-muted-foreground"
				>
					220 Ω
				</text>
			{/each}

			<!-- ── The cable: which pins carry, and the shield that does not ── -->
			<text x="238" y="56" text-anchor="middle" font-size="8" fill="var(--msg-note)">pin 4</text>
			<text x="238" y="194" text-anchor="middle" font-size="8" fill="var(--msg-note)">pin 5</text>

			<!--
				Pin 2 is the shield, and the specification grounds it at the sending
				end only. Drawing it as a wire that simply stops is not a shortcut:
				an unterminated shield is exactly why the receiving device has no
				return path to the sender, which is half of why this connection
				cannot hum.
			-->
			<path d="M 132 120 L 232 120" fill="none" stroke="var(--wire)" stroke-width="1.25" />
			<g transform="translate(132 120)">
				<path
					d="M 0 0 L 0 10 M -6 10 L 6 10 M -4 13.5 L 4 13.5 M -2 17 L 2 17"
					fill="none"
					stroke="var(--wire)"
					stroke-width="1.25"
				/>
			</g>
			<circle cx="232" cy="120" r="2.5" fill="var(--wire)" />
			<text x="182" y="112" font-size="7.5" class="fill-muted-foreground">pin 2 · shield</text>
			<text x="182" y="136" font-size="7" class="fill-muted-foreground" opacity="0.8">
				grounded at one end, so it
			</text>
			<text x="182" y="145" font-size="7" class="fill-muted-foreground" opacity="0.8">
				is not a return path either
			</text>

			<!-- ── Receiving end, before the barrier ───────────────────────── -->
			<rect
				x="339"
				y="88"
				width="26"
				height="12"
				rx="2"
				class="fill-card stroke-border"
				stroke-width="1.25"
			/>
			<text x="322" y="97" text-anchor="end" font-size="7.5" class="fill-muted-foreground">
				220 Ω
			</text>

			<!-- The LED, pointing the way the current goes: downward. -->
			<g transform="translate(352 128)">
				<path
					d="M -8 -8 L 8 -8 L 0 7 Z"
					fill={flowing ? 'var(--msg-note)' : 'var(--muted)'}
					stroke="var(--wire)"
					stroke-width="1"
				/>
				<path d="M -8 8 L 8 8" stroke="var(--wire)" stroke-width="1.8" />
				<!-- Light leaving it, towards the barrier. -->
				{#each [0, 1, 2] as i (i)}
					<path
						d="M {11 + i * 7} {-4 + i * 4} l 5 3"
						stroke={flowing ? 'var(--msg-note)' : 'transparent'}
						stroke-width="1.5"
						stroke-linecap="round"
					/>
				{/each}
			</g>

			<!-- ── The barrier. The single most important line in the drawing ─ -->
			<line
				x1={BARRIER_X}
				y1="44"
				x2={BARRIER_X}
				y2="206"
				stroke="var(--warn)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			<text
				x={BARRIER_X}
				y="222"
				text-anchor="middle"
				font-size="8"
				font-weight="600"
				fill="var(--warn)"
			>
				NOTHING CONDUCTS ACROSS THIS
			</text>

			<!-- ── After the barrier: light in, logic out ──────────────────── -->
			<circle cx="412" cy="128" r="15" class="fill-card stroke-border" stroke-width="1.25" />
			<path
				d="M 405 120 L 405 136 M 405 124 L 419 118 M 405 132 L 419 138"
				fill="none"
				stroke={flowing ? 'var(--msg-note)' : 'var(--wire)'}
				stroke-width="1.5"
			/>
			<text x="412" y="156" text-anchor="middle" font-size="7.5" class="fill-muted-foreground">
				phototransistor
			</text>

			<path d="M 427 128 L 452 128" fill="none" stroke="var(--wire)" stroke-width="1.5" />
			<text x="470" y="120" text-anchor="middle" font-size="7.5" class="fill-muted-foreground">
				reads
			</text>
			<text
				x="470"
				y="134"
				text-anchor="middle"
				font-size="12"
				font-family="var(--font-mono)"
				fill={flowing ? 'var(--msg-note)' : 'var(--muted-foreground)'}
			>
				{bit}
			</text>

			<!-- The whole opto-isolator is one component straddling the barrier. -->
			<rect
				x="334"
				y="106"
				width="94"
				height="62"
				rx="5"
				fill="none"
				stroke="var(--muted-foreground)"
				stroke-width="1"
				opacity="0.45"
			/>
			<text x="381" y="196" text-anchor="middle" font-size="7.5" class="fill-muted-foreground">
				one opto-isolator, straddling the gap
			</text>

			<!-- Current annotation, only while there is current. -->
			<text
				x="238"
				y="78"
				text-anchor="middle"
				font-size="8.5"
				font-family="var(--font-mono)"
				fill={flowing ? 'var(--msg-note)' : 'transparent'}
			>
				≈ 5 mA
			</text>
		</svg>
	</div>

	<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3">
		<div class="flex gap-1.5">
			<Button variant={bit === 1 ? 'default' : 'outline'} size="sm" onclick={() => (bit = 1)}>
				Send a 1
			</Button>
			<Button variant={bit === 0 ? 'default' : 'outline'} size="sm" onclick={() => (bit = 0)}>
				Send a 0
			</Button>
		</div>
		<p class="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
			{#if flowing}
				Current is going round the loop, the diode is lit, and the phototransistor on the far side
				conducts. <strong class="text-foreground">Logic 0 is current on</strong> — the opposite of what
				most people guess.
			{:else}
				No current, no light, nothing conducting. This is the resting state of every MIDI cable in
				your studio: an idle line draws nothing at all.
			{/if}
		</p>
	</div>
</div>
