<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import SchedulerLab from '$lib/components/midi/SchedulerLab.svelte';
	import LatencyTest from '$lib/components/midi/LatencyTest.svelte';
	import JitterPlot from '$lib/components/midi/JitterPlot.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { transport } from '$lib/midi/clock.svelte';

	const meta = lessonById('latency-and-jitter')!;

	// One byte at 31,250 baud with its start and stop bits.
	const bitsPerByte = 10;
	const baud = 31250;
	const msPerByte = (bitsPerByte / baud) * 1000;
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			Two different timing problems get called "latency", and only one of them is fixable.
		</p>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-xl border border-ok/40 p-4">
				<p class="text-[11px] font-semibold tracking-wide text-ok uppercase">
					Latency — a constant delay
				</p>
				<p class="text-sm leading-relaxed">
					Everything arrives 9 ms late, every time. Annoying to play through, but entirely
					correctable: schedule 9 ms earlier, or nudge the track. Consistency is what makes it
					solvable.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-xl border border-destructive/40 p-4">
				<p class="text-[11px] font-semibold tracking-wide text-destructive uppercase">
					Jitter — an inconsistent delay
				</p>
				<p class="text-sm leading-relaxed">
					Sometimes 4 ms, sometimes 22 ms, unpredictably. There is nothing to compensate <em>for</em
					>, because the number keeps changing. This is what people mean when a rig "feels loose".
				</p>
			</div>
		</div>
	</Section>

	<Section title="Where the time goes">
		<p class="text-[15px] leading-relaxed">
			On the wire itself, MIDI 1.0 is genuinely slow but genuinely predictable. At {baud.toLocaleString()}
			bits per second, with a start and stop bit around each byte, one byte takes about
			<strong>{msPerByte.toFixed(2)} ms</strong>. A three-byte note is roughly
			{(msPerByte * 3).toFixed(1)} ms; a ten-note chord sent as ten separate notes is about
			{(msPerByte * 30).toFixed(0)} ms from first to last — which is at the edge of audible as a strum.
		</p>
		<p class="text-[15px] leading-relaxed">
			That is the floor, and it is fixed. Everything above it comes from software: the operating
			system's MIDI stack, USB polling intervals, the browser's main thread, and — usually the
			largest contributor — your own code firing events from timers.
		</p>
		<Callout variant="key" title="The wire is rarely the problem">
			<p>
				USB MIDI is much faster than DIN, and yet USB rigs are not automatically tighter. The
				bottleneck in a modern setup is almost always scheduling, not transmission. Which is good
				news, because scheduling is the part you control.
			</p>
		</Callout>
	</Section>

	<Section title="Why setTimeout cannot sequence music">
		<p class="text-[15px] leading-relaxed">
			A JavaScript timer promises to run your callback <em>no sooner</em> than the delay you asked for.
			It promises nothing about how much later. Anything else on the main thread — a garbage collection,
			a layout pass, a big render, another tab on the same process — pushes it back, and you find out
			afterwards.
		</p>
		<p class="text-[15px] leading-relaxed">
			The fix is to stop asking a timer to <em>play</em> notes and start asking it to
			<em>plan</em> them. Wake up coarsely, look a little way into the future, and hand every event in
			that window to the audio and MIDI subsystems with an explicit timestamp. They run on their own clocks
			and will deliver on time even if JavaScript is busy.
		</p>

		<TryThis title="Hear the difference">
			<SchedulerLab />
		</TryThis>

		<div class="flex flex-col gap-3 rounded-xl border bg-surface-sunken p-4">
			<p class="text-[10px] tracking-wide text-muted-foreground uppercase">The pattern, in full</p>
			<pre class="scrollbar-thin overflow-x-auto font-mono text-[11px] leading-relaxed"><code
					>{`const LOOKAHEAD = 0.12;   // seconds of future to plan
const INTERVAL  = 25;     // ms between wake-ups

let nextTime = ctx.currentTime + 0.05;

setInterval(() => {
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    // Audio: schedule on the audio clock.
    playVoice(nextTime);

    // MIDI: schedule on the performance clock.
    output.send([0x90, 60, 100], audioToPerf(nextTime));

    nextTime += secondsPerStep;
  }
}, INTERVAL);`}</code
				></pre>
			<p class="text-xs leading-relaxed text-muted-foreground">
				Two rules make it work. The wake-up interval must be comfortably shorter than the lookahead
				window, so a late wake-up still catches its events. And nothing inside the loop may depend
				on the wall clock — only on <code class="rounded bg-muted px-1">nextTime</code>, which
				advances by exact arithmetic and therefore never drifts.
			</p>
		</div>
	</Section>

	<Section title="Measuring your own rig">
		<p class="text-[15px] leading-relaxed">
			Numbers beat opinions. Two measurements are worth taking on your actual hardware.
		</p>
		<TryThis title="Round-trip latency">
			<LatencyTest />
		</TryThis>
		<TryThis title="Incoming clock stability">
			<p class="text-sm leading-relaxed">
				Start a clock from your OP-XY, MPC or DAW into this page and watch the spread. This is how
				you find out which device deserves to be your clock leader.
			</p>
			<JitterPlot intervals={transport.clockIntervals} height={100} />
		</TryThis>
	</Section>

	<Section title="Dense automation has a cost">
		<p class="text-[15px] leading-relaxed">
			A single controller sweep recorded at high resolution can be hundreds of messages per second.
			On a DIN cable, at {msPerByte.toFixed(2)} ms per byte, three hundred three-byte messages per second
			is {((300 * 3 * msPerByte) / 10).toFixed(0)}% of the available bandwidth — and your notes are
			queued behind them.
		</p>
		<p class="text-[15px] leading-relaxed">
			The symptom is distinctive and easy to misdiagnose: timing that is fine when the arrangement
			is sparse and falls apart in the busy section. Thin the automation, move it to a different
			port, or accept a coarser sweep. All three are better than blaming the sequencer.
		</p>
	</Section>

	<Quiz
		question="Your notes arrive a consistent 11 ms late. What should you do?"
		options={[
			'Nothing can be done — this is jitter',
			'Compensate: schedule 11 ms earlier, or shift the track',
			'Reduce the MIDI clock rate',
			'Switch from USB to DIN'
		]}
		answer={1}
		explanation="Consistent means correctable. A fixed offset is latency, and every DAW has a track delay control for exactly this. Only inconsistency — jitter — is genuinely unfixable, which is why measuring the spread matters more than measuring the average."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="naive"
			label="Play the pattern with the naive scheduler and block the thread"
			hint="You should hear a note stumble."
			test={(e) => e.message.type === 'noteOn' && e.message.velocity === 112}
		/>
		<Checkpoint
			lesson={meta.id}
			id="lookahead"
			label="Play the same pattern with the lookahead scheduler and block it again"
			hint="This time it should not stumble."
			count={8}
			key={(e) => String(e.id)}
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="measure"
			label="Measure something on your own setup"
			hint="Round-trip latency with a loopback, or the jitter of an external clock. Tick by hand if you have no hardware to hand."
			test={(e) => e.message.type === 'clock' && e.direction === 'in'}
		/>
	</Checkpoints>
</LessonShell>
