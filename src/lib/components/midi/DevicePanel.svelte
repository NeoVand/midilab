<script lang="ts">
	/**
	 * Ports in, ports out, and nothing opened without you saying so.
	 *
	 * Auto-opening every port is how MIDI loops are born: an input echoed to an
	 * output that feeds back into the input. So this panel lists what exists and
	 * makes you choose.
	 */
	import { midiAccess } from '$lib/midi/access.svelte';
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

<div class={cn('flex flex-col gap-4', className)}>
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
	{:else if midiAccess.status !== 'granted'}
		<div class="flex flex-col items-start gap-3 rounded-lg border p-4">
			<div>
				<p class="text-sm font-medium">Not connected to your MIDI hardware yet.</p>
				<p class="mt-1 text-sm text-muted-foreground">
					The browser will ask permission. Nothing is opened automatically — you pick which ports to
					listen to and which to send on.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<Button
					size="sm"
					onclick={() => midiAccess.request(false)}
					disabled={midiAccess.status === 'requesting'}
				>
					<HugeiconsIcon icon={PlugSocketIcon} size={15} />
					{midiAccess.status === 'requesting' ? 'Asking…' : 'Connect MIDI'}
				</Button>
			</div>
			{#if midiAccess.error}
				<p class="text-xs text-destructive">{midiAccess.error}</p>
			{/if}
		</div>
	{:else}
		<div class={cn('grid gap-4', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
			<!-- Inputs -->
			<section class="flex flex-col gap-1.5">
				<header
					class="flex items-center justify-between px-1 text-[10px] tracking-wide text-muted-foreground uppercase"
				>
					<span>Inputs — listen</span>
					<button
						class="hover:text-foreground"
						onclick={() => midiAccess.refresh()}
						aria-label="Rescan ports"
					>
						<HugeiconsIcon icon={Refresh01Icon} size={13} />
					</button>
				</header>
				{#if midiAccess.inputs.length === 0}
					<p class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
						No MIDI inputs found. Plug something in — the list updates itself.
					</p>
				{:else}
					{#each midiAccess.inputs as port (port.id)}
						<label
							class={cn(
								'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors hover:bg-accent/50',
								midiAccess.isListening(port.id) && 'border-msg-cc/50 bg-msg-cc-bg'
							)}
						>
							<HugeiconsIcon
								icon={transportIcon(port.name)}
								size={15}
								class={midiAccess.isListening(port.id) ? 'text-msg-cc' : 'text-muted-foreground'}
							/>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[13px] leading-tight">{port.name}</span>
								{#if port.manufacturer}
									<span class="block truncate text-[11px] text-muted-foreground"
										>{port.manufacturer}</span
									>
								{/if}
							</span>
							{#if port.state === 'disconnected'}
								<Badge variant="outline" class="text-[10px]">offline</Badge>
							{/if}
							<Switch
								checked={midiAccess.isListening(port.id)}
								onCheckedChange={() => midiAccess.toggleListen(port.id)}
								disabled={port.state === 'disconnected'}
							/>
						</label>
					{/each}
				{/if}
			</section>

			<!-- Outputs -->
			<section class="flex flex-col gap-1.5">
				<header class="px-1 text-[10px] tracking-wide text-muted-foreground uppercase">
					Outputs — send
				</header>
				{#each engine.outputs as out (out.id)}
					<label
						class={cn(
							'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors hover:bg-accent/50',
							engine.isOutputActive(out.id) && 'border-msg-note/50 bg-msg-note-bg'
						)}
					>
						<HugeiconsIcon
							icon={out.kind === 'internal' ? AudioWaveformIcon : transportIcon(out.name)}
							size={15}
							class={engine.isOutputActive(out.id) ? 'text-msg-note' : 'text-muted-foreground'}
						/>
						<span class="min-w-0 flex-1 truncate text-[13px]">{out.name}</span>
						{#if !out.connected}
							<Badge variant="outline" class="text-[10px]">offline</Badge>
						{/if}
						<Switch
							checked={engine.isOutputActive(out.id)}
							onCheckedChange={() => engine.toggleOutput(out.id)}
						/>
					</label>
				{/each}
			</section>
		</div>

		<div class="flex flex-wrap items-center gap-3 border-t pt-3">
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
				<p class="w-full text-[11px] leading-snug text-muted-foreground">
					SysEx is gated separately because it can reach a device's firmware. The browser will
					prompt again.
				</p>
			{/if}
		</div>

		<label class="flex items-center gap-3 rounded-lg border px-2.5 py-2 hover:bg-accent/40">
			<span class="flex-1">
				<span class="block text-[13px]">Audition incoming MIDI</span>
				<span class="block text-[11px] text-muted-foreground">
					Play whatever arrives through the internal synth, so you can hear a controller with no
					sound module attached.
				</span>
			</span>
			<Switch bind:checked={engine.auditionInput} />
		</label>
	{/if}
</div>
