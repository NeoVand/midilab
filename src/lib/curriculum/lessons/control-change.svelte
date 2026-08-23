<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import CcPanel from '$lib/components/midi/CcPanel.svelte';
	import CcLearn from '$lib/components/midi/CcLearn.svelte';
	import Drone from '$lib/components/midi/Drone.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { ccInfo, ESSENTIAL_CCS } from '$lib/midi/constants';
	import { combine14 } from '$lib/midi/messages';
	import { noteState } from '$lib/midi/notestate.svelte';

	const meta = lessonById('control-change')!;

	function staircase(steps: number, width = 240, height = 64): string {
		const pts: string[] = [];
		for (let i = 0; i < steps; i++) {
			const x0 = (i / steps) * width;
			const x1 = ((i + 1) / steps) * width;
			const y = height - ((i + 0.5) / steps) * height;
			pts.push(`${x0},${y} ${x1},${y}`);
		}
		return 'M ' + pts.join(' L ');
	}
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-base leading-relaxed">
			Notes are only half of a performance. The other half is everything you do <em>while</em> the
			note is sounding: opening a filter, leaning on the mod wheel, pushing the sustain pedal,
			swelling a phrase. All of that travels as <strong>Control Change</strong> — status
			<code class="rounded-sm bg-muted px-1 font-mono">0xBn</code>, then a controller number 0–127,
			then a value 0–127.
		</p>
		<ByteInspector bytes={[0xb0, 74, 96]} />
	</Section>

	<Callout variant="convention" title="This is the part people get wrong">
		<p>
			CC 74 means "brightness" the way <em>Mr</em> means "man" — by widespread agreement, not by law.
			The MIDI specification defines a handful of controllers strictly (the pedals, the mode messages,
			the data-entry mechanism) and recommends meanings for many more. A synthesiser in its own native
			mode is free to map CC 74 to tape speed if it likes, and some do.
		</p>
		<p class="mt-2">
			So there are two questions you will ask for the rest of your MIDI life, and they have
			different answers: <strong>"what does the spec suggest?"</strong> and
			<strong>"what does this device actually do?"</strong> The second is answered only by the device's
			MIDI implementation chart — or by wiggling a knob and watching, which is what the tool further down
			does.
		</p>
	</Callout>

	<Section title="The nine worth memorising">
		<p class="text-base leading-relaxed">
			There are 128 controllers. You will use roughly nine of them nine tenths of the time.
		</p>
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<thead class="label bg-muted/50">
					<tr>
						<th class="w-14 px-3 py-2 text-left font-medium">CC</th>
						<th class="px-3 py-2 text-left font-medium">Name</th>
						<th class="px-3 py-2 text-left font-medium">What it is for</th>
					</tr>
				</thead>
				<tbody>
					{#each ESSENTIAL_CCS as cc (cc)}
						<tr class="border-t">
							<td class="px-3 py-2 font-mono text-msg-cc">{cc}</td>
							<td class="px-3 py-2">{ccInfo(cc).short}</td>
							<td class="px-3 py-2 text-xs leading-snug text-muted-foreground">
								{ccInfo(cc).description ?? ccInfo(cc).name}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Callout variant="gotcha" title="Volume versus Expression">
			<p>
				CC 7 is the channel's mix fader — set it once and leave it. CC 11 is a percentage
				<em>of</em> that fader, meant to move constantly for swells and phrasing. Using CC 7 for performance
				dynamics works until you try to balance a mix, at which point you discover your levels are also
				your musical expression and you cannot change one without ruining the other.
			</p>
		</Callout>
	</Section>

	<TryThis title="Turn some knobs">
		<p class="text-sm leading-relaxed">
			Start a drone, then move the controls. Every knob turn is a real Control Change going to every
			output enabled in the dock — including your hardware, if it is connected.
		</p>
		<div class="flex flex-wrap items-center gap-3">
			<Drone notes={[40, 52, 55, 59]} label="Hold a chord" />
			<span class="text-xs text-muted-foreground">
				Cutoff and resonance are the two that will feel most dramatic.
			</span>
		</div>
		<CcPanel />
		<Keyboard low={40} octaves={3} height={110} typing={false} />
	</TryThis>

	<Section title="Seven bits is not very many">
		<p class="text-base leading-relaxed">
			A controller value has 128 possible positions. For a pan knob that is plenty. For a filter
			sweep across ten octaves it is 12.8 steps per octave — and if the receiver applies each value
			instantly, a slow sweep becomes an audible staircase. Engineers call the artefact
			<strong>zipper noise</strong>.
		</p>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">7-bit · 128 steps</p>
				<svg viewBox="0 0 240 64" class="mt-3 w-full">
					<path
						d={staircase(16)}
						fill="none"
						stroke="var(--msg-cc)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
					/>
				</svg>
				<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
					Drawn at 16 steps so you can see it. The real thing has 128 — better, but still steps.
				</p>
			</div>
			<div class="rounded-lg border border-msg-note/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					14-bit · 16,384 steps
				</p>
				<svg viewBox="0 0 240 64" class="mt-3 w-full">
					<path
						d={staircase(120)}
						fill="none"
						stroke="var(--msg-note)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
					/>
				</svg>
				<p class="mt-2 text-xs leading-relaxed text-muted-foreground">
					Effectively continuous. Achieved by pairing two controllers.
				</p>
			</div>
		</div>

		<p class="text-base leading-relaxed">
			MIDI's answer is the <strong>MSB/LSB pair</strong>. Controllers 0–31 each have a partner 32
			higher: CC 1 is the coarse half of the mod wheel and CC 33 is the fine half. Send both and the
			receiver combines them:
		</p>
		<div
			class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-surface-sunken p-4 font-mono text-sm"
		>
			<span
				><span class="text-msg-cc">CC 1</span> = 100
				<span class="text-muted-foreground">(MSB)</span></span
			>
			<span
				><span class="text-msg-cc">CC 33</span> = 45
				<span class="text-muted-foreground">(LSB)</span></span
			>
			<span class="text-muted-foreground">→</span>
			<span
				>(100 &lt;&lt; 7) | 45 = <span class="text-msg-note">{combine14(100, 45)}</span> of 16383</span
			>
		</div>
		<Callout variant="gotcha" title="Almost nobody does this">
			<p>
				14-bit CC is rare in practice: it doubles the message rate on a slow wire, and most devices
				ignore the LSB entirely. The places you <em>will</em> meet 14 bits are pitch bend, which is always
				14-bit, and NRPNs, which are the proper mechanism for deep parameter editing. Both are coming
				up next.
			</p>
			<p class="mt-2">
				The practical mitigation for zipper noise is at the receiving end: a well-built instrument
				smooths incoming controller values over a few milliseconds instead of jumping. The synth in
				this page does exactly that, which is why the cutoff knob above feels continuous.
			</p>
		</Callout>
	</Section>

	<TryThis title="Learn your own hardware">
		<p class="text-sm leading-relaxed">
			Connect a controller in the dock, enable it as an input, then move something on it. This will
			tell you what it actually sends — which is the only authority that matters.
		</p>
		<CcLearn />
		<p class="text-xs leading-relaxed text-muted-foreground">
			Watch the range column. A knob that reports 0–127 is a full-range absolute control; one that
			hovers around 64 is probably an endless encoder sending relative increments, which is a
			different beast entirely.
		</p>
	</TryThis>

	<Quiz
		question="You automate CC 74 on your sequencer to sweep a filter. It works perfectly on your software synth and does nothing on your Korg. Why is the most likely reason?"
		options={[
			'The MIDI cable cannot carry Control Change',
			'The Korg maps its filter cutoff to a different controller, or to an NRPN',
			'CC 74 only works on channel 1',
			'The sequencer is sending 14-bit and the Korg only reads 7-bit'
		]}
		answer={1}
		explanation="CC 74 as cutoff is a General MIDI recommendation. Hardware synths in their native modes very often use their own numbering, or expose deep parameters only through NRPN or SysEx. The fix is the implementation chart — or the learn tool above."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="cc74"
			label="Send CC 74"
			hint="The Cutoff knob."
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 74}
		/>
		<Checkpoint
			lesson={meta.id}
			id="sweep"
			label="Sweep a single controller through at least 30 different values"
			hint="Drag one knob slowly across its full range."
			count={30}
			key={(e) =>
				e.message.type === 'controlChange' ? `${e.message.controller}:${e.message.value}` : ''}
			test={(e) => e.message.type === 'controlChange'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="four-ccs"
			label="Use four different controllers"
			count={4}
			key={(e) => (e.message.type === 'controlChange' ? String(e.message.controller) : '')}
			test={(e) => e.message.type === 'controlChange' && e.message.controller < 120}
		/>
		<Checkpoint
			lesson={meta.id}
			id="while-held"
			label="Change a controller while a note is sounding"
			hint="Start the drone, then turn a knob."
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller < 120 && noteState.heldCount > 0}
		/>
	</Checkpoints>
</LessonShell>
