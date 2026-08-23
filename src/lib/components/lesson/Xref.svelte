<script lang="ts">
	/**
	 * A link from one lesson to another, by id.
	 *
	 * The prose in this course refers to other lessons constantly — "you will
	 * meet it properly in two lessons' time", "as you saw with velocity" — and
	 * until now every one of those was a dead end that asked you to remember
	 * the course order and navigate by hand. Worse, "two lessons' time" is a
	 * fact about the running order that rots silently the moment a lesson is
	 * inserted anywhere before it.
	 *
	 * Taking the id and reading the title out of the registry fixes both: the
	 * words are always the lesson's real title, and an id that no longer exists
	 * shows up immediately rather than shipping as a broken link.
	 */
	import { lessonById } from '$lib/curriculum/registry';
	import { lessonHref } from '$lib/nav';
	import { cn } from '$lib/utils';

	interface Props {
		to: string;
		/** Override the link text. Defaults to the lesson's own title. */
		label?: string;
		class?: string;
	}
	let { to, label, class: className }: Props = $props();

	const meta = $derived(lessonById(to));
</script>

{#if meta}
	<a
		href={lessonHref(to)}
		class={cn(
			'underline decoration-foreground/25 decoration-1 underline-offset-[3px] transition-colors hover:decoration-foreground',
			className
		)}
		title="Lesson {meta.number} · {meta.title}"
	>
		{label ?? meta.title}
	</a>
{:else}
	<!-- A missing id is a content bug, not a runtime one: say so, do not hide it. -->
	<span class="text-destructive">[no lesson “{to}”]</span>
{/if}
