<script lang="ts">
	/**
	 * The stream, as a picture of the wire.
	 *
	 * A log answers "did that message arrive" and is very bad at "what shape is
	 * this". A mod wheel sweep is forty rows of Control Change that you read one
	 * at a time; here it is a curve. A held chord is six rows scattered among
	 * the clock; here it is six marks at their pitches, side by side.
	 *
	 * The layout is one lane per channel and one for system messages, time
	 * running right to left with the present at the right edge. Within a lane
	 * the vertical axis is simply **the value on the wire, 0 to 127** — a note
	 * number for a note, a controller value for a CC, the high seven bits for a
	 * bend. That is the one axis every channel message shares, so nothing has
	 * to be rescaled to fit beside anything else, and the colour says which
	 * kind of number you are looking at.
	 */
	import { onMount } from 'svelte';
	import { bus, type MidiEvent } from '$lib/midi/bus';
	import { family, type MessageFamily } from '$lib/midi/messages';
	import { monitor } from '$lib/midi/monitor.svelte';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** Seconds of history across the width. */
		window?: number;
		class?: string;
	}
	let { window: seconds = 8, class: className }: Props = $props();

	/** Channels are 0–15; anything without one shares this lane. */
	const SYSTEM_LANE = 16;

	interface Mark {
		t: number;
		lane: number;
		/** 0–1 up the lane: the data byte, which every channel message has. */
		value: number;
		fam: MessageFamily;
		dim: boolean;
		/** Note number, for the ones drawn as bars. */
		note?: number;
		/** When the note ended. Undefined while it is still held. */
		end?: number;
	}

	let host = $state<HTMLDivElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);

	/**
	 * What each message contributes. Returning null drops it — running status
	 * bytes and active sensing say nothing about shape and would only fog the
	 * picture.
	 */
	function markOf(e: MidiEvent): Mark | null {
		const m = e.message;
		const fam = family(m);
		const dim = e.direction === 'out';
		const base = { t: e.time, fam, dim };
		switch (m.type) {
			case 'noteOn':
				// A note is a bar from here to its Note Off, so it carries its own
				// number and waits for an end.
				return { ...base, lane: m.channel, value: m.note / 127, note: m.note };
			case 'noteOff':
				return null;
			case 'controlChange':
				return { ...base, lane: m.channel, value: m.value / 127 };
			case 'pitchBend':
				return { ...base, lane: m.channel, value: m.value / 16383 };
			case 'channelAftertouch':
				return { ...base, lane: m.channel, value: m.pressure / 127 };
			case 'polyAftertouch':
				return { ...base, lane: m.channel, value: m.pressure / 127 };
			case 'programChange':
				return { ...base, lane: m.channel, value: m.program / 127 };
			case 'clock':
			case 'activeSensing':
				return null;
			default:
				return { ...base, lane: SYSTEM_LANE, value: 0.5 };
		}
	}

	onMount(() => {
		/**
		 * A few seconds of marks. Older ones fall off the left and are dropped.
		 *
		 * Seeded from the monitor's own buffer rather than starting blank: the
		 * last few seconds already happened, and a view that shows nothing until
		 * something new arrives makes you play a note to find out whether it
		 * works.
		 */
		let marks: Mark[] = [];

		/*
		 * Lanes are the channels that have actually spoken, not all sixteen.
		 *
		 * Sixteen lanes in a panel this tall gives each one about thirty pixels,
		 * which puts the whole 0–127 axis inside twenty-four of them and makes an
		 * octave three pixels — a melody drawn as a flat line of dots. The set
		 * only ever grows, so nothing jumps around while you are reading it.
		 */
		const lanes = new Set<number>();

		const take = (e: MidiEvent) => {
			const mark = markOf(e);
			if (!mark) {
				// A Note Off closes the bar its Note On opened, latest first.
				const m = e.message;
				if (m.type === 'noteOff' || (m.type === 'noteOn' && m.velocity === 0)) {
					for (let i = marks.length - 1; i >= 0; i--) {
						const open = marks[i];
						if (open.note === m.note && open.lane === m.channel && open.end === undefined) {
							open.end = e.time;
							break;
						}
					}
				}
				return;
			}
			lanes.add(mark.lane);
			marks.push(mark);
		};

		// The last few seconds already happened; a view that shows nothing until
		// something new arrives makes you play a note to find out whether it works.
		const cutoff = performance.now() - seconds * 1000;
		for (const e of monitor.events) if (e.time >= cutoff) take(e);

		const off = bus.subscribe((e) => {
			if (!monitor.paused) take(e);
		});

		const ink: Record<string, string> = {};
		const readTheme = () => {
			if (!host) return;
			const cs = getComputedStyle(host);
			for (const f of ['note', 'cc', 'expr', 'program', 'clock', 'sysex', 'common']) {
				ink[f] = cs.getPropertyValue(`--msg-${f}`).trim() || cs.color;
			}
			ink.rule = cs.getPropertyValue('--grid-line').trim() || cs.color;
			ink.strong = cs.getPropertyValue('--grid-line-strong').trim() || cs.color;
			ink.label = cs.getPropertyValue('--muted-foreground').trim() || cs.color;
		};
		readTheme();
		const themeWatch = new MutationObserver(readTheme);
		themeWatch.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'style', 'data-theme']
		});

		/*
		 * Each lane finds its own vertical range, the way a scope does.
		 *
		 * A fixed 0–127 axis is honest and useless: a melody inside one octave
		 * is a twelfth of the lane, which is a flat ribbon whatever height the
		 * lane has. So the range is whatever is actually in the window, opened
		 * out to at least two octaves and snapped to octave boundaries so the
		 * numbers stay round — and eased toward, so it settles rather than
		 * twitching on every note.
		 */
		const ranges = new Map<number, { lo: number; hi: number }>();
		const SPAN_MIN = 24;

		function rangeFor(lane: number, values: number[]) {
			let lo = 127;
			let hi = 0;
			for (const v of values) {
				if (v < lo) lo = v;
				if (v > hi) hi = v;
			}
			if (lo > hi) {
				lo = 48;
				hi = 84;
			}
			const centre = (lo + hi) / 2;
			const span = Math.max(SPAN_MIN, hi - lo + 8);
			let low = Math.max(0, Math.floor((centre - span / 2) / 12) * 12);
			let high = Math.min(127, Math.ceil((centre + span / 2) / 12) * 12);
			if (high - low < SPAN_MIN) high = Math.min(127, low + SPAN_MIN);
			if (high - low < SPAN_MIN) low = Math.max(0, high - SPAN_MIN);

			const current = ranges.get(lane) ?? { lo: low, hi: high };
			// Ease, so a new note opens the window smoothly instead of snapping it.
			current.lo += (low - current.lo) * 0.12;
			current.hi += (high - current.hi) * 0.12;
			ranges.set(lane, current);
			return current;
		}

		let frame = 0;
		const draw = () => {
			frame = requestAnimationFrame(draw);
			const ctx = canvas?.getContext('2d');
			if (!ctx || !canvas) return;
			const dpr = globalThis.devicePixelRatio || 1;
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			if (!w || !h) return;
			if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
				canvas.width = Math.round(w * dpr);
				canvas.height = Math.round(h * dpr);
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);

			const now = performance.now();
			const span = seconds * 1000;
			if (marks.length && now - (marks[0].end ?? marks[0].t) > span + 1000) {
				marks = marks.filter((m) => now - (m.end ?? m.t) <= span);
			}

			const order = [...lanes].sort((a, b) => a - b);
			if (!order.length) order.push(0);
			const GUTTER = 30;
			const laneH = h / order.length;
			const plotW = w - GUTTER;
			const rowOf = (lane: number) => order.indexOf(lane);

			// One pass to collect what each lane is carrying, so the axis can fit it.
			const perLane = new Map<number, number[]>();
			for (const m of marks) {
				const list = perLane.get(m.lane);
				if (list) list.push(m.value * 127);
				else perLane.set(m.lane, [m.value * 127]);
			}
			const axis = new Map<number, { lo: number; hi: number }>();
			for (const lane of order) axis.set(lane, rangeFor(lane, perLane.get(lane) ?? []));
			/** Where a 0–127 value sits inside its lane, given that lane's range. */
			const yOf = (lane: number, value: number, top: number) => {
				const r = axis.get(lane)!;
				const f = (value * 127 - r.lo) / Math.max(1, r.hi - r.lo);
				return top + laneH - 3 - Math.max(0, Math.min(1, f)) * (laneH - 6);
			};

			// Lane rules and their numbers. The grid is the whole reason a mark
			// means anything: without it a dot is a dot.
			ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
			ctx.textBaseline = 'middle';
			for (let i = 0; i < order.length; i++) {
				const lane = order[i];
				const y = Math.round(i * laneH) + 0.5;
				ctx.strokeStyle = ink.rule;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(GUTTER, y);
				ctx.lineTo(w, y);
				ctx.stroke();

				// The octave lines this lane currently spans, so a height can be read
				// against something rather than guessed at.
				const r = axis.get(lane)!;
				if (lane !== SYSTEM_LANE && laneH > 40) {
					ctx.setLineDash([2, 4]);
					for (let n = Math.ceil(r.lo / 12) * 12; n <= r.hi; n += 12) {
						const gy = Math.round(yOf(lane, n / 127, i * laneH)) + 0.5;
						ctx.beginPath();
						ctx.moveTo(GUTTER, gy);
						ctx.lineTo(w, gy);
						ctx.stroke();
						ctx.fillStyle = ink.label;
						ctx.textAlign = 'left';
						ctx.fillText(
							noteName(n, { convention: settings.octaveConvention }),
							GUTTER + 4,
							gy - 5
						);
					}
					ctx.setLineDash([]);
				}

				ctx.fillStyle = ink.label;
				ctx.textAlign = 'right';
				ctx.fillText(lane === SYSTEM_LANE ? 'sys' : `ch ${lane + 1}`, GUTTER - 6, y + laneH / 2);
			}
			ctx.strokeStyle = ink.strong;
			ctx.beginPath();
			ctx.moveTo(GUTTER + 0.5, 0);
			ctx.lineTo(GUTTER + 0.5, h);
			ctx.stroke();

			// The present, at the right edge.
			ctx.strokeStyle = ink.strong;
			ctx.beginPath();
			ctx.moveTo(w - 0.5, 0);
			ctx.lineTo(w - 0.5, h);
			ctx.stroke();

			const xOf = (t: number) => GUTTER + (1 - (now - t) / span) * plotW;
			for (const m of marks) {
				const row = rowOf(m.lane);
				if (row < 0) continue;
				const y = yOf(m.lane, m.value, row * laneH);
				ctx.fillStyle = ink[m.fam] ?? ink.common;
				ctx.globalAlpha = m.dim ? 0.5 : 1;
				if (m.note !== undefined) {
					// A note is as long as it was held, which is the one thing a log
					// of Note On and Note Off rows cannot show you.
					const x0 = Math.max(GUTTER, xOf(m.t));
					const x1 = Math.min(w, xOf(m.end ?? now));
					if (x1 < GUTTER) continue;
					ctx.fillRect(x0, y - 1.5, Math.max(2, x1 - x0), 3);
				} else {
					const x = xOf(m.t);
					if (x < GUTTER) continue;
					ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
				}
			}
			ctx.globalAlpha = 1;
		};
		frame = requestAnimationFrame(draw);

		return () => {
			off();
			cancelAnimationFrame(frame);
			themeWatch.disconnect();
		};
	});
</script>

<div bind:this={host} class={cn('panel-sunken relative flex min-h-0 flex-col', className)}>
	<!--
		Fallback content, not an aria-label: a canvas is an interactive element as
		far as ARIA is concerned, and its accessible description is what is
		written between the tags.
	-->
	<canvas bind:this={canvas} class="block min-h-0 w-full flex-1">
		One lane per MIDI channel, time running right to left, height showing the value each message
		carried. The stream view beside it lists the same messages as text.
	</canvas>
	<div
		class="flex shrink-0 items-baseline justify-between border-t px-2 py-1 text-2xs text-muted-foreground"
	>
		<span>−{seconds}s</span>
		<span class="label">notes are as long as you held them · each lane fits what it carries</span>
		<span>now</span>
	</div>
</div>
