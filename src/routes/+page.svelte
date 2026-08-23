<script lang="ts">
	import InstrumentPanel from '$lib/components/midi/InstrumentPanel.svelte';
	import RigDiagram from '$lib/components/midi/RigDiagram.svelte';
	import CourseMap from '$lib/components/shell/CourseMap.svelte';
	import ToolFigure from '$lib/components/shell/ToolFigure.svelte';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { ALL_LESSONS, TOTAL_MINUTES } from '$lib/curriculum/registry';
	import { lessonHref, path } from '$lib/nav';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowRight01Icon,
		PlugSocketIcon,
		FlaskConicalIcon,
		LibraryIcon
	} from '@hugeicons/core-free-icons';

	const overall = $derived(progress.fractionOf(ALL_LESSONS.map((l) => l.id)));
	const nextLesson = $derived(
		ALL_LESSONS.find((l) => !progress.isLessonComplete(l.id)) ?? ALL_LESSONS[0]
	);

	const tools = [
		{
			href: '/lab/monitor',
			figure: 'monitor',
			name: 'Monitor',
			desc: 'Every byte, colour-coded'
		},
		{
			href: '/lab/patchbay',
			figure: 'patchbay',
			name: 'Patchbay',
			desc: 'Route, remap, transpose'
		},
		{
			href: '/lab/programmer',
			figure: 'programmer',
			name: 'Programmer',
			desc: 'Sequence and export .mid'
		},
		{
			href: '/lab/devices',
			figure: 'devices',
			name: 'Device Lab',
			desc: 'Learn an unknown synth'
		}
	] as const;
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pt-8 pb-12 sm:px-8">
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
			<Button href={lessonHref(nextLesson)} size="xl">
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
					<a
						href={path('/lab/patchbay')}
						class="text-sm text-muted-foreground hover:text-foreground"
					>
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
			<span class="tnum text-sm text-muted-foreground">
				{Math.round(overall * 100)}% complete
			</span>
		</div>
		<CourseMap />
	</section>

	<!-- ── the lab ───────────────────────────────────────────────────────── -->
	<section class="flex flex-col gap-5">
		<div class="flex items-baseline justify-between">
			<h2 class="text-xl font-semibold tracking-tight">The Lab</h2>
			<a href={path('/lab')} class="text-sm text-muted-foreground hover:text-foreground"
				>Open the lab →</a
			>
		</div>
		<p class="measure -mt-3 text-sm text-muted-foreground">
			The tools the lessons are built on, standing alone. These are the parts you keep using after
			the course is over.
		</p>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each tools as tool (tool.href)}
				<a
					href={path(tool.href)}
					class="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/25"
				>
					<span class="panel-sunken block rounded-md px-3.5 py-3">
						<ToolFigure tool={tool.figure} />
					</span>
					<span>
						<span class="block text-sm font-medium">{tool.name}</span>
						<span class="block text-sm text-muted-foreground">{tool.desc}</span>
					</span>
				</a>
			{/each}
		</div>
	</section>

	<footer class="flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
		<a href={path('/reference')} class="flex items-center gap-1.5 hover:text-foreground">
			<HugeiconsIcon icon={LibraryIcon} size={13} /> Reference tables
		</a>
		<a href={path('/lab')} class="flex items-center gap-1.5 hover:text-foreground">
			<HugeiconsIcon icon={FlaskConicalIcon} size={13} /> Lab tools
		</a>
		<span>Web MIDI needs Chrome, Edge or Firefox — Safari has none.</span>
	</footer>
</div>
