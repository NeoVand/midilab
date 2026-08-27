<script lang="ts">
	/** A single question with an explanation that only appears once you commit. */
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Tick02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		question: string;
		options: string[];
		answer: number;
		explanation?: string;
		children?: Snippet;
		class?: string;
	}
	let { question, options, answer, explanation, children, class: className }: Props = $props();

	let picked = $state<number | null>(null);
	const correct = $derived(picked === answer);
</script>

<div class={cn('reading flex flex-col gap-3 rounded-lg border p-4', className)}>
	<p class="text-base font-medium">{question}</p>
	{#if children}
		<div>{@render children()}</div>
	{/if}
	<div class="flex flex-col gap-1.5">
		{#each options as option, i (i)}
			<button
				class={cn(
					'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
					picked === null && 'hover:border-foreground/30 hover:bg-accent/40',
					picked !== null && i === answer && 'border-ok/50 bg-ok/10',
					picked === i && i !== answer && 'border-destructive/50 bg-destructive/10'
				)}
				disabled={picked !== null}
				onclick={() => (picked = i)}
			>
				<span
					class={cn(
						'grid size-4 shrink-0 place-items-center rounded-full border text-transparent',
						picked !== null && i === answer && 'border-ok bg-ok text-background',
						picked === i && i !== answer && 'border-destructive bg-destructive text-background'
					)}
				>
					<HugeiconsIcon
						icon={i === answer ? Tick02Icon : Cancel01Icon}
						size={10}
						strokeWidth={3}
					/>
				</span>
				<span>{option}</span>
			</button>
		{/each}
	</div>
	{#if picked !== null && explanation}
		<p
			class={cn(
				'rounded-lg border-l-2 py-1 pl-3 text-sm leading-relaxed',
				correct ? 'border-ok' : 'border-warn'
			)}
		>
			{explanation}
		</p>
	{/if}
</div>
