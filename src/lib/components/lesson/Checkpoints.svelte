<script lang="ts">
	import type { Snippet } from 'svelte';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Target02Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		lesson: string;
		title?: string;
		children: Snippet;
		class?: string;
	}
	let { lesson, title = 'Prove it', children, class: className }: Props = $props();

	const done = $derived(progress.doneCount(lesson));
	const total = $derived(progress.totalFor(lesson));
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<div class="flex items-baseline gap-2.5">
		<HugeiconsIcon icon={Target02Icon} size={18} class="translate-y-0.5 text-muted-foreground" />
		<h2 class="text-xl font-semibold tracking-tight">{title}</h2>
		{#if total > 0}
			<span class="tnum font-mono text-xs text-muted-foreground">{done}/{total}</span>
		{/if}
	</div>
	<p class="-mt-1 text-sm text-muted-foreground">
		These tick themselves off when the engine sees you do it — on the internal synth or on your own
		hardware, it makes no difference.
	</p>
	<div class="flex flex-col gap-2">
		{@render children()}
	</div>
</div>
