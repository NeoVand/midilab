<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import StepSequencer from '$lib/components/midi/StepSequencer.svelte';
	import CodeSandbox from '$lib/components/midi/CodeSandbox.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { transport } from '$lib/midi/clock.svelte';

	const meta = lessonById('building-a-sequencer')!;

	const EXAMPLES = [
		{
			name: 'Sixteen steps',
			code: `// The whole sequencer, in fifteen lines.
const pattern = [1,0,0,0, 1,0,1,0, 0,0,1,0, 1,0,0,1];
const notes   = [36,0,0,0, 38,0,42,0, 0,0,36,0, 38,0,0,42];
const PPQ = 96, ticksPerStep = PPQ / 4;

midi.transport.onTick((t) => {
	if (t.tick % ticksPerStep) return;
	const step = Math.floor(t.tick / ticksPerStep) % 16;
	if (!pattern[step]) return;
	const note = notes[step];
	const dur = 60 / midi.transport.bpm / 4 * 0.8;
	midi.send({ type: 'noteOn',  channel: 9, note, velocity: 100 }, midi.toPerf(t.audioTime), t.audioTime);
	midi.send({ type: 'noteOff', channel: 9, note, velocity: 0   }, midi.toPerf(t.audioTime + dur), t.audioTime + dur);
});

midi.transport.start();
log('running — press Stop to cancel the subscription');`
		},
		{
			name: 'Note lifecycle done properly',
			code: `// The bug this avoids: stopping mid-note leaves it hanging.
const held = new Set();

function play(note, channel, atAudio, seconds) {
	held.add(note + ':' + channel);
	midi.send({ type: 'noteOn', channel, note, velocity: 96 }, midi.toPerf(atAudio), atAudio);
	const off = atAudio + seconds;
	midi.send({ type: 'noteOff', channel, note, velocity: 0 }, midi.toPerf(off), off);
	setTimeout(() => held.delete(note + ':' + channel), seconds * 1000 + 50);
}

// Scheduling the Note Off at the same moment as the Note On means it is
// already committed to the MIDI subsystem before anything can go wrong.
const t = midi.now() + 0.1;
[60, 64, 67, 72].forEach((n, i) => play(n, 0, t + i * 0.25, 0.22));

log('four notes, each with its release already scheduled');`
		},
		{
			name: 'Follow an external clock',
			code: `// Count incoming clock ticks and fire on every sixth — a sixteenth note.
let ticks = 0;
midi.onMessage((e) => {
	if (e.direction !== 'in') return;
	if (e.message.type === 'start') { ticks = 0; log('start'); return; }
	if (e.message.type === 'stop')  { log('stop'); return; }
	if (e.message.type !== 'clock') return;
	if (ticks++ % 6 === 0) {
		midi.note(42, 70, 60, 9);          // 24 clock ticks per quarter,
	}                                     // so every 6th is a sixteenth
});

log('waiting for external clock — start your hardware');`
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-base leading-relaxed">
			You now have every part: a message language, a scheduler, a transport, and an audio engine. A
			sequencer is what happens when you put them together, and it is smaller than you expect.
		</p>
		<p class="text-base leading-relaxed">
			The whole job is: on each tick, work out which step we are on, look up what should happen, and
			schedule it — <em>with the tick's own timestamp</em>, never with "now".
		</p>
	</Section>

	<TryThis title="A working one">
		<StepSequencer />
	</TryThis>

	<Section title="Three things that separate working from good">
		<div class="flex flex-col gap-3">
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">1 · Schedule the Note Off with the Note On</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					Do not wait until the note should end and then send the release — by then anything might
					have happened. Compute the end time when you schedule the start and hand both to the MIDI
					subsystem together. Stopping the transport mid-note then cannot strand anything, because
					the release was committed before you stopped.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">2 · Track what is held anyway</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					Belt and braces. Keep a set of currently-sounding (channel, note) pairs and release them
					on stop, on pattern change, on channel change and on unmount. Every hanging-note bug is a
					place where one of those paths was forgotten.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">3 · Advance time by arithmetic, never by measurement</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					<code class="rounded bg-muted px-1">nextTime += secondsPerStep</code> stays exact forever.
					<code class="rounded bg-muted px-1">nextTime = now() + secondsPerStep</code> accumulates every
					scheduling error you ever make, and drifts audibly within a minute.
				</p>
			</div>
		</div>
	</Section>

	<TryThis title="Write your own">
		<CodeSandbox initial={EXAMPLES[0].code} examples={EXAMPLES} rows={16} />
	</TryThis>

	<Section title="Following someone else's clock">
		<p class="text-base leading-relaxed">
			Everything above assumes you are the clock leader. To follow instead, you stop generating time
			and start counting it: 24 incoming clock ticks make a quarter note, so every sixth tick is a
			sixteenth. Start resets your position to zero, Continue does not, and Song Position Pointer
			relocates you before either.
		</p>
		<Callout variant="gotcha" title="Following costs you the lookahead">
			<p>
				When you generate the clock you know where the next tick will be, so you can plan ahead.
				When you follow, you only know a tick has happened once it arrives — there is no future to
				schedule into, and your events go out immediately with whatever jitter the incoming clock
				had, plus your own.
			</p>
			<p class="mt-2">
				Serious followers mitigate this by estimating tempo from recent ticks and predicting the
				next one, which buys back a small lookahead at the cost of reacting slightly late to tempo
				changes. That trade-off is why some devices follow clock much better than others.
			</p>
		</Callout>
	</Section>

	<Section title="What to build next">
		<p class="text-base leading-relaxed">
			The step sequencer above is the smallest interesting version. The obvious extensions, roughly
			in order of value: per-step velocity and length; more than one pattern with chaining; a
			controller lane so you can sequence CC as well as notes; per-track length for polyrhythm; and
			swing applied as a timing offset rather than a separate grid.
		</p>
		<p class="text-base leading-relaxed">
			The Programmer in the Lab has several of these. None of them change the architecture — they
			are all "what should happen on this tick", answered more elaborately.
		</p>
	</Section>

	<Quiz
		question="Your sequencer drifts noticeably flat over a minute of playing. What is the most likely cause?"
		options={[
			'The audio context sample rate is wrong',
			'Time is being advanced from the current clock reading rather than by fixed arithmetic',
			'The tempo is too high',
			'MIDI clock is not enabled'
		]}
		answer={1}
		explanation="Setting nextTime = now() + interval bakes in the scheduling error of every single step, and the errors accumulate in one direction. Advancing nextTime += interval keeps the grid exact no matter how late any individual wake-up was."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="pattern"
			label="Make a pattern and play it"
			test={(e) => e.message.type === 'noteOn' && transport.playing}
		/>
		<Checkpoint
			lesson={meta.id}
			id="export"
			label="Export it as a .mid file"
			hint="The Export button writes it with the codec from Lesson 18."
		/>
		<Checkpoint
			lesson={meta.id}
			id="code"
			label="Write a sequencer in the console"
			hint="Run the first example, then change the pattern."
		/>
		<Checkpoint
			lesson={meta.id}
			id="clean-stop"
			label="Stop mid-pattern and confirm nothing hangs"
			test={(e) => e.message.type === 'stop'}
		/>
	</Checkpoints>
</LessonShell>
