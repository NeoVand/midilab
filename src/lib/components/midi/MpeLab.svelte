<script lang="ts">
	/**
	 * An MPE playing surface and a channel-by-channel view of what it produces.
	 *
	 * Press anywhere on the strip: the note is chosen by horizontal position and
	 * gets its own member channel. Drag sideways and only that note bends. Drag
	 * up and down and only that note's CC 74 moves. If your pointer reports
	 * pressure — a pen, or a trackpad that supports it — that drives channel
	 * pressure; otherwise vertical distance stands in for it.
	 */
	import { onDestroy } from 'svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import {
		configureZone,
		makeZone,
		noteOnMessages,
		ZoneAllocator,
		type MpeNote
	} from '$lib/midi/mpe';
	import { noteName } from '$lib/midi/notes';
	import { unitToBend } from '$lib/midi/messages';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import { capturePointer, cn } from '$lib/utils';

	interface Props {
		lowNote?: number;
		noteCount?: number;
		class?: string;
	}
	let { lowNote = 48, noteCount = 25, class: className }: Props = $props();

	let memberCount = $state(8);
	let bendRange = $state(48);
	/** The zone actually in force — only changes when you press Configure. */
	let zone = $state(makeZone('lower', 8, 48));
	const allocator = new ZoneAllocator(makeZone('lower', 8, 48));

	let voices = $state<MpeNote[]>([]);
	let configured = $state(false);
	let surface = $state<HTMLDivElement | null>(null);
	const held = new Map<number, MpeNote>();

	function configure() {
		zone = makeZone('lower', memberCount, bendRange);
		allocator.zone = zone;
		engine.wake();
		engine.sendAll(configureZone(zone));
		configured = true;
		voices = [];
	}

	function noteAt(x: number): number {
		return lowNote + Math.min(noteCount - 1, Math.max(0, Math.floor(x * noteCount)));
	}

	function down(e: PointerEvent) {
		if (!surface) return;
		capturePointer(surface, e.pointerId);
		const r = surface.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width;
		const y = 1 - (e.clientY - r.top) / r.height;
		const note = noteAt(x);
		const voice = allocator.allocate(note, Math.round(40 + y * 80));
		if (!voice) return;
		voice.slide = Math.round(y * 127);
		voice.pressure = Math.round((e.pressure > 0 && e.pressure < 1 ? e.pressure : y) * 127);
		held.set(e.pointerId, voice);
		engine.sendAll(noteOnMessages(voice));
		voices = allocator.active;
	}

	function move(e: PointerEvent) {
		const voice = held.get(e.pointerId);
		if (!voice || !surface) return;
		const r = surface.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width;
		const y = 1 - (e.clientY - r.top) / r.height;

		// Distance from the key the note started on, in semitones, mapped through
		// the member bend range.
		const centre = (voice.note - lowNote + 0.5) / noteCount;
		const semis = (x - centre) * noteCount;
		voice.bend = Math.max(-1, Math.min(1, semis / zone.memberBendRange));
		voice.slide = Math.round(Math.max(0, Math.min(1, y)) * 127);
		voice.pressure = Math.round((e.pressure > 0 && e.pressure < 1 ? e.pressure : y) * 127);

		engine.send({ type: 'pitchBend', channel: voice.channel, value: unitToBend(voice.bend) });
		engine.send({
			type: 'controlChange',
			channel: voice.channel,
			controller: 74,
			value: voice.slide
		});
		engine.send({ type: 'channelAftertouch', channel: voice.channel, pressure: voice.pressure });
		voices = allocator.active;
	}

	function up(e: PointerEvent) {
		const voice = held.get(e.pointerId);
		if (!voice) return;
		engine.send({ type: 'noteOff', channel: voice.channel, note: voice.note, velocity: 0 });
		engine.send({ type: 'pitchBend', channel: voice.channel, value: 8192 });
		engine.send({ type: 'channelAftertouch', channel: voice.channel, pressure: 0 });
		allocator.release(voice.channel);
		held.delete(e.pointerId);
		voices = allocator.active;
	}

	onDestroy(() => {
		for (const v of allocator.active) {
			engine.send({ type: 'noteOff', channel: v.channel, note: v.note, velocity: 0 });
		}
	});

	const members = $derived(zone.members);
</script>

<div class={cn('flex flex-col gap-4', className)}>
	<div class="flex flex-wrap items-center gap-5">
		<Button variant={configured ? 'outline' : 'default'} size="sm" onclick={configure}>
			{configured ? 'Reconfigure zone' : 'Configure the MPE zone'}
		</Button>
		<label class="flex min-w-44 items-center gap-3">
			<span class="w-24 text-xs text-muted-foreground">Member channels</span>
			<Slider
				type="single"
				bind:value={memberCount}
				min={1}
				max={15}
				step={1}
				aria-label="Member channels"
			/>
			<span class="tnum w-6 text-right font-mono text-xs">{memberCount}</span>
		</label>
		<label class="flex min-w-44 items-center gap-3">
			<span class="w-20 text-xs text-muted-foreground">Bend range</span>
			<Slider
				type="single"
				bind:value={bendRange}
				min={2}
				max={96}
				step={1}
				aria-label="Bend range in semitones"
			/>
			<span class="tnum w-10 text-right font-mono text-xs">±{bendRange}</span>
		</label>
	</div>

	<!-- the surface -->
	<div
		bind:this={surface}
		role="application"
		aria-label="MPE playing surface"
		class="panel-sunken relative h-44 touch-none overflow-hidden rounded-lg border select-none"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
	>
		{#each Array.from({ length: noteCount }, (_, i) => i) as i (i)}
			{@const n = lowNote + i}
			{@const black = [1, 3, 6, 8, 10].includes(((n % 12) + 12) % 12)}
			<div
				class="absolute inset-y-0"
				style="left: {(i / noteCount) * 100}%; width: {100 / noteCount}%; background: {black
					? 'color-mix(in oklch, var(--foreground) 7%, transparent)'
					: 'transparent'}; border-right: 1px solid var(--grid-line)"
			>
				{#if ((n % 12) + 12) % 12 === 0}
					<span class="absolute bottom-1 left-1 font-mono text-2xs text-muted-foreground">
						{noteName(n, { convention: settings.octaveConvention })}
					</span>
				{/if}
			</div>
		{/each}

		{#each voices as v (v.id)}
			{@const centre = ((v.note - lowNote + 0.5) / noteCount) * 100}
			{@const x = centre + ((v.bend * zone.memberBendRange) / noteCount) * 100}
			<div
				class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
				style="left: {x}%; top: {100 - (v.slide / 127) * 100}%;
					width: {12 + (v.pressure / 127) * 30}px; height: {12 + (v.pressure / 127) * 30}px;
					background: radial-gradient(circle, var(--msg-expr) 0%, transparent 70%);
					opacity: {0.5 + (v.pressure / 127) * 0.5}"
			></div>
			<div
				class="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-msg-expr"
				style="left: {x}%; opacity: 0.55"
			></div>
		{/each}

		{#if !configured}
			<div class="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
				Configure a zone, then press and drag here.
			</div>
		{/if}
	</div>
	<p class="text-xs leading-relaxed text-muted-foreground">
		Horizontal position picks the note and, once held, bends it. Vertical position is CC 74 —
		"slide". Pressure comes from your pointer if it reports it, and from vertical distance if not.
		Press two or three fingers at once on a touchscreen and bend one of them.
	</p>

	<!-- per-channel state -->
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
		{#each members as ch (ch)}
			{@const v = voices.find((x) => x.channel === ch)}
			<div
				class={cn(
					'flex flex-col gap-1 rounded-lg border p-2',
					v && 'border-msg-expr/60 bg-msg-expr-bg'
				)}
			>
				<div class="flex items-baseline justify-between">
					<span class="tnum font-mono text-xs">ch {ch + 1}</span>
					{#if v}
						<span class="font-mono text-2xs text-msg-expr">
							{noteName(v.note, { convention: settings.octaveConvention })}
						</span>
					{/if}
				</div>
				{#if v}
					<div class="flex flex-col gap-0.5 font-mono text-2xs">
						<span class="text-muted-foreground">
							bend {v.bend >= 0 ? '+' : ''}{(v.bend * zone.memberBendRange).toFixed(1)}
						</span>
						<span class="text-muted-foreground">press {v.pressure}</span>
						<span class="text-muted-foreground">cc74 {v.slide}</span>
					</div>
				{:else}
					<span class="text-2xs text-muted-foreground">free</span>
				{/if}
			</div>
		{/each}
	</div>
</div>
