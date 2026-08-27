<script module lang="ts">
	/**
	 * A photograph, with the credit it is owed.
	 *
	 * Everything else in this course is drawn: schematics, piano rolls, circles
	 * of fifths. Drawings are better than photographs for explaining how a thing
	 * works, and worse at the one job a photograph does — establishing that the
	 * thing was real. Two boxes made by rival companies in 1982 either look like
	 * objects somebody lifted onto a trade-show table or they stay a sentence in
	 * a timeline, and no diagram will close that gap.
	 *
	 * ## Why the files are vendored
	 *
	 * The app makes a promise that it works offline and talks to nothing, and
	 * hotlinking Wikimedia would quietly break it — a request to an outside host
	 * on every page view, and a picture that disappears the day somebody renames
	 * a file. The bytes live in `static/img/` instead. The licences permit that;
	 * they require attribution, which is the point of the strip under each
	 * image.
	 *
	 * ## Why the credit is visible rather than in a tooltip
	 *
	 * CC BY and CC BY-SA both require the author be named "in any reasonable
	 * manner" — a `title` attribute nobody hovers is not that. It also costs
	 * one line of small grey type to be plainly honest about where a picture
	 * came from, on a site whose whole argument is that it checked its sources.
	 */
	export interface FigureImage {
		/** Route under `static/`, e.g. `/img/prophet-600.jpg`. */
		src: string;
		/** What is in the picture, for a reader who cannot see it. */
		alt: string;
		/** A word or two under the image. The caption carries the argument. */
		label?: string;
		/**
		 * Intrinsic pixel size. Not decoration: without it the page reflows when
		 * the bytes land, and a lesson that jumps while you are reading it is a
		 * worse lesson.
		 */
		width: number;
		height: number;
		/** The photographer, spelled as the file page spells them. */
		credit: string;
		/** e.g. `CC BY 2.0`. */
		license: string;
		licenseUrl: string;
		/** The Wikimedia Commons file page, so the claim can be checked. */
		source: string;
	}
</script>

<script lang="ts">
	import { path } from '$lib/nav';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		images: FigureImage[];
		/** The sentence the picture is here to support. */
		children?: Snippet;
		class?: string;
	}
	let { images, children, class: className }: Props = $props();

	/**
	 * Whether the columns can share their rows.
	 *
	 * The subgrid below assumes every column has all three of picture, label and
	 * credit; one column missing a label would shift its credit up a row and
	 * misalign the lot. Rather than require a label, check for one.
	 */
	const aligned = $derived(images.length > 1 && images.every((i) => i.label));
</script>

<figure class={cn('flex flex-col gap-3', className)}>
	<!--
		Three rows — picture, label, credit — shared across the columns, so that
		two photographs of different proportions still line their labels up.
		Without the subgrid the taller image drags its own caption down and the
		pair reads as two unrelated things that happen to be adjacent, which is
		the opposite of what putting them side by side is for.
	-->
	<div
		class={cn(
			'grid gap-x-3 gap-y-1.5',
			images.length > 1 && 'sm:grid-cols-2',
			aligned && 'sm:grid-rows-[auto_auto_auto]'
		)}
	>
		{#each images as img (img.src)}
			<div
				class={cn(
					'grid min-w-0 grid-rows-[auto_auto_auto] gap-1.5',
					aligned && 'sm:row-span-3 sm:grid-rows-subgrid sm:gap-0'
				)}
			>
				<!--
					Bottom-aligned, so two instruments of different proportions stand on
					the same line rather than floating at different heights.
				-->
				<div class="self-end overflow-hidden rounded-lg border bg-surface-sunken">
					<img
						src={path(img.src)}
						alt={img.alt}
						width={img.width}
						height={img.height}
						loading="lazy"
						decoding="async"
						class="h-auto w-full"
					/>
				</div>
				{#if img.label}
					<p class="text-sm font-medium">{img.label}</p>
				{/if}
				<!--
					One line, small, grey, and complete: who took it, under what
					licence, and where to go and check. Both links leave the app, so
					both say so the way every other outbound link here does.
				-->
				<p class="text-xs leading-relaxed text-muted-foreground">
					Photograph by {img.credit} ·
					<a
						href={img.licenseUrl}
						target="_blank"
						rel="noreferrer noopener license"
						class="underline underline-offset-2 hover:text-foreground"
					>
						{img.license}
					</a>
					·
					<a
						href={img.source}
						target="_blank"
						rel="noreferrer noopener"
						class="underline underline-offset-2 hover:text-foreground"
					>
						Wikimedia Commons
					</a>
				</p>
			</div>
		{/each}
	</div>

	{#if children}
		<figcaption class="text-sm leading-relaxed text-muted-foreground">
			{@render children()}
		</figcaption>
	{/if}
</figure>
