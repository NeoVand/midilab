<script lang="ts">
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { CURRICULUM, ALL_LESSONS, TOTAL_MINUTES, lessonPath } from '$lib/curriculum/registry';
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

	/** The most recent thing that was not a clock tick — the "you just did that" panel. */
	const latest = $derived.by(() => {
		void monitor.version;
		const events = monitor.events;
		for (let i = events.length - 1; i >= 0; i--) {
			const t = events[i].message.type;
			if (t !== 'clock' && t !== 'activeSensing') return events[i];
		}
		return null;
	});

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

<div class="mx-auto flex w-full max-w-6xl flex-col gap-12 px-8 py-12">
	<!-- ── hero ──────────────────────────────────────────────────────────── -->
	<header class="flex flex-col gap-5">
		<p class="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">MIDI Lab</p>
		<h1 class="max-w-3xl text-4xl font-semibold">
			Learn MIDI by making it happen, one byte at a time.
		</h1>
		<p class="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
			Thirty lessons that start at "what even is a MIDI message" and end with you running a rig of
			several instruments from one clock — or from your own code. Everything here is wired to a live
			engine, so nothing is a diagram: press a key below and watch the actual bytes.
		</p>
		<div class="flex flex-wrap items-center gap-3 pt-1">
			<Button href={lessonPath(nextLesson)} size="xl">
				{overall > 0 ? 'Continue' : 'Start the course'}
				<HugeiconsIcon icon={ArrowRight01Icon} size={16} />
			</Button>
			{#if midiAccess.status !== 'granted' && midiAccess.status !== 'unsupported'}
				<Button variant="outline" size="xl" onclick={() => midiAccess.request(false)}>
					<HugeiconsIcon icon={PlugSocketIcon} size={16} />
					Connect your hardware
				</Button>
			{/if}
			<span class="text-sm text-muted-foreground">
				{ALL_LESSONS.length} lessons · about {Math.round(TOTAL_MINUTES / 60)} hours
			</span>
		</div>
	</header>

	<!-- ── first contact ─────────────────────────────────────────────────── -->
	<!--
		Cause above, effect below. Side by side, the keyboard column ran short
		while the inspector ran long, and the byte cards were forced to wrap in a
		25rem gutter; stacked, the three bytes sit in one row the way they sit on
		the wire, and pressing a key reads down the page rather than across it.
	-->
	<section class="overflow-hidden rounded-lg border bg-card">
		<div class="flex items-baseline justify-between border-b px-5 py-3">
			<h2 class="text-sm font-medium">Press a key</h2>
			<p class="tnum text-xs text-muted-foreground">
				{noteState.heldCount} note{noteState.heldCount === 1 ? '' : 's'} held
			</p>
		</div>

		<div class="flex flex-col gap-3 p-5">
			<Keyboard low={48} octaves={3} height={148} labels="c" />
			<p class="text-xs text-muted-foreground">
				Watch the panel below change twice: <span class="text-msg-note">Note On</span> when you
				press, <span class="text-msg-note">Note Off</span> when you let go. A note is two messages, not
				one — which is exactly why notes get stuck.
			</p>
		</div>

		<div class="panel-sunken min-h-44 border-t p-5">
			{#if latest}
				<ByteInspector bytes={latest.bytes} message={latest.message} />
			{:else}
				<!-- Centred, like every other "nothing yet" panel in the app. Pinned to
				     the left of a panel this wide it reads as content that failed to
				     load rather than as an invitation. -->
				<div class="grid h-full min-h-36 place-items-center text-center">
					<div class="measure flex flex-col gap-2">
						<p class="text-sm font-medium">Nothing has happened yet.</p>
						<p class="text-xs text-muted-foreground">
							Play a note and this panel will take the message apart — hex, bits, the one bit that
							decides whether a byte is a command or a value, and what it all means in English.
						</p>
					</div>
				</div>
			{/if}
		</div>
	</section>

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
					<div class="flex items-baseline gap-2">
						<span class="font-mono text-xs text-muted-foreground">ACT {act.number}</span>
						<span class="ml-auto font-mono text-xs text-muted-foreground">
							{act.lessons.length} lessons
						</span>
					</div>
					<h3 class="leading-snug font-medium">{act.title}</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">{act.subtitle}</p>
					<div class="mt-2 h-1 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-msg-note transition-[width]"
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
