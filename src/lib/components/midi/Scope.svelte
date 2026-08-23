<script lang="ts">
	/** Master-bus waveform and spectrum, straight off the analyser node. */
	import { onMount } from 'svelte';
	import { audio } from '$lib/audio/engine';
	import { cn } from '$lib/utils';

	interface Props {
		height?: number;
		mode?: 'wave' | 'spectrum' | 'both';
		/** Names the panel. Without it the scope is an unexplained empty rectangle. */
		label?: string;
		class?: string;
	}
	let { height = 96, mode = 'both', label, class: className }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	/** The audio graph only exists after the first gesture that wakes it. */
	let live = $state(false);

	onMount(() => {
		let frame = 0;
		const wave = new Float32Array(2048);
		const spectrum = new Uint8Array(1024);

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

			// A scope at rest still shows its zero line. A blank rectangle reads as
			// broken; a flat trace reads as silence, which is what it is.
			const hasAnalyser = !!audio.analyser;
			if (live !== hasAnalyser) live = hasAnalyser;
			if (!hasAnalyser) {
				ctx.strokeStyle = 'var(--grid-line-strong)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(0, Math.round(h / 2) + 0.5);
				ctx.lineTo(w, Math.round(h / 2) + 0.5);
				ctx.stroke();
				return;
			}

			if (mode !== 'wave') {
				audio.spectrum(spectrum);
				const bars = Math.min(96, spectrum.length);
				const bw = w / bars;
				ctx.fillStyle = 'color-mix(in oklch, var(--msg-cc) 28%, transparent)';
				for (let i = 0; i < bars; i++) {
					const v = spectrum[Math.floor((i / bars) ** 1.7 * spectrum.length)] / 255;
					ctx.fillRect(i * bw, h - v * h, Math.max(1, bw - 1), v * h);
				}
			}

			if (mode !== 'spectrum') {
				audio.waveform(wave);
				ctx.beginPath();
				ctx.strokeStyle = 'var(--msg-note)';
				ctx.lineWidth = 1.5;
				for (let i = 0; i < wave.length; i++) {
					const x = (i / wave.length) * w;
					const y = h / 2 - wave[i] * (h / 2) * 0.9;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.stroke();
			}
		};
		frame = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class={cn('overflow-hidden rounded-lg border bg-card', className)}>
	{#if label}
		<div class="flex items-baseline justify-between border-b px-3 py-1.5">
			<span class="label">{label}</span>
			<span class="label" class:text-msg-note={live}>{live ? 'live' : 'idle'}</span>
		</div>
	{/if}
	<div class="panel-sunken graph-paper relative">
		<canvas bind:this={canvas} class="block w-full" style="height: {height}px"></canvas>
		{#if !live}
			<p
				class="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-2xs text-muted-foreground"
			>
				Silent — the audio engine wakes on the first note you play.
			</p>
		{/if}
	</div>
</div>
