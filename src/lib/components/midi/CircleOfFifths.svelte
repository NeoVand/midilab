<script lang="ts">
	/**
	 * The circle of fifths, playable.
	 *
	 * Twelve pitch classes arranged so that each is a perfect fifth from the
	 * last — and after twelve steps you are back where you started. That single
	 * fact is the reason a keyboard has twelve keys to the octave, the reason
	 * key signatures gain one sharp at a time going one way and one flat going
	 * the other, and the reason equal temperament had to exist at all: the
	 * circle only closes if you bend every fifth very slightly flat.
	 *
	 * Printed in a book it is a mnemonic. Here it can be played, which turns it
	 * into something you can check: press round the outside and you hear the
	 * root climb by sevens and come home; press a wedge and you hear the chord
	 * that belongs to it.
	 *
	 * ## Why it is drawn rather than tabulated
	 *
	 * The wrap-around *is* the content. A table of twelve rows says the same
	 * words and hides the one thing worth noticing, which is that the last row
	 * touches the first.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import VoicePicker from './VoicePicker.svelte';
	import { noteName } from '$lib/midi/notes';
	import { cn } from '$lib/utils';
	import { onDestroy } from 'svelte';

	interface Props {
		/** Show the relative minor ring inside the majors. */
		minors?: boolean;
		class?: string;
	}
	let { minors = true, class: className }: Props = $props();

	/**
	 * Twelve steps of seven semitones, starting at C.
	 *
	 * The names are spelled the way a musician writing that key signature would
	 * spell them — F♯ has six sharps, G♭ has six flats, and they are the same
	 * key on a keyboard. Both are shown at the bottom of the circle because
	 * that collision is exactly where the circle closes.
	 */
	const KEYS = [
		{ pc: 0, major: 'C', minor: 'Am', sig: '—' },
		{ pc: 7, major: 'G', minor: 'Em', sig: '1♯' },
		{ pc: 2, major: 'D', minor: 'Bm', sig: '2♯' },
		{ pc: 9, major: 'A', minor: 'F♯m', sig: '3♯' },
		{ pc: 4, major: 'E', minor: 'C♯m', sig: '4♯' },
		{ pc: 11, major: 'B', minor: 'G♯m', sig: '5♯' },
		{ pc: 6, major: 'G♭', minor: 'E♭m', sig: '6♭', alt: 'F♯' },
		{ pc: 1, major: 'D♭', minor: 'B♭m', sig: '5♭' },
		{ pc: 8, major: 'A♭', minor: 'Fm', sig: '4♭' },
		{ pc: 3, major: 'E♭', minor: 'Cm', sig: '3♭' },
		{ pc: 10, major: 'B♭', minor: 'Gm', sig: '2♭' },
		{ pc: 5, major: 'F', minor: 'Dm', sig: '1♭' }
	];

	let selected = $state(0);
	let program = $state(0);
	let offTimer = 0;

	const key = $derived(KEYS[selected]);

	/** Keep every root inside one octave from C4, so the circle does not climb away. */
	const rootNote = $derived(60 + key.pc);

	const SIZE = 300;
	const C = SIZE / 2;
	/** Twelve wedges, starting at the top and going clockwise. */
	const STEP = (Math.PI * 2) / 12;

	function polar(r: number, i: number) {
		const a = i * STEP - Math.PI / 2;
		return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
	}

	/** An annular wedge for slice `i` between two radii. */
	function wedge(i: number, r0: number, r1: number) {
		const a0 = (i - 0.5) * STEP - Math.PI / 2;
		const a1 = (i + 0.5) * STEP - Math.PI / 2;
		const p = (r: number, a: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;
		return (
			`M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} ` +
			`L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
		);
	}

	async function play(i: number, minor = false) {
		selected = i;
		await engine.wake();
		engine.programChange(program, 0);
		clearTimeout(offTimer);
		const root = 60 + KEYS[i].pc;
		// A triad rather than a single note: a key is a chord's worth of
		// information, and the third is the note that says major or minor.
		const chord = [root, root + (minor ? 3 : 4), root + 7];
		for (const n of chord) engine.noteOn(n, 84, 0);
		offTimer = window.setTimeout(() => {
			for (const n of chord) engine.noteOff(n, 0);
		}, 900);
	}

	onDestroy(() => clearTimeout(offTimer));
</script>

<div class={cn('flex flex-col gap-4 sm:flex-row sm:items-center', className)}>
	<svg
		viewBox="0 0 {SIZE} {SIZE}"
		class="h-auto w-full max-w-[19rem] shrink-0 self-center"
		role="group"
		aria-label="The circle of fifths. Twelve keys, each a perfect fifth above the last."
	>
		<!-- Majors on the outside, relative minors within. -->
		{#each KEYS as k, i (k.pc)}
			{@const on = selected === i}
			{@const p = polar(minors ? 116 : 104, i)}
			{@const q = polar(65, i)}
			<g>
				<path
					d={wedge(i, minors ? 88 : 62, 142)}
					fill={on ? 'var(--msg-note-bg)' : 'var(--surface-sunken)'}
					stroke="var(--border)"
					stroke-width="1"
					class="focus-shape cursor-pointer transition-[fill]"
					role="button"
					tabindex="0"
					aria-label="{k.major} major, {k.sig}"
					onclick={() => play(i)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							play(i);
						}
					}}
				/>
				<text
					x={p.x}
					y={p.y + 1}
					text-anchor="middle"
					font-size="15"
					font-weight={on ? '700' : '500'}
					fill={on ? 'var(--msg-note)' : 'var(--foreground)'}
					class="pointer-events-none"
				>
					{k.major}
				</text>
				<text
					x={p.x}
					y={p.y + 13}
					text-anchor="middle"
					font-size="8"
					class="pointer-events-none fill-muted-foreground"
				>
					{k.sig}
				</text>

				{#if minors}
					<path
						d={wedge(i, 44, 86)}
						fill={on ? 'var(--msg-expr-bg)' : 'var(--muted)'}
						stroke="var(--border)"
						stroke-width="1"
						class="focus-shape cursor-pointer transition-[fill]"
						role="button"
						tabindex="0"
						aria-label="{k.minor} minor"
						onclick={() => play(i, true)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								play(i, true);
							}
						}}
					/>
					<text
						x={q.x}
						y={q.y + 3.5}
						text-anchor="middle"
						font-size="10"
						fill={on ? 'var(--msg-expr)' : 'var(--muted-foreground)'}
						class="pointer-events-none"
					>
						{k.minor}
					</text>
				{/if}
			</g>
		{/each}

		<!--
			The hub says which direction is which, because that is the only thing
			about this drawing anybody ever forgets.
		-->
		<circle cx={C} cy={C} r="42" class="fill-card stroke-border" stroke-width="1" />
		<text x={C} y={C - 12} text-anchor="middle" font-size="8" class="fill-muted-foreground">
			+7 clockwise
		</text>
		<text
			x={C}
			y={C + 6}
			text-anchor="middle"
			font-size="17"
			font-weight="600"
			fill="var(--msg-note)"
		>
			{key.major}
		</text>
		<text x={C} y={C + 20} text-anchor="middle" font-size="8" class="fill-muted-foreground">
			{key.sig === '—' ? 'no sharps or flats' : key.sig}
		</text>
	</svg>

	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<p class="text-sm">
				<span class="font-semibold">{key.major} major</span>
				<span class="text-muted-foreground"> · relative minor {key.minor}</span>
			</p>
			<VoicePicker bind:value={program} audition={false} />
		</div>

		<div class="flex flex-col gap-1 rounded-lg border bg-surface-sunken p-3 text-sm">
			<div class="flex justify-between gap-3">
				<span class="text-muted-foreground">Root note</span>
				<span class="tnum font-mono">
					{rootNote} · {noteName(rootNote, { octave: false })}
				</span>
			</div>
			<div class="flex justify-between gap-3">
				<span class="text-muted-foreground">Key signature</span>
				<span class="font-mono">{key.sig}</span>
			</div>
			{#if key.alt}
				<div class="flex justify-between gap-3">
					<span class="text-muted-foreground">Also spelled</span>
					<span class="font-mono">{key.alt} major</span>
				</div>
			{/if}
		</div>

		<p class="text-sm leading-relaxed text-muted-foreground">
			Every step clockwise adds <strong>7</strong> to the root and one sharp to the signature; every step
			anticlockwise adds 5 and one flat. Twelve steps of seven semitones is 84 — exactly seven octaves
			— so the circle closes, and that is the only reason a keyboard can have twelve keys instead of an
			endless spiral of them.
		</p>
	</div>
</div>
