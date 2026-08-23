<script lang="ts">
	/**
	 * The shape MIDI does not send.
	 *
	 * MIDI gives an instrument two instants — key down, key up — and the
	 * instrument has to turn them into something that lasts. The envelope is
	 * how. Every claim the course makes elsewhere that sounds like hand-waving
	 * ("Note Off is not silence", "velocity feels like dynamics", "CC 74 opens
	 * the filter") is a fact about this diagram, so it is worth being able to
	 * grab it.
	 *
	 * Three rules this widget is built to keep honest:
	 *
	 *   1. What is drawn is what is scheduled. `heldLevel` below is the same
	 *      maths the Web Audio calls perform, so the exponential decay on
	 *      screen bends exactly as the sound does. A straight line would be a
	 *      lie that most synth manuals tell.
	 *   2. You hold it. Note On is pointer-down and Note Off is pointer-up,
	 *      because the entire point is that the sustain lasts as long as the
	 *      key is down and the release happens after you let go.
	 *   3. The trace is recorded, not predicted. Let go during the attack and
	 *      the release starts from wherever the level actually was — which is
	 *      the behaviour that surprises people, so it must not be smoothed over.
	 */
	import { audio } from '$lib/audio/engine';
	import { momentary } from '$lib/a11y/momentary';
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	// ── the four numbers ────────────────────────────────────────────────────
	let attack = $state(0.01);
	let decay = $state(0.35);
	let sustain = $state(0.55);
	let release = $state(0.4);

	const A_MAX = 1.2;
	const D_MAX = 1.5;
	const R_MAX = 1.8;

	/**
	 * Five instruments that are five different envelopes and nothing else.
	 *
	 * The organ is the one to press second: same oscillator, same filter, same
	 * pitch, and it stops sounding like a synthesiser pad the instant the
	 * shape changes.
	 */
	const PRESETS = [
		{
			name: 'Pluck',
			a: 0.002,
			d: 0.16,
			s: 0,
			r: 0.12,
			why: 'Nothing to sustain — it decays to silence whether you hold it or not.'
		},
		{
			name: 'Piano',
			a: 0.002,
			d: 1.1,
			s: 0.18,
			r: 0.28,
			why: 'A struck string. Instant start, a long fall, and the damper lands when you lift.'
		},
		{
			name: 'Organ',
			a: 0.004,
			d: 0.01,
			s: 1,
			r: 0.012,
			why: 'A switch. Full level immediately, full level throughout, gone on release.'
		},
		{
			name: 'Strings',
			a: 0.28,
			d: 0.4,
			s: 0.8,
			r: 0.6,
			why: 'A bow takes time to speak, and the room takes time to let go.'
		},
		{
			name: 'Pad',
			a: 0.85,
			d: 0.6,
			s: 0.75,
			r: 1.6,
			why: 'Slow in, slow out. Play a chord and the changes blur into each other.'
		}
	];
	let preset = $state<string | null>(null);

	function apply(p: (typeof PRESETS)[number]) {
		attack = p.a;
		decay = p.d;
		sustain = p.s;
		release = p.r;
		preset = p.name;
	}

	/** Any hand-drag stops claiming to be a preset. */
	function touched() {
		preset = null;
	}

	// ── the maths, used for both the picture and the sound ───────────────────
	/**
	 * Decay and release are `setTargetAtTime`, which is exponential and never
	 * technically arrives; these are the tau values passed to it, so the curve
	 * drawn is the curve scheduled.
	 */
	const decayTau = $derived(Math.max(0.01, decay / 3));
	const releaseTau = $derived(Math.max(0.008, release / 4));

	/**
	 * A set of envelope numbers, snapshotted.
	 *
	 * A sounding note keeps the shape it started with — changing the patch
	 * under it does not reach back and rewrite what is already scheduled, on
	 * this synth or on any other. The trace therefore reads from a copy taken
	 * at Note On rather than from the live controls, so that pressing a preset
	 * mid-note redraws the patch without falsifying the note.
	 */
	type Env = { a: number; d: number; s: number; dTau: number; rTau: number };
	const snapshot = (): Env => ({
		a: attack,
		d: decay,
		s: sustain,
		dTau: decayTau,
		rTau: releaseTau
	});

	/** Level at `t` seconds after Note On, assuming the key is still down. */
	function levelOf(p: Env, t: number): number {
		if (t <= 0) return 0;
		if (t < p.a) return t / p.a;
		return p.s + (1 - p.s) * Math.exp(-(t - p.a) / p.dTau);
	}

	const heldLevel = (t: number) => levelOf(snapshot(), t);

	// ── plot geometry ────────────────────────────────────────────────────────
	/**
	 * Two time axes, meeting at Note Off.
	 *
	 * A single linear axis wide enough for a two-second release draws a
	 * ten-millisecond attack as a hairline against the left edge — unreadable,
	 * and impossible to grab. A single linear axis narrow enough to show the
	 * attack cannot hold a pad. So: distance from the origin goes as the square
	 * root of time, which gives the short stages room while still fitting the
	 * long ones, and the gridlines below say plainly that it does.
	 *
	 * The axis then restarts at Note Off, because the release is measured from
	 * when you let go rather than from when you started. The stretch in between
	 * is the sustain, and it deliberately has no scale at all — it lasts as
	 * long as you hold, which is not a number this diagram gets to know.
	 */
	const W = 1000;
	const H = 250;
	const PAD = { l: 14, r: 10, t: 22, b: 30 };
	const plotW = W - PAD.l - PAD.r;
	const plotH = H - PAD.t - PAD.b;

	const HELD_MAX = A_MAX + D_MAX;
	/** Room left for the sustain even when attack and decay are at maximum. */
	const PLATEAU_MIN = 64;
	const UNIT = (plotW - PLATEAU_MIN) / (Math.sqrt(HELD_MAX) + Math.sqrt(R_MAX));

	const f = (t: number) => Math.sqrt(Math.max(0, t)) * UNIT;
	/** x for `t` seconds after Note On, while the key is still down. */
	const xHeld = (t: number) => PAD.l + f(t);
	/** x of Note Off — fixed, so the picture fills the panel whatever the patch. */
	const xOff = PAD.l + f(HELD_MAX) + PLATEAU_MIN;
	/** x for `dt` seconds after Note Off. */
	const xRel = (dt: number) => xOff + f(dt);

	const tHeld = (x: number) => ((x - PAD.l) / UNIT) ** 2;
	const tRel = (x: number) => ((x - xOff) / UNIT) ** 2;

	const yOf = (v: number) => PAD.t + (1 - Math.max(0, Math.min(1, v))) * plotH;
	const vOf = (y: number) => 1 - (y - PAD.t) / plotH;

	const xAttack = $derived(xHeld(attack));
	const xDecay = $derived(xHeld(attack + decay));
	const xEnd = $derived(xRel(release));

	/** The idle envelope, sampled along x so the curves read as curves. */
	const shape = $derived.by(() => {
		const pts: string[] = [`${xHeld(0)},${yOf(0)}`, `${xAttack},${yOf(1)}`];
		for (let i = 1; i <= 48; i++) {
			const x = xAttack + ((xDecay - xAttack) * i) / 48;
			pts.push(`${x.toFixed(1)},${yOf(heldLevel(tHeld(x))).toFixed(1)}`);
		}
		pts.push(`${xOff},${yOf(sustain)}`);
		for (let i = 1; i <= 48; i++) {
			const x = xOff + ((xEnd - xOff) * i) / 48;
			pts.push(`${x.toFixed(1)},${yOf(sustain * Math.exp(-tRel(x) / releaseTau)).toFixed(1)}`);
		}
		return 'M ' + pts.join(' L ');
	});

	/** Gridlines, without which the horizontal axis is only a feeling. */
	const label = (t: number) => (t < 1 ? `${t * 1000} ms` : `${t} s`);
	const TICKS = [
		...[0.1, 0.25, 0.5, 1, 2].map((t) => ({ x: xHeld(t), text: label(t) })),
		...[0.25, 0.5, 1].map((t) => ({ x: xRel(t), text: `+${label(t)}` }))
	];

	// ── dragging ─────────────────────────────────────────────────────────────
	let svg = $state<SVGSVGElement | null>(null);
	type Handle = 'a' | 'ds' | 'r';
	let dragging = $state<Handle | null>(null);

	function local(e: PointerEvent) {
		const r = svg!.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
	}

	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

	function move(h: Handle, x: number, y: number) {
		if (h === 'a') attack = clamp(tHeld(x), 0.001, Math.min(A_MAX, HELD_MAX - decay));
		else if (h === 'ds') {
			decay = clamp(tHeld(x) - attack, 0.005, Math.min(D_MAX, HELD_MAX - attack));
			sustain = clamp(vOf(y), 0, 1);
		} else release = clamp(tRel(x), 0.005, R_MAX);
	}

	function grab(h: Handle) {
		return (e: PointerEvent) => {
			e.preventDefault();
			(e.currentTarget as Element).setPointerCapture(e.pointerId);
			dragging = h;
			touched();
			const p = local(e);
			move(h, p.x, p.y);
		};
	}

	function drag(e: PointerEvent) {
		if (!dragging) return;
		const p = local(e);
		move(dragging, p.x, p.y);
	}

	/**
	 * Arrow keys move the handles too. A drag target that only answers to a
	 * mouse is a control half the people who meet it cannot use. The steps are
	 * proportional rather than fixed, so a millisecond attack is still
	 * adjustable in milliseconds while a two-second release moves in tenths.
	 */
	function nudge(v: number, dir: number, lo: number, hi: number, coarse: boolean) {
		const step = Math.max(0.001, v * (coarse ? 0.5 : 0.12));
		return clamp(v + dir * step, lo, hi);
	}

	function keys(h: Handle) {
		return (e: KeyboardEvent) => {
			const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
			const dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
			if (!dx && !dy) return;
			e.preventDefault();
			touched();
			if (h === 'a')
				attack = nudge(attack, dx, 0.001, Math.min(A_MAX, HELD_MAX - decay), e.shiftKey);
			else if (h === 'ds') {
				if (dx) decay = nudge(decay, dx, 0.005, Math.min(D_MAX, HELD_MAX - attack), e.shiftKey);
				if (dy) sustain = clamp(sustain + dy * (e.shiftKey ? 0.2 : 0.05), 0, 1);
			} else release = nudge(release, dx, 0.005, R_MAX, e.shiftKey);
		};
	}

	// ── sound ────────────────────────────────────────────────────────────────
	let voice: { osc: OscillatorNode; amp: GainNode; filter: BiquadFilterNode } | null = null;
	let holding = $state(false);
	/** The note actually being played, in plot coordinates. */
	let trace = $state('');
	/** Where an early release jumped from, drawn as a deliberate connector. */
	let jump = $state<{ x: number; y: number } | null>(null);
	let head = $state<{ x: number; y: number } | null>(null);
	let raf = 0;
	let onAt = 0;
	let offAt = 0;
	let releaseFrom = 0;
	/** The shape the sounding note was started with. */
	let live: Env = snapshot();

	async function noteOn() {
		if (holding) return;
		const ctx = await audio.resume();
		const dest = audio.destination;
		if (!ctx || !dest) return;

		silence(true);
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		osc.type = 'sawtooth';
		osc.frequency.value = 220;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.Q.value = 1.2;
		const amp = ctx.createGain();
		amp.gain.setValueAtTime(0.0001, t);

		// The amplitude envelope, exactly as drawn.
		amp.gain.linearRampToValueAtTime(0.26, t + Math.max(0.001, attack));
		amp.gain.setTargetAtTime(0.26 * Math.max(0.0004, sustain), t + attack, decayTau);

		// A filter on the same shape, because an envelope that only moves the
		// volume sounds like someone turning a knob rather than like an
		// instrument starting.
		filter.frequency.setValueAtTime(300, t);
		filter.frequency.linearRampToValueAtTime(5200, t + Math.max(0.001, attack));
		filter.frequency.setTargetAtTime(600 + 3200 * sustain, t + attack, decayTau);

		osc.connect(filter).connect(amp).connect(dest);
		osc.start(t);
		voice = { osc, amp, filter };

		holding = true;
		live = snapshot();
		onAt = performance.now();
		trace = '';
		jump = null;
		startTracing();
	}

	function silence(immediate = false) {
		if (!voice) return;
		const ctx = audio.context;
		const v = voice;
		voice = null;
		if (!ctx) return;
		const t = ctx.currentTime;
		const r = immediate ? 0.004 : live.rTau;
		v.amp.gain.cancelScheduledValues(t);
		v.amp.gain.setTargetAtTime(0.0001, t, r);
		v.filter.frequency.cancelScheduledValues(t);
		v.filter.frequency.setTargetAtTime(300, t, r);
		try {
			v.osc.stop(t + r * 8 + 0.05);
		} catch {
			/* already stopped */
		}
		v.osc.onended = () => {
			v.osc.disconnect();
			v.filter.disconnect();
			v.amp.disconnect();
		};
	}

	function noteOff() {
		if (!holding) return;
		holding = false;
		offAt = performance.now();
		silence();
	}

	/**
	 * The playhead.
	 *
	 * While held it eases towards Note Off and never quite arrives, however
	 * long you hold — which is the right picture, since that stretch of the
	 * axis stands for an unbounded amount of time. Letting go moves it to the
	 * Note Off line, and because that is a real jump on a broken axis it is
	 * drawn as one: a dotted connector at the level the note had actually
	 * reached, which is the level the release then starts from.
	 */
	function startTracing() {
		cancelAnimationFrame(raf);
		const pts: string[] = [];
		let last = { x: xHeld(0), y: yOf(0) };
		const step = () => {
			const now = performance.now();
			let x: number;
			let v: number;
			if (holding) {
				const e = (now - onAt) / 1000;
				const knee = live.a + live.d;
				v = levelOf(live, e);
				if (e < knee) {
					x = xHeld(e);
				} else {
					const from = xHeld(knee);
					x = from + (xOff - from) * (1 - Math.exp(-(e - knee) / 0.9));
				}
				releaseFrom = v;
			} else {
				const e = (now - offAt) / 1000;
				if (!jump) {
					jump = last;
					pts.length = 0;
				}
				x = xRel(e);
				v = releaseFrom * Math.exp(-e / live.rTau);
				if (x > W - PAD.r || v < 0.0015) {
					head = null;
					trace = pts.length > 1 ? 'M ' + pts.join(' L ') : '';
					return;
				}
			}
			const y = yOf(v);
			last = { x, y };
			pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
			if (pts.length > 900) pts.shift();
			trace = 'M ' + pts.join(' L ');
			head = last;
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}

	onDestroy(() => {
		cancelAnimationFrame(raf);
		silence(true);
	});

	const ms = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`);
</script>

<svelte:window
	onpointermove={drag}
	onpointerup={() => (dragging = null)}
	onpointercancel={() => (dragging = null)}
/>

<div class={cn('flex flex-col gap-3', className)}>
	<div class="flex flex-wrap items-center gap-1.5">
		{#each PRESETS as p (p.name)}
			<button
				type="button"
				onclick={() => apply(p)}
				aria-pressed={preset === p.name}
				use:momentary
				class="rounded-md border px-2.5 py-1 text-xs transition-colors
					hover:border-foreground/30 hover:bg-accent
					aria-pressed:border-transparent aria-pressed:bg-foreground aria-pressed:text-background"
			>
				{p.name}
			</button>
		{/each}
	</div>

	<div class="panel-sunken overflow-hidden rounded-lg border">
		<svg
			bind:this={svg}
			viewBox="0 0 {W} {H}"
			class="block w-full touch-none select-none"
			style="height: {H * 0.68}px"
			role="group"
			aria-label="Envelope shape. Three handles set attack, decay, sustain and release."
		>
			{#each TICKS as t (t.text)}
				<line
					x1={t.x}
					y1={PAD.t}
					x2={t.x}
					y2={PAD.t + plotH}
					stroke="var(--grid-line)"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
				/>
				<text
					x={t.x + 4}
					y={H - 11}
					class="fill-muted-foreground font-mono"
					style="font-size: 11px"
				>
					{t.text}
				</text>
			{/each}

			<line
				x1={PAD.l}
				y1={yOf(0)}
				x2={W - PAD.r}
				y2={yOf(0)}
				stroke="var(--grid-line-strong)"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>

			<!--
				The stretch with no scale. Everything to its left is time since
				Note On; everything to its right is time since Note Off; the band
				itself is however long you decide to hold, which is why it is the
				one part of the axis with no gridlines in it.
			-->
			<rect
				x={xDecay}
				y={PAD.t}
				width={Math.max(0, xOff - xDecay)}
				height={plotH}
				fill="var(--msg-note)"
				opacity="0.045"
			/>
			<!--
				Named in the header row rather than inside the band: a label sitting
				in the plot is a label that a curve eventually runs through, and
				this band is exactly where a zero-sustain patch draws a flat line.
			-->
			{#if xOff - xDecay > 150}
				<text
					x={(xDecay + xOff) / 2}
					y={PAD.t - 9}
					text-anchor="middle"
					class="fill-muted-foreground font-mono"
					style="font-size: 11px; letter-spacing: 0.08em"
				>
					held
				</text>
			{/if}

			<!-- The two instants MIDI actually sends. Everything else is the instrument. -->
			{#each [{ x: PAD.l, label: 'Note On', anchor: 'start' }, { x: xOff, label: 'Note Off', anchor: 'end' }] as m (m.label)}
				<line
					x1={m.x}
					y1={PAD.t - 8}
					x2={m.x}
					y2={PAD.t + plotH}
					stroke="var(--msg-note)"
					stroke-width="1"
					stroke-dasharray="2 3"
					opacity="0.85"
					vector-effect="non-scaling-stroke"
				/>
				<text
					x={m.anchor === 'end' ? m.x - 5 : m.x + 5}
					y={PAD.t - 9}
					text-anchor={m.anchor}
					class="fill-msg-note font-mono"
					style="font-size: 11px; letter-spacing: 0.04em"
				>
					{m.label}
				</text>
			{/each}

			<path
				d={shape}
				fill="none"
				stroke="var(--msg-note)"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
				opacity={head ? 0.3 : 1}
				vector-effect="non-scaling-stroke"
			/>

			{#if jump}
				<line
					x1={jump.x}
					y1={jump.y}
					x2={xOff}
					y2={jump.y}
					stroke="var(--foreground)"
					stroke-width="1.5"
					stroke-dasharray="1 4"
					stroke-linecap="round"
					opacity="0.55"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
			{#if trace}
				<path
					d={trace}
					fill="none"
					stroke="var(--foreground)"
					stroke-width="2.5"
					stroke-linejoin="round"
					stroke-linecap="round"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
			{#if head}
				<circle cx={head.x} cy={head.y} r="5" fill="var(--foreground)" />
			{/if}

			{#snippet handle(h: Handle, x: number, y: number, name: string, value: string, now: number)}
				<g
					role="slider"
					tabindex="0"
					aria-label={name}
					aria-valuetext={value}
					aria-valuenow={now}
					aria-valuemin={0}
					aria-valuemax={100}
					class="group cursor-grab outline-none"
					onpointerdown={grab(h)}
					onkeydown={keys(h)}
				>
					<circle cx={x} cy={y} r="22" fill="transparent" />
					<circle
						cx={x}
						cy={y}
						r="10"
						fill="none"
						stroke="var(--ring)"
						stroke-width="2"
						class="opacity-0 group-focus-visible:opacity-100"
						vector-effect="non-scaling-stroke"
					/>
					<circle
						cx={x}
						cy={y}
						r="5.5"
						fill="var(--background)"
						stroke="var(--msg-note)"
						stroke-width="2.5"
						vector-effect="non-scaling-stroke"
					/>
				</g>
			{/snippet}

			{@render handle('a', xAttack, yOf(1), 'Attack time', ms(attack), (attack / A_MAX) * 100)}
			{@render handle(
				'ds',
				xDecay,
				yOf(sustain),
				'Decay time and sustain level',
				`${ms(decay)}, ${Math.round(sustain * 100)}%`,
				sustain * 100
			)}
			{@render handle('r', xEnd, yOf(0), 'Release time', ms(release), (release / R_MAX) * 100)}
		</svg>
	</div>

	<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
		<button
			type="button"
			use:momentary
			onpointerdown={noteOn}
			onpointerup={noteOff}
			onpointerleave={noteOff}
			onkeydown={(e) => {
				if (e.key === ' ' || e.key === 'Enter') {
					e.preventDefault();
					if (!e.repeat) noteOn();
				}
			}}
			onkeyup={(e) => {
				if (e.key === ' ' || e.key === 'Enter') noteOff();
			}}
			class={cn(
				'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
				holding
					? 'border-transparent bg-msg-note text-background'
					: 'hover:border-foreground/30 hover:bg-accent'
			)}
		>
			{holding ? 'Holding — let go' : 'Hold to play'}
		</button>

		<dl class="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs">
			{#each [['A', ms(attack)], ['D', ms(decay)], ['S', `${Math.round(sustain * 100)}%`], ['R', ms(release)]] as [k, v] (k)}
				<div class="flex items-baseline gap-1.5">
					<dt class="text-msg-note">{k}</dt>
					<dd class="tnum text-muted-foreground">{v}</dd>
				</div>
			{/each}
		</dl>

		<span class="ml-auto text-2xs text-muted-foreground">
			Time is square-root scaled, so a ten-millisecond attack is still something you can see.
		</span>
	</div>

	<p class="min-h-[2lh] text-sm leading-relaxed text-muted-foreground">
		{#if preset}
			{PRESETS.find((p) => p.name === preset)?.why}
		{:else}
			Hold the button and let go at different moments. Let go during the attack and the release
			starts from wherever the level had reached — the instrument has no idea a Note Off is coming.
		{/if}
	</p>
</div>
