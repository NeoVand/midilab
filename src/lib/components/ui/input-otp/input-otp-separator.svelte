<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { MinusSignIcon } from '@hugeicons/core-free-icons';
	import type { WithElementRef } from '$lib/utils.js';
	import { cn } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="input-otp-separator"
	role="separator"
	class={cn("flex items-center [&_svg:not([class*='size-'])]:size-4", className)}
	{...restProps}
>
	{#if children}
		{@render children?.()}
	{:else}
		<HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
	{/if}
</div>
