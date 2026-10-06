<script lang="ts">
	import { untrack } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	type NativeSelectProps = Omit<WithElementRef<HTMLSelectAttributes>, 'size'> & {
		size?: 'sm' | 'default';
	};

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		size = 'default',
		children,
		...restProps
	}: NativeSelectProps = $props();
</script>

<div
	class={cn(
		'cn-native-select-wrapper group/native-select relative w-fit has-[select:disabled]:opacity-50',
		className
	)}
	data-slot="native-select-wrapper"
	data-size={size}
>
	<select
		bind:value
		{@attach (element) => {
			if (untrack(() => ref) !== element) ref = element;
			return () => {
				if (ref === element) ref = null;
			};
		}}
		data-slot="native-select"
		data-size={size}
		class="select-control h-7 w-full min-w-0 appearance-none rounded-md border border-input py-0.5 pr-6 pl-2 text-xs/relaxed text-foreground transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-[size=sm]:h-6 data-[size=sm]:text-[0.625rem] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
		{...restProps}
	>
		{@render children?.()}
	</select>
	<HugeiconsIcon
		icon={ArrowDown01Icon}
		strokeWidth={2}
		class="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-muted-foreground select-none group-data-[size=sm]/native-select:size-2.5"
		aria-hidden
		data-slot="native-select-icon"
	/>
</div>
