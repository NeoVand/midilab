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

<div class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-8 py-8">
	<PageHeader
		title="Diagnostics"
		lead="Measure instead of guessing: round-trip latency, incoming clock stability, scheduler accuracy — and a decision tree for when nothing is arriving at all."
		back={{ href: '/lab', label: 'Lab' }}
	>
		{#snippet actions()}
			<Button variant="destructive" size="sm" class="gap-1.5" onclick={() => engine.panic(true)}>
				<HugeiconsIcon icon={DangerIcon} size={14} /> Full panic
			</Button>
		{/snippet}
	</PageHeader>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Round-trip latency</h2>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Loop a MIDI output back into an input — physically, or with a virtual port such as the macOS
			IAC Driver or loopMIDI on Windows — and this measures the real cost of a message leaving and
			returning.
		</p>
		<LatencyTest />
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Incoming clock stability</h2>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Start a clock from any device into this page. The average tells you its tempo; the spread
			tells you whether it deserves to be your clock leader.
		</p>
		<JitterPlot intervals={transport.clockIntervals} height={110} />
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Scheduler accuracy</h2>
		<SchedulerLab />
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Audio output</h2>
		<Scope height={120} />
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Nothing is arriving</h2>
		<Troubleshooter />
	</section>
</div>
