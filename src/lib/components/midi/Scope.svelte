<script lang="ts">
	/**
	 * Master-bus waveform and spectrum, straight off the analyser node.
	 *
	 * Two things here are worth knowing:
	 *
	 * A canvas cannot read CSS custom properties. `ctx.strokeStyle =
	 * 'var(--foreground)'` is not an error — the assignment is simply ignored
	 * and the property keeps whatever it had, which is black. So every colour is
	 * resolved off the element's computed style and re-resolved when the theme
	 * changes.
	 *
	 * And the trace is triggered, the way a real scope is: the draw starts at
	 * the first rising zero crossing rather than at sample zero. Without that,
	 * a steady tone slides sideways every frame and the instrument looks like it
	 * is guessing. With it, a held note stands still.
	 */
	import { onMount } from 'svelte';
	import { audio } from '$lib/audio/engine';
	import { cn } from '$lib/utils';

	interface Props {
		height?: number;
		mode?: 'wave' | 'spectrum' | 'both';
		/** Names the panel. Without it the scope is an unexplained empty rectangle. */
		label?: string;
		/**
		 * What the canvas is, for a screen reader. A canvas has no accessible
		 * name of its own, so without this the trace is an anonymous blank.
		 */
		ariaLabel?: string;
		/** Draw only the trace — for a scope set into a larger front panel. */
		bare?: boolean;
		/**
		 * With nothing sounding, draw this oscillator shape as a faint reference
		 * trace. A scope showing the shape the current voice *will* make is both
		 * honest and useful; an empty rectangle is neither.
		 */
		idleShape?: OscillatorType;
		/**
		 * Reads back whether the bus is actually carrying signal — so a panel
		 * around this can label its own screen without duplicating the test.
		 */
		sounding?: boolean;
		class?: string;
	}
	let {
		height = 96,
		mode = 'both',
		label,
		ariaLabel = 'Output waveform',
		bare = false,
		idleShape,
		sounding = $bindable(false),
		class: className
	}: Props = $props();

	/** Enough cycles to name the shape at a glance, few enough to read it. */
	const IDLE_CYCLES = 3;

	/** One period of each oscillator, phase in turns. */
	function shapeAt(shape: OscillatorType, phase: number): number {
		const t = phase - Math.floor(phase);
		switch (shape) {
			case 'square':
				return t < 0.5 ? 1 : -1;
			case 'sawtooth':
				return 2 * t - 1;
			case 'triangle':
				return t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
			default:
				return Math.sin(t * Math.PI * 2);
		}
	}

	let canvas = $state<HTMLCanvasElement | null>(null);
	/** The audio graph only exists after the first gesture that wakes it. */
	let live = $state(false);

	onMount(() => {
		let frame = 0;
		const wave = new Float32Array(2048);
		const spectrum = new Uint8Array(1024);

		let ink = '#000';
		let rule = '#888';
		let bars = '#888';
		let sweepInk = '#888';
		const readTheme = () => {
			if (!canvas) return;
			const cs = getComputedStyle(canvas);
			ink = cs.getPropertyValue('--foreground').trim() || cs.color;
			rule = cs.getPropertyValue('--grid-line-strong').trim() || ink;
			// Not a family colour. Blue is Control Change everywhere else in this
			// app, and a spectrum is not a control change.
			bars = `color-mix(in oklch, ${ink} 15%, transparent)`;
			sweepInk = `color-mix(in oklch, ${ink} 38%, transparent)`;
		};
		readTheme();
		// The theme lives as a class and a data attribute on <html>; both flip
		// every colour under it, and neither fires an event.
		const themeWatch = new MutationObserver(readTheme);
		themeWatch.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'style', 'data-theme']
		});

		const draw = () => {
			frame = requestAnimationFrame(draw);
			const ctx = canvas?.getContext('2d');
			if (!ctx || !canvas) return;
			const dpr = window.devicePixelRatio || 1;
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
				canvas.width = w * dpr;
				canvas.height = h * dpr;
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, w, h);
			const mid = Math.round(h / 2) + 0.5;

			// A scope at rest still shows its zero line, and a real one sweeps it.
			// A blank rectangle reads as broken; a swept flat line reads as a
			// switched-on instrument with nothing plugged into it, which is what
			// this is.
			const hasAnalyser = !!audio.analyser;
			let rms = 0;
			if (hasAnalyser) {
				audio.waveform(wave);
				for (let i = 0; i < wave.length; i++) rms += wave[i] * wave[i];
				rms = Math.sqrt(rms / wave.length);
			}
			// A hair above the noise floor of a silent bus, well below anything
			// audible.
			const signal = rms > 0.0015;
			if (live !== signal) live = signal;
			if (sounding !== signal) sounding = signal;
			if (!signal) {
				ctx.strokeStyle = rule;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(0, mid);
				ctx.lineTo(w, mid);
				ctx.stroke();

				if (idleShape) {
					ctx.strokeStyle = sweepInk;
					ctx.lineWidth = 1.25;
					ctx.lineJoin = 'round';
					ctx.beginPath();
					const amp = (h / 2) * 0.3;
					for (let px = 0; px <= w; px++) {
						const phase = (px / w) * IDLE_CYCLES;
						const y = mid - shapeAt(idleShape, phase) * amp;
						if (px === 0) ctx.moveTo(px, y);
						else ctx.lineTo(px, y);
					}
					ctx.stroke();
				}
				return;
			}

			if (mode !== 'wave') {
				audio.spectrum(spectrum);
				const count = Math.min(96, spectrum.length);
				const bw = w / count;
				ctx.fillStyle = bars;
				for (let i = 0; i < count; i++) {
					const v = spectrum[Math.floor((i / count) ** 1.7 * spectrum.length)] / 255;
					ctx.fillRect(i * bw, h - v * h, Math.max(1, bw - 1), v * h);
				}
			}

			if (mode !== 'spectrum') {
				// Trigger: start at the first rising zero crossing so a steady tone
				// holds still instead of scrolling. Half the buffer is reserved for
				// the search, half for the draw.
				const span = wave.length >> 1;
				let start = 0;
				for (let i = 1; i < span; i++) {
					if (wave[i - 1] <= 0 && wave[i] > 0) {
						start = i;
						break;
					}
				}

				ctx.beginPath();
				// Audio is not a MIDI message family, so it does not get a family
				// colour. A bright trace on the sunken graph paper is what a scope
				// looks like anyway.
				ctx.strokeStyle = ink;
				ctx.lineWidth = 1.5;
				ctx.lineJoin = 'round';
				for (let i = 0; i < span; i++) {
					const x = (i / span) * w;
					const y = h / 2 - wave[start + i] * (h / 2) * 0.9;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.stroke();
			}
		};
		frame = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(frame);
			themeWatch.disconnect();
		};
	});
</script>

<div class={cn(!bare && 'overflow-hidden rounded-lg border bg-card', className)}>
	{#if label}
		<div class="flex items-baseline justify-between border-b px-3 py-1.5">
			<span class="label">{label}</span>
			<span class="label" class:text-ok={live}>{live ? 'live' : 'idle'}</span>
		</div>
	{/if}
	<div class={cn('relative', !bare && 'panel-sunken graph-paper')}>
		<!--
			Fallback content, not an aria-label: a canvas is an interactive element
			as far as ARIA is concerned, and its accessible description is what is
			written between the tags.
		-->
		<canvas bind:this={canvas} class="block w-full" style="height: {height}px">
			{ariaLabel}
		</canvas>
		{#if !live}
			<p class="pointer-events-none absolute bottom-1.5 left-3 text-2xs text-muted-foreground">
				{idleShape
					? `Silent — the ${idleShape === 'sawtooth' ? 'saw' : idleShape} this voice starts from`
					: 'Silent — the audio wakes on the first note you play'}
			</p>
		{/if}
	</div>
</div>
