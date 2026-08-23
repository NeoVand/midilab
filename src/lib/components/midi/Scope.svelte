<script lang="ts">
	/**
	 * The spectrum of whatever this page is making, one bar per semitone.
	 *
	 * This was a hand-rolled canvas analyser and it was wrong: the frequency
	 * axis was a made-up power curve rather than a real logarithmic scale, so
	 * the bars did not sit where the frequencies actually are. It is
	 * audioMotion-analyzer now, which does the octave-band maths properly and
	 * is a far better piece of engineering than anything worth writing here.
	 *
	 * The one choice that is ours: 1/12th-octave bands, which puts exactly one
	 * bar on every semitone. Play a C and the C bar lights, then the C an
	 * octave up, then the G above that — the harmonic series, on the same axis
	 * as the note numbers this whole app is about.
	 */
	import { onMount } from 'svelte';
	import AudioMotionAnalyzer from 'audiomotion-analyzer';
	import { audio } from '$lib/audio/engine';
	import { noteName, noteToFrequency } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { device } from '$lib/stores/device.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		height?: number;
		/** Names the panel. Without it the analyser is an unexplained rectangle. */
		label?: string;
		/** Draw only the bars — for an analyser set into a larger front panel. */
		bare?: boolean;
		/** Draw the octave axis under the bars. */
		scale?: boolean;
		/**
		 * Reads back whether the bus is actually carrying signal, so a panel
		 * around this can label its own screen without repeating the test.
		 */
		sounding?: boolean;
		class?: string;
	}
	let {
		height = 108,
		label,
		bare = false,
		scale = true,
		sounding = $bindable(false),
		class: className
	}: Props = $props();

	/*
	 * The range the bars are drawn over, and the axis below reads from the same.
	 *
	 * The labelled span is the nine octave Cs from MIDI note 24 to note 120 — a
	 * piano and then some. The right edge is note 127, the highest pitch a MIDI
	 * note number can name, and the left edge is the same distance below note
	 * 24: so every fundamental the protocol can ask for is inside the picture,
	 * nothing above the highest of them is drawn as though it mattered, and the
	 * first and last labels are not jammed against the sides.
	 *
	 * A phone gives up the bottom octave. Notes 24 to 35 are the pedal register
	 * of an organ and the bottom of a five-string bass; on a desk they cost
	 * nothing to include, and across three hundred pixels they are an eighth of
	 * the width spent on a region almost nothing puts a fundamental in. What is
	 * left is the octaves music is actually written in, wider.
	 */
	const LOWEST_LABEL = $derived(device.narrow ? 36 : 24);
	const HIGHEST_LABEL = 120;

	const MARGIN = noteToFrequency(127) / noteToFrequency(HIGHEST_LABEL);
	const MIN_HZ = $derived(noteToFrequency(LOWEST_LABEL) / MARGIN);
	const MAX_HZ = noteToFrequency(HIGHEST_LABEL) * MARGIN;

	/**
	 * How finely to slice the spectrum, which is a question about pixels.
	 *
	 * One band per semitone is the right answer on a desk: the harmonic series
	 * lands on named notes and you can read a fifth off the screen. Across a
	 * phone it is ninety-six bars in three hundred pixels — three pixels each,
	 * with a gap — which is not a spectrum, it is a texture. So a narrow screen
	 * gets third-octave bands instead: two dozen bars, thirteen pixels wide,
	 * still logarithmic, still showing a filter open and a chord spread out,
	 * and actually visible.
	 *
	 * The same arithmetic applies to the axis. Nine octave labels across a
	 * phone collide; every other one does not, and the gridlines still mark
	 * all nine.
	 */
	const bands = $derived(device.narrow ? 6 : 2);
	const labelEvery = $derived(device.narrow ? 2 : 1);

	/**
	 * One tick per octave C, named the way the rest of the app names notes —
	 * so a bar lighting under "C3" is the same C3 the keyboard and the byte
	 * readout are talking about.
	 */
	const OCTAVES = $derived.by(() => {
		const out: { label: string; left: number; named: boolean }[] = [];
		const span = Math.log2(MAX_HZ / MIN_HZ);
		let i = 0;
		for (let note = LOWEST_LABEL; note <= HIGHEST_LABEL; note += 12, i++) {
			out.push({
				label: noteName(note, { convention: settings.octaveConvention }),
				left: (Math.log2(noteToFrequency(note) / MIN_HZ) / span) * 100,
				named: i % labelEvery === 0
			});
		}
		return out;
	});

	let host = $state<HTMLDivElement | null>(null);
	let analyzer: AudioMotionAnalyzer | null = null;

	/*
	 * Rotating a phone, or dragging a desktop window narrow, changes the answer
	 * to "how many bars fit" — so it is re-asked rather than decided once when
	 * the analyser was built. At component scope, because an effect created
	 * inside `onMount` has no owner to be cleaned up by.
	 */
	$effect(() => {
		const [m, lo] = [bands, MIN_HZ];
		if (!analyzer) return;
		analyzer.mode = m;
		analyzer.minFreq = lo;
	});

	onMount(() => {
		// The graph is built here rather than waited for: suspended and silent,
		// but present, so the analyser has something to attach to and the panel
		// shows its resting floor instead of an empty rectangle.
		audio.prime();
		let frame = 0;
		let themeWatch: MutationObserver | null = null;

		/**
		 * audioMotion needs real colours, and CSS custom properties are not
		 * real colours until something computes them — so they are read off the
		 * element and read again whenever the theme flips.
		 */
		const paint = (a: AudioMotionAnalyzer) => {
			if (!host) return;
			const cs = getComputedStyle(host);
			const ink = cs.getPropertyValue('--foreground').trim() || cs.color;
			const dim = cs.getPropertyValue('--muted-foreground').trim() || ink;
			a.registerGradient('lab', {
				bgColor: 'transparent',
				colorStops: [
					{ pos: 0, color: `color-mix(in oklch, ${ink} 92%, transparent)` },
					{ pos: 0.55, color: `color-mix(in oklch, ${ink} 55%, transparent)` },
					{ pos: 1, color: `color-mix(in oklch, ${dim} 30%, transparent)` }
				]
			});
			a.gradient = 'lab';
		};

		const build = () => {
			const node = audio.analyser;
			if (!node || !host || analyzer) return;
			analyzer = new AudioMotionAnalyzer(host, {
				source: node,
				// The master bus already reaches the speakers; this is a tap.
				connectSpeakers: false,
				// How many bands, and therefore how wide each bar is — see `bands`.
				mode: bands,
				frequencyScale: 'log',
				minFreq: MIN_HZ,
				maxFreq: MAX_HZ,
				ansiBands: false,
				// audioMotion's own axis is drawn on a hardcoded black bar with
				// light text, which is a black stripe across a light panel. The
				// axis below is ours, in the app's colours and in its octave
				// naming — the same C3 the rest of the app means.
				showScaleX: false,
				showScaleY: false,
				showBgColor: false,
				overlay: true,
				showPeaks: true,
				peakFadeTime: 900,
				peakHoldTime: 400,
				smoothing: 0.6,
				fftSize: 8192,
				colorMode: 'gradient',
				roundBars: false,
				alphaBars: false,
				channelLayout: 'single'
			});
			paint(analyzer);
			themeWatch = new MutationObserver(() => analyzer && paint(analyzer));
			themeWatch.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class', 'style', 'data-theme']
			});
		};

		/*
		 * The audio graph does not exist until the first gesture that wakes it,
		 * and nothing announces when it does — so watch for it, and read the
		 * level off the same node while we are here.
		 */
		const tick = () => {
			frame = requestAnimationFrame(tick);
			if (!analyzer) {
				build();
				return;
			}
			// A hair above the noise floor of a silent bus, far below audible.
			const level = analyzer.getEnergy();
			const on = level > 0.008;
			if (on !== sounding) sounding = on;
		};
		frame = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(frame);
			themeWatch?.disconnect();
			analyzer?.destroy();
			analyzer = null;
		};
	});
</script>

<div class={cn('flex flex-col', !bare && 'overflow-hidden rounded-lg border bg-card', className)}>
	{#if label}
		<div class="flex items-baseline justify-between border-b px-3 py-1.5">
			<span class="label">{label}</span>
			<span class="label" class:text-ok={sounding}>{sounding ? 'sounding' : 'silent'}</span>
		</div>
	{/if}
	<!--
		`flex-1` only in the bare form, where the panel around it sets the height.
		In the standalone card the height prop is the height, and a flex-basis of
		zero would win against it and collapse the whole thing to its axis.
	-->
	<div
		class={cn('relative w-full', bare ? 'min-h-0 flex-1' : 'panel-sunken shrink-0')}
		style={bare ? undefined : `height: ${height}px`}
	>
		<!--
			The octave grid the bars are read against, and the floor they stand
			on. It is the same set of lines the axis below is labelled with, so a
			bar can be placed by eye without counting — and it means the panel is
			an instrument screen with nothing on it rather than an empty box,
			which is what it looked like before a note had been played.
		-->
		<div class="pointer-events-none absolute inset-0" aria-hidden="true">
			{#each OCTAVES as tick (tick.label)}
				<span class="absolute inset-y-0 w-px bg-grid-line" style="left: {tick.left}%"></span>
			{/each}
			<span class="absolute inset-x-0 bottom-0 h-px bg-grid-line-strong"></span>
		</div>
		<div
			bind:this={host}
			class="absolute inset-0"
			role="img"
			aria-label="Live spectrum analyser, {device.narrow
				? 'one bar per third of an octave'
				: 'one bar per semitone'}"
		></div>
	</div>
	{#if scale}
		<div class="relative h-4 shrink-0 select-none" aria-hidden="true">
			{#each OCTAVES as tick (tick.label)}
				{#if tick.named}
					<span
						class="tnum absolute top-0 -translate-x-1/2 text-2xs text-muted-foreground"
						style="left: {tick.left}%"
					>
						{tick.label}
					</span>
				{/if}
			{/each}
		</div>
	{/if}
</div>
