<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import EnvelopeLab from '$lib/components/midi/EnvelopeLab.svelte';
	import CcPanel from '$lib/components/midi/CcPanel.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import Drone from '$lib/components/midi/Drone.svelte';
	import EngineToggle from '$lib/components/midi/EngineToggle.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { gm } from '$lib/audio/gm.svelte';
	import { GM_PROGRAMS } from '$lib/midi/constants';
	import type { MidiEvent } from '$lib/midi/bus';
	import { lessonById } from '$lib/curriculum/registry';

	const meta = lessonById('envelope')!;

	/**
	 * Three patches with very different envelopes, so the relative controllers
	 * further down can be caught being relative. Sending a Program Change is
	 * also the honest way to switch: the voice is not a setting in this page,
	 * it is a message, and it goes to your hardware too.
	 */
	const VOICES = [0, 48, 24];
	let voice = $state(0);

	function pickVoice(p: number) {
		voice = p;
		engine.programChange(p);
		gm.load(p);
	}

	/**
	 * Four instruments, one distinguishing fact each. The point of the table is
	 * that none of these differences is a MIDI difference — the same two
	 * messages produce all four.
	 */
	const SHAPES = [
		{
			name: 'Organ',
			shape: 'On, then off',
			what: 'No attack to speak of, no decay, full sustain. The key is a switch, and holding it longer is the only expression available.'
		},
		{
			name: 'Plucked string',
			shape: 'Down from the start',
			what: 'Sustain is zero. It fades to nothing whether or not you keep holding, which is why guitar parts sound wrong when they are held like organ parts.'
		},
		{
			name: 'Piano',
			shape: 'Struck, then falling',
			what: 'A long decay towards a low sustain, and a release that is the damper landing. Lift the key early and you hear the damper, not silence.'
		},
		{
			name: 'Bowed string',
			shape: 'Eased in and out',
			what: 'A slow attack, because a bow takes time to set the string going. The reason string libraries feel late is that their attack is honest.'
		}
	];

	/**
	 * The lesson's one real gotcha, as a checkpoint: envelope times are stamped
	 * on a note when it starts, so a Sound Controller only means something to
	 * the note that comes after it. Passing this requires doing them in that
	 * order — which is the order people get wrong.
	 */
	const ENVELOPE_CC = new Set([72, 73, 75]);
	let reshaped = false;

	function reshapedThenPlayed(e: MidiEvent): boolean {
		const m = e.message;
		if (m.type === 'controlChange' && ENVELOPE_CC.has(m.controller)) {
			reshaped = true;
			return false;
		}
		return reshaped && m.type === 'noteOn' && m.velocity > 0;
	}
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			MIDI sends two instants: key down, key up. But sound is not made of instants — it starts, it
			changes while it lasts, and it takes time to stop. Everything in the gap between those two
			messages is the instrument's own business, and the thing doing that business is called an
			<strong>envelope</strong>.
		</p>
		<p class="prose-body">
			This is the seam the whole course keeps arriving at from different directions. Note Off does
			not mean silence; velocity feels like dynamics rather than volume; two synths playing the
			identical file sound nothing alike. All three are facts about the envelope, and none of them
			are facts about MIDI.
		</p>
	</Section>

	<TryThis title="Hold a note and watch what the instrument does with it">
		<p class="text-sm leading-relaxed">
			Four numbers, and they are the difference between an organ and a harp. Drag the handles, or
			press a preset — then <em>hold</em> the button rather than clicking it, because the length of the
			note is yours and the shape is the instrument's.
		</p>
		<EnvelopeLab />
	</TryThis>

	<Section title="Three times and a level">
		<p class="prose-body">
			ADSR is the near-universal shorthand, and it hides a trap in plain sight: three of the four
			are durations and one is not.
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-1.5 rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					Attack · Decay · Release
				</p>
				<p class="text-sm leading-relaxed">
					How long it takes to reach full level, how long it takes to fall from there, and how long
					it takes to fade after you let go. Measured in milliseconds.
				</p>
			</div>
			<div class="flex flex-col gap-1.5 rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-warn uppercase">Sustain</p>
				<p class="text-sm leading-relaxed">
					A <em>level</em>, not a time. It is how loud the note settles to while you are still
					holding it, and it lasts exactly as long as you hold. Sustain of zero means the note fades
					out under your finger.
				</p>
			</div>
		</div>
		<Callout variant="gotcha" title="Sustain the level is not sustain the pedal">
			<p>
				The sustain pedal is CC 64, and it does something completely different: it stops Note Off
				from starting the release at all, so notes keep ringing after you lift your hands. Two
				unrelated ideas, one word, and both of them are in every synthesiser. If a conversation
				about sustain is going badly, this is usually why.
			</p>
		</Callout>
	</Section>

	<Section title="The same two messages, four instruments">
		<p class="prose-body">
			Nothing in this table is transmitted. A Note On for note 60 at velocity 90 is the same six
			bytes in all four cases — the difference is entirely on the receiving end, which is what
			"control, not sound" means when you get down to it.
		</p>
		<dl class="divide-y rounded-lg border">
			{#each SHAPES as s (s.name)}
				<div class="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
					<dt class="flex flex-col">
						<span class="text-sm font-medium">{s.name}</span>
						<span class="text-2xs text-muted-foreground">{s.shape}</span>
					</dt>
					<dd class="text-sm leading-relaxed text-muted-foreground">{s.what}</dd>
				</div>
			{/each}
		</dl>
	</Section>

	<Callout variant="key" title="Why Note Off does not stop the sound">
		<p>
			Note Off does not mean "be silent". It means "the key came up", and the instrument answers by
			entering the release stage of the envelope — which takes as long as the patch says it takes.
			On a pad that is two seconds. This is not a bug and there is no message that means "stop
			immediately and honestly", which is exactly why All Sound Off exists as a separate, blunter
			instruction from <Xref to="panic" label="All Notes Off" />.
		</p>
	</Callout>

	<Section title="Where MIDI does reach in">
		<p class="prose-body">
			The envelope is the instrument's, but the protocol has three controllers that lean on it. They
			are <Xref to="programs-and-banks" label="General MIDI" /> Level 2 Sound Controllers, and they are
			<em>relative</em>: 64 means "whatever the patch already says", lower is shorter, higher is
			longer. A device that ignores them still behaves correctly, which is both the reason they are
			safe to send and the reason you cannot rely on them.
		</p>
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="border-b bg-surface-sunken">
					<tr class="text-left">
						<th class="px-4 py-2 font-medium">CC</th>
						<th class="px-4 py-2 font-medium">Name</th>
						<th class="px-4 py-2 font-medium">Reaches</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each [[73, 'Attack Time', 'How long the note takes to speak'], [75, 'Decay Time', 'How long it takes to settle to the sustain level'], [72, 'Release Time', 'How long it rings after Note Off'], [74, 'Brightness', 'The filter, not the envelope — but it is the one that gets used'], [71, 'Timbre / Harmonic Content', 'Resonance at the filter cutoff']] as [cc, name, what] (cc)}
						<tr>
							<td class="tnum px-4 py-2 font-mono text-msg-cc">{cc}</td>
							<td class="px-4 py-2">{name}</td>
							<td class="px-4 py-2 text-muted-foreground">{what}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Callout variant="gotcha" title="They land at Note On, not mid-note">
			<p>
				Envelope times are stamped on a note when it starts. Sending CC 73 while a note is sounding
				changes the <em>next</em> note, not this one — unlike CC 74, which moves a filter that is already
				open and is therefore the controller people reach for when they want something to happen right
				now.
			</p>
		</Callout>
	</Section>

	<TryThis title="Reshape this instrument from the wire">
		<p class="text-sm leading-relaxed">
			These knobs send real Control Changes, and the instrument answers whichever of them it can.
			Pick a voice, turn Release up, hold a chord and let go — the sound outlives your hands. Then
			change the receiver and turn the same knobs again.
		</p>
		<EngineToggle />
		<div class="flex flex-wrap gap-1.5">
			{#each VOICES as p (p)}
				<button
					type="button"
					onclick={() => pickVoice(p)}
					aria-pressed={voice === p}
					class="rounded-md border px-2.5 py-1 text-xs transition-colors hover:border-foreground/30 hover:bg-accent aria-pressed:border-transparent aria-pressed:bg-foreground aria-pressed:text-background"
				>
					{GM_PROGRAMS[p]}
				</button>
			{/each}
		</div>
		<CcPanel controllers={[73, 75, 72, 74]} />
		<div class="flex flex-wrap items-center gap-3">
			<Drone notes={[48, 55, 60, 64]} label="Hold a chord" />
			<span class="text-xs text-muted-foreground">
				Attack and Decay are heard on the note <em>after</em> the change, not the one already sounding.
			</span>
		</div>
		<Keyboard low={48} octaves={3} height={120} />
		<Callout variant="key" title="Relative means it depends on the patch">
			<p>
				Send the same CC 73 to all three voices and compare. On the strings it is dramatic; on the
				piano, whose attack is two milliseconds to begin with, even the maximum is still fast. These
				controllers scale what the patch already is rather than setting it, which is why they are
				safe to send blind and no use at all for specifying a sound.
			</p>
		</Callout>
	</TryThis>

	<Section title="Half of them land on a sampler, and it is always the same half">
		<p class="prose-body">
			Switch the receiver above to the sampled instruments and turn the knobs again. Release and
			Brightness still work. Attack and Decay do nothing at all, and no amount of sending them
			harder will change that: the attack of a recorded trumpet is a recording of a trumpet
			starting, and there is no parameter inside it to turn.
		</p>
		<p class="prose-body">
			This is not a shortcoming of this page. It is the shape of the whole era. The Sound
			Controllers were written for synthesisers, and by the time General MIDI Level 2 arrived the
			boxes people actually owned were sample players — which is why CC 73 has a reputation for
			being ignored, and why nobody sequences with it. A message being defined, transmitted
			correctly and received correctly does not oblige anything to happen.
		</p>
		<Callout variant="note" title="What a sample player can be told">
			<p>
				Release, because the tail is a fade the player applies. Brightness, because a filter can be
				put after anything — though only downwards, since a recording is exactly as bright as it was
				recorded. Sustain-pedal behaviour, because that is about when notes stop rather than what
				they sound like. Everything else in the envelope was decided by whoever held the microphone.
			</p>
		</Callout>
	</Section>

	<Section title="What velocity is really doing">
		<p class="prose-body">
			Two lessons ago, velocity was described as making a note louder and brighter. Now it can be
			said properly: on almost every instrument worth the name, velocity scales the envelope's peak
			<em>and</em> the depth of a second envelope aimed at the filter. Hit harder and the filter opens
			further, so more of the harmonic series gets through before the decay closes it again.
		</p>
		<p class="prose-body">
			That is why a hard note is not a quiet note turned up. Turning it up raises every partial by
			the same amount; playing it harder changes which partials are there at all — and your ears
			have known the difference since long before anyone gave it a name.
		</p>
	</Section>

	<Further
		refs={['spec-cc', 'mdn-webaudio']}
		lead="The Sound Controllers as defined, and the API the instrument on this page shapes its envelopes with."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="attack"
			label="Send CC 73 — change how long the next note takes to speak"
			hint="Turn the Attack knob above."
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 73}
		/>
		<Checkpoint
			lesson={meta.id}
			id="release"
			label="Send CC 72 — change how long a note rings after you let go"
			hint="Turn the Release knob, then hold a chord and let go."
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 72}
		/>
		<Checkpoint
			lesson={meta.id}
			id="then-play"
			label="Reshape a voice and then play it — the controller first, the note second"
			hint="A Sound Controller changes the next note, never the one already sounding."
			test={reshapedThenPlayed}
		/>
	</Checkpoints>
</LessonShell>
