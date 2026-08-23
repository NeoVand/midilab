<script lang="ts">
	/** Seven bars, one per message family, lit by whatever is passing through. */
	import { monitor } from '$lib/midi/monitor.svelte';
	import { FAMILY_LABELS, familyColor, type MessageFamily } from '$lib/midi/messages';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';

	interface Props {
		families?: MessageFamily[];
		height?: number;
		class?: string;
	}
	let {
		families = ['note', 'cc', 'expr', 'program', 'clock', 'sysex', 'common'],
		height = 20,
		class: className
	}: Props = $props();
</script>

<Tooltip.Provider delayDuration={300}>
	<div class={cn('flex items-end gap-[3px]', className)} style="height: {height}px">
		{#each families as f (f)}
			{@const level = monitor.activity[f]}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<div
							{...props}
							class="relative w-[5px] rounded-[2px] bg-muted/60"
							style="height: {height}px"
						>
							<div
								class="absolute inset-x-0 bottom-0 rounded-[2px] transition-[height] duration-75"
								style="height: {Math.max(8, level * 100)}%; background: {familyColor(
									f
								)}; opacity: {0.25 + level * 0.75}"
							></div>
						</div>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top">{FAMILY_LABELS[f]}</Tooltip.Content>
			</Tooltip.Root>
		{/each}
	</div>
</Tooltip.Provider>
