<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import ActivityStrip from '$lib/components/midi/ActivityStrip.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import type { MidiEvent } from '$lib/midi/bus';
	import { FAMILY_LABELS, familyColor, type MessageFamily } from '$lib/midi/messages';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CloudDownloadIcon } from '@hugeicons/core-free-icons';

	let selected = $state<MidiEvent | null>(null);
	const families: MessageFamily[] = ['note', 'cc', 'expr', 'program', 'clock', 'sysex', 'common'];

	function exportTsv() {
		const url = URL.createObjectURL(
			new Blob([monitor.export()], { type: 'text/tab-separated-values' })
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'midi-monitor.tsv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 px-8 py-8">
	<PageHeader
		title="Monitor"
		lead="Every byte in and out, colour-coded by family. Select a row to take it apart."
		back={{ href: '/lab', label: 'Lab' }}
	>
		{#snippet actions()}
			<Button variant="outline" size="sm" class="gap-1.5" onclick={exportTsv}>
				<HugeiconsIcon icon={CloudDownloadIcon} size={14} /> Export
			</Button>
		{/snippet}
	</PageHeader>

	<div class="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3">
		<ActivityStrip height={22} />
		<div class="flex flex-wrap gap-3">
			{#each families as f (f)}
				<span class="flex items-center gap-1.5 text-xs">
					<span class="size-2.5 rounded-full" style="background: {familyColor(f)}"></span>
					{FAMILY_LABELS[f]}
				</span>
			{/each}
		</div>
		<div class="flex-1"></div>
		<span class="tnum font-mono text-xs text-muted-foreground">
			{monitor.rate}/s · {monitor.total} buffered
		</span>
	</div>

	<div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_26rem]">
		<div class="min-h-0 overflow-hidden rounded-lg border">
			<MidiMonitor
				class="h-full"
				onSelect={(e) => (selected = e)}
				selectedId={selected?.id ?? null}
			/>
		</div>
		<div class="flex min-h-0 scrollbar-thin flex-col gap-4 overflow-y-auto">
			<div class="rounded-lg border p-4">
				{#if selected}
					<ByteInspector bytes={selected.bytes} message={selected.message} />
				{:else}
					<p class="text-sm leading-relaxed text-muted-foreground">
						Select a message to see it as hex, as bits, split into its nibbles, and translated into
						English.
					</p>
				{/if}
			</div>
			<div class="rounded-lg border p-4">
				<DevicePanel compact />
			</div>
		</div>
	</div>
</div>
