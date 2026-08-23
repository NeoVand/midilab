<script lang="ts">
	/**
	 * The instrument.
	 *
	 * Everything on this page used to be a card: a headline card, a keyboard
	 * card, a byte card. Cards are how you lay out a dashboard, and a dashboard
	 * is exactly what this must not be. So the four things a synthesiser
	 * actually puts on its front — a voice bank, a screen, a keybed and a
	 * readout — are here as one enclosure with hairlines between them, the way
	 * they sit on a real panel, and every one of them is wired to the live
	 * engine rather than drawn.
	 *
	 * The voice bank is the part that earns its place twice: picking a voice is
	 * a Program Change, sent down the same wire as everything else, so choosing
	 * "Strings" makes a message you can watch arrive in the monitor and reaches
	 * your hardware if hardware is listening.
	 */
	import Keyboard from './Keyboard.svelte';
	import ByteInspector from './ByteInspector.svelte';
	import Scope from './Scope.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { bus } from '$lib/midi/bus';
	import { monitor } from '$lib/midi/monitor.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { FAMILY_PRESETS } from '$lib/audio/presets';
	import { GM_FAMILIES } from '$lib/midi/constants';
	import { rovingGrid } from '$lib/a11y/roving';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';

	/**
	 * The synth here has one timbre per General MIDI family, not 128 — so the
	 * bank offers the sixteen that actually sound different rather than 128
	 * buttons of which seven in eight are a lie. Each one sends the first
	 * program of its family, which is why the numbers climb in eights.
	 */
	const familyProgram = (i: number) => i * 8;
	let family = $state(0);

	function pick(i: number) {
		family = i;
		engine.programChange(familyProgram(i));
	}

	// Follow the wire: a Program Change arriving from a controller moves the
	// bank, because the bank is a view of the instrument's state, not a widget
	// that owns it.
	onMount(() =>
		bus.subscribe((e) => {
			if (e.message.type === 'programChange' && e.message.channel === engine.channel) {
				family = Math.floor((e.message.program & 0x7f) / 8);
			}
		})
	);

	const preset = $derived(FAMILY_PRESETS[family]);
	/** Set by the scope: is anything actually coming out, right now. */
	let sounding = $state(false);

	/** The most recent thing that was not a clock tick — "you just did that". */
	const latest = $derived.by(() => {
		void monitor.version;
		const events = monitor.events;
		for (let i = events.length - 1; i >= 0; i--) {
			const t = events[i].message.type;
			if (t !== 'clock' && t !== 'activeSensing') return events[i];
		}
		return null;
	});

	/*
	 * The amplitude envelope of the selected voice, drawn to scale — nearly.
	 * Real stage times span three orders of magnitude (a 2 ms piano attack
	 * beside a 4 s pad release), so the time axis is square-root compressed:
	 * fast stages stay visible, slow ones still read as unmistakably slower.
	 */
	const ENV_W = 200;
	const ENV_H = 44;
	const env = $derived.by(() => {
		const top = 4;
		const bot = ENV_H - 6;
		const a = Math.sqrt(preset.attack);
		const d = Math.sqrt(preset.decay);
		const r = Math.sqrt(preset.release);
		const hold = 0.5;
		const total = a + d + hold + r || 1;
		const x1 = (a / total) * ENV_W;
		const x2 = x1 + (d / total) * ENV_W;
		const x3 = x2 + (hold / total) * ENV_W;
		const ys = bot - preset.sustain * (bot - top);
		const line = `M 0 ${bot} L ${x1} ${top} L ${x2} ${ys} L ${x3} ${ys} L ${ENV_W} ${bot}`;
		return { line, fill: `${line} L 0 ${bot} Z`, x1, x2, x3, bot };
	});

	/** A shape name a beginner can hear, not an oscillator enum. */
	const OSC_LABEL: Record<string, string> = {
		sine: 'sine',
		square: 'square',
		sawtooth: 'saw',
		triangle: 'triangle'
	};

	/**
	 * The readout before anything has been played. Same three cards as the real
	 * thing, so the panel does not resize the moment a note arrives.
	 */
	const LEDS = Array.from({ length: 8 }, (_, i) => i);
	const BITS = LEDS;

	const GHOST = [
		{ title: 'Status byte', note: 'What kind of message, and on which channel' },
		{ title: 'Note number', note: '0–127, middle C is 60' },
		{ title: 'Velocity', note: 'How hard it was struck' }
	];

	const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`);
	const ms = (s: number) => (s >= 1 ? `${s.toFixed(1)} s` : `${Math.round(s * 1000)} ms`);
</script>

<!--
	One enclosure. The regions inside are separated by hairlines rather than by
	gaps between rounded cards, because that is the difference between a front
	panel and a dashboard.
-->
<section class="overflow-hidden rounded-xl border bg-card shadow-sm">
	<!-- ── faceplate ─────────────────────────────────────────────────────── -->
	<div class="flex items-center gap-3 border-b px-4 py-2.5">
		<span class="label text-foreground">MIDI Lab</span>
		<span class="text-border select-none" aria-hidden="true">/</span>
		<span class="tnum text-2xs text-muted-foreground">
			transmitting on channel {engine.channel + 1}
		</span>
		<div class="ml-auto flex items-center gap-2">
			<!-- Voice LEDs. Eight, because past eight you stop counting anyway. -->
			<div class="flex items-center gap-[3px]" aria-hidden="true">
				{#each LEDS as i (i)}
					<span
						class="size-1.5 rounded-full transition-colors duration-100"
						class:bg-msg-note={i < noteState.heldCount}
						class:bg-border={i >= noteState.heldCount}
					></span>
				{/each}
			</div>
			<span class="tnum w-16 text-right text-2xs text-muted-foreground">
				{noteState.heldCount} held
			</span>
		</div>
	</div>

	<!-- ── screen: scope and patch on the left, voice bank on the right ──── -->
	<div class="grid lg:grid-cols-[1fr_21rem]">
		<div class="panel-sunken graph-paper flex flex-col">
			<div class="flex items-baseline justify-between px-3 pt-2.5 pb-1">
				<span class="label">Output</span>
				<span class="label" class:text-ok={sounding}>{sounding ? 'sounding' : 'silent'}</span>
			</div>
			<Scope
				bare
				height={108}
				idleShape={preset.osc1}
				bind:sounding
				ariaLabel="Live output waveform and spectrum"
			/>
			<!-- The patch sheet: what the chosen voice actually is. -->
			<div class="flex flex-1 items-center gap-5 border-t px-4 py-3">
				<svg
					viewBox="0 0 {ENV_W} {ENV_H}"
					class="h-11 w-[200px] shrink-0"
					role="img"
					aria-label="Amplitude envelope: attack {preset.attack}s, decay {preset.decay}s, sustain {Math.round(
						preset.sustain * 100
					)}%, release {preset.release}s"
				>
					<path d={env.fill} class="fill-foreground/8" />
					<path
						d={env.line}
						fill="none"
						class="stroke-foreground"
						stroke-width="1.5"
						stroke-linejoin="round"
					/>
					{#each [env.x1, env.x2, env.x3] as x (x)}
						<line
							x1={x}
							y1="0"
							x2={x}
							y2={env.bot}
							class="stroke-border"
							stroke-width="1"
							stroke-dasharray="2 3"
						/>
					{/each}
				</svg>
				<dl class="grid flex-1 grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1.5 text-2xs">
					<dt class="label">shape</dt>
					<dd class="text-foreground">
						{OSC_LABEL[preset.osc1] ?? preset.osc1}{preset.osc2Level > 0.05
							? ` + ${OSC_LABEL[preset.osc2] ?? preset.osc2}`
							: ''}
					</dd>
					<dt class="label">attack</dt>
					<dd class="tnum text-foreground">{ms(preset.attack)}</dd>
					<dt class="label">filter</dt>
					<dd class="tnum text-foreground">{hz(preset.cutoff)}</dd>
					<dt class="label">release</dt>
					<dd class="tnum text-foreground">{ms(preset.release)}</dd>
				</dl>
			</div>
		</div>

		<!-- Voice bank. Two columns of eight, the way a patch list sits on a screen. -->
		<div class="panel-sunken flex flex-col border-t lg:border-t-0 lg:border-l">
			<div class="flex items-baseline justify-between px-3 pt-2.5 pb-1">
				<span class="label">Voice</span>
				<span class="tnum text-2xs text-muted-foreground">
					PGM {String(familyProgram(family)).padStart(3, '0')}
				</span>
			</div>
			<div
				class="grid flex-1 grid-cols-2 content-between gap-x-1 gap-y-px px-2 pt-1 pb-2.5"
				use:rovingGrid={{ columns: 2 }}
			>
				{#each GM_FAMILIES as name, i (name)}
					<button
						type="button"
						onclick={() => pick(i)}
						aria-pressed={family === i}
						class="flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-2xs transition-colors
							hover:bg-accent
							aria-pressed:bg-foreground aria-pressed:text-background"
					>
						<span class="tnum shrink-0 opacity-50">{String(familyProgram(i)).padStart(3, '0')}</span
						>
						<span class="truncate">{name}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- ── keybed ───────────────────────────────────────────────────────── -->
	<div class="border-t px-4 py-4">
		<Keyboard low={48} octaves={3} height={150} labels="c" />
	</div>

	<!-- ── readout ──────────────────────────────────────────────────────── -->
	<div class="panel-sunken min-h-44 border-t p-5">
		{#if latest}
			<ByteInspector bytes={latest.bytes} message={latest.message} />
		{:else}
			<!--
				Not an apology for having no data — the readout itself, waiting. Same
				three cards in the same places at the same size, drawn dashed and
				empty, with the one bit the whole course turns on already marked. So
				nothing moves when the first note lands: the blanks simply fill in.
			-->
			<div class="flex flex-col gap-4">
				<div class="flex flex-wrap gap-2.5">
					{#each GHOST as card, i (card.title)}
						<div
							class={cn(
								'min-w-[8.5rem] flex-1 rounded-lg border border-dashed p-3',
								i === 0 && 'border-msg-note/40'
							)}
						>
							<div class="label mb-1 flex items-baseline justify-between">
								<span>{card.title}</span>
								<span class="tnum">{i}</span>
							</div>
							<!-- A blank readout, in the shape the real one takes: 0x__ and a decimal. -->
							<div class="mb-2 flex items-baseline gap-2">
								<span class="font-mono text-2xl leading-none font-medium text-muted-foreground/45">
									0x--
								</span>
								<span class="tnum font-mono text-xs text-muted-foreground/45">---</span>
							</div>
							<div class="flex gap-[3px]" aria-hidden="true">
								{#each BITS as b (b)}
									<span
										class="h-6 w-[15px] rounded-xs"
										class:bg-msg-note={i === 0 && b === 0}
										class:bg-muted-foreground={i !== 0 && b === 0}
										class:bg-muted={b !== 0}
									></span>
								{/each}
							</div>
							<p class="mt-2 min-h-8 text-xs leading-snug text-muted-foreground">{card.note}</p>
						</div>
					{/each}
				</div>
				<p class="prose-body min-h-[2lh] text-muted-foreground">
					Play a key. This reads the message back to you in hex, in bits, and in English.
				</p>
			</div>
		{/if}
	</div>
</section>
