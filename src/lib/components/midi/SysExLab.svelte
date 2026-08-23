<script lang="ts">
	/**
	 * A SysEx workbench: type hex, validate it, send it, and watch replies.
	 *
	 * Deliberately unglamorous about safety. SysEx can carry firmware, so the
	 * panel refuses malformed messages, shows exactly what will be transmitted,
	 * and never sends anything you did not press a button for.
	 */
	import { onMount } from 'svelte';
	import { bus, type MidiEvent } from '$lib/midi/bus';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import {
		describeSysEx,
		formatHexString,
		identityRequest,
		parseHexString,
		parseIdentityReply,
		validateSysEx
	} from '$lib/midi/sysex';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SentIcon, AlertCircleIcon, LockIcon, Tick02Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	let text = $state('F0 7E 7F 06 01 F7');
	const bytes = $derived(parseHexString(text));
	const check = $derived(validateSysEx(bytes));
	const summary = $derived(bytes.length > 2 ? describeSysEx(bytes.slice(1, -1)) : null);

	let received = $state<MidiEvent[]>([]);

	onMount(() =>
		bus.subscribe((e) => {
			if (e.direction !== 'in' || e.message.type !== 'sysex') return;
			received = [e, ...received].slice(0, 8);
		})
	);

	function send() {
		if (!check.ok) return;
		engine.sendBytes(bytes);
	}

	const PRESETS: Array<[string, string, string]> = [
		[
			'Identity Request',
			formatHexString(identityRequest()),
			'Ask any listening device what it is.'
		],
		['GM System On', 'F0 7E 7F 09 01 F7', 'Put a General MIDI device into GM mode and reset it.'],
		['GM System Off', 'F0 7E 7F 09 02 F7', 'Return it to its native mode.'],
		[
			'Master Volume',
			'F0 7F 7F 04 01 00 7F F7',
			'Universal real-time master volume, set to maximum.'
		]
	];
</script>

<div class={cn('flex flex-col gap-4', className)}>
	{#if !midiAccess.sysexEnabled && midiAccess.status === 'granted'}
		<div class="flex items-start gap-3 rounded-lg border border-msg-sysex/40 bg-msg-sysex-bg p-3">
			<HugeiconsIcon icon={LockIcon} size={17} class="mt-0.5 shrink-0 text-msg-sysex" />
			<div class="flex-1 text-sm">
				<p class="font-medium">SysEx is not enabled for this page.</p>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					The browser gates it separately from ordinary MIDI, because SysEx can reach a device's
					firmware. You can build and inspect messages here without it — you just cannot transmit to
					hardware.
				</p>
			</div>
			<Button variant="outline" size="sm" onclick={() => midiAccess.enableSysEx()}>Enable</Button>
		</div>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap gap-1.5">
				{#each PRESETS as [name, hex, why] (name)}
					<button
						class="rounded border px-2 py-1 text-xs transition-colors hover:border-foreground/40"
						title={why}
						onclick={() => (text = hex)}
					>
						{name}
					</button>
				{/each}
			</div>

			<Textarea
				bind:value={text}
				rows={5}
				class="font-mono text-xs"
				spellcheck={false}
				aria-label="SysEx bytes as hex"
			/>

			<div class="flex items-center gap-3">
				<Button size="sm" class="gap-1.5" onclick={send} disabled={!check.ok}>
					<HugeiconsIcon icon={SentIcon} size={14} />
					Send {bytes.length} bytes
				</Button>
				{#if check.ok}
					<span class="flex items-center gap-1 text-xs text-ok">
						<HugeiconsIcon icon={Tick02Icon} size={13} /> well-formed
					</span>
				{:else}
					<span class="flex items-center gap-1.5 text-xs text-destructive">
						<HugeiconsIcon icon={AlertCircleIcon} size={13} />
						{check.problem}
					</span>
				{/if}
			</div>

			{#if summary}
				<div class="rounded-lg border bg-surface-sunken p-3 text-sm">
					<p class="label text-msg-sysex">{summary.manufacturer}</p>
					<p class="mt-1 leading-relaxed">{summary.summary}</p>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<p class="label">Replies received</p>
			{#if received.length === 0}
				<p
					class="rounded-lg border border-dashed p-4 text-xs leading-relaxed text-muted-foreground"
				>
					Nothing yet. Enable a hardware input in the dock, enable SysEx, then send an Identity
					Request — most devices answer with their manufacturer, family and firmware version.
				</p>
			{:else}
				{#each received as e (e.id)}
					{@const data = e.message.type === 'sysex' ? e.message.data : []}
					{@const id = parseIdentityReply(data)}
					<div class="flex flex-col gap-1.5 rounded-lg border p-3">
						<p class="text-2xs text-muted-foreground">{e.portName}</p>
						{#if id}
							<p class="text-sm">
								<span class="font-medium text-msg-sysex">{id.manufacturer}</span>
								<span class="text-muted-foreground">
									· family {id.family} · member {id.member} · firmware {id.versionString}
								</span>
							</p>
						{:else}
							<p class="text-sm">{describeSysEx(data).summary}</p>
						{/if}
						<code
							class="max-h-24 overflow-y-auto font-mono text-2xs leading-relaxed text-muted-foreground"
						>
							{formatHexString([0xf0, ...data, 0xf7])}
						</code>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
