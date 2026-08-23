<script lang="ts">
	/**
	 * A search box that behaves the way people expect a search box to behave.
	 *
	 * The plain `<Input placeholder="Filter…">` this replaces looked like a
	 * search field without doing any of the work: no way to see at a glance that
	 * a filter was active, no way to clear it without selecting the text, and no
	 * way to reach it from the keyboard. On a page whose entire purpose is
	 * lookup, that is the primary control.
	 */
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SearchIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
	import { isTypingTarget } from '$lib/stores/shortcuts.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		value: string;
		placeholder?: string;
		/** Single key that focuses this field from anywhere on the page. */
		shortcut?: string;
		class?: string;
	}
	let {
		value = $bindable(''),
		placeholder = 'Search…',
		shortcut,
		class: className
	}: Props = $props();

	let input = $state<HTMLInputElement | null>(null);

	function onWindowKeydown(e: KeyboardEvent) {
		if (!shortcut || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key !== shortcut || isTypingTarget(e.target)) return;
		e.preventDefault();
		input?.focus();
		input?.select();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		// First Escape clears, a second one gives the keyboard back to the page.
		if (value) {
			e.stopPropagation();
			value = '';
		} else {
			input?.blur();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class={cn('relative', className)}>
	<HugeiconsIcon
		icon={SearchIcon}
		size={14}
		strokeWidth={2}
		class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
	/>
	<input
		bind:this={input}
		bind:value
		type="search"
		spellcheck="false"
		autocomplete="off"
		{placeholder}
		onkeydown={onKeydown}
		class="h-8 w-full rounded-md border bg-surface-sunken pr-8 pl-8 text-sm
			placeholder:text-muted-foreground/70
			focus-visible:border-ring
			[&::-webkit-search-cancel-button]:appearance-none"
	/>
	{#if value}
		<button
			type="button"
			onclick={() => {
				value = '';
				input?.focus();
			}}
			aria-label="Clear search"
			class="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
		>
			<HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
		</button>
	{:else if shortcut}
		<kbd
			class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-md border px-1 font-mono text-2xs text-muted-foreground/70"
		>
			{shortcut}
		</kbd>
	{/if}
</div>
