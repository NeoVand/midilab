<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import LatencyTest from '$lib/components/midi/LatencyTest.svelte';
	import JitterPlot from '$lib/components/midi/JitterPlot.svelte';
	import SchedulerLab from '$lib/components/midi/SchedulerLab.svelte';
	import Troubleshooter from '$lib/components/midi/Troubleshooter.svelte';
	import Scope from '$lib/components/midi/Scope.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { DangerIcon } from '@hugeicons/core-free-icons';
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-8">
	<PageHeader
		title="Diagnostics"
		lead="Measure instead of guessing: round-trip latency, incoming clock stability, scheduler accuracy — and a decision tree for when nothing is arriving at all."
		back={{ href: '/lab', label: 'Lab' }}
	/>

	<div class="grid gap-8 lg:grid-cols-2">
		<section class="flex flex-col gap-3">
			<h2 class="text-lg font-semibold tracking-tight">Round-trip latency</h2>
			<p class="flex-1 text-sm text-muted-foreground">
				Loop a MIDI output back into an input — physically, or with a virtual port such as the macOS
				IAC Driver or loopMIDI on Windows — and this measures the real cost of a message leaving and
				returning.
			</p>
			<LatencyTest />
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="text-lg font-semibold tracking-tight">Incoming clock stability</h2>
			<p class="flex-1 text-sm text-muted-foreground">
				Start a clock from any device into this page. The average tells you its tempo; the spread
				tells you whether it deserves to be your clock leader.
			</p>
			<JitterPlot intervals={transport.clockIntervals} height={110} />
		</section>
	</div>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Scheduler accuracy</h2>
		<p class="measure text-sm text-muted-foreground">
			The same sixteen notes, played two ways. Watch what the JavaScript thread being busy does to
			each — and what it does not do to the one that hands over timestamps in advance.
		</p>
		<SchedulerLab />
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Audio output</h2>
		<p class="measure text-sm text-muted-foreground">
			The waveform leaving the built-in synth. Useful for confirming that silence is silence rather
			than a routing problem somewhere further along.
		</p>
		<Scope height={120} />
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Nothing is arriving</h2>
		<Troubleshooter />
	</section>

	<section class="flex flex-wrap items-center gap-4 rounded-lg border border-destructive/30 p-4">
		<div class="max-w-2xl min-w-0 flex-1">
			<p class="text-sm font-medium">Last resort</p>
			<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
				An explicit Note Off for all 128 notes on all 16 channels — 2,048 messages. On a DIN cable
				that takes about two seconds and you will hear it working. Use it when a device honours
				neither All Notes Off nor All Sound Off.
			</p>
		</div>
		<Button variant="destructive" size="sm" class="gap-1.5" onclick={() => engine.panic(true)}>
			<HugeiconsIcon icon={DangerIcon} size={14} /> Sweep every note off
		</Button>
	</section>
</div>
