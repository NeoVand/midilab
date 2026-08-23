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

	const config: Record<Variant, { icon: IconSvgElement; tone: string; label: string }> = {
		note: {
			icon: InformationCircleIcon,
			tone: 'border-msg-cc/35 bg-msg-cc-bg text-msg-cc',
			label: 'Note'
		},
		gotcha: { icon: Alert02Icon, tone: 'border-warn/40 bg-warn/8 text-warn', label: 'Gotcha' },
		convention: {
			icon: BookOpen01Icon,
			tone: 'border-msg-program/35 bg-msg-program-bg text-msg-program',
			label: 'Convention, not law'
		},
		key: {
			icon: IdeaIcon,
			tone: 'border-msg-note/35 bg-msg-note-bg text-msg-note',
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

<aside class={cn('flex gap-3 rounded-lg border p-3.5', c.tone, className)}>
	<HugeiconsIcon icon={c.icon} size={17} class="mt-0.5 shrink-0" />
	<div class="min-w-0 flex-1">
		<p class="mb-1 text-[11px] font-semibold tracking-wide uppercase">{title ?? c.label}</p>
		<div
			class="prose-tight text-sm leading-relaxed text-foreground/90 [&_a]:underline [&_code]:font-mono"
		>
			{@render children()}
		</div>
	</div>
</aside>
