<script lang="ts">
	/**
	 * An outbound link inside a sentence.
	 *
	 * The counterpart to `Xref`: that one goes sideways within the course, this
	 * one goes out of it. Same reasoning about ids — the URL lives in
	 * `references.ts` and a key that no longer resolves shows up as visible red
	 * text rather than shipping as a 404.
	 *
	 * It marks itself as leaving. A link that silently opens a new tab is a
	 * small betrayal, and the arrow costs one glyph.
	 */
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
	import { referenceById } from '$lib/curriculum/references';
	import { cn } from '$lib/utils';

	interface Props {
		/** A key from `$lib/curriculum/references`. */
		to: string;
		/** Override the link text. Defaults to the reference's own title. */
		label?: string;
		class?: string;
	}
	let { to, label, class: className }: Props = $props();

	const r = $derived(referenceById(to));
</script>

{#if r}
	<a
		href={r.url}
		target="_blank"
		rel="noopener noreferrer"
		title="{r.title} — {r.publisher}"
		class={cn(
			'underline decoration-foreground/25 decoration-1 underline-offset-[3px] transition-colors hover:decoration-foreground',
			className
		)}
	>
		{label ?? r.title}<HugeiconsIcon
			icon={ArrowUpRight01Icon}
			size={11}
			class="mb-[0.35em] ml-px inline-block align-middle text-muted-foreground"
		/>
	</a>
{:else}
	<!-- A missing key is a content bug. Say so rather than rendering nothing. -->
	<span class="text-destructive">[no reference “{to}”]</span>
{/if}
