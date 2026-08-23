<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import ActivityStrip from '$lib/components/midi/ActivityStrip.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import type { MidiEvent } from '$lib/midi/bus';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CloudDownloadIcon, Cancel01Icon } from '@hugeicons/core-free-icons';

	/**
	 * The inspector follows the stream until you pin a row.
	 *
	 * An empty 26rem panel headed "select a message" is a large piece of the
	 * screen doing nothing while the interesting thing scrolls past next to it.
	 * Following by default means the byte view is always showing the most recent
	 * message; clicking a row pins it so it stops moving under you.
	 */
	let pinned = $state<MidiEvent | null>(null);

	const latest = $derived.by(() => {
		void monitor.version;
		return monitor.filtered[0] ?? null;
	});
	const shown = $derived(pinned ?? latest);

	function select(e: MidiEvent) {
		pinned = pinned?.id === e.id ? null : e;
	}

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
		lead="Every byte in and out, colour-coded by family. Select a row to hold it still."
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
			<MidiMonitor class="h-full" onSelect={select} selectedId={pinned?.id ?? null} />
		</div>
		<div class="flex min-h-0 flex-col overflow-hidden rounded-lg border">
			<div class="flex items-center justify-between gap-2 border-b px-4 py-1.5">
				<p class="label">Inspector</p>
				{#if pinned}
					<button
						class="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-msg-note transition-colors hover:bg-muted"
						onclick={() => (pinned = null)}
					>
						Pinned <HugeiconsIcon icon={Cancel01Icon} size={10} strokeWidth={2.5} />
					</button>
				{:else if shown}
					<span class="label text-muted-foreground/60">following</span>
				{/if}
			</div>
			<div class="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-4">
				{#if shown}
					<ByteInspector bytes={shown.bytes} message={shown.message} />
				{:else}
					<p class="measure text-sm text-muted-foreground">
						Nothing to take apart yet. As soon as a message arrives this panel shows it as hex, as
						bits, split into its nibbles and translated into English — and clicking a row holds that
						one still while the rest scrolls past.
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>
