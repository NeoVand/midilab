<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { MoreHorizontalCircle01Icon } from '@hugeicons/core-free-icons';
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLSpanElement>>> = $props();
</script>

<span
	bind:this={ref}
	aria-hidden="true"
	data-slot="pagination-ellipsis"
	class={cn(
		"flex size-7 items-center items-center justify-center justify-center [&_svg:not([class*='size-'])]:size-3.5",
		className
	)}
	{...restProps}
>
	<HugeiconsIcon icon={MoreHorizontalCircle01Icon} strokeWidth={2} />
	<span class="sr-only">More pages</span>
</span>
