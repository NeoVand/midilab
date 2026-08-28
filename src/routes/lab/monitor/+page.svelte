<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import ActivityStrip from '$lib/components/midi/ActivityStrip.svelte';
	import ChannelState from '$lib/components/midi/ChannelState.svelte';
	import WireView from '$lib/components/midi/WireView.svelte';
	import WireLoad from '$lib/components/midi/WireLoad.svelte';
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
	 * Three ways of looking at the same stream.
	 *
	 * The log answers "did that message arrive". It is much worse at answering
	 * "what is the mod wheel sitting at", because the answer scrolled away four
	 * hundred messages ago — State answers that, and only for the channels
	 * actually in play. Neither answers "what shape is this": a filter sweep is
	 * forty rows of Control Change read one at a time, and the Wire view is the
	 * same forty rows as a curve.
	 */
	let view = $state<'stream' | 'wire' | 'state'>('stream');

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

<!--
	Fills the window on a desk; scrolls on a phone.
	
	Three panes sharing one viewport height is a desk layout. On a phone the
	header and the legend take half of it before the log starts, which left the
	stream and the inspector about a hundred and ninety pixels each — enough to
	clip their own empty-state sentences. Below `md` the page is a document: the
	log takes a generous share and the inspector follows it down.
-->
<div
	class="workbench mx-auto flex w-full flex-col gap-4 px-4 py-4 sm:gap-5 sm:py-6 md:h-full md:min-h-0 md:px-8"
>
	<PageHeader
		title="Monitor"
		lead="Three views of the same stream: every byte in the order the wire carried it, the shape of it over the last few seconds, or the standing state of every channel in play."
		back={{ href: '/lab', label: 'Lab' }}
	>
		{#snippet actions()}
			<div class="flex rounded-md border p-0.5">
				{#each [['stream', 'Stream'], ['wire', 'Wire'], ['state', 'State']] as [value, label] (value)}
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
			{#if view !== 'state'}
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
		The family legend is a colour key for the log and for the wire view, which
		is nothing but family colours. In the state view nothing is coloured by
		family, so it would be dead chrome — that row says what is actually in
		front of you instead.
	-->
	<div class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-2.5">
		{#if view !== 'state'}
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
		<!--
			What this traffic would cost on the wire MIDI was designed for. Over
			USB it costs nothing like it — the point is the shape of the limit the
			protocol still carries the scars of.
		-->
		<WireLoad class="w-56 shrink-0" />
		<!--
			"msg/s", not "/s". It sits immediately after the wire load's "B/s", and
			two bare rates a middot apart, one of them unlabelled, is a reader
			guessing which of them is bytes.
		-->
		<span class="tnum font-mono text-xs text-muted-foreground">
			{monitor.rate} msg/s · {monitor.total} buffered
		</span>
	</div>

	{#if view === 'stream'}
		<div class="grid gap-4 md:min-h-0 md:flex-1 lg:grid-cols-[1fr_26rem]">
			<div class="h-[46vh] overflow-hidden rounded-lg border md:h-auto md:min-h-0">
				<MidiMonitor class="h-full" onSelect={select} selectedId={pinned?.id ?? null} />
			</div>
			<div class="flex flex-col overflow-hidden rounded-lg border md:min-h-0">
				<div class="flex items-center justify-between gap-2 border-b px-4 py-1.5">
					<p class="label">Inspector</p>
					{#if pinned}
						<button
							class="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-foreground transition-colors hover:bg-muted"
							onclick={() => (pinned = null)}
						>
							Pinned <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={2.5} />
						</button>
					{:else if shown}
						<span class="label text-muted-foreground">following</span>
					{/if}
				</div>
				<div class="flex min-h-0 flex-1 scrollbar-thin flex-col overflow-y-auto p-4">
					<ByteInspector bytes={shown?.bytes ?? null} message={shown?.message} stack />
				</div>
			</div>
		</div>
	{:else if view === 'wire'}
		<div class="h-[52vh] overflow-hidden rounded-lg border md:h-auto md:min-h-0 md:flex-1">
			<WireView class="h-full" />
		</div>
	{:else}
		<div class="scrollbar-thin md:min-h-0 md:flex-1 md:overflow-y-auto">
			<ChannelState />
		</div>
	{/if}
</div>
