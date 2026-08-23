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
	import { GM_FAMILIES, GM_PROGRAMS } from '$lib/midi/constants';
	import { gm } from '$lib/audio/gm.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { rovingGrid } from '$lib/a11y/roving';
	import { momentary } from '$lib/a11y/momentary';
	import { onMount } from 'svelte';

	/**
	 * All 128 programs, in two moves: the sixteen families as a grid, and a
	 * stepper for the eight variants inside whichever family you are in.
	 * Putting 128 buttons on the panel would be a wall; hiding 112 of them
	 * behind a family would be a lie about what General MIDI is. The numbers
	 * climbing in eights is the thing worth noticing — a family *is* eight
	 * programs.
	 */
	let program = $state(0);
	const family = $derived(program >> 3);
	const familyProgram = (i: number) => i * 8;

	function pick(p: number) {
		program = ((p % 128) + 128) % 128;
		engine.programChange(program);
		gm.load(program);
	}

	// Follow the wire: a Program Change arriving from a controller moves the
	// bank, because the bank is a view of the instrument's state, not a widget
	// that owns it.
	onMount(() => {
		// Fetch the sound that is already selected, so the first key you press
		// is the instrument the panel says it is rather than the synth covering
		// while the samples arrive.
		gm.load(program);
		return bus.subscribe((e) => {
			if (e.message.type === 'programChange' && e.message.channel === engine.channel) {
				program = e.message.program & 0x7f;
			}
		});
	});

	const loading = $derived(gm.enabled && gm.stateOf(program) === 'loading');
	const substituted = $derived(gm.enabled && gm.stateOf(program) === 'failed');

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

	const LEDS = Array.from({ length: 8 }, (_, i) => i);
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
	<!--
		A fixed height, so the panel never resizes.
		
		Everything in this row changes as you play, and every one of those
		changes used to move the keybed and the readout under it. The row is now
		as tall as its fullest state and stays there; what varies is what is
		inside, not how much room it takes.
	-->
	<div class="panel-sunken grid border-b lg:h-[13.5rem] lg:grid-cols-[17rem_1fr_20rem]">
		<!-- Notation first: it is the thing you can read back to someone else. -->
		<div
			class="flex min-h-0 flex-col overflow-hidden border-b px-3 pt-2.5 pb-3 lg:border-r lg:border-b-0"
		>
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
				<button
					type="button"
					onclick={() => (gm.enabled = !gm.enabled)}
					use:momentary
					title="Sampled instruments sound like the instrument. The synth can be bent and filtered while a note is sounding."
					class="label rounded px-1 transition-colors hover:bg-accent hover:text-foreground"
				>
					{gm.enabled ? 'sampled' : 'synth'}
				</button>
			</div>
			<div
				class="grid flex-1 grid-cols-2 content-start gap-x-1 px-2 pt-0.5"
				use:rovingGrid={{ columns: 2 }}
			>
				{#each GM_FAMILIES as name, i (name)}
					<button
						type="button"
						onclick={() => pick(familyProgram(i))}
						aria-pressed={family === i}
						use:momentary
						class="flex items-center gap-1.5 rounded px-1.5 py-[3px] text-left text-3xs transition-colors
							hover:bg-accent
							aria-pressed:bg-foreground aria-pressed:text-background"
					>
						<span class="tnum shrink-0 opacity-50">{String(familyProgram(i)).padStart(3, '0')}</span
						>
						<span class="truncate">{name}</span>
					</button>
				{/each}
			</div>

			<!--
				The eight variants inside the family. This is where the other 112
				programs live, and where you find out that a family is not one
				sound but eight related ones.
			-->
			<div class="mt-1.5 flex items-center gap-1 border-t px-2 py-1">
				<button
					type="button"
					onclick={() => pick(program - 1)}
					use:momentary
					aria-label="Previous program"
					class="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} size={13} strokeWidth={2} />
				</button>
				<span class="tnum shrink-0 text-3xs text-muted-foreground">
					{String(program).padStart(3, '0')}
				</span>
				<span class="min-w-0 flex-1 truncate text-3xs" title={GM_PROGRAMS[program]}>
					{GM_PROGRAMS[program]}
				</span>
				{#if loading}
					<span class="label shrink-0">loading</span>
				{:else if substituted}
					<span class="label shrink-0" title="Sample could not be fetched — the synth is covering">
						synth
					</span>
				{/if}
				<button
					type="button"
					onclick={() => pick(program + 1)}
					use:momentary
					aria-label="Next program"
					class="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={2} />
				</button>
			</div>
		</div>
	</div>

	<!-- ── keybed ───────────────────────────────────────────────────────── -->
	<div class="px-4 py-4">
		<Keyboard low={48} octaves={3} height={150} labels="c" />
	</div>

	<!-- ── readout ──────────────────────────────────────────────────────── -->
	<div class="panel-sunken min-h-44 border-t p-5">
		<ByteInspector bytes={latest?.bytes ?? null} message={latest?.message} />
	</div>
</section>
