<script lang="ts">
	/**
	 * What the three sockets are actually wired to, inside one instrument.
	 *
	 * The lesson's own claim is that getting In, Out and Thru straight "resolves
	 * an enormous number of routing puzzles", and it then made that claim in
	 * three cards of prose. But the whole distinction is a wiring diagram: Out is
	 * fed by the keys, Thru is fed by In, and the two feeds never meet unless the
	 * device is doing something extra. Once the lines are drawn, "why can't the
	 * next synth in the chain hear me playing?" answers itself — you can see that
	 * nothing connects the keys to Thru.
	 *
	 * ## Why it has switches
	 *
	 * Because the two settings people actually get wrong are both switches in
	 * this exact picture. Local Control is the link between the keys and this
	 * device's own sound engine; Soft Thru is a link from In into Out. Both are
	 * menu items on real hardware, both are invisible from the outside, and both
	 * produce symptoms — a silent keyboard, a doubled note, a feedback loop —
	 * that make no sense until you can see which wire moved.
	 *
	 * Drawing them as switches rather than describing them means a reader can try
	 * the combination their own rig is in and read off the consequence.
	 *
	 * ## The layout
	 *
	 * Sockets along the bottom, as on a back panel; the two things inside the
	 * instrument that generate and consume MIDI above them. Every socket sits
	 * directly beneath whatever feeds it, so not one wire has to cross another —
	 * a crossing in a diagram this small reads as a connection, and a connection
	 * that is not there is the one mistake this drawing cannot afford.
	 */
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	/** The link between this device's keys and its own sound engine. */
	let local = $state(true);
	/** Whether In is also merged into Out — "Soft Thru", "MIDI echo", "Out/Thru". */
	let softThru = $state(false);

	// ── Geometry ───────────────────────────────────────────────────────────
	/** The three sockets, evenly spaced, each under what feeds it. */
	const IN_X = 146;
	const THRU_X = 281;
	const OUT_X = 416;
	/** The back panel: where the sockets sit. */
	const PANEL_Y = 194;
	/** The horizontal run that carries whatever arrived at In. */
	const BUS_Y = 148;
	/** The bottom edge of the two boxes inside the instrument. */
	const BOX_BOTTOM = 92;

	const ARRIVED = 'var(--msg-note)';
	const PLAYED = 'var(--msg-cc)';

	/**
	 * What the reader should take away from the switch positions they chose.
	 *
	 * All four combinations are real configurations somebody is sitting in right
	 * now, and three of the four are the cause of a specific complaint.
	 */
	const verdict = $derived.by(() => {
		if (local && !softThru) {
			return 'The factory setting. The keys play this instrument and also leave by Out; whatever arrives at In plays this instrument too, and leaves by Thru unchanged. Nothing is merged anywhere.';
		}
		if (!local && !softThru) {
			return 'Local Control off. The keys no longer reach the sound engine — press one and you hear nothing, which is why a synth in this state gets returned as broken. It is still sending: the notes leave by Out. This is the right setting when a computer is echoing them back, because otherwise every note would arrive at the engine twice.';
		}
		if (local && softThru) {
			return 'Soft Thru on. Out now carries both what you played and everything arriving at In, merged into one stream. Convenient for driving a chain from a keyboard — and the reason a device further along can suddenly hear messages you never knowingly sent.';
		}
		return 'Local Control off and Soft Thru on: this device is now a pure merger, playing nothing of its own and passing everything on. If anything downstream can reach this device’s In again, that is a loop, and it will fill the wire.';
	});
</script>

<div class={cn('flex flex-col overflow-hidden rounded-lg border', className)}>
	<div class="overflow-x-auto">
		<svg
			viewBox="0 0 560 244"
			class="h-auto w-full min-w-[32rem]"
			role="img"
			aria-label="Inside one MIDI instrument. Its keys feed the MIDI Out socket{local
				? ' and, because Local Control is on, its own sound engine'
				: ', but not its own sound engine, because Local Control is off'}. Whatever arrives at MIDI
				In feeds the sound engine and is copied to MIDI Thru{softThru
				? ', and is also merged into MIDI Out because Soft Thru is on'
				: '. Nothing connects the keys to Thru'}."
		>
			<!-- ── The instrument ──────────────────────────────────────────── -->
			<rect
				x="24"
				y="18"
				width="512"
				height="176"
				rx="10"
				class="fill-surface-sunken stroke-border"
				stroke-width="1.25"
			/>
			<text x="44" y="36" font-size="9" class="fill-muted-foreground">ONE INSTRUMENT</text>

			<!-- ── What consumes MIDI, and what generates it ───────────────── -->
			{#each [{ x: 56, t: 'SOUND ENGINE', s: 'makes the noise', c: ARRIVED }, { x: 326, t: 'KEYS, KNOBS, SEQUENCER', s: 'makes the messages', c: PLAYED }] as b (b.x)}
				<rect
					x={b.x}
					y="44"
					width="180"
					height={BOX_BOTTOM - 44}
					rx="6"
					class="fill-card stroke-border"
					stroke-width="1.25"
				/>
				<text x={b.x + 90} y="66" text-anchor="middle" font-size="10" font-weight="600" fill={b.c}>
					{b.t}
				</text>
				<text x={b.x + 90} y="80" text-anchor="middle" font-size="8" class="fill-muted-foreground">
					{b.s}
				</text>
			{/each}

			<!-- ──────────────────────────────────────────────────────────────
				Local Control: the one wire that is entirely internal. Drawn as a
				switch because that is what it is — a link the menu can open, with
				the instrument's own keys on one side and its own voice on the other.
			─────────────────────────────────────────────────────────────── -->
			<!--
				Hinged on the keys' side, so opening it strands the engine rather than
				the keys. That is the way round it actually is: the keys keep sending
				either way — it is the instrument's own voice that goes quiet.
			-->
			<path d="M 294 68 L 326 68" stroke={PLAYED} stroke-width="1.75" />
			<path
				d={local ? 'M 294 68 L 268 68' : 'M 294 68 L 270 55'}
				stroke={PLAYED}
				stroke-width="1.75"
				stroke-linecap="round"
			/>
			<path
				d="M 236 68 L 268 68"
				stroke={local ? PLAYED : 'var(--muted-foreground)'}
				stroke-width="1.75"
				opacity={local ? 1 : 0.35}
			/>
			{#each [268, 294] as x (x)}
				<circle cx={x} cy="68" r="2.75" fill="var(--surface-sunken)" stroke={PLAYED} />
			{/each}
			<text
				x="281"
				y="110"
				text-anchor="middle"
				font-size="8.5"
				font-weight="600"
				fill={local ? PLAYED : 'var(--muted-foreground)'}
			>
				LOCAL CONTROL {local ? 'ON' : 'OFF'}
			</text>

			<!-- ── In: up to the engine, across, and back down to Thru ─────── -->
			<path
				d="M {IN_X} {PANEL_Y - 12} L {IN_X} {BOX_BOTTOM}"
				stroke={ARRIVED}
				stroke-width="1.75"
			/>
			<path
				d="M {IN_X} {BUS_Y} L {THRU_X} {BUS_Y} L {THRU_X} {PANEL_Y - 12}"
				fill="none"
				stroke={ARRIVED}
				stroke-width="1.75"
				stroke-linejoin="round"
			/>
			<circle cx={IN_X} cy={BUS_Y} r="3.25" fill={ARRIVED} />

			<!-- ── The keys, straight down to Out ──────────────────────────── -->
			<path
				d="M {OUT_X} {BOX_BOTTOM} L {OUT_X} {PANEL_Y - 12}"
				stroke={PLAYED}
				stroke-width="1.75"
			/>

			<!--
				Soft Thru: In joined into Out. The junction dot is the whole point —
				two sources arriving at one socket is a merge, and a merge is the
				thing plain MIDI Out never does.
			-->
			{#if softThru}
				<path
					d="M {THRU_X} {BUS_Y} L {OUT_X} {BUS_Y}"
					stroke={ARRIVED}
					stroke-width="1.75"
					stroke-dasharray="5 3"
				/>
				<circle cx={OUT_X} cy={BUS_Y} r="3.25" fill={ARRIVED} />
				<text
					x={(THRU_X + OUT_X) / 2}
					y={BUS_Y - 8}
					text-anchor="middle"
					font-size="8"
					fill={ARRIVED}
				>
					SOFT THRU — merged into Out
				</text>
			{/if}

			<!-- ── The back panel ──────────────────────────────────────────── -->
			{#each [{ x: IN_X, t: 'MIDI In', c: ARRIVED, into: true }, { x: THRU_X, t: 'MIDI Thru', c: ARRIVED, into: false }, { x: OUT_X, t: 'MIDI Out', c: PLAYED, into: false }] as s (s.x)}
				<circle cx={s.x} cy={PANEL_Y} r="13" class="fill-card" stroke={s.c} stroke-width="1.5" />
				<!-- Which way the messages go through this socket. -->
				<path
					d={s.into
						? `M ${s.x} ${PANEL_Y + 5} L ${s.x} ${PANEL_Y - 5} M ${s.x - 4} ${PANEL_Y - 1} L ${s.x} ${PANEL_Y - 5} L ${s.x + 4} ${PANEL_Y - 1}`
						: `M ${s.x} ${PANEL_Y - 5} L ${s.x} ${PANEL_Y + 5} M ${s.x - 4} ${PANEL_Y + 1} L ${s.x} ${PANEL_Y + 5} L ${s.x + 4} ${PANEL_Y + 1}`}
					fill="none"
					stroke={s.c}
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<text x={s.x} y="226" text-anchor="middle" font-size="10" font-weight="600" fill={s.c}>
					{s.t}
				</text>
			{/each}

			<!--
				The absence is the lesson. Nothing runs from the keys to Thru, and a
				reader who has just been told that will look for the wire rather than
				take it on trust — so the gap is labelled.
			-->
			<text
				x={(THRU_X + OUT_X) / 2}
				y="242"
				text-anchor="middle"
				font-size="8"
				class="fill-muted-foreground"
			>
				nothing joins the keys to Thru — that is the whole distinction
			</text>
		</svg>
	</div>

	<div class="flex flex-col gap-3 border-t px-4 py-3">
		<div class="flex flex-wrap gap-1.5">
			<Button variant={local ? 'default' : 'outline'} size="sm" onclick={() => (local = !local)}>
				Local Control {local ? 'on' : 'off'}
			</Button>
			<Button
				variant={softThru ? 'default' : 'outline'}
				size="sm"
				onclick={() => (softThru = !softThru)}
			>
				Soft Thru {softThru ? 'on' : 'off'}
			</Button>
		</div>
		<p class="text-xs leading-relaxed text-muted-foreground">{verdict}</p>
	</div>
</div>
