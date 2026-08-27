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

	/**
	 * The two keys either side of the selected one.
	 *
	 * This is the whole reason the diagram is a circle rather than a list, and
	 * until now it was only asserted in the prose beside it: adjacent keys differ
	 * by exactly one accidental, so they share six of their seven notes. Lighting
	 * them shows the claim instead of stating it, and it is why a progression can
	 * step to its neighbour and still sound like the same piece of music.
	 *
	 * Clockwise is +7 semitones, which is the dominant; anticlockwise is the
	 * subdominant. Hence V on one side and IV on the other.
	 */
	const subdominant = $derived((selected + 11) % 12);
	const dominant = $derived((selected + 1) % 12);

	const SIZE = 320;
	const C = SIZE / 2;
	/** Twelve wedges, starting at the top and going clockwise. */
	const STEP = (Math.PI * 2) / 12;

	/**
	 * Ring radii.
	 *
	 * Drawn at nearly half as much again as the first version, which was small
	 * enough that the key signatures were a squint and the hub had room for a
	 * letter and nothing else. At this size the rings can be thinner in
	 * proportion, the type can sit inside them without touching the arcs, and the
	 * hub can hold a readout rather than a label.
	 */
	const MAJOR_IN = 100;
	const MAJOR_OUT = 152;
	const MINOR_IN = 56;
	const MINOR_OUT = 98;
	const HUB_R = 54;

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

<div class={cn('flex flex-col gap-5 sm:flex-row sm:items-center', className)}>
	<svg
		viewBox="0 0 {SIZE} {SIZE}"
		class="h-auto w-full max-w-[30rem] flex-1 self-center"
		role="group"
		aria-label="The circle of fifths. Twelve keys, each a perfect fifth above the last. {key.major} is
			selected; its neighbours {KEYS[subdominant].major} and {KEYS[dominant].major} share six of its
			seven notes."
	>
		<!-- Majors on the outside, relative minors within. -->
		{#each KEYS as k, i (k.pc)}
			{@const on = selected === i}
			{@const near = i === subdominant || i === dominant}
			{@const p = polar(minors ? (MAJOR_IN + MAJOR_OUT) / 2 + 5 : 118, i)}
			{@const q = polar((MINOR_IN + MINOR_OUT) / 2, i)}
			<g>
				<path
					d={wedge(i, minors ? MAJOR_IN : 68, MAJOR_OUT)}
					fill={on
						? 'var(--msg-note-bg)'
						: near
							? 'color-mix(in oklch, var(--msg-note-bg) 45%, var(--surface-sunken))'
							: 'var(--surface-sunken)'}
					stroke={on ? 'var(--msg-note)' : 'var(--border)'}
					stroke-width={on ? 1.5 : 1}
					class="focus-shape cursor-pointer transition-[fill]"
					role="button"
					tabindex="0"
					aria-label="{k.major} major, {k.sig}{near ? ', a neighbour of the selected key' : ''}"
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
					font-size="16"
					font-weight={on ? '700' : '500'}
					fill={on ? 'var(--msg-note)' : 'var(--foreground)'}
					class="pointer-events-none"
				>
					{k.major}
				</text>
				<text
					x={p.x}
					y={p.y + 14}
					text-anchor="middle"
					font-size="8.5"
					class="pointer-events-none fill-muted-foreground"
				>
					{k.sig}
				</text>
				<!--
					The degree, only on the two neighbours. Naming them is what turns a
					lit wedge into a fact you can carry away: the key a fifth up is your
					V, the one a fifth down is your IV, and those are the two chords
					every progression in this idiom leans on.
				-->
				{#if near}
					{@const r = polar(MAJOR_IN + 9, i)}
					<text
						x={r.x}
						y={r.y + 3}
						text-anchor="middle"
						font-size="8"
						font-weight="600"
						class="pointer-events-none"
						fill="var(--msg-note)"
						opacity="0.75"
					>
						{i === dominant ? 'V' : 'IV'}
					</text>
				{/if}

				{#if minors}
					<path
						d={wedge(i, MINOR_IN, MINOR_OUT)}
						fill={on ? 'var(--msg-expr-bg)' : 'var(--muted)'}
						stroke={on ? 'var(--msg-expr)' : 'var(--border)'}
						stroke-width={on ? 1.5 : 1}
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
						y={q.y + 4}
						text-anchor="middle"
						font-size="11"
						font-weight={on ? '600' : '400'}
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
			about this drawing anybody ever forgets — and then names what is
			selected, so the answer never leaves the drawing.
		-->
		<circle cx={C} cy={C} r={HUB_R} class="fill-card stroke-border" stroke-width="1" />
		<text x={C} y={C - 20} text-anchor="middle" font-size="8" class="fill-muted-foreground">
			+7 clockwise
		</text>
		<text
			x={C}
			y={C + 6}
			text-anchor="middle"
			font-size="26"
			font-weight="600"
			fill="var(--msg-note)"
		>
			{key.major}
		</text>
		<!--
			No relative minor here. It is already lit in the inner ring a few
			millimetres away, and a hub this size has room for the key or for a
			list, not both.
		-->
		<text x={C} y={C + 24} text-anchor="middle" font-size="9" class="fill-muted-foreground">
			{key.sig === '—' ? 'no sharps or flats' : key.sig}
		</text>
	</svg>

	<div class="flex w-full flex-col gap-4 sm:w-64 sm:shrink-0">
		<div class="flex items-baseline justify-between gap-2">
			<p class="text-sm font-semibold">{key.major} major</p>
			<VoicePicker bind:value={program} audition={false} />
		</div>

		<!--
			The three keys the circle is really about, as things you can press.
			The readout used to repeat what the hub already says — key, signature,
			relative minor — which is a panel earning nothing. What it can add is
			the step: here is the key you are in, and here are the only two moves
			that keep almost every note.
		-->
		<div class="flex items-stretch gap-1.5">
			{#each [{ i: subdominant, tag: 'IV' }, { i: selected, tag: 'I' }, { i: dominant, tag: 'V' }] as slot (slot.tag)}
				{@const isHere = slot.tag === 'I'}
				<button
					class={cn(
						'flex flex-1 flex-col items-center gap-0.5 rounded-md border px-1 py-2 transition-colors',
						isHere
							? 'border-msg-note bg-msg-note-bg'
							: 'bg-surface-sunken hover:border-foreground/30'
					)}
					onclick={() => play(slot.i)}
				>
					<span
						class={cn('font-mono text-2xs', isHere ? 'text-msg-note' : 'text-muted-foreground')}
					>
						{slot.tag}
					</span>
					<span class={cn('text-sm font-medium', isHere && 'text-msg-note')}>
						{KEYS[slot.i].major}
					</span>
				</button>
			{/each}
		</div>

		<p class="text-sm leading-relaxed text-muted-foreground">
			A neighbour differs by exactly one accidental, so
			<strong class="text-foreground">six of these seven notes</strong>
			are in {KEYS[subdominant].major} and {KEYS[dominant].major} too. That is why a progression can step
			sideways here and still sound like the same piece of music.
		</p>

		<div class="flex justify-between gap-3 border-t pt-3 text-sm">
			<span class="text-muted-foreground">Root note</span>
			<span class="tnum font-mono">
				{rootNote} · {noteName(rootNote, { octave: false })}
			</span>
		</div>
		{#if key.alt}
			<div class="flex justify-between gap-3 text-sm">
				<span class="text-muted-foreground">Also spelled</span>
				<span class="font-mono">{key.alt} major</span>
			</div>
		{/if}
	</div>
</div>
