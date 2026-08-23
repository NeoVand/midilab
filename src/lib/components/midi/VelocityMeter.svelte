<script lang="ts">
	/** Shows the velocity of the last Note On, with a decaying history. */
	import { bus } from '$lib/midi/bus';
	import { onMount } from 'svelte';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		channel?: number | null;
		class?: string;
	}
	let { channel = null, class: className }: Props = $props();

	let last = $state<{ note: number; velocity: number } | null>(null);
	let history = $state<number[]>([]);

	onMount(() =>
		bus.subscribe((e) => {
			if (e.message.type !== 'noteOn') return;
			if (channel !== null && e.message.channel !== channel) return;
			last = { note: e.message.note, velocity: e.message.velocity };
			history = [...history, e.message.velocity].slice(-40);
		})
	);

	const flavour = (v: number) =>
		v <= 20
			? 'barely touched'
			: v <= 45
				? 'soft'
				: v <= 80
					? 'moderate'
					: v <= 110
						? 'firm'
						: 'hammered';
</script>

<div class={cn('flex flex-col gap-3 rounded-lg border p-4', className)}>
	<div class="flex items-end justify-between">
		<div>
			<p class="label">Last velocity</p>
			<p class="tnum font-mono text-4xl leading-none text-msg-note">{last?.velocity ?? '—'}</p>
		</div>
		<p class="text-right text-xs text-muted-foreground">
			{#if last}
				{noteName(last.note, { convention: settings.octaveConvention })}<br />{flavour(
					last.velocity
				)}
			{:else}
				play something
			{/if}
		</p>
	</div>

	<div class="h-2 overflow-hidden rounded-full bg-muted">
		<div
			class="h-full rounded-full bg-msg-note transition-[width] duration-100"
			style="width: {((last?.velocity ?? 0) / 127) * 100}%"
		></div>
	</div>

	<div class="panel-sunken relative flex h-14 items-end gap-[2px] rounded-lg border p-1.5">
		{#each history as v, i (i)}
			<div
				class="min-w-[3px] flex-1 rounded-xs bg-msg-note"
				style="height: {Math.max(6, (v / 127) * 100)}%; opacity: {0.35 +
					(i / Math.max(1, history.length)) * 0.65}"
			></div>
		{/each}
		{#if history.length === 0}
			<p class="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
				velocity history
			</p>
		{/if}
	</div>
</div>
