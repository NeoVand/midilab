<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Loading03Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils.js';
	import type { SVGAttributes } from 'svelte/elements';

	let {
		class: className,
		role = 'status',
		// we add name, color, and stroke for compatibility with different icon libraries props
		name: _name,
		color: _color,
		stroke: _stroke,
		'aria-label': ariaLabel = 'Loading',
		...restProps
	}: SVGAttributes<SVGSVGElement> = $props();
</script>

<HugeiconsIcon
	icon={Loading03Icon}
	strokeWidth={2}
	{role}
	aria-label={ariaLabel}
	class={cn('size-4 animate-spin', className)}
/>
