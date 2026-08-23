<script lang="ts">
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	type Props = WithoutChildrenOrChild<SliderPrimitive.RootProps> & {
		/** One label per thumb, for range sliders whose ends mean different things. */
		thumbLabels?: string[];
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		orientation = 'horizontal',
		class: className,
		'aria-label': ariaLabel,
		thumbLabels,
		...restProps
	}: Props = $props();
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<SliderPrimitive.Root
	bind:ref
	bind:value={value as never}
	data-slot="slider"
	{orientation}
	class={cn(
		'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
		className
	)}
	{...restProps}
>
	{#snippet children({ thumbItems })}
		<span
			data-slot="slider-track"
			data-orientation={orientation}
			class={cn(
				'relative grow overflow-hidden rounded-md bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1'
			)}
		>
			<SliderPrimitive.Range
				data-slot="slider-range"
				class={cn('absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full')}
			/>
		</span>
		{#each thumbItems as thumb (thumb.index)}
			<!--
				The thumb is the element with role="slider", so the accessible name
				has to land here. Putting it on the root — or relying on a wrapping
				<label>, which does not associate with a div — leaves it unnamed.
			-->
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				index={thumb.index}
				aria-label={thumbLabels?.[thumb.index] ?? ariaLabel}
				class="relative block size-3 shrink-0 rounded-md border border-ring bg-background ring-ring/30 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden active:ring-2 disabled:pointer-events-none disabled:opacity-50"
			/>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
