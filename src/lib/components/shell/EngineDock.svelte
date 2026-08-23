<script lang="ts">
	/**
	 * The Engine Dock — always present, at the bottom of every screen.
	 *
	 * The premise of the whole app is that you are never more than zero clicks
	 * from the machine: transport, ports, activity and panic are visible while
	 * you read, and the monitor is one click away. A lesson can say "watch the
	 * dock" and mean it literally.
	 */
	import { engine, INTERNAL_OUTPUT_ID } from '$lib/midi/engine.svelte';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { audio } from '$lib/audio/engine';
	import type { MidiEvent } from '$lib/midi/bus';
	import ActivityStrip from '$lib/components/midi/ActivityStrip.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
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
		AudioWaveformIcon
	} from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Slider } from '$lib/components/ui/slider';
	import { cn } from '$lib/utils';

	let selected = $state<MidiEvent | null>(null);

	const inCount = $derived(midiAccess.listening.length);
	const outCount = $derived(engine.activeOutputs.filter((id) => id !== INTERNAL_OUTPUT_ID).length);

	function onVolume(v: number) {
		settings.masterVolume = v;
		audio.setVolume(v);
	}

	async function toggleTransport() {
		await engine.wake();
		transport.toggle();
	}
</script>

<section
	class={cn(
		'flex shrink-0 flex-col border-t bg-sidebar transition-[height] duration-200',
		settings.dockOpen ? 'h-[22rem]' : 'h-11'
	)}
	aria-label="Engine dock"
>
	<!-- ── collapsed bar ─────────────────────────────────────────────────── -->
	<div class="flex h-11 shrink-0 items-center gap-1 px-2">
		<Tooltip.Provider delayDuration={300}>
			<!-- transport -->
			<div class="flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon"
					class="size-7"
					onclick={() => transport.rewind()}
					aria-label="Return to start"
				>
					<HugeiconsIcon icon={BackwardIcon} size={14} />
				</Button>
				<Button
					variant={transport.playing ? 'default' : 'ghost'}
					size="icon"
					class="size-7"
					onclick={toggleTransport}
					aria-label={transport.playing ? 'Stop' : 'Play'}
				>
					<HugeiconsIcon icon={transport.playing ? StopIcon : PlayIcon} size={14} />
				</Button>
			</div>

			<div class="ml-1 flex items-baseline gap-2">
				<span class="tnum font-mono text-sm tracking-tight text-readout">
					{transport.positionLabel}
				</span>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="tnum rounded px-1 font-mono text-sm hover:bg-accent"
								ondblclick={() => transport.tap()}
								onclick={() => transport.tap()}
							>
								{transport.bpm.toFixed(1)}
								<span class="text-2xs text-muted-foreground">BPM</span>
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top">Tap to set tempo</Tooltip.Content>
				</Tooltip.Root>
			</div>

			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class={cn('size-7', transport.sendClock && 'text-msg-clock')}
							onclick={() => (transport.sendClock = !transport.sendClock)}
							aria-label="Send MIDI clock"
						>
							<HugeiconsIcon icon={MetronomeIcon} size={14} />
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top">
					{transport.sendClock ? 'Sending MIDI Clock to hardware' : 'Send MIDI Clock to hardware'}
				</Tooltip.Content>
			</Tooltip.Root>

			{#if transport.externalPresent}
				<span class="tnum ml-1 font-mono text-xs text-msg-clock">
					ext {transport.externalBpm.toFixed(1)}
					<span class="text-muted-foreground">±{transport.externalJitter.toFixed(1)}ms</span>
				</span>
			{/if}

			<div class="mx-2 h-5 w-px bg-border"></div>

			<!-- ports -->
			{#if midiAccess.status === 'granted'}
				<button
					class="flex items-center gap-1.5 rounded px-1.5 py-1 text-sm hover:bg-accent"
					onclick={() => {
						settings.dockOpen = true;
						settings.dockTab = 'devices';
					}}
				>
					<HugeiconsIcon icon={PlugSocketIcon} size={14} class="text-muted-foreground" />
					<span class="tnum"><span class="text-msg-cc">{inCount}</span> in</span>
					<span class="text-muted-foreground">·</span>
					<span class="tnum"><span class="text-msg-note">{outCount}</span> out</span>
				</button>
			{:else}
				<Button
					variant="outline"
					size="sm"
					class="h-7 gap-1.5 px-2 text-xs"
					onclick={() => {
						settings.dockOpen = true;
						settings.dockTab = 'devices';
					}}
				>
					<HugeiconsIcon icon={PlugSocketIcon} size={14} />
					Connect MIDI
				</Button>
			{/if}

			<ActivityStrip class="ml-2" height={16} />

			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<span
							{...props}
							class="tnum ml-2 flex items-center gap-1 font-mono text-xs text-muted-foreground"
						>
							<HugeiconsIcon icon={AudioWaveformIcon} size={13} />
							{engine.voiceCount}
						</span>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top">Voices sounding in the internal synth</Tooltip.Content>
			</Tooltip.Root>

			<div class="flex-1"></div>

			<div class="hidden w-28 items-center gap-1.5 md:flex">
				<HugeiconsIcon icon={VolumeHighIcon} size={14} class="text-muted-foreground" />
				<Slider
					type="single"
					value={settings.masterVolume}
					min={0}
					max={1}
					step={0.01}
					onValueChange={onVolume}
				/>
			</div>

			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="sm"
							class="ml-1 h-7 gap-1.5 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onclick={() => engine.panic()}
							ondblclick={() => engine.panic(true)}
						>
							<HugeiconsIcon icon={DangerIcon} size={15} />
							<span class="text-xs font-medium">Panic</span>
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top" class="max-w-56">
					All Notes Off, All Sound Off and Reset All Controllers on all sixteen channels.
					Double-click for the full 2,048-message Note Off sweep.
				</Tooltip.Content>
			</Tooltip.Root>

			<Button
				variant="ghost"
				size="icon"
				class="size-7"
				onclick={() => (settings.dockOpen = !settings.dockOpen)}
				aria-label={settings.dockOpen ? 'Collapse dock' : 'Expand dock'}
			>
				<HugeiconsIcon icon={settings.dockOpen ? ArrowDown01Icon : ArrowUp01Icon} size={15} />
			</Button>
		</Tooltip.Provider>
	</div>

	<!-- ── expanded ──────────────────────────────────────────────────────── -->
	{#if settings.dockOpen}
		<Tabs.Root bind:value={settings.dockTab} class="min-h-0 flex-1 gap-0">
			<Tabs.List class="mx-2 mb-0 h-8 w-fit shrink-0">
				<Tabs.Trigger value="devices" class="text-xs">Devices</Tabs.Trigger>
				<Tabs.Trigger value="monitor" class="text-xs">Monitor</Tabs.Trigger>
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
					onSelect={(e) => (selected = e)}
					selectedId={selected?.id ?? null}
				/>
				<div
					class="panel-sunken hidden min-h-0 scrollbar-thin overflow-y-auto border-t border-l p-3 lg:block"
				>
					{#if selected}
						<ByteInspector bytes={selected.bytes} message={selected.message} />
					{:else}
						<p class="p-2 text-xs text-muted-foreground">
							Select a message to take it apart, byte by byte.
						</p>
					{/if}
				</div>
			</Tabs.Content>
		</Tabs.Root>
	{/if}
</section>
