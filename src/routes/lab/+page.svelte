<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Activity03Icon,
		Route02Icon,
		Grid3X3Icon,
		Chip02Icon,
		StopWatchIcon,
		SquareTerminalIcon
	} from '@hugeicons/core-free-icons';

	const tools = [
		{
			href: '/lab/monitor',
			icon: Activity03Icon,
			name: 'Monitor',
			desc: 'Every message, colour-coded, filterable, with a byte-level inspector.'
		},
		{
			href: '/lab/patchbay',
			icon: Route02Icon,
			name: 'Patchbay',
			desc: 'Route any input to any output. Remap channels, transpose, filter, split.'
		},
		{
			href: '/lab/programmer',
			icon: Grid3X3Icon,
			name: 'Programmer',
			desc: 'Sequence notes and CC across tracks and devices. Exports Standard MIDI Files.'
		},
		{
			href: '/lab/devices',
			icon: Chip02Icon,
			name: 'Device Lab',
			desc: 'Identify a device, learn its controls by wiggling them, save a profile.'
		},
		{
			href: '/lab/diagnostics',
			icon: StopWatchIcon,
			name: 'Diagnostics',
			desc: 'Latency, clock jitter, loopback tests, and a connection troubleshooter.'
		},
		{
			href: '/lab/console',
			icon: SquareTerminalIcon,
			name: 'Console',
			desc: 'Write JavaScript that drives your actual hardware, right now.'
		}
	];
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8 px-8 py-12">
	<header class="flex flex-col gap-3">
		<h1 class="text-3xl font-semibold tracking-tight">The Lab</h1>
		<p class="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
			The instruments the lessons are built from, standing on their own. Nothing here is a demo —
			these are the tools you keep.
		</p>
	</header>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each tools as tool (tool.href)}
			<a
				href={tool.href}
				class="group flex flex-col gap-2 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/25"
			>
				<HugeiconsIcon icon={tool.icon} size={22} class="text-muted-foreground" />
				<h2 class="font-medium">{tool.name}</h2>
				<p class="text-[13px] leading-relaxed text-muted-foreground">{tool.desc}</p>
			</a>
		{/each}
	</div>
</div>
