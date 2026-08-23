<script lang="ts">
	/**
	 * Build an RPN or NRPN edit and watch it decompose into ordinary Control
	 * Changes — then watch the parser put it back together. Seeing both
	 * directions at once is what makes NRPNs stop looking like line noise.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { parameterEdit, RpnParser, type ParameterEdit } from '$lib/midi/rpn';
	import { rpnInfo } from '$lib/midi/constants';
	import { hexBytes, encode } from '$lib/midi/messages';
	import Knob from './Knob.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SentIcon } from '@hugeicons/core-free-icons';
	import { bus } from '$lib/midi/bus';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		channel?: number;
		class?: string;
	}
	let { channel = 0, class: className }: Props = $props();

	let kind = $state<'rpn' | 'nrpn'>('rpn');
	let msb = $state(0);
	let lsb = $state(0);
	let value = $state(2);
	let fine = $state(false);
	let nullAfter = $state(true);

	const sequence = $derived(
		parameterEdit(kind, channel, msb, lsb, fine ? value : value & 0x7f, { fine, nullAfter })
	);
	const known = $derived(kind === 'rpn' ? rpnInfo(msb, lsb) : undefined);

	let decoded = $state<ParameterEdit[]>([]);
	const parser = new RpnParser();

	onMount(() =>
		bus.subscribe((e) => {
			const edit = parser.push(e.message);
			if (edit) decoded = [edit, ...decoded].slice(0, 6);
		})
	);

	const EXPLAIN: Record<number, string> = {
		101: 'select registered parameter, coarse half',
		100: 'select registered parameter, fine half',
		99: 'select non-registered parameter, coarse half',
		98: 'select non-registered parameter, fine half',
		6: 'data entry, coarse',
		38: 'data entry, fine'
	};

	function explain(cc: number, v: number): string {
		if ((cc === 101 || cc === 100) && v === 127) return 'deselect — the RPN Null';
		return EXPLAIN[cc] ?? '';
	}
</script>

<div class={cn('flex flex-col gap-4 rounded-lg border p-4', className)}>
	<div class="flex flex-wrap items-end gap-5">
		<div class="flex flex-col gap-1">
			<span class="label">Kind</span>
			<div class="flex gap-1">
				<Button
					variant={kind === 'rpn' ? 'default' : 'outline'}
					size="sm"
					class="h-7 text-xs"
					onclick={() => (kind = 'rpn')}
				>
					RPN
				</Button>
				<Button
					variant={kind === 'nrpn' ? 'default' : 'outline'}
					size="sm"
					class="h-7 text-xs"
					onclick={() => (kind = 'nrpn')}
				>
					NRPN
				</Button>
			</div>
		</div>
		<Knob bind:value={msb} min={0} max={127} default={0} label="Param MSB" size={46} />
		<Knob bind:value={lsb} min={0} max={127} default={0} label="Param LSB" size={46} />
		<Knob
			bind:value
			min={0}
			max={fine ? 16383 : 127}
			default={0}
			label="Value"
			sub={fine ? `${value} of 16383` : `${value} of 127`}
			size={46}
			colour="var(--msg-note)"
		/>
		<div class="flex flex-col gap-2 pb-1">
			<div class="flex items-center gap-2">
				<Switch id="fine" bind:checked={fine} />
				<Label for="fine" class="text-xs font-normal">14-bit</Label>
			</div>
			<div class="flex items-center gap-2">
				<Switch id="nullafter" bind:checked={nullAfter} />
				<Label for="nullafter" class="text-xs font-normal">Null after</Label>
			</div>
		</div>
		<div class="flex-1"></div>
		<Button class="gap-1.5" onclick={() => engine.sendAll(sequence)}>
			<HugeiconsIcon icon={SentIcon} size={14} />
			Send {sequence.length} messages
		</Button>
	</div>

	{#if known}
		<p class="rounded border-l-2 border-msg-note bg-msg-note-bg py-1.5 pl-3 text-sm">
			<strong>{known.name}</strong> — {known.description}
		</p>
	{:else if kind === 'rpn'}
		<p class="text-xs text-muted-foreground">
			No registered parameter is defined at {msb},{lsb}. Registered numbers are assigned by the MIDI
			Association; unassigned ones do nothing anywhere.
		</p>
	{:else}
		<p class="text-xs text-muted-foreground">
			NRPN {msb},{lsb} means whatever your device's implementation chart says it means — and nothing at
			all to any other device.
		</p>
	{/if}

	<div class="flex flex-col gap-1.5 rounded-lg border bg-surface-sunken p-3">
		<p class="label mb-1">What actually goes on the wire</p>
		{#each sequence as m, i (i)}
			{#if m.type === 'controlChange'}
				<div class="flex flex-wrap items-baseline gap-3 font-mono text-xs">
					<span class="w-4 text-muted-foreground/50">{i + 1}</span>
					<code class="w-20 text-msg-cc">{hexBytes(encode(m))}</code>
					<span class="w-24">CC {m.controller} = {m.value}</span>
					<span class="font-sans text-xs text-muted-foreground">
						{explain(m.controller, m.value)}
					</span>
				</div>
			{/if}
		{/each}
	</div>

	<div class="flex flex-col gap-1.5">
		<p class="label">Reassembled by the parser</p>
		{#if decoded.length === 0}
			<p class="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
				Send something. A receiver has to reconstruct these edits from the CC stream — this is that
				reconstruction, running live.
			</p>
		{:else}
			{#each decoded as d, i (i)}
				<div class="flex items-baseline gap-3 rounded-lg border px-3 py-1.5 text-xs">
					<span class="font-mono text-msg-note uppercase">{d.kind}</span>
					<span class="font-mono">{d.msb},{d.lsb}</span>
					<span class="text-muted-foreground">=</span>
					<span class="font-mono">{d.value}</span>
					<span class="text-xs text-muted-foreground">
						{d.fine ? '14-bit' : '7-bit'}{rpnInfo(d.msb, d.lsb) && d.kind === 'rpn'
							? ` · ${rpnInfo(d.msb, d.lsb)!.name}`
							: ''}
					</span>
				</div>
			{/each}
		{/if}
	</div>
</div>
