<script lang="ts">
	/**
	 * The message monitor.
	 *
	 * Newest at the top so a running stream does not require chasing. Real-time
	 * messages are hidden by default because a MIDI clock alone is 48 messages a
	 * second at 120 BPM and would bury everything else — which is itself worth
	 * noticing, so the toggle is right there.
	 */
	import { monitor } from '$lib/midi/monitor.svelte';
	import type { MidiEvent } from '$lib/midi/bus';
	import {
		FAMILY_LABELS,
		family,
		familyColor,
		hexBytes,
		shortLabel,
		ch1,
		type MessageFamily
	} from '$lib/midi/messages';
	import { settings } from '$lib/stores/settings.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowDown01Icon,
		ArrowUp01Icon,
		PauseIcon,
		PlayIcon,
		Delete02Icon,
		FilterIcon
	} from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils';

	interface Props {
		onSelect?: (event: MidiEvent) => void;
		selectedId?: number | null;
		class?: string;
		showToolbar?: boolean;
	}
	let { onSelect, selectedId = null, class: className, showToolbar = true }: Props = $props();

	const rows = $derived(monitor.filtered);

	/**
	 * A column that says the same thing on every row is not a column, it is a
	 * caption repeated a hundred times. Port only appears once there is more
	 * than one of them, and then only on the row where it changes.
	 */
	const showPort = $derived(new Set(rows.map((e) => e.portId)).size > 1);
	const allFamilies: MessageFamily[] = [
		'note',
		'cc',
		'expr',
		'program',
		'clock',
		'sysex',
		'common'
	];

	function deltaMs(i: number): string {
		const next = rows[i + 1];
		if (!next) return '';
		const d = rows[i].time - next.time;
		return d < 1000 ? `+${d.toFixed(1)}` : `+${(d / 1000).toFixed(2)}s`;
	}
</script>

<div class={cn('flex min-h-0 flex-col', className)}>
	{#if showToolbar}
		<div class="flex shrink-0 items-center gap-1.5 border-b px-2 py-1.5">
			<Button
				variant="ghost"
				size="sm"
				class="h-7 gap-1.5 px-2"
				onclick={() => (monitor.paused = !monitor.paused)}
			>
				<HugeiconsIcon icon={monitor.paused ? PlayIcon : PauseIcon} size={14} />
				<span class="text-xs">{monitor.paused ? 'Resume' : 'Freeze'}</span>
			</Button>
			<Button variant="ghost" size="sm" class="h-7 gap-1.5 px-2" onclick={() => monitor.clear()}>
				<HugeiconsIcon icon={Delete02Icon} size={14} />
				<span class="text-xs">Clear</span>
			</Button>

			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm" class="h-7 gap-1.5 px-2">
							<HugeiconsIcon icon={FilterIcon} size={14} />
							<span class="text-xs">Filter</span>
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-64" align="start">
					<div class="flex flex-col gap-3">
						<div class="flex items-center justify-between">
							<Label for="hide-rt" class="text-xs font-normal">Hide clock &amp; sensing</Label>
							<Switch id="hide-rt" bind:checked={monitor.hideRealTime} />
						</div>
						<div class="flex flex-col gap-1.5">
							<span class="label">Families</span>
							{#each allFamilies as f (f)}
								<button
									class="flex items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent"
									onclick={() => monitor.toggleFamily(f)}
								>
									<span
										class="size-2.5 rounded-full transition-opacity"
										style="background: {familyColor(f)}; opacity: {monitor.families.includes(f)
											? 1
											: 0.2}"
									></span>
									<span class={monitor.families.includes(f) ? '' : 'text-muted-foreground/60'}>
										{FAMILY_LABELS[f]}
									</span>
								</button>
							{/each}
						</div>
					</div>
				</Popover.Content>
			</Popover.Root>

			<div class="flex-1"></div>
			<span class="tnum font-mono text-xs text-muted-foreground">
				{monitor.rate}/s · {monitor.total}
			</span>
		</div>
	{/if}

	<div class="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
		{#if rows.length === 0}
			<div
				class="grid h-full min-h-24 place-items-center p-6 text-center text-sm text-muted-foreground"
			>
				<div class="measure">
					<p class="text-foreground">Nothing on the wire yet.</p>
					<p class="mt-1.5 text-xs">
						Play a note, or connect a device and send something. Each row will show the gap since
						the previous message, its direction, its family colour, the channel, the raw bytes and
						what they mean.
					</p>
				</div>
			</div>
		{:else}
			<table class="w-full border-collapse font-mono text-xs">
				<thead class="sticky top-0 z-10 bg-background/95 backdrop-blur">
					<tr class="border-b">
						<th class="label w-14 py-1 pr-1 pl-2 text-right font-medium">Δt</th>
						<th class="label w-5 py-1 font-medium" title="Direction"
							><span class="sr-only">Direction</span></th
						>
						<th class="label w-2 py-1 font-medium"><span class="sr-only">Family</span></th>
						<th class="label w-7 py-1 pl-1.5 text-right font-medium">ch</th>
						<th class="label w-[8.5rem] py-1 pl-3 text-left font-medium">bytes</th>
						<th class="label py-1 pr-2 pl-2 text-left font-medium">message</th>
						{#if showPort}
							<th class="label hidden w-32 py-1 pr-3 text-right font-medium lg:table-cell">port</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each rows as e, i (e.id)}
						{@const fam = family(e.message)}
						{@const channel = ch1(e.message)}
						<tr
							class={cn(
								'cursor-default border-b border-border/50 transition-colors hover:bg-accent/40',
								selectedId === e.id && 'bg-accent'
							)}
							onclick={() => onSelect?.(e)}
						>
							<td class="w-14 py-[3px] pr-1 pl-2 text-right text-muted-foreground/70 tabular-nums">
								{deltaMs(i)}
							</td>
							<td class="w-5 py-[3px]">
								<HugeiconsIcon
									icon={e.direction === 'in' ? ArrowDown01Icon : ArrowUp01Icon}
									size={12}
									class={e.direction === 'in' ? 'text-msg-cc' : 'text-muted-foreground'}
								/>
							</td>
							<td class="w-2 py-[3px]">
								<span class="block size-2 rounded-full" style="background: {familyColor(fam)}"
								></span>
							</td>
							<td
								class="w-7 py-[3px] pl-1.5 text-right tabular-nums"
								style="color: {familyColor(fam)}"
							>
								{channel ?? '—'}
							</td>
							<td class="w-[8.5rem] py-[3px] pl-3 whitespace-nowrap text-muted-foreground">
								{hexBytes(e.bytes.slice(0, 6))}{e.bytes.length > 6 ? '…' : ''}
							</td>
							<td class="truncate py-[3px] pr-2 pl-2">
								{shortLabel(e.message, { octaveConvention: settings.octaveConvention })}
							</td>
							{#if showPort}
								<td
									class="hidden w-32 truncate py-[3px] pr-3 text-right text-muted-foreground/60 lg:table-cell"
								>
									{rows[i + 1]?.portId === e.portId ? '' : e.portName}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
