<script lang="ts">
	import InstrumentPanel from '$lib/components/midi/InstrumentPanel.svelte';
	import RigDiagram from '$lib/components/midi/RigDiagram.svelte';
	import CourseMap from '$lib/components/shell/CourseMap.svelte';
	import ToolFigure from '$lib/components/shell/ToolFigure.svelte';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { ALL_LESSONS, TOTAL_MINUTES, actOf } from '$lib/curriculum/registry';
	import { lessonHref, path } from '$lib/nav';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { device } from '$lib/stores/device.svelte';
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

	const nextAct = $derived(actOf(nextLesson.id));

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
		},
		{
			href: '/lab/jukebox',
			figure: 'jukebox',
			name: 'Jukebox',
			desc: 'Bach, on anything you like'
		}
	] as const;
</script>

<div
	class="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-3 pb-8 sm:gap-12 sm:px-8 sm:pt-8 sm:pb-12"
>
	<!--
		The instrument leads. Its faceplate is the masthead — a page about an
		instrument does not need a marketing banner above the instrument, and the
		banner was the single thing that made this read as a landing page rather
		than as a machine you had just switched on.
	-->
	<InstrumentPanel />

	<!--
		The phone home is the instrument and two rows.
		
		Everything under this on a wide screen — the headline, the course map,
		the grid of tool cards, the footer links — is a front door, and a phone
		already has one: the bar along the bottom, whose four words are Play,
		Learn, Lab and Tables. Repeating all of it down the page turns a tab
		called Play into a brochure you scroll past to reach the keys. So the
		two things that are *not* reachable from the bar stay, compressed to a
		line each: where you got to, and what is plugged in.
	-->
	{#if device.narrow}
		<div class="flex flex-col gap-2">
			<a
				href={lessonHref(nextLesson)}
				class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors active:bg-accent"
			>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="label">
						{overall > 0 ? 'Continue' : 'Start the course'} · Act {nextAct?.number ?? 1}
					</span>
					<span class="truncate text-sm font-medium">{nextLesson.title}</span>
				</span>
				<span class="tnum shrink-0 text-xs text-muted-foreground">{Math.round(overall * 100)}%</span
				>
				<HugeiconsIcon icon={ArrowRight01Icon} size={14} class="shrink-0 text-muted-foreground" />
			</a>

			{#if midiAccess.status === 'granted'}
				<a
					href={path('/lab/patchbay')}
					class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors active:bg-accent"
				>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="label">Your rig</span>
						<span class="tnum truncate text-sm font-medium">
							{midiAccess.inputs.length} in · {midiAccess.outputs.length} out
						</span>
					</span>
					<HugeiconsIcon icon={ArrowRight01Icon} size={14} class="shrink-0 text-muted-foreground" />
				</a>
			{:else if midiAccess.status !== 'unsupported'}
				<button
					type="button"
					onclick={() => midiAccess.request(false)}
					class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors active:bg-accent"
				>
					<HugeiconsIcon icon={PlugSocketIcon} size={14} class="shrink-0 text-muted-foreground" />
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-sm font-medium">Connect your hardware</span>
						<span class="truncate text-xs text-muted-foreground">Nothing leaves this page</span>
					</span>
				</button>
			{/if}
		</div>
	{:else}
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
					<HugeiconsIcon icon={ArrowRight01Icon} size={14} />
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
						Solid cables are open; dashed ones exist but carry nothing yet. A cable lights the
						moment a message runs down it.
					</p>
				{:else}
					<div class="flex flex-wrap items-center gap-3">
						<Button variant="outline" onclick={() => midiAccess.request(false)}>
							<HugeiconsIcon icon={PlugSocketIcon} size={14} />
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
			<!--
				Five columns at full width, so the five tools sit in one row. Four
				columns left the fifth hanging underneath on its own, which reads as a
				layout that broke rather than as a set of five things.

				No narrower state than three: this whole branch only renders above
				`md`, so a one- or two-column rule here would be a breakpoint nobody
				can reach.
			-->
			<div class="grid grid-cols-3 gap-3 lg:grid-cols-5">
				{#each tools as tool (tool.href)}
					<!--
						No card. The border belongs to the drawing, which is a thing with
						edges; the name under it is just a caption, and boxing a caption
						adds a second rectangle that says nothing the first did not.
					-->
					<a href={path(tool.href)} class="group flex flex-col gap-2.5">
						<span
							class="panel-sunken block rounded-lg border p-3 transition-colors group-hover:border-foreground/30"
						>
							<ToolFigure tool={tool.figure} />
						</span>
						<span class="px-0.5">
							<span class="block text-sm font-medium transition-colors group-hover:text-foreground">
								{tool.name}
							</span>
							<span class="block text-sm text-muted-foreground">{tool.desc}</span>
						</span>
					</a>
				{/each}
			</div>
		</section>

		<footer class="flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
			<a href={path('/reference')} class="flex items-center gap-1.5 hover:text-foreground">
				<HugeiconsIcon icon={LibraryIcon} size={14} /> Reference tables
			</a>
			<a href={path('/lab')} class="flex items-center gap-1.5 hover:text-foreground">
				<HugeiconsIcon icon={FlaskConicalIcon} size={14} /> Lab tools
			</a>
			<span>Web MIDI needs Chrome, Edge or Firefox — Safari has none.</span>
		</footer>
	{/if}
</div>
