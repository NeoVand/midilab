<script lang="ts">
	/**
	 * The state a tool is in most of the time before you have plugged anything
	 * in — so it deserves as much care as the populated one.
	 *
	 * The rule here: say what is missing, say what this will do once it is not,
	 * and offer the one action that fixes it. A box that only says "nothing
	 * yet" has spent the user's attention and given nothing back.
	 */
	import type { Snippet } from 'svelte';
	import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/svelte';
	import { cn } from '$lib/utils';

	interface Props {
		icon?: IconSvgElement;
		title: string;
		body?: string;
		/** Buttons or links. Kept to one primary action wherever possible. */
		action?: Snippet;
		/** A diagram of what this tool does once it has something to work with. */
		figure?: Snippet;
		class?: string;
	}
	let { icon, title, body, action, figure, class: className }: Props = $props();
</script>

<div
	class={cn(
		'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center',
		className
	)}
>
	{#if icon}
		<HugeiconsIcon {icon} size={22} strokeWidth={1.5} class="text-muted-foreground/50" />
	{/if}
	<p class="text-sm font-medium">{title}</p>
	{#if body}
		<p class="max-w-[46ch] text-xs text-muted-foreground">{body}</p>
	{/if}
	{#if figure}
		<div class="mt-1 w-full max-w-md opacity-90">{@render figure()}</div>
	{/if}
	{#if action}
		<div class="mt-1 flex flex-wrap items-center justify-center gap-2">{@render action()}</div>
	{/if}
</div>
