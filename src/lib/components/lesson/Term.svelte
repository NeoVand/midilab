<script lang="ts">
	/**
	 * A word in the prose that the reader may not have.
	 *
	 * The course was written by someone fluent in both music and bytes, for a
	 * reader who is reliably fluent in one and not the other — and which one
	 * varies. A producer hits "the low nibble of the status byte" cold; a
	 * programmer hits "twenty-four ticks a quarter note" equally cold. Sending
	 * either of them to a glossary page costs the thread of the paragraph.
	 *
	 * So the definition comes to the word. Dotted underline, no colour, no icon:
	 * present enough to be found when you need it, quiet enough to read straight
	 * past when you do not.
	 *
	 * A popover rather than a hover card, deliberately — hover does not exist on
	 * the phone this app already takes seriously, and a definition you cannot
	 * reach on a touch screen is a definition for half the readers.
	 */
	import type { Snippet } from 'svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { glossaryLookup, type GlossaryEntry } from '$lib/curriculum/glossary';
	import { lessonById } from '$lib/curriculum/registry';
	import { lessonHref } from '$lib/nav';
	import { cn } from '$lib/utils';

	interface Props {
		/**
		 * The glossary headword or alias. Optional: it defaults to the wrapped
		 * text, so `<Term>swing</Term>` is usually the whole call. Pass it when
		 * the sentence spells the word in a way the index does not carry.
		 */
		of?: string;
		children: Snippet;
		class?: string;
	}
	let { of: key, children, class: className }: Props = $props();

	/*
	 * The markup shape is deliberately the same whether or not the term
	 * resolves. An earlier version chose its structure based on the lookup and
	 * read the lookup key out of the rendered text — which meant the element
	 * holding the text only existed while the term was known, so the text went
	 * away, the term became unknown, and the two flipped against each other
	 * forever. One stable element, resolved once.
	 */
	let el = $state<HTMLElement | null>(null);
	let fromText = $state<GlossaryEntry | undefined>(undefined);

	$effect(() => {
		if (key || !el) return;
		fromText = glossaryLookup(el.textContent ?? '');
	});

	const entry = $derived(key ? glossaryLookup(key) : fromText);
	const source = $derived(entry?.lesson ? lessonById(entry.lesson) : undefined);

	/**
	 * `type` and `disabled` are button attributes and mean nothing on a span, so
	 * they come off before the rest is spread. Done here rather than as a
	 * destructure in the template because two discarded bindings read as dead
	 * code to anybody — human or linter — who has not been told why they exist.
	 */
	function forSpan(props: Record<string, unknown>): Record<string, unknown> {
		const { type, disabled, ...rest } = props;
		void type;
		void disabled;
		return rest;
	}

	const triggerClass = $derived(
		cn(
			'cursor-help underline decoration-dotted decoration-from-font underline-offset-[3px]',
			entry
				? 'decoration-muted-foreground/60 transition-colors hover:decoration-foreground'
				: 'decoration-destructive decoration-wavy',
			className
		)
	);
</script>

<!--
	## Why this is a span and not a button

	A term sits inside a sentence and has to behave like the words around it. A
	`<button>` will not: Blink lays one out as an atomic inline whatever its
	computed `display` says, which puts a line-break opportunity immediately
	after it. In a paragraph that reads "...groups called bars, and almost
	always..." the line broke between the term and its comma and stranded the
	comma at the start of the next line.

	So the trigger renders through bits-ui's `child` snippet as a plain span
	with `role="button"`. Nothing is given up for it: the props that snippet
	receives already include the Enter/Space `onkeydown` handler, the
	`aria-haspopup`, `aria-expanded` and `aria-controls` wiring, and the click
	handling — the library supplies exactly what the native element would have,
	which is the whole point of the escape hatch. `type` and `disabled` are
	dropped because they mean nothing on a span.

	## Why every tag below is jammed against its neighbour

	`Popover.Root` renders no element of its own, so its children — *including
	the whitespace between them* — land directly in the sentence. A newline
	between the trigger and the content is a space in the paragraph, which is
	how this component first shipped a visible gap between a term and the full
	stop after it: "no chord ." rather than "no chord.".
-->
<Popover.Root
	><Popover.Trigger>
		{#snippet child({ props })}
			<span
				{...forSpan(props)}
				bind:this={el}
				role="button"
				tabindex="0"
				class={triggerClass}
				aria-label={entry ? `What ${entry.term} means` : 'Undefined term'}
				>{@render children()}</span
			>
		{/snippet}
	</Popover.Trigger><Popover.Content class="w-80 max-w-[calc(100vw-2rem)] p-4" sideOffset={6}>
		{#if entry}
			<p class="mb-1.5 text-sm font-semibold">{entry.term}</p>
			<p class="text-sm leading-relaxed text-foreground/90">{entry.definition}</p>
			{#if source}
				<a
					href={lessonHref(source)}
					class="mt-2.5 inline-block text-xs text-muted-foreground underline decoration-muted-foreground/40 underline-offset-[3px] transition-colors hover:text-foreground"
				>
					Explained properly in lesson {source.number} · {source.title}
				</a>
			{/if}
		{:else}
			<!-- A content bug, and it should read as one rather than as a definition. -->
			<p class="text-sm text-destructive">
				No glossary entry for “{key ?? el?.textContent?.trim()}”.
			</p>
		{/if}
	</Popover.Content></Popover.Root
>
