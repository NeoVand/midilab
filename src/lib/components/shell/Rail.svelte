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
			label: 'Reference',
			hint: 'CC tables, GM maps, cheat sheets'
		}
	];

	const current = $derived(page.url.pathname);
</script>

<nav
	class="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3"
	aria-label="Primary"
>
	<a href="/" class="group mb-2 grid size-9 place-items-center" aria-label="MIDI Lab home">
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
		<Tooltip.Provider delayDuration={200}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							href={item.href}
							aria-current={active ? 'page' : undefined}
							class={cn(
								'relative grid size-10 place-items-center rounded-lg transition-colors',
								active
									? 'bg-sidebar-accent text-sidebar-accent-foreground'
									: 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
							)}
						>
							{#if active}
								<span
									class="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-msg-note"
								></span>
							{/if}
							<HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.7} />
						</a>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="right" class="flex flex-col gap-0.5">
					<span class="font-medium">{item.label}</span>
					<span class="text-xs text-muted-foreground">{item.hint}</span>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/each}

	<div class="flex-1"></div>

	<Tooltip.Provider delayDuration={200}>
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

	<button
		onclick={() => settings.toggleTheme()}
		class="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
		aria-label="Toggle colour theme"
	>
		<HugeiconsIcon
			icon={settings.resolvedTheme === 'dark' ? Sun03Icon : Moon02Icon}
			size={19}
			strokeWidth={1.7}
		/>
	</button>

	<a
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
</nav>
