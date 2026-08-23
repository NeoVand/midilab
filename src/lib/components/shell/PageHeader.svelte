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

<!--
	Stacked until there is room to sit side by side.
	
	`flex-wrap` was not enough. The actions row does not shrink — it is
	buttons — so on a narrow screen the flexible text column absorbed every
	pixel of the shortfall instead of wrapping, and the lead paragraph came out
	one word per line beside a button group. Below `sm` the two are simply
	stacked, which is what wrapping was meant to achieve.
-->
<header
	class={cn(
		'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4',
		className
	)}
>
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
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</header>
