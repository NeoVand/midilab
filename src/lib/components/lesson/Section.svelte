<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		title?: string;
		id?: string;
		lead?: string;
		children: Snippet;
		class?: string;
	}
	let { title, id, lead, children, class: className }: Props = $props();
</script>

<section {id} class={cn('flex scroll-mt-6 flex-col gap-4', className)}>
	{#if title}
		<h2 class="text-xl font-semibold tracking-tight">{title}</h2>
	{/if}
	{#if lead}
		<p class="-mt-2 text-[15px] leading-relaxed text-muted-foreground">{lead}</p>
	{/if}
	{@render children()}
</section>
