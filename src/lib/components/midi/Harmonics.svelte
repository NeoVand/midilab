<script lang="ts">
	/**
	 * Why one note is not one frequency — and why the keyboard cannot quite hold
	 * the answer.
	 *
	 * An instrument sounding one note puts out a whole series of them, at
	 * whole-number multiples of the fundamental, and the proportions between
	 * those are what makes a trumpet a trumpet. The series is also where every
	 * interval a musician names came from: the second harmonic is an octave, the
	 * third a fifth above that, the fifth a major third.
	 *
	 * ## What was wrong with drawing it as a row of hairlines
	 *
	 * It was eight vertical lines on an empty strip, captioned "evenly spaced by
	 * ear, not by hertz". That is a true sentence with a picture next to it, not
	 * a picture that says anything: the strip had no scale you could read a
	 * position against, so the only thing visible was that the lines bunch up.
	 * Everything the section is actually about — that these land *between* the
	 * keys, that the seventh is a third of a semitone flat of the note everyone
	 * calls it — was left to a column of numbers in the table underneath.
	 *
	 * So the series is now drawn over a chromatic ruler: one cell per semitone,
	 * black keys shaded, every cell the same width. A partial sits at its exact
	 * fractional semitone, and the distance between its marker and the middle of
	 * the key beneath it *is* the tuning error, at the scale you can see rather
	 * than in cents you have to take on trust.
	 *
	 * ## And why each one is a sine you can press
	 *
	 * The table said "a fifth above that" and gave you no way to hear a fifth.
	 * A harmonic is a pure tone, so each one plays as one: an oscillator at the
	 * true frequency, not at the key nearest to it — which is the only way the
	 * seventh can sound as flat as the drawing says it is. The whole note, on
	 * the real synth, is one button away for comparison, and stacking the
	 * partials builds that note back up from nothing but sines.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { audio } from '$lib/audio/engine';
	import { noteToFrequency, noteName, frequencyToNote } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, Layers01Icon } from '@hugeicons/core-free-icons';
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
	 * equal-tempered keyboard only approximates most of them — the drawing shows
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

	/** Eight harmonics span exactly three octaves; one spare each side to breathe. */
	const LOW = $derived(note - 1);
	const SPAN = 38;

	const series = $derived.by(() =>
		Array.from({ length: count }, (_, i) => {
			const n = i + 1;
			const hz = fundamental * n;
			const { note: nearest, cents } = frequencyToNote(hz);
			return {
				n,
				hz,
				nearest,
				cents,
				meaning: MEANING[n] ?? `${n}× the fundamental`,
				/** Exact position above the fundamental, in fractional semitones. */
				semis: 12 * Math.log2(n)
			};
		})
	);

	/**
	 * Percent across the ruler for a position given in semitones above the
	 * fundamental.
	 *
	 * The `+1` steps over the spare cell at the bottom; the `+0.5` aims at the
	 * middle of a cell rather than its left edge. Without that second term every
	 * marker sat half a semitone flat of where it belongs — which would have
	 * been invisible except that it is precisely the quantity this drawing
	 * exists to show, so the eighth harmonic would have looked as mistuned as
	 * the seventh actually is.
	 */
	const across = (semis: number) => ((semis + 1.5) / SPAN) * 100;

	const BLACK = new Set([1, 3, 6, 8, 10]);
	const cells = $derived(
		Array.from({ length: SPAN }, (_, i) => {
			const n = LOW + i;
			return { n, black: BLACK.has(((n % 12) + 12) % 12), c: ((n % 12) + 12) % 12 === 0 };
		})
	);

	let sounding = $state<number | null>(null);
	let osc: OscillatorNode[] = [];
	let gain: GainNode | null = null;
	let timer = 0;

	function hush() {
		clearTimeout(timer);
		const ctx = audio.context;
		if (gain && ctx) {
			gain.gain.cancelScheduledValues(ctx.currentTime);
			gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
			const dying = osc;
			const dead = gain;
			window.setTimeout(() => {
				for (const o of dying) {
					try {
						o.stop();
					} catch {
						/* already stopped */
					}
				}
				dead.disconnect();
			}, 200);
		}
		osc = [];
		gain = null;
		sounding = null;
	}

	/**
	 * Pure tones at exact frequencies.
	 *
	 * Not `engine.noteOn`, which can only reach the twelve notes an octave has —
	 * and the entire point of partials 5, 6 and 7 is that they are not on it.
	 */
	async function tone(parts: { hz: number; level: number }[], mark: number | null, ms = 1600) {
		await engine.wake();
		const ctx = audio.context;
		const out = audio.destination;
		if (!ctx || !out) return;
		hush();

		const g = ctx.createGain();
		g.gain.value = 0;
		g.connect(out);
		const now = ctx.currentTime;
		g.gain.setTargetAtTime(0.5, now, 0.02);
		g.gain.setTargetAtTime(0.0001, now + ms / 1000, 0.08);

		for (const p of parts) {
			const o = ctx.createOscillator();
			o.type = 'sine';
			o.frequency.value = p.hz;
			const vg = ctx.createGain();
			vg.gain.value = p.level;
			o.connect(vg).connect(g);
			o.start(now);
			o.stop(now + ms / 1000 + 0.6);
			osc.push(o);
		}
		gain = g;
		sounding = mark;
		timer = window.setTimeout(hush, ms + 500);
	}

	/** One partial, alone. */
	const hearPartial = (h: { n: number; hz: number }) => tone([{ hz: h.hz, level: 1 }], h.n);

	/**
	 * All of them at once, at 1/n — the recipe for a sawtooth, and a
	 * demonstration that a "rich" tone is nothing but sines added up.
	 */
	const hearStack = () =>
		tone(
			series.map((h) => ({ hz: h.hz, level: 1 / h.n })),
			0,
			2200
		);

	/** And the real thing, through the synth, for comparison. */
	async function hearNote() {
		hush();
		await engine.wake();
		engine.noteOn(note, 100, engine.channel);
		timer = window.setTimeout(() => engine.noteOff(note, engine.channel), 1600);
	}

	onDestroy(hush);
</script>

<div class={cn('flex flex-col gap-4 rounded-lg border p-4', className)}>
	<div class="flex flex-wrap items-end gap-x-4 gap-y-3">
		<div>
			<p class="label">Fundamental</p>
			<p class="tnum font-mono text-2xl leading-none text-msg-note">
				{noteName(note, { convention: settings.octaveConvention })}
			</p>
		</div>
		<div class="min-w-40 flex-1">
			<Slider
				type="single"
				bind:value={note}
				min={24}
				max={60}
				step={1}
				aria-label="Fundamental"
				onValueChange={hush}
			/>
		</div>
		<div class="flex gap-1.5">
			<Button variant="outline" size="sm" class="gap-1.5" onclick={hearNote}>
				<HugeiconsIcon icon={PlayIcon} size={14} /> The note
			</Button>
			<Button
				variant={sounding === 0 ? 'default' : 'outline'}
				size="sm"
				class="gap-1.5"
				onclick={hearStack}
			>
				<HugeiconsIcon icon={Layers01Icon} size={14} /> All eight
			</Button>
		</div>
	</div>

	<!--
		The ruler. One cell per semitone at equal width, so the horizontal gap
		between a partial and the middle of its key is the tuning error drawn to
		scale — which is the one thing a table of cents cannot do.
	-->
	<div class="flex flex-col gap-1">
		<div class="relative h-[62px]">
			{#each series as h (h.n)}
				{@const off = Math.abs(h.cents) > 8}
				<button
					type="button"
					class="group absolute bottom-0 z-10 -translate-x-1/2"
					style="left: {across(h.semis)}%"
					onclick={() => hearPartial(h)}
					aria-label="Hear harmonic {h.n}, {h.hz.toFixed(0)} hertz — {h.meaning}"
				>
					<span
						class={cn(
							'grid size-[18px] place-items-center rounded-full border text-3xs font-semibold transition-colors',
							sounding === h.n
								? 'border-msg-note bg-msg-note text-background'
								: h.n === 1
									? 'border-msg-note bg-msg-note-bg text-msg-note'
									: off
										? 'border-warn bg-background text-warn group-hover:bg-warn/15'
										: 'border-foreground/40 bg-background text-foreground group-hover:bg-accent'
						)}
					>
						{h.n}
					</span>
					<span
						class={cn(
							'mx-auto block w-px',
							sounding === h.n
								? 'bg-msg-note'
								: h.n === 1
									? 'bg-msg-note/70'
									: off
										? 'bg-warn/70'
										: 'bg-foreground/35'
						)}
						style="height: 44px"
					></span>
				</button>
			{/each}
		</div>

		<div class="flex h-9 overflow-hidden rounded-md border">
			{#each cells as cell (cell.n)}
				{@const hit = series.find((h) => h.nearest === cell.n)}
				<div
					class={cn(
						'relative min-w-0 flex-1 border-r last:border-r-0',
						cell.black ? 'bg-key-black' : 'bg-key-white',
						hit && 'ring-1 ring-msg-note/60 ring-inset'
					)}
				>
					{#if cell.c}
						<span
							class="absolute inset-x-0 bottom-0.5 text-center text-3xs text-neutral-500 tabular-nums"
						>
							{noteName(cell.n, { convention: settings.octaveConvention })}
						</span>
					{/if}
				</div>
			{/each}
		</div>
		<p class="text-2xs text-muted-foreground">
			One cell per semitone. A marker sitting off the middle of its key is a partial the keyboard
			cannot play — press one to hear it at its true frequency.
		</p>
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
				<span class={cn('ml-1', Math.abs(h.cents) > 8 ? 'text-warn' : 'text-muted-foreground')}>
					{h.cents >= 0 ? '+' : ''}{h.cents.toFixed(0)}¢
				</span>
			</dd>
		{/each}
	</dl>
</div>
