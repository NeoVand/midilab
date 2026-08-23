<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import ActivityStrip from '$lib/components/midi/ActivityStrip.svelte';
	import ChannelState from '$lib/components/midi/ChannelState.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import type { MidiEvent } from '$lib/midi/bus';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CloudDownloadIcon, Cancel01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	/**
	 * The inspector follows the stream until you pin a row.
	 *
	 * An empty 26rem panel headed "select a message" is a large piece of the
	 * screen doing nothing while the interesting thing scrolls past next to it.
	 * Following by default means the byte view is always showing the most recent
	 * message; clicking a row pins it so it stops moving under you.
	 */
	let pinned = $state<MidiEvent | null>(null);

	/**
	 * Two ways of looking at the same stream.
	 *
	 * The log answers "did that message arrive". It is much worse at answering
	 * "what is the mod wheel sitting at", because the answer scrolled away four
	 * hundred messages ago. State answers the second question, and only shows
	 * the channels that are actually in play.
	 */
	let view = $state<'stream' | 'state'>('stream');

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

<div class="mx-auto flex h-full min-h-0 w-full workbench flex-col gap-5 px-8 py-6">
	<PageHeader
		title="Monitor"
		lead="Two views of the same stream: every byte in the order the wire carried it, or the standing state of every channel in play."
		back={{ href: '/lab', label: 'Lab' }}
	>
		{#snippet actions()}
			<div class="flex rounded-md border p-0.5">
				{#each [['stream', 'Stream'], ['state', 'State']] as [value, label] (value)}
					<button
						class={cn(
							'rounded-sm px-2.5 py-1 text-xs transition-colors',
							view === value
								? 'bg-muted font-medium text-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
						onclick={() => (view = value as typeof view)}
					>
						{label}
					</button>
				{/each}
			</div>
			{#if view === 'stream'}
				<Button variant="outline" size="sm" class="gap-1.5" onclick={exportTsv}>
					<HugeiconsIcon icon={CloudDownloadIcon} size={14} /> Export
				</Button>
			{:else}
				<Button variant="outline" size="sm" class="gap-1.5" onclick={() => noteState.reset()}>
					<HugeiconsIcon icon={Delete02Icon} size={14} /> Forget
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

	<!--
		The family legend is a colour key for the log. In the state view nothing
		is coloured by family, so it would be dead chrome — that row says what is
		actually in front of you instead.
	-->
	<div class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-2.5">
		{#if view === 'stream'}
			<ActivityStrip layout="legend" />
		{:else}
			{@const n = noteState.usedChannels.length}
			<span class="text-xs text-muted-foreground">
				{n} channel{n === 1 ? '' : 's'} in play · {noteState.heldCount} note{noteState.heldCount ===
				1
					? ''
					: 's'} sounding
			</span>
		{/if}
		<div class="flex-1"></div>
		<span class="tnum font-mono text-xs text-muted-foreground">
			{monitor.rate}/s · {monitor.total} buffered
		</span>
	</div>

	{#if view === 'stream'}
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
						<span class="label text-muted-foreground">following</span>
					{/if}
				</div>
				<div class="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-4">
					{#if shown}
						<ByteInspector bytes={shown.bytes} message={shown.message} />
					{:else}
						<p class="measure text-sm text-muted-foreground">
							Nothing to take apart yet. As soon as a message arrives this panel shows it as hex, as
							bits, split into its nibbles and translated into English — and clicking a row holds
							that one still while the rest scrolls past.
						</p>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
			<ChannelState />
		</div>
	{/if}
</div>
