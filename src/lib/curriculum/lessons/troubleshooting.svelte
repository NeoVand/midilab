<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Troubleshooter from '$lib/components/midi/Troubleshooter.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import { lessonById } from '$lib/curriculum/registry';

	const meta = lessonById('troubleshooting')!;

	const TOP_FIVE = [
		[
			'Channel mismatch',
			'The sender transmits on 1, the receiver listens on 3. Everything is working perfectly and nothing happens.'
		],
		['TRS Type A/B', 'Silent, complete, and with no diagnostic clue whatsoever. Modern gear only.'],
		[
			'Local Control off',
			'A synth that makes no sound from its own keys but happily sends MIDI. Survives power cycles.'
		],
		[
			'A MIDI loop',
			'Doubled notes, stuck notes, or a message storm from one key press. Always configuration, never hardware.'
		],
		[
			'A stuck controller',
			'CC 7 at zero, or a pitch bend left off centre, from a session three weeks ago.'
		]
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			MIDI problems are almost never mysterious. They are almost always one of about five things,
			and the reason they feel mysterious is that people debug in the wrong order — starting with
			the expensive, rare causes and working backwards to the cheap, common ones.
		</p>
		<p class="prose-body">
			The discipline is simple: <strong>check the free things first</strong>, and check them
			properly rather than assuming. "The channel is right" and "I have confirmed the channel is
			right by looking at the monitor" are different statements, and only the second one counts.
		</p>
	</Section>

	<Section title="The five that account for most of it">
		<div class="flex flex-col gap-2">
			{#each TOP_FIVE as [title, body], i (title)}
				<div class="flex gap-4 rounded-lg border p-4">
					<span class="font-mono text-sm text-muted-foreground">{i + 1}</span>
					<div>
						<p class="text-sm font-medium">{title}</p>
						<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
					</div>
				</div>
			{/each}
		</div>
	</Section>

	<TryThis title="Work through it">
		<p class="text-sm leading-relaxed">
			Answer honestly — the value is in the ordering, not in reaching the end quickly. The banner at
			the top is a live probe: if anything at all is arriving on an open input, it will tell you.
		</p>
		<Troubleshooter />
	</TryThis>

	<Section title="The monitor is the arbiter">
		<p class="prose-body">
			Every question above eventually reduces to "what is actually on the wire?", and that is not a
			matter of opinion. A monitor turns arguments into observations:
		</p>
		<ul class="prose-body flex flex-col gap-2.5">
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-msg-cc/70"></span>
				<span>
					<strong>Is anything arriving?</strong> If the monitor is empty, the problem is upstream of the
					receiver entirely — cable, port, host, or the sender not sending.
				</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-msg-cc/70"></span>
				<span>
					<strong>On which channel?</strong> The channel column ends the channel argument in one glance.
				</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-msg-cc/70"></span>
				<span>
					<strong>How many times?</strong> One key press should be one Note On. Counting rows is the loop
					test.
				</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-msg-cc/70"></span>
				<span>
					<strong>What else is in there?</strong> A flood of aftertouch or clock you did not intend is
					both a bandwidth problem and a clue.
				</span>
			</li>
		</ul>
		<div class="h-64 overflow-hidden rounded-lg border">
			<MidiMonitor class="h-full" />
		</div>
	</Section>

	<Callout variant="key" title="Bisect the path">
		<p>
			When the tree does not settle it, cut the signal path in half. Put the monitor in the middle:
			connect the sender directly to the computer and confirm the messages are right there. If they
			are, the sender is fine and the problem is downstream. If they are not, you have halved the
			search space in one move.
		</p>
		<p class="mt-2">
			This works for chains, for Thru boxes, for interfaces, for anything. It is the single most
			effective debugging technique in the whole subject, and it is the reason a MIDI monitor is a
			piece of test equipment rather than a curiosity.
		</p>
	</Callout>

	<Section title="Reading an implementation chart">
		<p class="prose-body">
			If everything checks out and the device still ignores you, the last stop is its
			<strong>MIDI implementation chart</strong> — a table at the back of every manual with two columns:
			what it transmits, and what it recognises. Read it as a capabilities contract.
		</p>
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<thead class="label bg-muted/50">
					<tr>
						<th class="px-3 py-2 text-left font-medium">Function</th>
						<th class="w-24 px-3 py-2 text-center font-medium">Transmitted</th>
						<th class="w-24 px-3 py-2 text-center font-medium">Recognised</th>
					</tr>
				</thead>
				<tbody class="text-xs">
					{#each [['Note On / Off', '✓', '✓'], ['Velocity', '✓', '✓'], ['Aftertouch, channel', '✗', '✓'], ['Aftertouch, poly', '✗', '✗'], ['Pitch Bend', '✓', '✓'], ['Control Change', '✓', 'see chart'], ['Program Change', '✓', '0–127'], ['Bank Select', '✗', 'MSB only'], ['System Exclusive', '✓', '✓'], ['Clock', '✗', '✓'], ['Start / Stop / Continue', '✗', '✓']] as [fn, tx, rx] (fn)}
						<tr class="border-t">
							<td class="px-3 py-2">{fn}</td>
							<td class="px-3 py-2 text-center font-mono">{tx}</td>
							<td class="px-3 py-2 text-center font-mono">{rx}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-sm leading-relaxed text-muted-foreground">
			An illustrative chart, not a real device. Read across: this one <em>recognises</em> channel
			aftertouch but never <em>sends</em> it, follows clock but never generates it, and only reads the
			MSB half of Bank Select — so sending Bank LSB to it does nothing at all, correctly.
		</p>
		<Callout variant="convention" title="The chart is the API documentation">
			<p>
				Once you have read a few of these, an instrument stops being a mysterious box and becomes a
				documented interface: methods it accepts, properties it exposes, an addressing scheme, and
				an extension mechanism. That reframing is what the rest of this course builds on.
			</p>
		</Callout>
	</Section>

	<Quiz
		question="A note plays but hangs on forever, and only sometimes. What is the most productive first move?"
		options={[
			'Replace the MIDI cable',
			'Play one note and count how many messages the monitor shows',
			'Send panic and carry on',
			'Reduce the tempo'
		]}
		answer={1}
		explanation="Intermittent hanging notes come either from a loop swallowing Note Offs in a message storm, or from a long Thru chain dropping bytes. Counting the messages from a single key press distinguishes the two immediately. Panic clears the symptom without telling you anything."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="tree"
			label="Reach a diagnosis in the tree"
			hint="Any branch. Tick when you get to a conclusion."
		/>
		<Checkpoint
			lesson={meta.id}
			id="count"
			label="Use the monitor to count the messages from one key press"
			test={(e) => e.message.type === 'noteOn'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="chart"
			label="Find and read the implementation chart for one of your own devices"
			hint="Usually the last page of the manual, or a separate Data List PDF."
		/>
	</Checkpoints>
</LessonShell>
