<script lang="ts">
	/**
	 * Two rulers for the same seven notes, and the reason octaves are +12.
	 *
	 * The lesson's claim is that "doubling the frequency and adding twelve to
	 * the note number are the same operation", which it made in a sentence
	 * beside a button that played seven C's. You could hear that they were all
	 * C's. Nothing showed you why the arithmetic works, and the sentence is the
	 * only genuinely surprising thing in the section.
	 *
	 * So: the same seven notes on two axes. Note number is linear, and they come
	 * out evenly spaced, because that is what MIDI counts in. Frequency is
	 * linear too, and they come out crushed into the left-hand end with each gap
	 * twice the last — because that is what air does. The lines joining them fan
	 * out, and the fan is the whole answer: an even step in one is a doubling in
	 * the other, which is why a keyboard can have equal keys at all.
	 *
	 * Every C is playable, because a picture of octaves that you cannot hear is
	 * only half of the argument.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { noteToFrequency, noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon } from '@hugeicons/core-free-icons';
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** The C's to show. Seven of them covers everything musically useful. */
		notes?: number[];
		program?: number;
		class?: string;
	}
	let { notes = [24, 36, 48, 60, 72, 84, 96], program = 0, class: className }: Props = $props();

	const marks = $derived(notes.map((n) => ({ n, hz: noteToFrequency(n) })));
	const lowest = $derived(notes[0]);
	const highest = $derived(notes[notes.length - 1]);
	/** A little past the top note, so the last mark is not against the edge. */
	const topHz = $derived(noteToFrequency(highest) * 1.06);

	const W = 720;
	const NUM_Y = 48;
	const HZ_Y = 136;

	const xNum = (n: number) => 40 + ((n - lowest) / (highest - lowest)) * (W - 80);
	const xHz = (hz: number) => 40 + (hz / topHz) * (W - 80);

	/**
	 * The reading, for whichever mark was last pressed.
	 *
	 * The frequencies cannot be labelled on the axis: the first four sit inside
	 * six percent of its width, so "32.7 65 131 262" arrives as one smear of
	 * digits — and those four are the crowded ones the picture is about. Putting
	 * the number in a readout instead keeps the axis clean and makes pressing
	 * the dots worth doing.
	 */
	let sounding = $state<number | null>(null);
	let timers: number[] = [];

	function stop() {
		for (const t of timers) clearTimeout(t);
		timers = [];
		for (const m of marks) engine.noteOff(m.n, 0);
		sounding = null;
	}

	async function hear(n: number) {
		stop();
		await engine.wake();
		engine.programChange(program, 0);
		engine.noteOn(n, 96, 0);
		sounding = n;
		timers.push(
			window.setTimeout(() => {
				engine.noteOff(n, 0);
				sounding = null;
			}, 1100)
		);
	}

	async function hearAll() {
		stop();
		await engine.wake();
		engine.programChange(program, 0);
		marks.forEach((m, i) => {
			timers.push(
				window.setTimeout(() => {
					engine.noteOn(m.n, 96, 0);
					sounding = m.n;
				}, i * 420)
			);
			timers.push(window.setTimeout(() => engine.noteOff(m.n, 0), i * 420 + 620));
		});
		timers.push(window.setTimeout(() => (sounding = null), marks.length * 420 + 400));
	}

	onDestroy(stop);
</script>

<div class={cn('flex flex-col gap-3 rounded-lg border p-4', className)}>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="label">Seven C's, on two rulers</span>
		<Button variant="outline" size="sm" class="gap-1.5" onclick={hearAll}>
			<HugeiconsIcon icon={PlayIcon} size={14} /> Play all seven
		</Button>
	</div>

	<div class="overflow-x-auto">
		<svg
			viewBox="0 0 {W} 182"
			class="h-auto w-full min-w-[34rem]"
			role="group"
			aria-label="The same seven C's on two axes: note number, where they are evenly spaced, and
				frequency in hertz, where each gap is twice the one before."
		>
			<!-- ── Note number: what MIDI counts in ─────────────────────────── -->
			<text x="40" y="15" font-size="9" class="fill-muted-foreground">NOTE NUMBER · +12 EACH</text>
			<line x1="40" y1={NUM_Y} x2={W - 40} y2={NUM_Y} class="stroke-border" stroke-width="1.25" />

			<!-- ── Hertz: what the air does ─────────────────────────────────── -->
			<text x="40" y={HZ_Y + 36} font-size="9" class="fill-muted-foreground">
				FREQUENCY IN HERTZ · DOUBLING EACH
			</text>
			<!-- Only the ends: everything between them is unreadably close together. -->
			<text
				x={xHz(marks[0].hz)}
				y={HZ_Y + 19}
				text-anchor="start"
				font-size="9"
				font-family="var(--font-mono)"
				class="fill-muted-foreground"
			>
				{marks[0].hz.toFixed(0)}
			</text>
			<text
				x={xHz(marks[marks.length - 1].hz)}
				y={HZ_Y + 19}
				text-anchor="middle"
				font-size="9"
				font-family="var(--font-mono)"
				class="fill-muted-foreground"
			>
				{marks[marks.length - 1].hz.toFixed(0)}
			</text>
			<line x1="40" y1={HZ_Y} x2={W - 40} y2={HZ_Y} class="stroke-border" stroke-width="1.25" />

			{#each marks as m (m.n)}
				{@const on = sounding === m.n}
				{@const a = xNum(m.n)}
				{@const b = xHz(m.hz)}
				<!--
					The join. Even above, crushed below, and the slant between them is
					the exponential this lesson is actually about.
				-->
				<line
					x1={a}
					y1={NUM_Y + 7}
					x2={b}
					y2={HZ_Y - 7}
					stroke={on ? 'var(--msg-note)' : 'var(--wire)'}
					stroke-width={on ? 1.6 : 1}
					opacity={on ? 1 : 0.65}
				/>

				<g
					class="focus-shape cursor-pointer"
					role="button"
					tabindex="0"
					aria-label="Hear {noteName(m.n, {
						convention: settings.octaveConvention
					})}, note {m.n}, {m.hz.toFixed(1)} hertz"
					onclick={() => hear(m.n)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							hear(m.n);
						}
					}}
				>
					<circle
						cx={a}
						cy={NUM_Y}
						r="5.5"
						fill={on ? 'var(--msg-note)' : 'var(--card)'}
						stroke={on ? 'var(--msg-note)' : 'var(--foreground)'}
						stroke-width="1.4"
					/>
					<text
						x={a}
						y={NUM_Y - 12}
						text-anchor="middle"
						font-size="10"
						font-family="var(--font-mono)"
						fill={on ? 'var(--msg-note)' : 'var(--foreground)'}
					>
						{m.n}
					</text>

					<circle
						cx={b}
						cy={HZ_Y}
						r="5.5"
						fill={on ? 'var(--msg-note)' : 'var(--card)'}
						stroke={on ? 'var(--msg-note)' : 'var(--foreground)'}
						stroke-width="1.4"
					/>
					{#if on}
						<text
							x={Math.min(W - 44, Math.max(44, b))}
							y={HZ_Y + 19}
							text-anchor="middle"
							font-size="10"
							font-weight="600"
							font-family="var(--font-mono)"
							fill="var(--msg-note)"
						>
							{m.hz < 100 ? m.hz.toFixed(1) : m.hz.toFixed(0)} Hz
						</text>
					{/if}
				</g>
			{/each}
		</svg>
	</div>

	<p class="text-2xs leading-relaxed text-muted-foreground">
		Press any of them. Seven equal steps along the top; seven doublings along the bottom. The fan
		between the two is why a keyboard can have keys of equal width and still be in tune with itself
		— and why the number, not the frequency, is what travels down the cable.
	</p>
</div>
