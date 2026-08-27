<script lang="ts">
	/**
	 * The reading list at the foot of a lesson.
	 *
	 * A course that wants to be the place people start cannot also be the place
	 * they stop. Every lesson here compresses something that has a primary
	 * source — usually free, usually better on the details than any summary can
	 * be — and the compression is only honest if the original is one click away.
	 *
	 * Takes reference *ids*, not URLs, so the same source cited from four
	 * lessons is one row in `references.ts` and one place to fix when it moves.
	 * Each row says who stands behind it and roughly what it costs to read,
	 * because "further reading" that does not distinguish a two-page article
	 * from a four-hundred-page specification is not helping anyone choose.
	 */
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowUpRight01Icon,
		Certificate01Icon,
		BookOpen01Icon,
		News01Icon,
		Archive02Icon,
		Wrench01Icon,
		Database02Icon,
		FileScriptIcon
	} from '@hugeicons/core-free-icons';
	import type { IconSvgElement } from '@hugeicons/svelte';
	import { resolveReferences, refHost, KIND_LABEL, type RefKind } from '$lib/curriculum/references';
	import { cn } from '$lib/utils';

	interface Props {
		/** Reference ids from `$lib/curriculum/references`. */
		refs: readonly string[];
		title?: string;
		/** A sentence framing why these, if the list is not self-evident. */
		lead?: string;
		class?: string;
	}
	let { refs, title = 'Where this came from', lead, class: className }: Props = $props();

	const items = $derived(resolveReferences(refs));

	const KIND_ICON: Record<RefKind, IconSvgElement> = {
		spec: Certificate01Icon,
		docs: FileScriptIcon,
		article: News01Icon,
		paper: BookOpen01Icon,
		archive: Archive02Icon,
		tool: Wrench01Icon,
		data: Database02Icon
	};

	const WEIGHT_LABEL: Record<string, string> = {
		short: 'a short read',
		long: 'a long read',
		reference: 'keep it open'
	};
</script>

<section class={cn('flex flex-col gap-3 rounded-lg border bg-surface-sunken p-5', className)}>
	<div class="flex flex-col gap-1">
		<h2 class="text-sm font-semibold">{title}</h2>
		{#if lead}
			<p class="text-sm leading-relaxed text-muted-foreground">{lead}</p>
		{/if}
	</div>

	<ul class="flex flex-col">
		{#each items as r (r.id)}
			<li class="border-t border-border/60 first:border-t-0">
				<a
					href={r.url}
					target="_blank"
					rel="noopener noreferrer"
					class="group flex items-start gap-3 py-3 transition-colors"
				>
					<HugeiconsIcon
						icon={KIND_ICON[r.kind]}
						size={16}
						class="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
					/>
					<span class="flex min-w-0 flex-1 flex-col gap-1">
						<span class="flex flex-wrap items-baseline gap-x-2">
							<span
								class="text-sm font-medium decoration-foreground/30 underline-offset-[3px] group-hover:underline"
							>
								{r.title}
							</span>
							<span class="text-xs text-muted-foreground">
								{r.publisher}{#if r.year}, {r.year}{/if}
							</span>
						</span>
						<span class="text-sm leading-relaxed text-muted-foreground">{r.note}</span>
						<span class="label flex flex-wrap items-center gap-x-2 gap-y-0.5">
							<span>{KIND_LABEL[r.kind]}</span>
							{#if r.weight}
								<span aria-hidden="true">·</span>
								<span>{WEIGHT_LABEL[r.weight]}</span>
							{/if}
							<span aria-hidden="true">·</span>
							<span class="normal-case">{refHost(r)}</span>
						</span>
					</span>
					<HugeiconsIcon
						icon={ArrowUpRight01Icon}
						size={14}
						class="mt-1 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground"
					/>
				</a>
			</li>
		{/each}
	</ul>
</section>
