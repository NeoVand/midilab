<script lang="ts">
	/**
	 * Why one note is not one frequency.
	 *
	 * Play a low C and the analyser lights up in half a dozen places. That is
	 * not the analyser being wrong: an instrument sounding one note puts out a
	 * whole series of them, at whole-number multiples of the fundamental, and
	 * the proportions between those are what makes a trumpet a trumpet.
	 *
	 * The series is also where tuning comes from. The second harmonic is an
	 * octave, the third is a fifth above that, the fifth is a major third —
	 * every interval a musician names is sitting in the overtones of a single
	 * note, which is the thing that makes this worth drawing rather than
	 * asserting.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { noteToFrequency, noteName, frequencyToNote } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon } from '@hugeicons/core-free-icons';
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** The fundamental, as a MIDI note. */
		note?: number;
		count?: number;
		class?: string;
	}
	let { note = $bindable(36), count = 8, class: className }: Props = $props();

	/**
	 * What each harmonic is, musically. These names are exact ratios, and the
	 * equal-tempered keyboard only approximates most of them — the table says
	 * where by how much, because that gap is the whole story of tuning.
	 */
	const MEANING: Record<number, string> = {
		1: 'the note itself',
		2: 'an octave up',
		3: 'a fifth above that',
		4: 'two octaves up',
		5: 'a major third above that',
		6: 'a fifth, two octaves up',
		7: 'a flat seventh — not on any keyboard',
		8: 'three octaves up'
	};

	const fundamental = $derived(noteToFrequency(note));

	const series = $derived.by(() =>
		Array.from({ length: count }, (_, i) => {
			const n = i + 1;
			const hz = fundamental * n;
			// Where the keyboard would put this frequency, and how far off it is.
			const { note: nearest, cents } = frequencyToNote(hz);
			return {
				n,
				hz,
				nearest,
				cents,
				meaning: MEANING[n] ?? `${n}× the fundamental`
			};
		})
	);

	let timer = 0;
	function play() {
		const n = note;
		clearTimeout(timer);
		engine.noteOn(n, 100, engine.channel);
		timer = window.setTimeout(() => engine.noteOff(n, engine.channel), 1400);
	}
	onDestroy(() => clearTimeout(timer));

	/** Log placement, so the octaves are evenly spaced the way an ear hears them. */
	const span = $derived(Math.log2(count));
	const leftOf = (n: number) => (Math.log2(n) / span) * 100;
</script>

<div class={cn('flex flex-col gap-4 rounded-lg border p-4', className)}>
	<div class="flex flex-wrap items-end gap-4">
		<div>
			<p class="label">Fundamental</p>
			<p class="tnum font-mono text-2xl leading-none text-msg-note">
				{noteName(note, { convention: settings.octaveConvention })}
			</p>
		</div>
		<div class="min-w-40 flex-1">
			<Slider type="single" bind:value={note} min={24} max={72} step={1} aria-label="Fundamental" />
		</div>
		<Button variant="outline" size="sm" class="gap-1.5" onclick={play}>
			<HugeiconsIcon icon={PlayIcon} size={14} /> Hear it
		</Button>
	</div>

	<!--
		The series on a log axis, because that is the axis an octave is a fixed
		distance on — and the point of the picture is that the gaps close up as
		you climb, which a linear axis hides.
	-->
	<div class="panel-sunken relative h-16 rounded-md">
		{#each series as h (h.n)}
			<div class="absolute inset-y-0" style="left: {leftOf(h.n)}%">
				<div
					class="absolute inset-y-2 w-px"
					class:bg-msg-note={h.n === 1}
					class:bg-foreground={h.n !== 1}
					class:opacity-40={h.n !== 1}
				></div>
				<span class="tnum absolute top-1 left-1 text-2xs text-muted-foreground">{h.n}</span>
			</div>
		{/each}
		<span class="tnum absolute right-2 bottom-1 text-2xs text-muted-foreground">
			evenly spaced by ear, not by hertz
		</span>
	</div>

	<dl class="grid grid-cols-[auto_auto_1fr_auto] gap-x-4 gap-y-1 text-xs">
		<dt class="label">×</dt>
		<dt class="label">hz</dt>
		<dt class="label">what it is</dt>
		<dt class="label text-right">nearest key</dt>
		{#each series as h (h.n)}
			<dd class="tnum text-foreground">{h.n}</dd>
			<dd class="tnum text-muted-foreground">{h.hz.toFixed(0)}</dd>
			<dd class="text-muted-foreground">{h.meaning}</dd>
			<dd class="tnum text-right">
				<span class="text-foreground">
					{noteName(h.nearest, { convention: settings.octaveConvention })}
				</span>
				<!--
					How far the pure ratio sits from the key you would press. Anything
					past a few cents is audible, and the seventh harmonic is a third of
					a semitone flat of the note everyone calls it.
				-->
				<span class={cn('ml-1', Math.abs(h.cents) > 10 ? 'text-warn' : 'text-muted-foreground')}>
					{h.cents >= 0 ? '+' : ''}{h.cents.toFixed(0)}¢
				</span>
			</dd>
		{/each}
	</dl>
</div>
