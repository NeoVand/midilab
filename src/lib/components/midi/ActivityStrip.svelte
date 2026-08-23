<script lang="ts">
	/**
	 * Live activity per message family.
	 *
	 * Two shapes of the same data. `bars` is the dock's seven-bar meter, small
	 * enough to sit in a toolbar and read peripherally. `legend` is the same
	 * meters with their names attached — which means the colour key and the
	 * activity display are one object rather than two things saying the same
	 * thing side by side, and the legend teaches itself: the bar you see move
	 * is the name you read.
	 */
	import { monitor } from '$lib/midi/monitor.svelte';
	import { FAMILY_LABELS, familyColor, type MessageFamily } from '$lib/midi/messages';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';

	interface Props {
		families?: MessageFamily[];
		height?: number;
		layout?: 'bars' | 'legend';
		class?: string;
	}
	let {
		families = ['note', 'cc', 'expr', 'program', 'clock', 'sysex', 'common'],
		height = 20,
		layout = 'bars',
		class: className
	}: Props = $props();
</script>

{#if layout === 'legend'}
	<div class={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
		{#each families as f (f)}
			{@const level = monitor.activity[f]}
			<span class="flex items-center gap-1.5">
				<span
					class="size-2 shrink-0 rounded-full transition-[box-shadow,opacity] duration-100"
					style="background: {familyColor(f)}; opacity: {0.45 +
						level * 0.55}; box-shadow: 0 0 {level * 7}px {familyColor(f)}"
				></span>
				<span
					class="text-xs whitespace-nowrap transition-colors duration-150"
					style:color={level > 0.15 ? familyColor(f) : undefined}
					class:text-muted-foreground={level <= 0.15}
				>
					{FAMILY_LABELS[f]}
				</span>
			</span>
		{/each}
	</div>
{:else}
	<Tooltip.Provider delayDuration={300}>
		<div class={cn('flex items-end gap-[3px]', className)} style="height: {height}px">
			{#each families as f (f)}
				{@const level = monitor.activity[f]}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<div
								{...props}
								class="relative w-[5px] rounded-xs bg-muted/60"
								style="height: {height}px"
							>
								<div
									class="absolute inset-x-0 bottom-0 rounded-xs transition-[height] duration-75"
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
{/if}
