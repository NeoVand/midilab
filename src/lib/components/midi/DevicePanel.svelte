<script lang="ts">
	/**
	 * Ports in, ports out, and nothing opened without you saying so.
	 *
	 * Auto-opening every port is how MIDI loops are born: an input echoed to an
	 * output that feeds back into the input. So this panel lists what exists and
	 * makes you choose.
	 */
	import { midiAccess } from '$lib/midi/access.svelte';
	import RigDiagram from './RigDiagram.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlugSocketIcon,
		UsbIcon,
		BluetoothIcon,
		AudioWaveformIcon,
		AlertCircleIcon,
		Refresh01Icon,
		LockIcon
	} from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
		compact?: boolean;
	}
	let { class: className, compact = false }: Props = $props();

	function transportIcon(name: string) {
		const n = name.toLowerCase();
		if (n.includes('bluetooth') || n.includes('ble')) return BluetoothIcon;
		if (n.includes('usb')) return UsbIcon;
		return PlugSocketIcon;
	}
</script>

<!--
	The panel fills whatever height the tray has been given. Left to size
	itself it sat at the top with a hundred and twenty pixels of nothing
	underneath, which reads as a layout that stopped halfway. Spare height now
	goes inside the two lists, where it looks like room.
-->
<div class={cn('flex min-h-full flex-col gap-3', className)}>
	{#if midiAccess.status === 'unsupported'}
		<div class="flex gap-3 rounded-lg border border-warn/40 bg-warn/5 p-3">
			<HugeiconsIcon icon={AlertCircleIcon} size={18} class="mt-0.5 shrink-0 text-warn" />
			<div class="text-sm">
				<p class="font-medium">This browser has no Web MIDI.</p>
				<p class="mt-1 text-muted-foreground">
					Safari ships no Web MIDI API at all, on macOS or iOS — this is a deliberate Apple
					decision, not something a page can work around. Use Chrome, Edge, Brave, Arc or Firefox to
					talk to hardware.
				</p>
				<p class="mt-2 text-muted-foreground">
					Everything else still works: the built-in synthesiser receives exactly the messages an
					external instrument would, so most of the course runs unchanged.
				</p>
			</div>
		</div>
	{/if}

	<!--
		Outputs are listed whatever the permission state, because there is always
		at least one: the synth built into this page. Hiding the whole panel
		behind "not connected yet" told you that you had nothing to play, which
		was never true.
	-->
	{#if midiAccess.status === 'granted' && !compact}
		<!-- The lists below are a control surface; this is what they are of. -->
		<div class="panel-sunken shrink-0 overflow-hidden rounded-lg border px-3 py-2">
			<RigDiagram />
		</div>
	{/if}

	<div class={cn('grid min-h-0 flex-1 gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
		<!-- Inputs -->
		<section class="panel-sunken flex min-h-32 flex-col overflow-hidden rounded-lg border">
			<header class="label flex shrink-0 items-baseline justify-between border-b px-3 py-2">
				<span>Inputs — listen</span>
				{#if midiAccess.status === 'granted'}
					<span class="font-mono text-muted-foreground">
						{midiAccess.listening.length} of {midiAccess.inputs.length} open
					</span>
				{/if}
			</header>
			<div class="flex min-h-0 flex-1 scrollbar-thin flex-col gap-1.5 overflow-y-auto p-2">
				{#if midiAccess.status === 'unsupported'}
					<p class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
						No Web MIDI in this browser, so no inputs can exist here.
					</p>
				{:else if midiAccess.status !== 'granted'}
					<div class="flex flex-col items-start gap-2.5 rounded-lg border p-3">
						<p class="text-xs leading-relaxed text-muted-foreground">
							The browser will ask permission. Nothing is opened automatically — you pick which
							ports to listen to and which to send on.
						</p>
						<Button
							size="sm"
							onclick={() => midiAccess.request(false)}
							disabled={midiAccess.status === 'requesting'}
						>
							<HugeiconsIcon icon={PlugSocketIcon} size={15} />
							{midiAccess.status === 'requesting' ? 'Asking…' : 'Connect MIDI'}
						</Button>
						{#if midiAccess.error}
							<p class="text-xs text-destructive">{midiAccess.error}</p>
						{/if}
					</div>
				{:else if midiAccess.inputs.length === 0}
					<p class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
						No MIDI inputs found. Plug something in — the list updates itself.
					</p>
				{:else}
					{#each midiAccess.inputs as port (port.id)}
						<label
							class={cn(
								'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors hover:bg-accent/50',
								midiAccess.isListening(port.id) && 'border-ring/60 bg-accent'
							)}
						>
							<HugeiconsIcon
								icon={transportIcon(port.name)}
								size={15}
								class={midiAccess.isListening(port.id)
									? 'text-foreground'
									: 'text-muted-foreground'}
							/>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm leading-tight">{port.name}</span>
								{#if port.manufacturer}
									<span class="block truncate text-xs text-muted-foreground"
										>{port.manufacturer}</span
									>
								{/if}
							</span>
							{#if port.state === 'disconnected'}
								<Badge variant="outline" class="text-2xs">offline</Badge>
							{/if}
							<Switch
								checked={midiAccess.isListening(port.id)}
								onCheckedChange={() => midiAccess.toggleListen(port.id)}
								disabled={port.state === 'disconnected'}
							/>
						</label>
					{/each}
				{/if}
			</div>
		</section>

		<!-- Outputs. Same row shape as inputs, down to the second line. -->
		<section class="panel-sunken flex min-h-32 flex-col overflow-hidden rounded-lg border">
			<header class="label flex shrink-0 items-baseline justify-between border-b px-3 py-2">
				<span>Outputs — send</span>
				<span class="font-mono text-muted-foreground">
					{engine.activeOutputs.length} of {engine.outputs.length} open
				</span>
			</header>
			<div class="flex min-h-0 flex-1 scrollbar-thin flex-col gap-1.5 overflow-y-auto p-2">
				{#each engine.outputs as out (out.id)}
					<label
						class={cn(
							'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors hover:bg-accent/50',
							engine.isOutputActive(out.id) && 'border-ring/60 bg-accent'
						)}
					>
						<HugeiconsIcon
							icon={out.kind === 'internal' ? AudioWaveformIcon : transportIcon(out.name)}
							size={15}
							class={engine.isOutputActive(out.id) ? 'text-foreground' : 'text-muted-foreground'}
						/>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm leading-tight">{out.name}</span>
							{#if out.subtitle}
								<span class="block truncate text-xs text-muted-foreground">{out.subtitle}</span>
							{/if}
						</span>
						{#if !out.connected}
							<Badge variant="outline" class="text-2xs">offline</Badge>
						{/if}
						<Switch
							checked={engine.isOutputActive(out.id)}
							onCheckedChange={() => engine.toggleOutput(out.id)}
						/>
					</label>
				{/each}
				{#if midiAccess.status !== 'granted' && midiAccess.status !== 'unsupported'}
					<p class="px-1 text-2xs leading-relaxed text-muted-foreground">
						Your hardware outputs join this list once you connect.
					</p>
				{/if}
			</div>
		</section>
	</div>

	<!--
		Panel-level footer. Rescan used to be a bare icon in the Inputs header,
		which made the two column headers different shapes for something that
		re-reads both lists anyway.
	-->
	{#if midiAccess.status === 'granted'}
		<div class="flex shrink-0 flex-wrap items-center gap-3 border-t pt-3">
			<Button
				variant="ghost"
				size="sm"
				class="h-7 gap-1.5 text-xs"
				onclick={() => midiAccess.refresh()}
			>
				<HugeiconsIcon icon={Refresh01Icon} size={13} />
				Rescan ports
			</Button>
			<span class="h-4 w-px bg-border"></span>
			<div class="flex items-center gap-2">
				<HugeiconsIcon icon={LockIcon} size={14} class="text-muted-foreground" />
				<span class="text-xs">
					System Exclusive:
					<span
						class={midiAccess.sysexEnabled ? 'font-medium text-msg-sysex' : 'text-muted-foreground'}
					>
						{midiAccess.sysexEnabled ? 'enabled' : 'not enabled'}
					</span>
				</span>
			</div>
			{#if !midiAccess.sysexEnabled}
				<Button
					variant="outline"
					size="sm"
					class="h-7 text-xs"
					onclick={() => midiAccess.enableSysEx()}
				>
					Enable SysEx
				</Button>
				<p class="w-full text-xs leading-snug text-muted-foreground">
					SysEx is gated separately because it can reach a device's firmware. The browser will
					prompt again.
				</p>
			{/if}
		</div>

		<label class="flex items-center gap-3 rounded-lg border px-2.5 py-2 hover:bg-accent/40">
			<span class="flex-1">
				<span class="block text-sm">Audition incoming MIDI</span>
				<span class="block text-xs text-muted-foreground">
					Play whatever arrives through the internal synth, so you can hear a controller with no
					sound module attached.
				</span>
			</span>
			<Switch bind:checked={engine.auditionInput} />
		</label>
	{/if}
</div>
