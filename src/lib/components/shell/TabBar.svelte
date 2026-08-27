<script lang="ts">
	/**
	 * Navigation, on a phone.
	 *
	 * The rail is a good desktop pattern and a bad phone one: it spends 52 of
	 * 375 pixels — a seventh of the width — on something you use a handful of
	 * times a session, and it puts it at the top-left, which is the furthest
	 * point on the screen from a thumb. So below `md` it is replaced rather
	 * than shrunk. Same destinations, same order, same words, moved to the
	 * edge the hand is already at.
	 *
	 * Four across, plus the palette, at 56 px tall before the safe-area strip.
	 * Nothing here is under the 44 px a fingertip needs, and the labels stay:
	 * an unlabelled icon is a guess whatever the screen size.
	 */
	import { page } from '$app/state';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		GraduationCapIcon,
		FlaskConicalIcon,
		LibraryIcon,
		MusicNote02Icon,
		SearchIcon
	} from '@hugeicons/core-free-icons';
	import { path, routeOf } from '$lib/nav';
	import { cn } from '$lib/utils';

	interface Props {
		onOpenPalette: () => void;
		class?: string;
	}
	let { onOpenPalette, class: className }: Props = $props();

	const items = [
		{ href: '/', icon: MusicNote02Icon, label: 'Play' },
		{ href: '/learn', icon: GraduationCapIcon, label: 'Learn' },
		{ href: '/lab', icon: FlaskConicalIcon, label: 'Lab' },
		{ href: '/reference', icon: LibraryIcon, label: 'Tables' }
	];

	const current = $derived(routeOf(page.url.pathname));
	const active = (href: string) =>
		href === '/' ? current === '/' : current === href || current.startsWith(href + '/');
</script>

<nav class={cn('pb-safe shrink-0 border-t bg-sidebar', className)} aria-label="Primary">
	<div class="flex h-14 items-stretch">
		{#each items as item (item.href)}
			{@const on = active(item.href)}
			<a
				href={path(item.href)}
				aria-current={on ? 'page' : undefined}
				class={cn(
					'relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors',
					on ? 'text-foreground' : 'text-muted-foreground'
				)}
			>
				{#if on}
					<!-- On the edge it shares with the page, the same way the rail
					     marks the edge it shares with the page. -->
					<span class="absolute inset-x-4 top-0 h-px bg-foreground"></span>
				{/if}
				<HugeiconsIcon
					icon={item.icon}
					size={22}
					strokeWidth={on ? 2 : 1.6}
					class={item.href === '/' && on ? 'text-msg-note' : undefined}
				/>
				<span class="text-3xs leading-none font-medium">{item.label}</span>
			</a>
		{/each}
		<button
			type="button"
			onclick={onOpenPalette}
			class="flex w-14 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
			aria-label="Search everything"
		>
			<HugeiconsIcon icon={SearchIcon} size={22} strokeWidth={1.6} />
			<span class="text-3xs leading-none font-medium">Find</span>
		</button>
	</div>
</nav>
