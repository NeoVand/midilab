<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		InformationCircleIcon,
		Alert02Icon,
		IdeaIcon,
		BookOpen01Icon,
		DangerIcon
	} from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { IconSvgElement } from '@hugeicons/svelte';

	type Variant = 'note' | 'gotcha' | 'convention' | 'key' | 'danger';

	interface Props {
		variant?: Variant;
		title?: string;
		children: Snippet;
		class?: string;
	}
	let { variant = 'note', title, children, class: className }: Props = $props();

	/*
	 * Callouts are editorial furniture, not message families.
	 *
	 * They used to borrow the family palette, which produced a box labelled
	 * "Note" painted in the Control Change colour and a box labelled "The idea"
	 * painted in the Note colour — on pages that also show live widgets keyed to
	 * those exact hues. The seven family colours mean one thing in this app and
	 * they cannot moonlight.
	 *
	 * What is left is a hierarchy of emphasis built from neutrals and the two
	 * real status tones: a quiet aside, a louder idea, a warning, a danger. The
	 * icon and the label were always doing the work of telling them apart.
	 */
	const config: Record<Variant, { icon: IconSvgElement; tone: string; label: string }> = {
		note: {
			icon: InformationCircleIcon,
			tone: 'border-border bg-surface-sunken text-muted-foreground',
			label: 'Note'
		},
		gotcha: { icon: Alert02Icon, tone: 'border-warn/40 bg-warn/8 text-warn', label: 'Gotcha' },
		convention: {
			icon: BookOpen01Icon,
			tone: 'border-border bg-surface-sunken text-muted-foreground',
			label: 'Convention, not law'
		},
		key: {
			icon: IdeaIcon,
			tone: 'border-foreground/25 bg-accent text-foreground',
			label: 'The idea'
		},
		danger: {
			icon: DangerIcon,
			tone: 'border-destructive/40 bg-destructive/8 text-destructive',
			label: 'Careful'
		}
	};
	const c = $derived(config[variant]);
</script>

<aside class={cn('reading flex gap-3 rounded-lg border p-3.5', c.tone, className)}>
	<HugeiconsIcon icon={c.icon} size={17} class="mt-0.5 shrink-0" />
	<div class="min-w-0 flex-1">
		<p class="mb-1 text-sm font-semibold">{title ?? c.label}</p>
		<div
			class="prose-tight text-sm leading-relaxed text-foreground/90 [&_a]:underline [&_code]:font-mono"
		>
			{@render children()}
		</div>
	</div>
</aside>
