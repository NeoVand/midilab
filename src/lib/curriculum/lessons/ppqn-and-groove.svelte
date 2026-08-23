<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import GrooveLab from '$lib/components/midi/GrooveLab.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { PPQ, CLOCK_PPQ } from '$lib/midi/clock.svelte';

	const meta = lessonById('ppqn-and-groove')!;
	let swing = $state(50);

	const RESOLUTIONS: Array<[string, number, string]> = [
		['MIDI Clock on the wire', 24, 'Fixed by the specification since 1983. Not negotiable.'],
		['Standard MIDI File, typical', 480, 'Chosen per file, written in the header.'],
		['This app’s sequencer', PPQ, 'Fine enough for the grid, cheap enough to schedule.'],
		[
			'Teenage Engineering OP-XY',
			1920,
			'Deep internal resolution for polyrhythm and micro-timing.'
		],
		['Many DAWs', 960, 'Ableton, Logic and friends sit in this region.']
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Two numbers get called "PPQN" and they are not the same number. Confusing them makes timing
			arguments unresolvable, so let us separate them once and for all.
		</p>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border border-msg-clock/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-clock uppercase">
					Transmission resolution — {CLOCK_PPQ} PPQN
				</p>
				<p class="text-sm leading-relaxed">
					How often the clock byte goes down the wire. Fixed at 24 by the MIDI specification.
					Nothing you own changes it, and nothing needs to.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border border-msg-note/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					Sequencer resolution — whatever you like
				</p>
				<p class="text-sm leading-relaxed">
					How finely a sequencer can place an event <em>between</em> those ticks. 480, 960, 1920 — entirely
					internal, entirely up to the device.
				</p>
			</div>
		</div>
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<thead class="label bg-muted/50">
					<tr>
						<th class="px-3 py-2 text-left font-medium">Where</th>
						<th class="w-20 px-3 py-2 text-right font-medium">PPQN</th>
						<th class="hidden px-3 py-2 text-left font-medium sm:table-cell">Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each RESOLUTIONS as [where, ppqn, note] (where)}
						<tr class="border-t">
							<td class="px-3 py-2">{where}</td>
							<td class="tnum px-3 py-2 text-right font-mono">{ppqn}</td>
							<td class="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Callout variant="key" title="High internal resolution still helps">
			<p>
				"But the wire is only 24 PPQN, so why does 1920 matter?" Because the wire carries
				<em>clock</em>, not your notes. A follower receives ticks at 24 PPQN and then places its own
				events on its own fine grid, interpolating between them. Micro-timing, swing and polyrhythm
				all live in that interpolation.
			</p>
		</Callout>
	</Section>

	<Section title="Quantisation">
		<p class="prose-body">
			Quantising moves each note to the nearest point on a grid. It is the most useful and most
			overused feature in every sequencer ever made, because perfectly-gridded music is also
			perfectly lifeless music — the thing that makes a groove feel human is precisely the small
			deviations quantising removes.
		</p>
		<p class="prose-body">
			Most sequencers therefore offer <strong>quantise strength</strong>: move each note 50% of the
			way to the grid rather than all of it. Tighten without flattening.
		</p>
	</Section>

	<Section title="Swing is arithmetic">
		<p class="prose-body">
			Swing has a reputation for being mystical. It is not. Take the sixteenth-note grid and delay
			every <em>second</em> sixteenth by a fraction of its own length. The dial everyone uses says 50%
			for a straight grid and 66% for a triplet feel — that is the swung sixteenth sitting two thirds
			of the way between its neighbours instead of halfway. Past that it starts to limp.
		</p>
		<TryThis title="Turn the knobs and listen">
			<GrooveLab bind:swing />
			<p class="text-xs leading-relaxed text-muted-foreground">
				Swing moves alternate notes by a fixed amount, so it stays locked to the grid — the groove
				is repeatable. Humanise adds a random offset to every note, which never repeats and is a
				much cruder tool. Most of the time you want swing.
			</p>
		</TryThis>
	</Section>

	<Callout variant="gotcha" title="Swing on the leader does not swing the followers">
		<p>
			Swing is applied to <em>note placement</em>, not to the clock. If your groovebox swings its
			own sequencer, its clock output stays perfectly even — so an external synth's arpeggiator
			running off that clock will play straight. If you need the whole rig to swing, every device
			must apply its own swing, or the parts must be sequenced from one place.
		</p>
	</Callout>

	<Section title="Where the resolution actually runs out">
		<p class="prose-body">
			At 120 BPM a quarter note is 500 ms, so one clock tick is about 20.8 ms — clearly audible as a
			placement error if that were your grid. At 480 PPQN a tick is about 1 ms, which is below the
			threshold at which most people hear placement differences. At 1920 it is a quarter of that.
		</p>
		<p class="prose-body">
			So sequencer resolution stops mattering fairly quickly, and something else takes over as the
			limiting factor: how reliably the events actually leave the machine at the time they were
			scheduled for. That is jitter, and it is Lesson 17.
		</p>
	</Section>

	<Quiz
		question="Your DAW sequences at 960 PPQN. What resolution does it send MIDI Clock at?"
		options={['960 PPQN', '480 PPQN', '24 PPQN', 'Whatever the follower requests']}
		answer={2}
		explanation="Always 24. The clock rate is fixed by the specification and has nothing to do with the sequencer's internal grid. A follower receives 24 ticks per quarter note and interpolates its own events between them."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="play"
			label="Play the loop"
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 9}
		/>
		<Checkpoint
			lesson={meta.id}
			id="swing"
			label="Hear the difference between straight and swung"
			hint="Play the loop, then push swing past 50% — 66% is triplet."
			count={2}
			key={() => (swing > 52 ? 'swung' : 'straight')}
			test={(e) => e.message.type === 'noteOn' && e.message.note === 42}
		/>
		<Checkpoint
			lesson={meta.id}
			id="distinguish"
			label="Say out loud which number is fixed at 24 and which one you choose"
			hint="Tick this yourself once you are sure. Transmission is fixed; sequencing is yours."
		/>
	</Checkpoints>
</LessonShell>
