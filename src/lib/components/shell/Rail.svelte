<script lang="ts">
	import { page } from '$app/state';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		GraduationCapIcon,
		FlaskConicalIcon,
		LibraryIcon,
		MusicNote02Icon,
		Settings02Icon,
		Sun03Icon,
		Moon02Icon,
		CommandIcon
	} from '@hugeicons/core-free-icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { settings } from '$lib/stores/settings.svelte';
	import { path, routeOf } from '$lib/nav';
	import { cn } from '$lib/utils';

	interface Props {
		onOpenPalette: () => void;
		class?: string;
	}
	let { onOpenPalette, class: className }: Props = $props();

	/*
	 * Three destinations, and they are named.
	 *
	 * An unlabelled icon rail asks you to memorise a graduation cap, a flask
	 * and a stack of books before you can navigate; a tooltip you have to hover
	 * to read is a worse answer than a word that is simply there. The tooltips
	 * stay, but they now carry what is *inside* each destination rather than
	 * repeating its name.
	 */
	const items = [
		{ href: '/learn', icon: GraduationCapIcon, label: 'Learn', hint: 'The course, Act I to VI' },
		{
			href: '/lab',
			icon: FlaskConicalIcon,
			label: 'Lab',
			hint: 'Monitor, patchbay, sequencer, device tools'
		},
		{
			href: '/reference',
			icon: LibraryIcon,
			label: 'Tables',
			hint: 'CC tables, GM maps, cheat sheets'
		}
	];

	// Compared against the routes in `items`, so the base path comes off
	// first — under one, every pathname starts with it.
	const current = $derived(routeOf(page.url.pathname));
	const isDark = $derived(settings.resolvedTheme === 'dark');
</script>

<!--
	Narrow, and nothing in a box.
	
	A rail is a margin, not a panel: every pill, plate and outline in it is a
	frame around something that was already legible, and they add up to a strip
	that looks heavier than the page it is beside. So the width is what the
	longest label needs and no more, and the only thing that marks the current
	destination is that it is the one drawn at full strength — with a hairline
	on the edge it opens onto, which is a join rather than a container.
-->
<nav
	class={cn(
		'pl-safe w-[3.25rem] shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3',
		className ?? 'flex'
	)}
	aria-label="Primary"
>
	<a href={path('/')} class="mb-2.5 grid size-8 place-items-center" aria-label="MIDI Lab home">
		<HugeiconsIcon icon={MusicNote02Icon} size={22} strokeWidth={1.7} class="text-msg-note" />
	</a>

	{#each items as item (item.href)}
		{@const active = current === item.href || current.startsWith(item.href + '/')}
		<Tooltip.Provider delayDuration={400}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							href={path(item.href)}
							aria-current={active ? 'page' : undefined}
							class={cn(
								'relative flex w-full flex-col items-center gap-1 py-1.5 transition-colors',
								active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
							)}
						>
							{#if active}
								<!-- Flush with the border it sits on, so it reads as this item
								     joining the page rather than as a badge stuck to it. -->
								<span class="absolute inset-y-0 -right-px w-px bg-foreground"></span>
							{/if}
							<HugeiconsIcon icon={item.icon} size={19} strokeWidth={active ? 2 : 1.6} />
							<span class="text-2xs leading-none font-medium">{item.label}</span>
						</a>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="right">{item.hint}</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/each}

	<div class="flex-1"></div>

	<div class="mb-1 h-px w-6 bg-sidebar-border"></div>

	<Tooltip.Provider delayDuration={400}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						onclick={onOpenPalette}
						class="grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
						aria-label="Open command palette"
					>
						<HugeiconsIcon icon={CommandIcon} size={19} strokeWidth={1.7} />
					</button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="right">Command palette <kbd class="ml-1">⌘K</kbd></Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>

	<Tooltip.Provider delayDuration={400}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						onclick={() => settings.toggleTheme()}
						class="grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
						aria-label={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
					>
						<HugeiconsIcon icon={isDark ? Sun03Icon : Moon02Icon} size={19} strokeWidth={1.7} />
					</button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="right">{isDark ? 'Light theme' : 'Dark theme'}</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>

	<Tooltip.Provider delayDuration={400}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a
						{...props}
						href={path('/settings')}
						aria-current={current === '/settings' ? 'page' : undefined}
						class={cn(
							'relative grid size-9 place-items-center transition-colors',
							current === '/settings'
								? 'text-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
						aria-label="Settings"
					>
						{#if current === '/settings'}
							<span class="absolute inset-y-0 -right-[7px] w-px bg-foreground"></span>
						{/if}
						<HugeiconsIcon
							icon={Settings02Icon}
							size={18}
							strokeWidth={current === '/settings' ? 2 : 1.6}
						/>
					</a>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="right">Settings</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</nav>
