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
	import NowPlaying from './NowPlaying.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { bus } from '$lib/midi/bus';
	import { monitor } from '$lib/midi/monitor.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
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

	<!-- ── screen: what you played, what it sounds like, what voice ─────── -->
	<div class="panel-sunken grid border-b lg:grid-cols-[13rem_1fr_20rem]">
		<!-- Notation first: it is the thing you can read back to someone else. -->
		<div class="flex flex-col border-b px-3 pt-2.5 pb-3 lg:border-r lg:border-b-0">
			<span class="label mb-1.5">Notation</span>
			<NowPlaying />
		</div>

		<div class="flex flex-col border-b lg:border-r lg:border-b-0">
			<div class="flex items-baseline justify-between px-3 pt-2.5 pb-1">
				<span class="label">Output</span>
				<span class="label" class:text-ok={sounding}>{sounding ? 'sounding' : 'silent'}</span>
			</div>
			<Scope bare class="flex-1 pb-1" bind:sounding />
		</div>

		<!-- Voice bank. Two columns of eight, the way a patch list sits on a screen. -->
		<div class="flex flex-col">
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
	<div class="px-4 py-4">
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
						<div class="min-w-[8.5rem] flex-1 rounded-lg border border-dashed p-3">
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
									<!--
										An empty cell has no text to make it visible, so it cannot
										borrow `bg-muted` from the real card — on a light card that
										leaves one green square floating in nothing.
									-->
									<span
										class={cn(
											'h-6 w-[15px] rounded-xs',
											b !== 0
												? 'bg-foreground/10'
												: i === 0
													? 'bg-msg-note/70'
													: 'bg-muted-foreground/45'
										)}
									></span>
								{/each}
							</div>
							<p class="mt-2 min-h-8 text-xs leading-snug text-muted-foreground">{card.note}</p>
						</div>
					{/each}
				</div>
				<p class="text-base leading-relaxed text-muted-foreground">
					Play a key. This reads the message back to you in hex, in bits, and in English.
				</p>
			</div>
		{/if}
	</div>
</section>
