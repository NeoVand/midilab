<script lang="ts">
	import type { Snippet } from 'svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { FlaskConicalIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		title?: string;
		children: Snippet;
		class?: string;
	}
	let { title = 'Try this', children, class: className }: Props = $props();
</script>

<div class={cn('overflow-hidden rounded-xl border', className)}>
	<div class="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
		<HugeiconsIcon icon={FlaskConicalIcon} size={15} class="text-muted-foreground" />
		<span class="text-[11px] font-semibold tracking-wide uppercase">{title}</span>
	</div>
	<div class="flex flex-col gap-4 p-4">
		{@render children()}
	</div>
</div>
