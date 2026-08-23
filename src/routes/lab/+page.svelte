<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Activity03Icon,
		Route02Icon,
		Grid3X3Icon,
		Chip02Icon,
		StopWatchIcon,
		SquareTerminalIcon,
		PlugSocketIcon
	} from '@hugeicons/core-free-icons';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { router } from '$lib/midi/router.svelte';
	import { devices } from '$lib/midi/devices/store.svelte';
	import { Button } from '$lib/components/ui/button';
	import SignalPath from '$lib/components/shell/SignalPath.svelte';
	import { cn } from '$lib/utils';

	/*
	 * Each tool says what is inside it as well as what it is for. A launcher
	 * whose cards only repeat their own titles teaches you nothing you could
	 * not have guessed, and the space it takes up is space the tool could have
	 * used to tell you it already holds three routes.
	 */
	const tools = $derived([
		{
			href: '/lab/monitor',
			icon: Activity03Icon,
			name: 'Monitor',
			desc: 'Every message in and out, in the order the wire carried them.',
			contents: 'Byte inspector · Family filters · TSV export',
			badge: null as string | null
		},
		{
			href: '/lab/patchbay',
			icon: Route02Icon,
			name: 'Patchbay',
			desc: 'Route any input to any output, with rules in between.',
			contents: 'Channel remap · Transpose · Filter · Split',
			badge: router.routes.length
				? `${router.routes.length} route${router.routes.length === 1 ? '' : 's'}`
				: null
		},
		{
			href: '/lab/programmer',
			icon: Grid3X3Icon,
			name: 'Programmer',
			desc: 'Build a program, then play it out or save it to a file.',
			contents: 'Step sequencer · Patterns · MIDI files · Clock',
			badge: null
		},
		{
			href: '/lab/devices',
			icon: Chip02Icon,
			name: 'Device Lab',
			desc: 'Teach the app an instrument it has never met.',
			contents: 'Identify · Learn by wiggling · Saved profiles',
			badge: devices.user.length ? `${devices.user.length} saved` : null
		},
		{
			href: '/lab/diagnostics',
			icon: StopWatchIcon,
			name: 'Diagnostics',
			desc: 'Prove where the latency and the jitter are actually coming from.',
			contents: 'Round trip · Clock jitter · Loopback · Troubleshooter',
			badge: null
		},
		{
			href: '/lab/console',
			icon: SquareTerminalIcon,
			name: 'Console',
			desc: 'Write JavaScript that drives your real hardware, right now.',
			contents: 'engine · notes · patterns · transport',
			badge: null
		}
	]);

	const ports = $derived(midiAccess.inputs.length + midiAccess.outputs.length);
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-12">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-3">
			<h1 class="text-3xl font-semibold tracking-tight">The Lab</h1>
			<p class="prose-body text-muted-foreground">
				The instruments the lessons are built from, standing on their own. Nothing here is a demo —
				these are the tools you keep.
			</p>
		</div>

		<!-- Every tool below needs the same thing, so it is answered once, here. -->
		{#if midiAccess.status === 'granted'}
			<p class="flex items-center gap-2 text-xs text-muted-foreground">
				<span class={cn('size-1.5 rounded-full', ports ? 'bg-ok' : 'bg-muted-foreground/40')}
				></span>
				{#if ports}
					<!-- "detected", because the dock a few pixels below counts the ports
					     you have actually opened. Two readouts in the same shape meaning
					     two different things is how you get someone counting cables. -->
					{midiAccess.inputs.length} in · {midiAccess.outputs.length} out detected
				{:else}
					No ports found
				{/if}
			</p>
		{:else if midiAccess.status !== 'unsupported'}
			<Button variant="outline" size="sm" onclick={() => midiAccess.request(false)}>
				<HugeiconsIcon icon={PlugSocketIcon} size={14} />
				Connect MIDI
			</Button>
		{/if}
	</header>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each tools as tool (tool.href)}
			<a
				href={tool.href}
				class="group flex flex-col gap-2.5 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/25"
			>
				<!--
					Mark and name on one line. The icon used to sit alone on a row of
					its own above the title, which left it reading as a stray glyph
					rather than the card's mark.
				-->
				<div class="flex items-center gap-3">
					<span
						class="grid size-9 shrink-0 place-items-center rounded-lg border bg-surface-sunken transition-colors group-hover:border-foreground/25 group-hover:bg-accent"
					>
						<HugeiconsIcon
							icon={tool.icon}
							size={18}
							strokeWidth={1.6}
							class="text-muted-foreground transition-colors group-hover:text-foreground"
						/>
					</span>
					<h2 class="min-w-0 flex-1 leading-tight font-medium">{tool.name}</h2>
					{#if tool.badge}
						<span
							class="tnum shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
						>
							{tool.badge}
						</span>
					{/if}
				</div>
				<p class="text-sm leading-relaxed text-muted-foreground">{tool.desc}</p>
				<p class="mt-auto border-t pt-2.5 text-2xs leading-relaxed text-muted-foreground">
					{tool.contents}
				</p>
			</a>
		{/each}
	</div>

	<!--
		The six tools above are not six separate programs. This is the one
		sentence of architecture that makes the rest of the app make sense, so it
		gets drawn rather than written.
	-->
	<section class="flex flex-col gap-4 rounded-lg border bg-card px-6 py-5">
		<div class="flex flex-col gap-1">
			<h2 class="font-medium">How a byte travels</h2>
			<p class="measure text-sm leading-relaxed text-muted-foreground">
				Nothing here has a private side channel. Your keyboard, the widgets on these pages, the
				sequencer and your own code all put messages on the same bus, and every tool in the Lab is
				something that listens to it.
			</p>
		</div>
		<SignalPath />
	</section>
</div>
