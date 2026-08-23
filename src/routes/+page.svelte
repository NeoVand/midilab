<script lang="ts">
	import InstrumentPanel from '$lib/components/midi/InstrumentPanel.svelte';
	import RigDiagram from '$lib/components/midi/RigDiagram.svelte';
	import { progress } from '$lib/curriculum/progress.svelte';
	import {
		CURRICULUM,
		ALL_LESSONS,
		TOTAL_MINUTES,
		ACT_ICON,
		lessonPath
	} from '$lib/curriculum/registry';
	import { cn } from '$lib/utils';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowRight01Icon,
		PlugSocketIcon,
		FlaskConicalIcon,
		LibraryIcon,
		Route02Icon,
		Activity03Icon,
		Grid3X3Icon,
		Chip02Icon
	} from '@hugeicons/core-free-icons';

	const overall = $derived(progress.fractionOf(ALL_LESSONS.map((l) => l.id)));
	const nextLesson = $derived(
		ALL_LESSONS.find((l) => !progress.isLessonComplete(l.id)) ?? ALL_LESSONS[0]
	);

	const tools = [
		{
			href: '/lab/monitor',
			icon: Activity03Icon,
			name: 'Monitor',
			desc: 'Every byte, colour-coded'
		},
		{ href: '/lab/patchbay', icon: Route02Icon, name: 'Patchbay', desc: 'Route, remap, transpose' },
		{
			href: '/lab/programmer',
			icon: Grid3X3Icon,
			name: 'Programmer',
			desc: 'Sequence and export .mid'
		},
		{ href: '/lab/devices', icon: Chip02Icon, name: 'Device Lab', desc: 'Learn an unknown synth' }
	];
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-12 px-8 pt-8 pb-12">
	<!--
		The instrument leads. Its faceplate is the masthead — a page about an
		instrument does not need a marketing banner above the instrument, and the
		banner was the single thing that made this read as a landing page rather
		than as a machine you had just switched on.
	-->
	<InstrumentPanel />

	<!-- ── what this is ──────────────────────────────────────────────────── -->
	<header class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
		<div class="flex flex-col gap-3">
			<h1 class="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
				Learn MIDI by making it happen, one byte at a time.
			</h1>
			<p class="max-w-xl leading-relaxed text-pretty text-muted-foreground">
				Thirty lessons, from "what even is a MIDI message" to running a rig of several instruments
				off one clock — or off your own code. Nothing here is an illustration: the panel above is
				the same engine every lesson is built on.
			</p>
		</div>
		<div class="flex shrink-0 flex-col items-start gap-2 sm:items-end">
			<Button href={lessonPath(nextLesson)} size="xl">
				{overall > 0 ? 'Continue' : 'Start the course'}
				<HugeiconsIcon icon={ArrowRight01Icon} size={16} />
			</Button>
			<span class="text-xs text-muted-foreground">
				{ALL_LESSONS.length} lessons · about {Math.round(TOTAL_MINUTES / 60)} hours
			</span>
		</div>
	</header>

	{#if midiAccess.status !== 'unsupported'}
		<!--
			What is actually plugged into this machine, drawn — the one part of the
			app that is specific to the person using it. The connect button lives
			here rather than in a hero, beside the drawing it fills in.
		-->
		<section class="flex flex-col gap-5">
			<div class="flex items-baseline justify-between">
				<h2 class="text-xl font-semibold tracking-tight">Your rig</h2>
				{#if midiAccess.status === 'granted'}
					<a href="/lab/patchbay" class="text-sm text-muted-foreground hover:text-foreground">
						Route it →
					</a>
				{/if}
			</div>
			<div class="panel-sunken graph-paper overflow-hidden rounded-lg border px-4 py-5">
				<RigDiagram />
			</div>
			{#if midiAccess.status === 'granted'}
				<p class="measure -mt-1 text-xs leading-relaxed text-muted-foreground">
					Solid cables are open; dashed ones exist but carry nothing yet. A cable lights the moment
					a message runs down it.
				</p>
			{:else}
				<div class="flex flex-wrap items-center gap-3">
					<Button variant="outline" onclick={() => midiAccess.request(false)}>
						<HugeiconsIcon icon={PlugSocketIcon} size={16} />
						Connect your hardware
					</Button>
					<span class="text-xs text-muted-foreground">
						Chrome, Edge or Firefox. Nothing leaves this page.
					</span>
				</div>
			{/if}
		</section>
	{/if}

	<!-- ── the course ────────────────────────────────────────────────────── -->
	<section class="flex flex-col gap-5">
		<div class="flex items-baseline justify-between">
			<h2 class="text-xl font-semibold tracking-tight">The course</h2>
			<a href="/learn" class="text-sm text-muted-foreground hover:text-foreground">
				All {ALL_LESSONS.length} lessons →
			</a>
		</div>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each CURRICULUM as act (act.id)}
				{@const frac = progress.fractionOf(act.lessons.map((l) => l.id))}
				<a
					href="/learn#{act.id}"
					class="group flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/25"
				>
					<div class="flex items-center gap-2.5">
						<span
							class="grid size-8 shrink-0 place-items-center rounded-lg border bg-surface-sunken transition-colors group-hover:border-foreground/25 group-hover:bg-accent"
						>
							<HugeiconsIcon
								icon={ACT_ICON[act.id]}
								size={16}
								strokeWidth={1.6}
								class={cn(
									'transition-colors',
									frac === 1 ? 'text-ok' : 'text-muted-foreground group-hover:text-foreground'
								)}
							/>
						</span>
						<span class="label text-muted-foreground">Act {act.number}</span>
						<span class="ml-auto font-mono text-xs text-muted-foreground">
							{act.lessons.length} lessons
						</span>
					</div>
					<h3 class="leading-snug font-medium">{act.title}</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">{act.subtitle}</p>
					<div class="mt-2 h-1 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-ok transition-[width]"
							style="width: {frac * 100}%"
						></div>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- ── the lab ───────────────────────────────────────────────────────── -->
	<section class="flex flex-col gap-5">
		<div class="flex items-baseline justify-between">
			<h2 class="text-xl font-semibold tracking-tight">The Lab</h2>
			<a href="/lab" class="text-sm text-muted-foreground hover:text-foreground">Open the lab →</a>
		</div>
		<p class="-mt-3 max-w-2xl text-sm text-muted-foreground">
			The tools the lessons are built on, standing alone. These are the parts you keep using after
			the course is over.
		</p>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each tools as tool (tool.href)}
				<a
					href={tool.href}
					class="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/25"
				>
					<HugeiconsIcon icon={tool.icon} size={20} class="mt-0.5 shrink-0 text-muted-foreground" />
					<span>
						<span class="block text-sm font-medium">{tool.name}</span>
						<span class="block text-sm text-muted-foreground">{tool.desc}</span>
					</span>
				</a>
			{/each}
		</div>
	</section>

	<footer class="flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
		<a href="/reference" class="flex items-center gap-1.5 hover:text-foreground">
			<HugeiconsIcon icon={LibraryIcon} size={13} /> Reference tables
		</a>
		<a href="/lab" class="flex items-center gap-1.5 hover:text-foreground">
			<HugeiconsIcon icon={FlaskConicalIcon} size={13} /> Lab tools
		</a>
		<span>Web MIDI needs Chrome, Edge or Firefox — Safari has none.</span>
	</footer>
</div>
