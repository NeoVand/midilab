<script lang="ts">
	/**
	 * The whole first lesson, as one picture.
	 *
	 * The claim is that MIDI carries instructions and not sound, and the lesson
	 * used to settle it with two numbers in two boxes: a few hundred bytes
	 * against a megabyte. Numbers are the weakest way to make that point. Nobody
	 * disbelieves them and nobody feels them either.
	 *
	 * What settles it is putting the two things side by side and letting the
	 * shapes argue. On the left, every byte that would go down the cable —
	 * short enough to read, in a column you could copy out by hand. On the
	 * right, the sound those bytes produced: a waveform and a spectrogram of
	 * the same performance, rendered here, in this tab, at this moment. One side
	 * fits in a paragraph. The other is a photograph of a room.
	 *
	 * ## Why it renders rather than ships an audio file
	 *
	 * Because the instrument has to be changeable. "The notes did not change,
	 * the instrument did" is the sentence this lesson exists to land, and it
	 * only lands if switching from a piano to a pad visibly redraws the picture
	 * while the column of bytes on the left changes by exactly one number. A
	 * prerecorded file would make the left column a caption rather than a cause.
	 *
	 * The render is offline, so it takes a fraction of the piece's length and
	 * needs no gesture, and the byte column is `encode()` on the real messages —
	 * the same function the wire uses.
	 */
	import { onMount, untrack } from 'svelte';
	import { renderTake, type Take } from '$lib/audio/render';
	import { SequencePlayer, notesToEvents } from '$lib/midi/player.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { melody, melodyNotes } from '$lib/music/melodies';
	import { encode, hex } from '$lib/midi/messages';
	import { noteName } from '$lib/midi/notes';
	import { cn } from '$lib/utils';

	interface Props {
		/** Melody id. Defaults to the one everybody already knows. */
		id?: string;
		/**
		 * The instrument to render through — owned by whatever is above this on
		 * the page.
		 *
		 * This used to carry its own picker and its own Play button, which meant
		 * a lesson showing one performance offered two ways to choose its
		 * instrument and two ways to start it. That is not a figure with
		 * controls, it is a second copy of the demo above it. The figure is the
		 * consequence; the demo is the cause.
		 */
		program: number;
		channel?: number;
		class?: string;
	}
	let { id = 'ode-to-joy', program, channel = 0, class: className }: Props = $props();

	// Fixed at mount: this figure is about one tune on one channel, and the
	// render is far too expensive to redo because a prop moved.
	const tune = melody(untrack(() => id));
	const notes = melodyNotes(
		untrack(() => id),
		{ channel: untrack(() => channel) }
	);
	const events = notesToEvents(notes, tune.bpm);

	/** Every byte, exactly as the wire would carry it. */
	const wire = events.map((e) => ({
		at: e.time,
		bytes: Array.from(encode(e.message)),
		message: e.message
	}));
	const midiBytes = wire.reduce((n, w) => n + w.bytes.length, 0);

	let take = $state<Take | null>(null);
	let rendering = $state(false);
	let failed = $state(false);

	/*
	 * Its own transport, deliberately.
	 *
	 * The instrument is shared with the demo above — one performance, one
	 * choice — but playing is not a choice, it is a thing you do to a figure.
	 * And this figure has something the demo does not: while it runs, the
	 * message the wire is carrying *right now* is lit in the left column and a
	 * line sweeps the waveform on the right, so the two halves stop being an
	 * illustration of each other and start being the same event twice.
	 */
	const player = new SequencePlayer();
	/** Where the playhead is, as a fraction of the *rendered* take. */
	const through = $derived(
		take && player.playing ? Math.min(1, player.position / take.duration) : null
	);
	/** The last message the wire has actually carried. */
	const atMessage = $derived.by(() => {
		if (!player.playing) return -1;
		let i = -1;
		for (let k = 0; k < wire.length; k++) {
			if (wire[k].at <= player.position + 1e-6) i = k;
			else break;
		}
		return i;
	});

	let logEl = $state<HTMLElement | null>(null);
	/*
	 * Keep the lit row in view — but by moving this box's own scrollTop, never
	 * with scrollIntoView, which would drag the whole page along behind it.
	 */
	$effect(() => {
		const box = logEl;
		const i = atMessage;
		if (!box || i < 0) return;
		const row = box.querySelector<HTMLElement>(`[data-row="${i}"]`);
		if (!row) return;
		const top = row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2;
		box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
	});

	let waveEl = $state<HTMLCanvasElement | null>(null);
	let spectroEl = $state<HTMLCanvasElement | null>(null);

	/** One render in flight at a time; a fast click-through should not queue six. */
	let generation = 0;
	async function build(p: number) {
		const mine = ++generation;
		rendering = true;
		failed = false;
		try {
			const t = await renderTake(notes, tune.bpm, p);
			if (mine !== generation) return;
			take = t;
		} catch {
			if (mine === generation) failed = true;
		} finally {
			if (mine === generation) rendering = false;
		}
	}

	onMount(() => {
		build(program);
		return () => player.stop();
	});

	async function toggle() {
		if (player.playing) {
			player.stop();
			return;
		}
		await engine.wake();
		engine.programChange(program, channel);
		player.play(events);
	}

	/*
	 * Re-render whenever the page changes the instrument — that redraw *is* the
	 * lesson. Guarded against re-entry so a reader clicking through the bank
	 * queues one render rather than nine.
	 */
	let lastBuilt = untrack(() => program);
	$effect(() => {
		if (program !== lastBuilt) {
			lastBuilt = program;
			build(program);
		}
	});

	/**
	 * Resolve a token to something canvas will accept.
	 *
	 * Canvas takes a CSS colour string, and the palette is written in `oklch`,
	 * which current browsers accept — but a stale one would silently paint
	 * nothing, and a spectrogram that is a blank rectangle looks like a bug
	 * rather than like an unsupported colour space. Painting a probe and reading
	 * back what stuck is cheap insurance.
	 */
	function ink(el: HTMLElement, token: string, fallback: string): string {
		const value = getComputedStyle(el).getPropertyValue(token).trim();
		if (!value) return fallback;
		const probe = document.createElement('canvas').getContext('2d');
		if (!probe) return fallback;
		probe.fillStyle = '#000';
		probe.fillStyle = value;
		return probe.fillStyle === '#000' && value !== '#000' ? fallback : value;
	}

	$effect(() => {
		const t = take;
		const wave = waveEl;
		const spectro = spectroEl;
		if (!t || !wave || !spectro) return;

		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const note = ink(wave, '--msg-note', '#4ade80');
		const hot = ink(wave, '--foreground', '#ffffff');
		const rule = ink(wave, '--grid-line', 'rgba(128,128,128,0.25)');

		// ── Waveform ────────────────────────────────────────────────────────
		{
			const w = wave.clientWidth;
			const h = wave.clientHeight;
			wave.width = Math.round(w * dpr);
			wave.height = Math.round(h * dpr);
			const c = wave.getContext('2d');
			if (!c) return;
			c.scale(dpr, dpr);
			c.clearRect(0, 0, w, h);

			c.strokeStyle = rule;
			c.lineWidth = 1;
			c.beginPath();
			c.moveTo(0, h / 2);
			c.lineTo(w, h / 2);
			c.stroke();

			/*
			 * Scaled to the loudest peak in the take.
			 *
			 * The synth leaves a lot of headroom, so drawn at true amplitude this
			 * is a thin green smear across the middle of the box — which says
			 * nothing about the shape of the performance, and the shape is the
			 * entire reason a waveform is here. The vertical axis of a waveform
			 * display is conventionally relative anyway; the number that matters
			 * is in the header.
			 */
			const n = t.peaks.length;
			let loudest = 0;
			for (const p of t.peaks) loudest = Math.max(loudest, Math.abs(p.min), Math.abs(p.max));
			const gain = loudest > 0.001 ? 0.94 / loudest : 1;

			c.fillStyle = note;
			for (let i = 0; i < n; i++) {
				const x = (i / n) * w;
				const { min, max } = t.peaks[i];
				const top = (0.5 - Math.max(-1, Math.min(1, max * gain)) * 0.48) * h;
				const bottom = (0.5 - Math.max(-1, Math.min(1, min * gain)) * 0.48) * h;
				c.fillRect(x, top, Math.max(0.7, w / n), Math.max(1, bottom - top));
			}
		}

		// ── Spectrogram ─────────────────────────────────────────────────────
		{
			const w = spectro.clientWidth;
			const h = spectro.clientHeight;
			spectro.width = Math.round(w * dpr);
			spectro.height = Math.round(h * dpr);
			const c = spectro.getContext('2d');
			if (!c) return;
			c.scale(dpr, dpr);
			c.clearRect(0, 0, w, h);

			const cw = w / t.frames;
			const ch = h / t.bins;
			for (let f = 0; f < t.frames; f++) {
				for (let b = 0; b < t.bins; b++) {
					const v = t.spectrogram[f * t.bins + b];
					if (v < 0.04) continue;
					// Two passes of one hue: the body of the sound in the note
					// colour, and the loudest tenth lifted towards the foreground so
					// the fundamentals read as lines rather than as a green haze.
					c.globalAlpha = Math.min(1, v * 1.15);
					c.fillStyle = note;
					c.fillRect(f * cw, h - (b + 1) * ch, cw + 0.5, ch + 0.5);
					if (v > 0.82) {
						c.globalAlpha = (v - 0.82) / 0.18;
						c.fillStyle = hot;
						c.fillRect(f * cw, h - (b + 1) * ch, cw + 0.5, ch + 0.5);
					}
				}
			}
			c.globalAlpha = 1;
		}
	});

	/** A short human name for a message, for the right-hand column of the dump. */
	function describe(m: (typeof wire)[number]['message']): string {
		if (m.type === 'noteOn') return `Note On  ${noteName(m.note)}  vel ${m.velocity}`;
		if (m.type === 'noteOff') return `Note Off ${noteName(m.note)}`;
		return m.type;
	}

	const kb = $derived(take ? (take.audioBytes / 1_000_000).toFixed(1) : null);
	const ratio = $derived(take ? Math.round(take.audioBytes / midiBytes) : null);
</script>

<div class={cn('flex flex-col gap-4', className)}>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
		<Button variant="default" size="sm" class="gap-1.5" onclick={toggle}>
			<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={14} />
			{player.playing ? 'Stop' : 'Play'}
		</Button>
		<p class="text-xs text-muted-foreground">
			{#if rendering}
				rendering the audio…
			{:else if failed}
				this browser would not render offline audio
			{:else}
				Press play and watch the same instant in both columns.
			{/if}
		</p>
	</div>

	<div class="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
		<!-- ── Left: what actually goes down the cable ─────────────────────── -->
		<div class="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
			<div class="flex items-baseline justify-between border-b px-3 py-1.5">
				<span class="label text-msg-note">MIDI · the instructions</span>
				<span class="tnum label">{midiBytes} bytes</span>
			</div>
			<div bind:this={logEl} class="panel-sunken h-64 scrollbar-thin overflow-y-auto px-3 py-2">
				<table class="w-full font-mono text-2xs">
					<tbody>
						{#each wire as w, i (i)}
							{@const now = i === atMessage}
							{@const ahead = atMessage >= 0 && i > atMessage}
							<tr
								data-row={i}
								class={cn(
									'align-baseline transition-colors',
									now && 'bg-msg-note-bg',
									ahead && 'opacity-45'
								)}
							>
								<td class="tnum py-px pr-2 text-right text-muted-foreground">{w.at.toFixed(2)}</td>
								<td
									class={cn(
										'py-px pr-3 whitespace-nowrap',
										now ? 'font-semibold text-msg-note' : 'text-msg-note/85'
									)}
								>
									{w.bytes.map((byte) => hex(byte)).join(' ')}
								</td>
								<td
									class={cn(
										'py-px whitespace-nowrap',
										now ? 'text-foreground' : 'text-muted-foreground'
									)}
								>
									{describe(w.message)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="border-t px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
				{wire.length} messages. Change the instrument and exactly one number in this column moves.
			</p>
		</div>

		<!-- ── Right: what came out ────────────────────────────────────────── -->
		<div class="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
			<div class="flex items-baseline justify-between border-b px-3 py-1.5">
				<span class="label">Audio · the result</span>
				<span class="tnum label">
					{#if kb}{kb} MB{:else}—{/if}
				</span>
			</div>
			<div class="panel-sunken relative flex h-64 flex-col">
				<canvas bind:this={waveEl} class="h-[38%] w-full" aria-hidden="true"></canvas>
				<canvas bind:this={spectroEl} class="min-h-0 w-full flex-1" aria-hidden="true"></canvas>
				<!--
					The playhead, over both panels at once. It is the join: the byte lit on
					the left and the slice of sound under this line are the same moment, and
					until you can see the two move together they are only two pictures that
					happen to be next to each other.
				-->
				{#if through !== null}
					<div
						class="pointer-events-none absolute inset-y-0 left-0 bg-foreground/8"
						style="width: {through * 100}%"
					></div>
					<div
						class="pointer-events-none absolute inset-y-0 w-px bg-foreground/80"
						style="left: {through * 100}%"
					></div>
				{/if}
				<!--
					The axis is two labels, not a scale. A spectrogram at this size is
					a shape, and the only thing a reader needs to place the shape is
					which end is low.
				-->
				{#if take}
					<div
						class="pointer-events-none absolute right-2 bottom-1 left-2 flex justify-between font-mono text-3xs text-muted-foreground"
					>
						<span>20 Hz</span>
						<span>{(take.nyquist / 1000).toFixed(0)} kHz</span>
					</div>
				{/if}
				{#if rendering}
					<div
						class="absolute inset-0 grid place-items-center bg-surface-sunken/70 text-xs text-muted-foreground"
					>
						rendering…
					</div>
				{/if}
			</div>
			<p class="border-t px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
				{#if take}
					The waveform above, its frequencies below — the same {take.duration.toFixed(1)} seconds as uncompressed
					stereo, which is
					<strong class="text-foreground">{ratio?.toLocaleString()}× more data</strong>
					than the column beside it. Every pixel of it is a consequence.
				{:else}
					Rendered in this tab, from those bytes, through the instrument you picked.
				{/if}
			</p>
		</div>
	</div>
</div>
