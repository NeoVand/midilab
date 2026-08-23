<script lang="ts">
	/**
	 * "Wiggle a knob and I'll tell you what it is."
	 *
	 * Watches incoming Control Change traffic and reports which controller
	 * numbers are moving, on which channel, through what range. This is how you
	 * map an instrument whose manual you cannot find — and the core of the
	 * Device Lab's profile builder.
	 */
	import { onMount } from 'svelte';
	import { bus } from '$lib/midi/bus';
	import { ccInfo } from '$lib/midi/constants';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Delete02Icon, PlugSocketIcon } from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** Only watch messages arriving from outside; ignore what this page sends. */
		incomingOnly?: boolean;
		class?: string;
	}
	let { incomingOnly = true, class: className }: Props = $props();

	interface Seen {
		key: string;
		channel: number;
		cc: number;
		last: number;
		min: number;
		max: number;
		count: number;
		at: number;
	}

	let seen = $state<Seen[]>([]);

	onMount(() =>
		bus.subscribe((e) => {
			if (incomingOnly && e.direction !== 'in') return;
			const m = e.message;
			if (m.type !== 'controlChange') return;
			const key = `${m.channel}:${m.controller}`;
			const existing = seen.find((s) => s.key === key);
			if (existing) {
				existing.last = m.value;
				existing.min = Math.min(existing.min, m.value);
				existing.max = Math.max(existing.max, m.value);
				existing.count++;
				existing.at = e.time;
				seen = [...seen].sort((a, b) => b.at - a.at);
			} else {
				seen = [
					{
						key,
						channel: m.channel,
						cc: m.controller,
						last: m.value,
						min: m.value,
						max: m.value,
						count: 1,
						at: e.time
					},
					...seen
				].slice(0, 24);
			}
		})
	);
</script>

<div class={cn('flex flex-col gap-2 rounded-lg border', className)}>
	<div class="flex items-center justify-between border-b px-3 py-2">
		<p class="text-sm font-semibold">
			Controllers seen{incomingOnly ? ' from your hardware' : ''}
		</p>
		<Button variant="ghost" size="sm" class="h-6 gap-1 px-1.5 text-xs" onclick={() => (seen = [])}>
			<HugeiconsIcon icon={Delete02Icon} size={12} /> Reset
		</Button>
	</div>

	{#if seen.length === 0 && incomingOnly && midiAccess.listening.length === 0}
		<div class="flex flex-col items-center gap-3 p-5 text-center">
			<p class="max-w-[52ch] text-xs leading-relaxed text-muted-foreground">
				{#if midiAccess.status === 'unsupported'}
					This browser has no Web MIDI, so nothing can arrive here. Chrome, Edge or Firefox can
					watch a controller; everything else in the app still works.
				{:else if midiAccess.status === 'granted'}
					Nothing is being listened to yet. Switch on an input in the dock, then move a knob.
				{:else}
					Nothing is connected yet.
				{/if}
			</p>
			{#if midiAccess.status !== 'granted' && midiAccess.status !== 'unsupported'}
				<Button size="sm" class="gap-1.5" onclick={() => midiAccess.request(false)}>
					<HugeiconsIcon icon={PlugSocketIcon} size={14} /> Connect MIDI
				</Button>
			{/if}
		</div>
	{:else if seen.length === 0}
		<p class="p-4 text-center text-xs leading-relaxed text-muted-foreground">
			Move a knob, fader, wheel or pedal{incomingOnly ? ' on your controller' : ''}.<br />
			Whatever it sends will appear here with its number and range.
		</p>
	{:else}
		<div class="flex flex-col">
			{#each seen as s (s.key)}
				<div class="flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0">
					<span class="tnum w-14 font-mono text-sm text-msg-cc">CC {s.cc}</span>
					<span class="w-8 font-mono text-xs text-muted-foreground">ch {s.channel + 1}</span>
					<span class="min-w-0 flex-1 truncate text-xs">{ccInfo(s.cc).name}</span>
					<div class="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
						<div class="h-full bg-msg-cc" style="width: {(s.last / 127) * 100}%"></div>
					</div>
					<span class="tnum w-8 text-right font-mono text-xs">{s.last}</span>
					<span class="tnum w-16 text-right font-mono text-2xs text-muted-foreground">
						{s.min}–{s.max}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
