<script lang="ts">
	/**
	 * The Engine Dock — always present, at the bottom of every screen.
	 *
	 * The premise of the whole app is that you are never more than zero clicks
	 * from the machine: transport, ports, activity and panic are visible while
	 * you read, and the monitor is one click away. A lesson can say "watch the
	 * dock" and mean it literally.
	 *
	 * Laid out as separated zones rather than one undifferentiated row, because
	 * that is what every hardware transport and every DAW control bar does: you
	 * learn where a thing lives by its position, and a hairline between groups
	 * is what makes position readable at a glance.
	 */
	import { browser } from '$app/environment';
	import { engine, INTERNAL_OUTPUT_ID } from '$lib/midi/engine.svelte';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { audio } from '$lib/audio/engine';
	import type { MidiEvent } from '$lib/midi/bus';
	import { ch1, family, familyColor, hexBytes, shortLabel } from '$lib/midi/messages';
	import ActivityStrip from '$lib/components/midi/ActivityStrip.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import ChannelState from '$lib/components/midi/ChannelState.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
	import TempoField from '$lib/components/midi/TempoField.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlayIcon,
		StopIcon,
		BackwardIcon,
		MetronomeIcon,
		DangerIcon,
		ArrowUp01Icon,
		ArrowDown01Icon,
		PlugSocketIcon,
		VolumeHighIcon,
		VolumeOffIcon
	} from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Slider } from '$lib/components/ui/slider';
	import { capturePointer, cn } from '$lib/utils';

	let selected = $state<MidiEvent | null>(null);
	/*
	 * Same rule as the Monitor page: the inspector follows the newest message
	 * until you click a row to hold one still. An empty pane beside a live
	 * stream is the panel telling you to do work it could have done itself.
	 */
	const shown = $derived.by(() => {
		if (selected) return selected;
		void monitor.version;
		return monitor.filtered[0] ?? null;
	});

	const inCount = $derived(midiAccess.listening.length);
	const outCount = $derived(engine.activeOutputs.filter((id) => id !== INTERNAL_OUTPUT_ID).length);
	const connected = $derived(midiAccess.status === 'granted');

	/** Bars.beats.sixteenths, zero-padded so the readout never jitters. */
	const position = $derived.by(() => {
		const [bar, beat, six] = transport.positionLabel.split('.');
		return `${bar.padStart(3, '0')}.${beat}.${six}`;
	});

	/**
	 * The last thing that was not a clock tick.
	 *
	 * The dock's middle would otherwise be 500px of nothing, and the app's whole
	 * claim is that the bytes are always in view. This is that claim, kept even
	 * while the dock is collapsed and you are three paragraphs into a lesson.
	 */
	const latest = $derived.by(() => {
		void monitor.version;
		const events = monitor.events;
		for (let i = events.length - 1; i >= 0; i--) {
			const t = events[i].message.type;
			if (t !== 'clock' && t !== 'activeSensing') return events[i];
		}
		return null;
	});

	function onVolume(v: number) {
		settings.masterVolume = v;
		audio.setVolume(v);
	}

	async function toggleTransport() {
		await engine.wake();
		transport.toggle();
	}

	/**
	 * The dock is draggable because how much of it you want depends entirely on
	 * what you are doing: a glance at the ports wants four rows, reading a dense
	 * monitor stream wants half the screen. A fixed height would be wrong for
	 * one of those every time.
	 */
	const MIN_H = 132;

	/**
	 * The stored height is a wish, not a promise.
	 *
	 * Clamping only while you drag meant a dock dragged tall on a large display
	 * came back at that height on a laptop, where it swallowed the page and left
	 * the tool underneath it unusable — with the clamp never running again to
	 * rescue it. Clamp on the way out too, against the window as it is now.
	 */
	let viewportH = $state(browser ? window.innerHeight : 900);
	const dockH = $derived(
		Math.min(Math.max(MIN_H, settings.dockHeight), Math.max(MIN_H, viewportH - 220))
	);
	let resizing = $state(false);

	function startResize(e: PointerEvent) {
		capturePointer(e.currentTarget as HTMLElement, e.pointerId);
		resizing = true;
		settings.dockOpen = true;
	}

	function onResize(e: PointerEvent) {
		if (!resizing) return;
		const max = Math.max(MIN_H, window.innerHeight - 220);
		// Whole pixels: a drag hands over 522.93359375, and that is what gets
		// written to storage and read back forever.
		settings.dockHeight = Math.round(
			Math.min(max, Math.max(MIN_H, window.innerHeight - e.clientY - 48))
		);
	}

	function openDock(tab: string) {
		settings.dockOpen = true;
		settings.dockTab = tab;
	}
</script>

<svelte:window bind:innerHeight={viewportH} />

<section
	class={cn(
		'relative flex shrink-0 flex-col border-t bg-sidebar',
		!resizing && 'transition-[height] duration-200'
	)}
	style="height: {settings.dockOpen ? dockH + 48 : 48}px"
	aria-label="Engine dock"
>
	{#if settings.dockOpen}
		<div
			class="group absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize"
			role="separator"
			aria-label="Resize the dock"
			aria-orientation="horizontal"
			onpointerdown={startResize}
			onpointermove={onResize}
			onpointerup={() => (resizing = false)}
			onpointercancel={() => (resizing = false)}
			ondblclick={() => (settings.dockHeight = 240)}
		>
			<div
				class={cn(
					'mx-auto mt-[3px] h-[2px] w-10 rounded-full transition-colors',
					resizing ? 'bg-ring' : 'bg-transparent group-hover:bg-border'
				)}
			></div>
		</div>
	{/if}
	<!-- ── collapsed bar ─────────────────────────────────────────────────── -->
	<div
		class="flex h-12 shrink-0 items-center divide-x divide-border [&>*]:flex [&>*]:h-full [&>*]:items-center [&>*]:gap-1.5 [&>*]:px-3"
	>
		<Tooltip.Provider delayDuration={400}>
			<!-- transport -->
			<div class="!pl-2">
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class="size-7"
								onclick={() => transport.rewind()}
								aria-label="Return to start"
							>
								<HugeiconsIcon icon={BackwardIcon} size={14} />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top">Return to the start</Tooltip.Content>
				</Tooltip.Root>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant={transport.playing ? 'default' : 'secondary'}
								size="icon"
								class="size-7"
								onclick={toggleTransport}
								aria-label={transport.playing ? 'Stop' : 'Play'}
							>
								<HugeiconsIcon icon={transport.playing ? StopIcon : PlayIcon} size={14} />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top" class="flex items-center gap-2">
						{transport.playing ? 'Stop' : 'Play'}
						<kbd class="rounded-xs bg-foreground/15 px-1 font-mono text-2xs">space</kbd>
					</Tooltip.Content>
				</Tooltip.Root>
			</div>

			<!-- position and tempo -->
			<div>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<span {...props} class="tnum font-mono text-sm text-readout tabular-nums">
								{position}
							</span>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top">Bar · beat · sixteenth</Tooltip.Content>
				</Tooltip.Root>
				<TempoField compact />
			</div>

			<!-- sync -->
			<div>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class={cn('size-7', transport.sendClock && 'bg-msg-clock-bg text-msg-clock')}
								onclick={() => (transport.sendClock = !transport.sendClock)}
								aria-label="Send MIDI clock"
								aria-pressed={transport.sendClock}
							>
								<HugeiconsIcon icon={MetronomeIcon} size={14} />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top" class="max-w-56">
						{transport.sendClock
							? 'Sending MIDI Clock — this machine is the clock leader'
							: 'Send MIDI Clock to hardware, making this machine the clock leader'}
					</Tooltip.Content>
				</Tooltip.Root>

				{#if transport.externalPresent}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<span {...props} class="tnum font-mono text-xs text-msg-clock">
									ext {transport.externalBpm.toFixed(1)}
									<span class="text-muted-foreground">
										±{transport.externalJitter.toFixed(1)}
									</span>
								</span>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" class="max-w-56">
							An external clock is arriving. The second figure is its jitter in milliseconds — the
							spread, not the average, is what you hear.
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}
			</div>

			<!-- ports -->
			<div class="!px-0">
				{#if connected}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									class="flex h-full items-center gap-1.5 px-3 text-sm hover:bg-accent"
									onclick={() => openDock('devices')}
								>
									<HugeiconsIcon icon={PlugSocketIcon} size={14} class="text-muted-foreground" />
									<span class="tnum font-mono">
										<span class={inCount ? 'text-foreground' : 'text-muted-foreground'}
											>{inCount}</span
										>
										<span class="text-muted-foreground">in</span>
										<span class="mx-0.5 text-muted-foreground">/</span>
										<span class={outCount ? 'text-foreground' : 'text-muted-foreground'}>
											{outCount}
										</span>
										<span class="text-muted-foreground">out</span>
									</span>
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top">Hardware ports open — click to manage</Tooltip.Content>
					</Tooltip.Root>
				{:else}
					<div class="px-3">
						<Button
							variant="outline"
							size="sm"
							class="h-7 gap-1.5"
							onclick={() => openDock('devices')}
						>
							<HugeiconsIcon icon={PlugSocketIcon} size={14} />
							Connect MIDI
						</Button>
					</div>
				{/if}
			</div>

			<!-- activity -->
			<div class="!px-0">
				<button
					class="flex h-full items-center gap-2.5 px-3 hover:bg-accent"
					onclick={() => openDock('monitor')}
					aria-label="Open the monitor"
				>
					<!--
						Direction is not a hue.

						These two dots used to be msg-cc and msg-note — the Control Change
						and Note colours — sitting six pixels from the seven-bar meter
						where those same two hues mean Control Change and Note. In an app
						whose whole colour system is "this hue is that message family",
						spending two of those hues on in-versus-out is a lie told next to
						the truth. The words "in" and "out" are already right there.
					-->
					<span class="flex flex-col gap-[3px]">
						{#each [['in', monitor.flow.in], ['out', monitor.flow.out]] as const as [dir, level] (dir)}
							<span class="flex items-center gap-1">
								<span
									class="size-1.5 rounded-full bg-foreground transition-opacity duration-75"
									style="opacity: {0.18 + level * 0.82}"
								></span>
								<span class="label leading-none">{dir}</span>
							</span>
						{/each}
					</span>
					<ActivityStrip height={18} />
				</button>
			</div>

			<!-- voices -->
			<div>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<span
								{...props}
								class={cn(
									'tnum font-mono text-xs tabular-nums',
									engine.voiceCount ? 'text-foreground' : 'text-muted-foreground'
								)}
							>
								{engine.voiceCount}
								<span class="label">{engine.voiceCount === 1 ? 'voice' : 'voices'}</span>
							</span>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top">Notes sounding in the internal synth</Tooltip.Content>
				</Tooltip.Root>
			</div>

			<!--
				The widest zone on the bar, and it used to render nothing at all until
				the first message arrived: an empty six-hundred-pixel button where the
				run of dividers simply stopped. It keeps its divider like every other
				zone, and says what it is for while it waits.
			-->
			<button
				class="min-w-0 flex-1 justify-start overflow-hidden text-left hover:bg-accent/50"
				onclick={() => openDock('monitor')}
				aria-label="Most recent message — open the monitor"
			>
				{#if latest}
					{@const fam = family(latest.message)}
					<span class="size-1.5 shrink-0 rounded-full" style="background: {familyColor(fam)}"
					></span>
					<span class="tnum shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
						{latest.direction === 'in' ? '▸' : '◂'}
						{ch1(latest.message) ?? '—'}
					</span>
					<span class="shrink-0 font-mono text-xs" style="color: {familyColor(fam)}">
						{hexBytes(latest.bytes.slice(0, 3))}
					</span>
					<span class="truncate text-xs text-muted-foreground">
						{shortLabel(latest.message, { octaveConvention: settings.octaveConvention })}
					</span>
				{:else}
					<span class="truncate text-xs text-muted-foreground">
						The last message will show here
					</span>
				{/if}
			</button>

			<!-- output level -->
			<div class="hidden md:flex">
				<button
					class="rounded-sm p-1.5 text-muted-foreground hover:text-foreground"
					onclick={() => onVolume(settings.masterVolume > 0 ? 0 : 0.75)}
					aria-label={settings.masterVolume > 0 ? 'Mute' : 'Unmute'}
				>
					<HugeiconsIcon
						icon={settings.masterVolume > 0 ? VolumeHighIcon : VolumeOffIcon}
						size={14}
					/>
				</button>
				<div class="w-24">
					<Slider
						type="single"
						value={settings.masterVolume}
						min={0}
						max={1}
						step={0.01}
						onValueChange={onVolume}
						aria-label="Output level"
					/>
				</div>
			</div>

			<!-- panic -->
			<div>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="flex h-7 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 text-sm font-medium text-destructive transition-colors hover:border-destructive/70 hover:bg-destructive/20"
								onclick={() => engine.panic()}
								ondblclick={() => engine.panic(true)}
							>
								<HugeiconsIcon icon={DangerIcon} size={14} />
								Panic
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top" class="max-w-64">
						Lifts the pedals, then All Notes Off, All Sound Off and Reset All Controllers on all
						sixteen channels. Double-click for the full 2,048-message Note Off sweep.
					</Tooltip.Content>
				</Tooltip.Root>
			</div>

			<!-- expand -->
			<div class="!px-1">
				<Button
					variant="ghost"
					size="icon"
					class="size-7"
					onclick={() => (settings.dockOpen = !settings.dockOpen)}
					aria-label={settings.dockOpen ? 'Collapse dock' : 'Expand dock'}
					aria-expanded={settings.dockOpen}
				>
					<HugeiconsIcon icon={settings.dockOpen ? ArrowDown01Icon : ArrowUp01Icon} size={15} />
				</Button>
			</div>
		</Tooltip.Provider>
	</div>

	<!-- ── expanded ──────────────────────────────────────────────────────── -->
	{#if settings.dockOpen}
		<Tabs.Root bind:value={settings.dockTab} class="min-h-0 flex-1 gap-0">
			<Tabs.List class="mx-3 mb-0 h-8 w-fit shrink-0">
				<Tabs.Trigger value="devices" class="text-xs">Devices</Tabs.Trigger>
				<Tabs.Trigger value="monitor" class="text-xs">Monitor</Tabs.Trigger>
				<Tabs.Trigger value="state" class="text-xs">State</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="devices" class="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-3">
				<DevicePanel />
			</Tabs.Content>

			<Tabs.Content
				value="monitor"
				class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_26rem]"
			>
				<MidiMonitor
					class="min-h-0 border-t"
					onSelect={(e) => (selected = selected?.id === e.id ? null : e)}
					selectedId={selected?.id ?? null}
				/>
				<!--
					Built the same way as the inspector on the Monitor page, because it
					is the same thing: a header strip, and an empty state centred with
					a headline rather than a paragraph pinned to the top-left corner
					beside a stream that centres its own. It also stops both columns
					opening with the words "Nothing on the wire yet".
				-->
				<div class="panel-sunken hidden min-h-0 flex-col border-t border-l lg:flex">
					<!-- 45px, matching the stream's toolbar beside it, so the two panes
					     share one horizontal rule instead of two at different heights. -->
					<div class="label flex h-[45px] shrink-0 items-center border-b px-3">Inspector</div>
					<div class="flex min-h-0 flex-1 scrollbar-thin flex-col overflow-y-auto p-3">
						{#if shown}
							<ByteInspector bytes={shown.bytes} message={shown.message} />
						{:else}
							<div class="grid flex-1 place-items-center text-center">
								<div class="measure">
									<p class="text-sm text-foreground">Nothing to take apart yet.</p>
									<p class="mt-1.5 text-xs text-muted-foreground">
										Whatever arrives next appears here as hex, as bits, split into its nibbles and
										translated into English.
									</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</Tabs.Content>

			<!--
				The other half of monitoring, in the panel that is on every page:
				where every channel currently stands, without reading the log.
			-->
			<Tabs.Content
				value="state"
				class="min-h-0 flex-1 scrollbar-thin overflow-y-auto border-t p-3"
			>
				<ChannelState />
			</Tabs.Content>
		</Tabs.Root>
	{/if}
</section>
