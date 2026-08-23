<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.ContentProps = $props();
</script>

<TabsPrimitive.Content
	bind:ref
	data-slot="tabs-content"
	class={cn(
		// The panel carries tabindex=0 so Tab out of the tab list lands in it —
		// which is only useful if you can see that it did. Without this it is a
		// stop with nothing to show for itself.
		'flex-1 rounded-md text-xs/relaxed outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-solid focus-visible:outline-ring/60',
		className
	)}
	{...restProps}
/>
