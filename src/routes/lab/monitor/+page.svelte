<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import ActivityStrip from '$lib/components/midi/ActivityStrip.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import type { MidiEvent } from '$lib/midi/bus';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CloudDownloadIcon } from '@hugeicons/core-free-icons';

	let selected = $state<MidiEvent | null>(null);

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

<div class="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-5 px-8 py-6">
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

	<div class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-2.5">
		<ActivityStrip layout="legend" />
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
		<div class="flex min-h-0 flex-col overflow-hidden rounded-lg border">
			<p class="label border-b px-4 py-2.5">Inspector</p>
			<div class="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-4">
				{#if selected}
					<ByteInspector bytes={selected.bytes} message={selected.message} />
				{:else}
					<p class="measure text-sm text-muted-foreground">
						Select a message to see it as hex, as bits, split into its nibbles, and translated into
						English.
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>
