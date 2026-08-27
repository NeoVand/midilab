<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import Term from '$lib/components/lesson/Term.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Chain from '$lib/components/lesson/Chain.svelte';
	import CcPanel from '$lib/components/midi/CcPanel.svelte';
	import Drone from '$lib/components/midi/Drone.svelte';
	import Scope from '$lib/components/midi/Scope.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import Harmonics from '$lib/components/midi/Harmonics.svelte';
	import MelodyPlayer from '$lib/components/midi/MelodyPlayer.svelte';
	import EngineToggle from '$lib/components/midi/EngineToggle.svelte';
	import { lessonById } from '$lib/curriculum/registry';

	const meta = lessonById('inside-the-instrument')!;

	const BLOCKS = [
		{
			name: 'Oscillator',
			does: 'Makes a raw, repeating waveform at the pitch you asked for.',
			shapes:
				'A sawtooth has every harmonic; a square has only the odd ones and sounds hollow; a sine has none at all and sounds like a whistle.',
			cc: 'Nothing standard. Waveform choice is almost always NRPN or SysEx.'
		},
		{
			name: 'Filter',
			does: 'Takes frequencies away — nearly always the high ones.',
			shapes:
				'Cutoff is where it starts removing; resonance is a boost right at that point which makes a sweep sing rather than just dull.',
			cc: 'CC 74 for cutoff, CC 71 for resonance. The two most-automated controllers in music.'
		},
		{
			name: 'Envelope',
			does: 'Moves something over the life of one note, with no further messages.',
			shapes:
				'Attack, decay, sustain, release. Aimed at volume it decides whether a note plucks or swells; aimed at the filter it decides whether it opens brightly and closes.',
			cc: 'CC 73 attack, CC 75 decay, CC 72 release. No standard controller for sustain.'
		},
		{
			name: 'LFO',
			does: 'A wave too slow to hear, used to move something else.',
			shapes:
				'Pointed at pitch it is vibrato. At volume, tremolo. At the filter, a wobble. Same block, three famous effects.',
			cc: 'CC 1 asks the instrument to apply its own; CC 76–78 nominally set rate, depth and delay.'
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Everything so far has been about the message. This lesson is about the thing on the other end
			of the cable, because half the confusing behaviour in MIDI is not the protocol at all — it is
			a synthesiser doing something reasonable that you were not expecting.
		</p>
		<p class="prose-body">
			You do not need to be able to build one. You need enough of the map that CC 74 stops being a
			magic number and becomes a request you can predict the answer to.
		</p>
		<Chain
			steps={[
				{ label: 'Note On', note: 'pitch + velocity' },
				{ label: 'Oscillator', note: 'a raw waveform' },
				{ label: 'Filter', note: 'takes the highs away', accent: true },
				{ label: 'Amplifier', note: 'shaped by the envelope' },
				{ label: 'Sound' }
			]}
		/>
	</Section>

	<Section title="The four blocks">
		<p class="prose-body">
			Almost every synthesiser ever made — analogue, digital, hardware, plugin — is these four
			things wired together. The architecture is called
			<Term>subtractive synthesis</Term>, and MIDI's controller conventions were designed around it,
			which is why they map so cleanly onto it.
		</p>
		<div class="flex flex-col gap-3">
			{#each BLOCKS as b (b.name)}
				<div class="flex flex-col gap-1.5 rounded-lg border p-4">
					<p class="text-sm font-semibold">{b.name}</p>
					<p class="text-sm leading-relaxed">{b.does}</p>
					<p class="text-sm leading-relaxed text-muted-foreground">{b.shapes}</p>
					<p class="text-xs leading-relaxed text-msg-cc">{b.cc}</p>
				</div>
			{/each}
		</div>
	</Section>

	<TryThis title="Hold a note and take it apart">
		<EngineToggle
			needs="synth"
			because="Everything below reshapes a sound while it is already sounding, and a recording cannot be reshaped — the sampled instruments will follow CC 74 and simply ignore CC 71."
		/>
		<Drone notes={[45, 52, 57]} label="Hold a chord" program={81} />
		<CcPanel controllers={[74, 71, 73, 72, 1, 91]} />
		<Scope label="What is actually coming out" height={110} />
		<p class="text-sm leading-relaxed">
			Turn <strong>CC 74</strong> down and the sound gets darker — you are closing the filter and
			removing the upper harmonics. Watch the analyser: the right-hand side of it disappears. Turn
			<strong>CC 71</strong> up and a peak appears right at the point where the filter is working. That
			peak is resonance, and sweeping 74 with 71 up is the single most recognisable gesture in electronic
			music.
		</p>
	</TryThis>

	<Section title="Why the filter is the interesting one">
		<p class="prose-body">
			A note is not one frequency. It is a <Term>harmonic series</Term> — a fundamental plus a stack of
			whole-number multiples above it — and the balance of that stack is most of what makes a trumpet
			sound different from a flute playing the same note.
		</p>
		<Harmonics />
		<p class="prose-body">
			A filter is a way of reshaping that stack from outside, without touching the pitch. That is
			why one controller can take a sound from bright to muffled and back while the notes stay
			exactly where they were, and it is why <Term>cutoff</Term> is the parameter every producer automates
			first.
		</p>
	</Section>

	<Section title="What velocity is really reaching for">
		<p class="prose-body">
			<Xref to="velocity" /> says velocity is a measurement rather than a volume control. Here is what
			the measurement usually gets wired to inside an instrument:
		</p>
		<div class="grid gap-3 sm:grid-cols-3">
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">To the amplifier</p>
				<p class="mt-1.5 text-sm leading-relaxed">Louder. The obvious one, and the least useful.</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">To the filter</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					Brighter as well as louder — which is what a real instrument does, because hitting
					something harder excites its upper harmonics more.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">To a sample</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					Chooses a different recording — a <Term>velocity layer</Term> — captured at that strength. The
					most convincing option, and the most expensive to produce.
				</p>
			</div>
		</div>
		<Callout variant="key" title="This is why velocity feels different on different instruments">
			<p>
				Nothing in MIDI says where velocity goes. An organ patch throws it away entirely; a good
				piano sample uses it to pick between a dozen recordings. Same number, same message,
				completely different instrument — the principle from
				<Xref to="control-not-sound" />, one layer down.
			</p>
		</Callout>
	</Section>

	<Section title="Samplers ignore half of this">
		<p class="prose-body">
			A <Term>sampler</Term> plays recordings rather than generating waveforms, and you cannot ask a recording
			to change its own harmonic content. So roughly half of the controller vocabulary lands and half
			does nothing.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border border-ok/30 p-4">
				<p class="text-xs font-semibold tracking-wide text-ok uppercase">Usually works</p>
				<ul class="flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed">
					<li>Volume and pan — CC 7, CC 10</li>
					<li>Filter cutoff and resonance — a filter can be put after a sample</li>
					<li>Attack and release — the player can fade in and out</li>
					<li>Pitch bend — resampling changes speed and pitch together</li>
				</ul>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border border-warn/30 p-4">
				<p class="text-xs font-semibold tracking-wide text-warn uppercase">Usually does nothing</p>
				<ul class="flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed">
					<li>Waveform selection — there is no oscillator to switch</li>
					<li>Decay — the recording already contains its own</li>
					<li>Anything asking to change the character of the tone itself</li>
				</ul>
			</div>
		</div>
		<p class="prose-body">
			The instrument in this page is both. The built-in synthesiser is subtractive and responds to
			everything above; the sampled <Xref to="programs-and-banks" label="General MIDI" /> voices are a
			sampler and respond to rather less. Try the same controller against a synth voice and a sampled
			one and you will hear the difference immediately — which is exactly the experiment
			<Xref to="envelope" /> sets up.
		</p>
	</Section>

	<TryThis title="The same melody through four architectures">
		<MelodyPlayer id="minuet-in-g" voices={[80, 0, 19, 48, 40, 73]} />
		<p class="text-sm leading-relaxed text-muted-foreground">
			A synth lead, a piano, an organ, strings, a violin, a flute. The first is generated; the rest
			are recordings. The notes are identical in every case, and so are the messages.
		</p>
	</TryThis>

	<Section title="Your turn">
		<p class="prose-body">
			Play, and adjust the controllers as you go. Everything you are hearing is being made in the
			browser by the code in <code class="rounded-sm bg-muted px-1 font-mono">src/lib/audio</code> —
			which is the same subject as <Xref to="web-audio" />, from the other side.
		</p>
		<Keyboard low={45} octaves={3} height={140} />
	</Section>

	<Quiz
		question="You sweep CC 74 down on a bright pad and the sound gets darker. What is happening?"
		options={[
			'The volume is dropping, and quieter sounds seem darker',
			'The filter is removing upper harmonics from the sound',
			'The oscillator is switching to a different waveform'
		]}
		answer={1}
		explanation="CC 74 is Brightness by convention, and it is wired to filter cutoff on essentially every instrument that responds to it. The volume is untouched — you are throwing away the top of the harmonic stack, which is a completely different thing from turning it down."
	/>

	<Quiz
		question="Why does the same velocity feel more expressive on a good piano library than on a basic synth patch?"
		options={[
			'The library has a wider dynamic range',
			'The library uses velocity to choose between different recordings, not just to set a level',
			'The library receives a higher-resolution velocity value'
		]}
		answer={1}
		explanation="Velocity is seven bits either way — the resolution is identical. The difference is what the receiver does with it: a velocity-layered library changes the tone as well as the level, which is what a real instrument does when you hit it harder."
	/>

	<Further
		refs={['mdn-webaudio', 'spec-cc']}
		lead="The controller table is the contract; the Web Audio documentation is what the instrument in this page is built out of."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="cutoff"
			label="Close the filter — send CC 74 below 40"
			hint="The Brightness knob, turned well down."
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 74 && e.message.value < 40}
		/>
		<Checkpoint
			lesson={meta.id}
			id="resonance"
			label="Add resonance — send CC 71 above 90"
			hint="Then sweep the cutoff again and listen to the peak move."
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 71 && e.message.value > 90}
		/>
		<Checkpoint
			lesson={meta.id}
			id="sweep"
			label="Sweep the filter under a held chord"
			hint="Hold the drone, then turn CC 74 through at least twenty values."
			count={20}
			key={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 74
					? String(e.message.value)
					: ''}
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 74}
		/>
		<Checkpoint
			lesson={meta.id}
			id="architectures"
			label="Hear one melody through a generated voice and a sampled one"
			hint="Pick the synth lead, play it, then pick the violin and play it again."
			count={2}
			key={(e) => (e.message.type === 'programChange' ? String(e.message.program) : '')}
			test={(e) => e.message.type === 'programChange'}
		/>
	</Checkpoints>
</LessonShell>
