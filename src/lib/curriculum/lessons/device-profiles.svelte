<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import DeviceProfileEditor from '$lib/components/midi/DeviceProfileEditor.svelte';
	import CodeSandbox from '$lib/components/midi/CodeSandbox.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { devices } from '$lib/midi/devices/store.svelte';

	const meta = lessonById('device-profiles')!;

	const EXAMPLES = [
		{
			name: 'Speak in parameters',
			code: `// No CC numbers anywhere in the caller.
midi.send({ type: 'noteOn', channel: 0, note: 48, velocity: 100 });

// Sweep "the filter", whatever that turns out to mean on this device.
let x = 0;
const id = setInterval(() => {
	x += 0.02;
	if (x > 1) { clearInterval(id); midi.send({ type: 'noteOff', channel: 0, note: 48, velocity: 0 }); return; }
	// A profile would translate this; here is the shape of the call.
	midi.cc(74, Math.round(x * 127));
}, 30);

log('sweeping — the caller never mentioned a controller number');`
		},
		{
			name: 'Why raw CCs rot',
			code: `// Imagine this is your song file, three years from now.
const song = [
	{ at: 0,   cc: 74, value: 40 },
	{ at: 500, cc: 74, value: 90 },
	{ at: 900, cc: 71, value: 110 },
];

log('This is bound to one instrument forever.');
log('CC 74 is cutoff on a GM module, something else on a Korg in native mode,');
log('and CC 32 on an OP-XY. Nothing in the data says which was meant.');
log('');
log('The same song as parameters:');
log(JSON.stringify([
	{ at: 0,   param: 'filter.cutoff',    value: 0.31 },
	{ at: 500, param: 'filter.cutoff',    value: 0.71 },
	{ at: 900, param: 'filter.resonance', value: 0.87 },
], null, 1));`
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-base leading-relaxed">
			Here is a design mistake that is very easy to make and very expensive to undo: putting CC
			numbers into your music.
		</p>
		<div class="grid gap-3 lg:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border border-destructive/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-destructive uppercase">
					Bound to one instrument
				</p>
				<pre class="font-mono text-xs leading-relaxed"><code
						>{`{ cc: 74, value: 96, channel: 3 }`}</code
					></pre>
				<p class="text-xs leading-relaxed text-muted-foreground">
					Nothing in this says what was <em>meant</em>. Change the synth and it is meaningless —
					possibly worse than meaningless, because it will still do something.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border border-msg-note/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					Bound to an intention
				</p>
				<pre class="font-mono text-xs leading-relaxed"><code
						>{`{ param: 'filter.cutoff', value: 0.75 }`}</code
					></pre>
				<p class="text-xs leading-relaxed text-muted-foreground">
					Portable. A profile per instrument decides how it is delivered — CC, NRPN or SysEx — and
					the part survives changing the hardware.
				</p>
			</div>
		</div>
	</Section>

	<Callout variant="key" title="The instrument is an API; the profile is its client library">
		<p>
			Everything in Act IV pointed at this. An implementation chart lists methods (which messages it
			accepts), properties (its CC and NRPN map), an addressing scheme (port and channel) and an
			extension mechanism (SysEx). A device profile is that documentation, written down in a form
			your code can execute.
		</p>
	</Callout>

	<Section title="The shape of a profile">
		<pre
			class="scrollbar-thin overflow-x-auto rounded-lg border bg-surface-sunken p-4 font-mono text-sm leading-relaxed"><code
				>{`{
  id: 'my-korg',
  name: 'Korg',
  channel: 2,                      // wire value; displays as 3
  parameters: [
    { id: 'filter.cutoff',    name: 'Cutoff',
      protocol: { kind: 'cc',   number: 74 },        min: 0, max: 127 },
    { id: 'filter.resonance', name: 'Resonance',
      protocol: { kind: 'nrpn', msb: 0, lsb: 44 },   min: 0, max: 1023 },
    { id: 'osc.wave',         name: 'Waveform',
      protocol: { kind: 'sysex', template: [...], valueIndex: 7 }, min: 0, max: 63 }
  ],
  programs: [
    { name: 'Warm pad', bankMsb: 63, bankLsb: 4, program: 17 }
  ]
}`}</code
			></pre>
		<p class="text-base leading-relaxed">
			Three parameters, three completely different delivery mechanisms, one calling convention. The
			adapter turns <code class="rounded bg-muted px-1">set('filter.resonance', 0.8)</code> into whichever
			handshake that particular parameter needs — including the full four-message NRPN sequence, with
			the Null afterwards.
		</p>
		<Callout variant="note" title="Normalised values, not device units">
			<p>
				A profile-driven API should speak in 0–1 by default. A generative process, an envelope, an
				LFO or a piece of composition logic wants "three quarters open", not "value 96 of 127" or
				"value 767 of 1023". The profile knows the range; the caller should not have to.
			</p>
		</Callout>
	</Section>

	<TryThis title="Build one for your own instrument">
		<p class="text-sm leading-relaxed">
			Start from a built-in profile and duplicate it, or start empty and use Learn: arm it, wiggle a
			control on the hardware, and the incoming message becomes a named parameter. The knobs here
			drive the real device through the profile.
		</p>
		<DeviceProfileEditor />
	</TryThis>

	<Section title="Learning a device you have no documentation for">
		<p class="text-base leading-relaxed">
			The Learn button is not a toy. It is the fastest reliable way to map an instrument, and it
			works even when the manual is missing, wrong, or in a language you do not read. The procedure:
		</p>
		<ol class="flex flex-col gap-2 text-base leading-relaxed">
			{#each ['Connect the instrument’s MIDI Out to this machine and enable it as an input in the dock.', 'Arm Learn, move one control, and rename the parameter it captures to something semantic.', 'Repeat for every control you care about. Twenty minutes gets you a usable profile.', 'Verify the other direction: turn the on-screen knob and confirm the hardware responds. Transmit and receive maps are not always the same.', 'Export the JSON and keep it with your project.'] as step, i (step)}
				<li class="flex gap-3">
					<span class="mt-0.5 font-mono text-sm text-msg-note">{i + 1}</span>
					<span>{step}</span>
				</li>
			{/each}
		</ol>
		<Callout variant="gotcha" title="What a device sends is not always what it receives">
			<p>
				Plenty of instruments transmit a control on one number and respond to it on another, or
				transmit something they do not respond to at all. Always test the return path. This is also
				why the built-in OP-XY profile in this app is marked unverified: those numbers come from
				community mapping, not from an official chart, and your firmware may differ.
			</p>
		</Callout>
	</Section>

	<TryThis title="The difference, in code">
		<CodeSandbox initial={EXAMPLES[1].code} examples={EXAMPLES} rows={14} />
	</TryThis>

	<Section title="Where this is going">
		<p class="text-base leading-relaxed">
			MIDI 2.0's Property Exchange lets a device publish this structure itself — its controllers,
			its programs, its current state — as machine-readable data. Software could then build an
			editor for an instrument it has never encountered.
		</p>
		<p class="text-base leading-relaxed">
			Until then, you are the Property Exchange. The abstraction is worth building now precisely
			because it will not need changing later: when instruments start describing themselves, the
			profiles simply arrive pre-filled.
		</p>
	</Section>

	<Quiz
		question="Why should a composition store 'filter.cutoff = 0.75' rather than 'CC 74 = 96'?"
		options={[
			'It uses less storage',
			'It survives changing the instrument, because the translation lives in one replaceable place',
			'CC 74 is deprecated',
			'It transmits faster'
		]}
		answer={1}
		explanation="CC numbers are per-device conventions. Storing intent and translating at the edge means one profile swap re-targets an entire piece — and it is the only form that still means something in five years when the hardware has changed."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="create"
			label="Create or duplicate a profile"
			test={() => devices.user.length > 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="param"
			label="Add at least three parameters to it"
			test={() => devices.user.some((p) => p.parameters.length >= 3)}
		/>
		<Checkpoint
			lesson={meta.id}
			id="drive"
			label="Drive a parameter and watch the right message go out"
			test={(e) => e.direction === 'out' && e.message.type === 'controlChange'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="learn"
			label="Capture a control from real hardware with Learn"
			hint="Needs an instrument connected. Tick by hand otherwise."
			test={(e) => e.direction === 'in' && e.message.type === 'controlChange'}
		/>
	</Checkpoints>
</LessonShell>
