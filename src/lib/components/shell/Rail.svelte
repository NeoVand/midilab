<script lang="ts">
	import { page } from '$app/state';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		GraduationCapIcon,
		FlaskConicalIcon,
		LibraryIcon,
		Settings02Icon,
		Sun03Icon,
		Moon02Icon,
		CommandIcon
	} from '@hugeicons/core-free-icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { settings } from '$lib/stores/settings.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		onOpenPalette: () => void;
	}
	let { onOpenPalette }: Props = $props();

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

	const current = $derived(page.url.pathname);
	const isDark = $derived(settings.resolvedTheme === 'dark');
</script>

<nav
	class="flex w-[4.25rem] shrink-0 flex-col items-center gap-0.5 border-r bg-sidebar py-3"
	aria-label="Primary"
>
	<a href="/" class="mb-2 grid size-9 place-items-center" aria-label="MIDI Lab home">
		<!-- The mark: a status byte's high bit, then seven data bits. -->
		<svg viewBox="0 0 24 24" class="size-6" aria-hidden="true">
			<rect x="1" y="4" width="4" height="16" rx="1.2" fill="var(--msg-note)" />
			<rect x="7" y="7" width="2.4" height="10" rx="1" fill="currentColor" opacity="0.85" />
			<rect x="11" y="9.5" width="2.4" height="5" rx="1" fill="currentColor" opacity="0.55" />
			<rect x="15" y="7" width="2.4" height="10" rx="1" fill="currentColor" opacity="0.85" />
			<rect x="19" y="10.5" width="2.4" height="3" rx="1" fill="currentColor" opacity="0.4" />
		</svg>
	</a>

	{#each items as item (item.href)}
		{@const active = current === item.href || current.startsWith(item.href + '/')}
		<Tooltip.Provider delayDuration={400}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class={cn(
								'relative flex w-12 flex-col items-center gap-1 rounded-lg py-2 transition-colors',
								active
									? 'bg-sidebar-accent text-sidebar-accent-foreground'
									: 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
							)}
						>
							{#if active}
								<span
									class="absolute top-1/2 -left-[9px] h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-foreground"
								></span>
							{/if}
							<HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.7} />
							<span class="text-2xs leading-none font-medium">{item.label}</span>
						</a>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="right">{item.hint}</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/each}

	<div class="flex-1"></div>

	<div class="mb-1 h-px w-8 bg-sidebar-border"></div>

	<Tooltip.Provider delayDuration={400}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						onclick={onOpenPalette}
						class="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
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
						class="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
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
						href="/settings"
						aria-current={current === '/settings' ? 'page' : undefined}
						class={cn(
							'grid size-10 place-items-center rounded-lg transition-colors',
							current === '/settings'
								? 'bg-sidebar-accent text-sidebar-accent-foreground'
								: 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
						)}
						aria-label="Settings"
					>
						<HugeiconsIcon icon={Settings02Icon} size={19} strokeWidth={1.7} />
					</a>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="right">Settings</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</nav>
