<script lang="ts">
	/**
	 * Which receiver is listening.
	 *
	 * This app has two, and they are not equivalent: the sampled General MIDI
	 * instruments sound like the instruments, and the built-in synth can be
	 * bent, filtered and reshaped while a note is sounding. Several lessons
	 * demonstrate things only one of them can do, and a demonstration that
	 * silently does nothing because the other one is selected is worse than no
	 * demonstration at all — so those lessons say which they need, and offer
	 * the switch on the spot rather than sending you to Settings.
	 */
	import { gm } from '$lib/audio/gm.svelte';
	import { momentary } from '$lib/a11y/momentary';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Alert02Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		/** Which engine this demonstration actually needs, if either. */
		needs?: 'synth' | 'sampled';
		/** Said only when the wrong one is selected. */
		because?: string;
		class?: string;
	}
	let { needs, because, class: className }: Props = $props();

	const wrong = $derived(needs !== undefined && (needs === 'synth') === gm.enabled);
</script>

<div class={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs', className)}>
	<div class="flex items-center gap-1.5">
		<span class="text-muted-foreground">Receiver</span>
		<div class="flex rounded-md border p-0.5" role="group" aria-label="Sound engine">
			{#each [['sampled', true], ['synth', false]] as [label, sampled] (label)}
				<button
					type="button"
					use:momentary
					onclick={() => (gm.enabled = sampled as boolean)}
					aria-pressed={gm.enabled === sampled}
					class="rounded-sm px-2 py-0.5 text-muted-foreground
						transition-colors hover:text-foreground
						aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground"
				>
					{label}
				</button>
			{/each}
		</div>
	</div>
	{#if wrong && because}
		<p class="flex items-center gap-1.5 text-warn">
			<HugeiconsIcon icon={Alert02Icon} size={13} strokeWidth={2} />
			{because}
		</p>
	{/if}
</div>
