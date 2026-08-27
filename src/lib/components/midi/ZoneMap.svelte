<script lang="ts">
	/**
	 * Which of the sixteen channels an MPE zone claims, and what each one is for.
	 *
	 * MPE is a layout, and the lesson described it in sentences: "a master
	 * channel plus a run of member channels", "members count upward from channel
	 * 2", "the upper zone counts downward". Every one of those sentences is a
	 * picture of sixteen boxes, and a reader who has to build that picture in
	 * their head is doing the work the page should have done.
	 *
	 * The confusion this exists to kill is the off-by-one: an eight-member lower
	 * zone occupies channels 1 through 9, not 1 through 8, because the master is
	 * not a member. Stated, that is a sentence you nod at. Drawn, with the
	 * leftovers greyed and counted, it is impossible to get wrong.
	 *
	 * ## Why it reuses `makeZone`
	 *
	 * The same function the MPE lab allocates real notes with decides which cells
	 * are lit here. A diagram that worked out the channel numbers for itself
	 * would be free to drift out of agreement with the code that actually sends
	 * the notes, and a diagram that disagrees with the demo below it is worse
	 * than no diagram.
	 */
	import { untrack } from 'svelte';
	import { makeZone, configureZone, type ZoneSide } from '$lib/midi/mpe';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	interface Props {
		/** Starting side. Both are reachable from the buttons. */
		side?: ZoneSide;
		/** Starting member count. Eight is what most controllers ship with. */
		members?: number;
		class?: string;
	}
	let { side = 'lower', members = 8, class: className }: Props = $props();

	// Seeds, not bindings: the props say where the map starts and the buttons
	// own it from there.
	let zoneSide = $state<ZoneSide>(untrack(() => side));
	let memberCount = $state(untrack(() => members));

	const zone = $derived(makeZone(zoneSide, memberCount));
	const memberSet = $derived(new Set(zone.members));
	/** Channels the zone does not claim, which stay ordinary MIDI channels. */
	const spare = $derived(
		Array.from({ length: 16 }, (_, i) => i).filter((c) => c !== zone.master && !memberSet.has(c))
	);

	/**
	 * The declaration itself, taken from the same builder the lab sends.
	 *
	 * Showing it under the picture is the point where the diagram stops being an
	 * illustration: move the slider and watch the third message change, and the
	 * RPN section of this lesson stops being an unrelated table of numbers.
	 */
	const rpn = $derived(
		configureZone(zone)
			.slice(0, 5)
			.map((m) => (m.type === 'controlChange' ? `CC ${m.controller} = ${m.value}` : ''))
	);

	// ── Geometry ───────────────────────────────────────────────────────────
	const W = 640;
	const CELL = 34;
	const GAP = 4.5;
	const X0 = (W - (16 * CELL + 15 * GAP)) / 2;
	const TOP = 58;
	const H = 40;

	const cellX = (channel: number) => X0 + channel * (CELL + GAP);

	/** The span the member run covers, for the bracket beneath it. */
	const bracket = $derived.by(() => {
		if (zone.members.length === 0) return null;
		const lo = Math.min(...zone.members);
		const hi = Math.max(...zone.members);
		return { x0: cellX(lo), x1: cellX(hi) + CELL };
	});

	/**
	 * Keep a centred label inside the drawing.
	 *
	 * A one-member zone puts the bracket over a single 34-unit cell near the
	 * edge, and a caption centred on it runs off the side and gets clipped by
	 * the viewBox — which is exactly the setting somebody exploring the slider
	 * reaches first. `half` is a generous estimate of the widest line's half
	 * width; the tick below elbows across to wherever this lands it.
	 */
	const clamp = (x: number, half: number) => Math.max(half, Math.min(W - half, x));

	const masterX = $derived(cellX(zone.master));
	/** The master sits at one end; its label has to grow towards the middle. */
	const masterAnchor = $derived(zoneSide === 'lower' ? 'start' : 'end');
	const masterLabelX = $derived(zoneSide === 'lower' ? masterX : masterX + CELL);
</script>

<div class={cn('flex flex-col overflow-hidden rounded-lg border', className)}>
	<div class="overflow-x-auto">
		<svg
			viewBox="0 0 {W} 152"
			class="h-auto w-full min-w-[34rem]"
			role="img"
			aria-label="The sixteen MIDI channels. In this {zoneSide} zone, channel {zone.master +
				1} is the master and channels {zone.members
				.map((m) => m + 1)
				.join(', ')} are members, one note each. {spare.length} channels are left over."
		>
			<!-- ── Master, annotated above ─────────────────────────────────── -->
			<text
				x={masterLabelX}
				y="18"
				text-anchor={masterAnchor}
				font-size="10"
				font-weight="600"
				fill="var(--msg-expr)"
			>
				MASTER · channel {zone.master + 1}
			</text>
			<text
				x={masterLabelX}
				y="31"
				text-anchor={masterAnchor}
				font-size="9"
				class="fill-muted-foreground"
			>
				sustain, programs, a bend that moves the whole zone
			</text>
			<path
				d="M {masterX + CELL / 2} 37 L {masterX + CELL / 2} {TOP - 4}"
				stroke="var(--msg-expr)"
				stroke-width="1.25"
			/>

			<!-- ── The sixteen channels ────────────────────────────────────── -->
			{#each Array.from({ length: 16 }, (_, i) => i) as ch (ch)}
				{@const isMaster = ch === zone.master}
				{@const isMember = memberSet.has(ch)}
				<rect
					x={cellX(ch)}
					y={TOP}
					width={CELL}
					height={H}
					rx="5"
					fill={isMaster
						? 'var(--msg-expr-bg)'
						: isMember
							? 'var(--msg-note-bg)'
							: 'var(--surface-sunken)'}
					stroke={isMaster ? 'var(--msg-expr)' : isMember ? 'var(--msg-note)' : 'var(--border)'}
					stroke-width={isMaster || isMember ? 1.5 : 1}
				/>
				<text
					x={cellX(ch) + CELL / 2}
					y={TOP + 25}
					text-anchor="middle"
					font-size="14"
					font-weight={isMaster || isMember ? '600' : '400'}
					fill={isMaster
						? 'var(--msg-expr)'
						: isMember
							? 'var(--msg-note)'
							: 'var(--muted-foreground)'}
				>
					{ch + 1}
				</text>
			{/each}

			<!-- ── The member run, bracketed below ─────────────────────────── -->
			{#if bracket}
				{@const mid = (bracket.x0 + bracket.x1) / 2}
				<path
					d="M {bracket.x0} {TOP + H + 10} L {bracket.x0} {TOP + H + 4}
					   L {bracket.x1} {TOP + H + 4} L {bracket.x1} {TOP + H + 10}"
					fill="none"
					stroke="var(--msg-note)"
					stroke-width="1.25"
				/>
				{@const labelX = clamp(mid, 112)}
				<path
					d="M {mid} {TOP + H + 4} L {mid} {TOP + H + 12} L {labelX} {TOP + H + 12}"
					fill="none"
					stroke="var(--msg-note)"
					stroke-width="1.25"
				/>
				<text
					x={labelX}
					y={TOP + H + 27}
					text-anchor="middle"
					font-size="10"
					font-weight="600"
					fill="var(--msg-note)"
				>
					{zone.members.length}
					{zone.members.length === 1 ? 'MEMBER' : 'MEMBERS'} · one note each
				</text>
				<text
					x={labelX}
					y={TOP + H + 40}
					text-anchor="middle"
					font-size="9"
					class="fill-muted-foreground"
				>
					its own bend, its own pressure, its own CC 74
				</text>
			{/if}

			<!--
				The leftovers matter. A zone does not have to eat the instrument:
				whatever it does not claim is still an ordinary MIDI channel, and
				that is how one port carries an MPE controller and a drum machine.
			-->
			{#if spare.length}
				{@const lo = cellX(Math.min(...spare))}
				{@const hi = cellX(Math.max(...spare)) + CELL}
				<text
					x={clamp((lo + hi) / 2, 74)}
					y={TOP - 8}
					text-anchor="middle"
					font-size="9"
					class="fill-muted-foreground"
				>
					{spare.length} left over — ordinary MIDI
				</text>
			{/if}
		</svg>
	</div>

	<div class="flex flex-col gap-3 border-t px-4 py-3">
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
			<div class="flex gap-1.5">
				{#each [{ v: 'lower', l: 'Lower zone' }, { v: 'upper', l: 'Upper zone' }] as z (z.v)}
					<Button
						variant={zoneSide === z.v ? 'default' : 'outline'}
						size="sm"
						onclick={() => (zoneSide = z.v as ZoneSide)}
					>
						{z.l}
					</Button>
				{/each}
			</div>
			<label class="flex min-w-[12rem] flex-1 items-center gap-3">
				<span class="label shrink-0">Members</span>
				<input
					type="range"
					min="1"
					max="15"
					step="1"
					bind:value={memberCount}
					class="h-1.5 min-w-0 flex-1 accent-msg-note"
				/>
				<span class="tnum w-5 shrink-0 text-right text-xs text-muted-foreground">
					{memberCount}
				</span>
			</label>
		</div>

		<p class="text-xs leading-relaxed text-muted-foreground">
			<!--
				Spelled out in words as well as drawn, because the arithmetic is the
				trap: the master is not one of the members, so the zone is always one
				channel wider than the member count.
			-->
			{memberCount}
			{memberCount === 1 ? 'member' : 'members'} plus the master is
			<strong class="text-foreground">{memberCount + 1} channels</strong>, so this zone can sound
			{memberCount}
			{memberCount === 1 ? 'note' : 'notes'} at once. The controller announces it on the master with
			<code class="font-mono text-foreground">{rpn[2]}</code>, wrapped in the
			<span class="font-mono">{rpn[0]}</span> / <span class="font-mono">{rpn[1]}</span> that select RPN
			0,6:
		</p>
		<code class="tnum overflow-x-auto rounded-md bg-surface-sunken px-3 py-2 font-mono text-2xs">
			{rpn.join('  ·  ')}
		</code>
	</div>
</div>
