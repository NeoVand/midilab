<script lang="ts">
	import { path } from '$lib/nav';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		title: string;
		lead?: string;
		back?: { href: string; label: string };
		actions?: Snippet;
		class?: string;
	}
	let { title, lead, back, actions, class: className }: Props = $props();
</script>

<header class={cn('flex flex-wrap items-end justify-between gap-4', className)}>
	<div class="flex min-w-0 flex-1 flex-col gap-2">
		{#if back}
			<a href={path(back.href)} class="text-xs text-muted-foreground hover:text-foreground">
				← {back.label}
			</a>
		{/if}
		<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
		{#if lead}
			<p class="measure text-sm text-muted-foreground">{lead}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex items-center gap-2">{@render actions()}</div>
	{/if}
</header>
