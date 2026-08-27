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
	import StepSequencer from '$lib/components/midi/StepSequencer.svelte';
	import PadGrid from '$lib/components/midi/PadGrid.svelte';
	import PhrasePlayer from '$lib/components/midi/PhrasePlayer.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { noteState } from '$lib/midi/notestate.svelte';
	import type { SeqTrack } from '$lib/midi/steps';
	import type { NoteSpec } from '$lib/midi/player.svelte';

	const meta = lessonById('programming-drums')!;

	/** The eight you will reach for ninety per cent of the time. */
	const CORE = [36, 38, 42, 46, 44, 39, 51, 49];

	function track(name: string, note: number, steps: number[]): SeqTrack {
		return { id: `d-${note}`, name, note, channel: 9, steps, mute: false };
	}

	const V = 104; // an accent
	const M = 78; // an ordinary hit
	const G = 34; // a ghost

	/*
	 * The same eight-bar idea twice. The first is what somebody types in: every
	 * hit at one velocity, everything on the grid. The second is the same
	 * placement with the dynamics a drummer would actually play — accents on
	 * the backbeat, ghost notes filling the gaps, the hi-hat breathing.
	 *
	 * Nothing moves in time between them. Only the numbers change, and the
	 * difference is the entire lesson.
	 */
	const FLAT: SeqTrack[] = [
		track('Kick', 36, [M, 0, 0, 0, 0, 0, M, 0, 0, 0, M, 0, 0, 0, 0, 0]),
		track('Snare', 38, [0, 0, 0, 0, M, 0, 0, 0, 0, 0, 0, 0, M, 0, 0, 0]),
		track('Hi-hat', 42, [M, 0, M, 0, M, 0, M, 0, M, 0, M, 0, M, 0, M, 0])
	];

	const HUMAN: SeqTrack[] = [
		track('Kick', 36, [V, 0, 0, 0, 0, 0, M, 0, 0, 0, V, 0, 0, 0, 0, G]),
		track('Snare', 38, [0, 0, G, 0, V, 0, 0, G, 0, G, 0, 0, V, 0, G, 0]),
		track('Hi-hat', 42, [M, G, V, G, M, G, V, G, M, G, V, G, M, G, V, G])
	];

	/** Four bars of a hi-hat, choked and unchoked, so the difference is audible. */
	const CHOKE: NoteSpec[] = [
		{ note: 46, start: 0, duration: 1.8, velocity: 100, channel: 9 },
		{ note: 46, start: 2, duration: 1.8, velocity: 100, channel: 9 },
		{ note: 46, start: 4, duration: 0.4, velocity: 100, channel: 9 },
		{ note: 42, start: 4.5, duration: 0.2, velocity: 96, channel: 9 },
		{ note: 46, start: 5, duration: 0.4, velocity: 100, channel: 9 },
		{ note: 42, start: 5.5, duration: 0.2, velocity: 96, channel: 9 }
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Drums are the one place MIDI stops being about pitch. On a drum channel a note number does not
			mean a frequency — it means <em>which instrument</em>. Note 36 is a kick, note 38 is a snare,
			note 42 is a closed hi-hat, and playing a "chord" of 36, 38 and 42 means hitting three
			different drums at once.
		</p>
		<p class="prose-body">
			Everything else about the protocol works exactly as before: Note On starts the hit, velocity
			says how hard, and channel 10 is where the kit conventionally lives — <Xref to="channels" /> for
			why that is a convention rather than a rule.
		</p>
	</Section>

	<Section title="The map you actually need">
		<p class="prose-body">
			<Xref to="programs-and-banks" label="General MIDI" /> defines note numbers 35 to 81 as a percussion
			kit. In practice eight of them carry almost everything, and knowing these by number is worth more
			than the other thirty-nine combined.
		</p>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each CORE as n (n)}
				<div class="flex items-baseline gap-3 rounded-lg border p-3">
					<span class="tnum w-7 shrink-0 font-mono text-sm text-msg-note">{n}</span>
					<span class="text-sm">{GM_DRUMS[n]}</span>
				</div>
			{/each}
		</div>
		<Callout variant="convention" title="Only on a General MIDI kit">
			<p>
				This map is part of the General MIDI agreement, not part of MIDI. Send note 38 to a
				sample-based drum machine loaded with somebody's kit and you will get whatever is on that
				pad, which may well be a cowbell. Hardware drum machines almost never follow the GM map —
				they publish their own, in the manual, and that table is the one that matters for that box.
			</p>
		</Callout>
	</Section>

	<TryThis title="Hit some things">
		<PadGrid notes={CORE} columns={4} channel={9} />
		<p class="text-xs leading-relaxed text-muted-foreground">
			Hitting a pad low sends a lower velocity than hitting it high. Watch the dock: every one of
			these is a Note On on channel 10, and the only thing distinguishing a kick from a crash is one
			number.
		</p>
	</TryThis>

	<Section title="Velocity is the entire difference between a beat and a grid">
		<p class="prose-body">
			Here is the same pattern twice. The placement is identical — not one hit moves in time. What
			changes is the velocity of each hit.
		</p>

		<div class="flex flex-col gap-2">
			<p class="label">Every hit at the same velocity</p>
			<StepSequencer steps={16} tracks={FLAT} />
		</div>

		<div class="flex flex-col gap-2">
			<p class="label">The same hits, played rather than typed</p>
			<StepSequencer steps={16} tracks={HUMAN} />
		</div>

		<Callout variant="key" title="Accents and ghosts">
			<p>
				The second pattern uses three levels rather than one. <strong>Accents</strong> around 104 on
				the backbeat and the strong kicks. <strong>Ordinary hits</strong> around 78.
				<strong><Term>Ghost notes</Term></strong> around 34 — so quiet you feel them rather than hear
				them, filling the gaps between the real hits.
			</p>
			<p class="mt-2">
				A drummer cannot physically strike two notes at the same strength, and a listener knows it.
				Three levels is the minimum for a pattern that does not sound typed; a real programmer of
				drums uses a dozen.
			</p>
		</Callout>

		<p class="prose-body">
			The other half is timing, and it belongs to <Xref to="ppqn-and-groove" />: nudging the snare a
			few milliseconds late, or swinging the hi-hats, does as much as velocity does. Both are the
			same idea — deviation from the grid is what the ear reads as a human.
		</p>
	</Section>

	<Section title="Hi-hats, and the one drum with state">
		<p class="prose-body">
			Every other drum is a one-shot: it starts, it rings, it stops when it stops, and its Note Off
			is meaningless. A hi-hat is not. It is two cymbals with a pedal between them, and an open
			hi-hat has to <em>stop</em> when the pedal closes.
		</p>
		<p class="prose-body">
			GM handles this by putting the three hi-hat states on three note numbers — 42 closed, 44
			pedal, 46 open — and expecting the receiver to treat them as one exclusive group. Sending 42
			while 46 is ringing cuts the open hat off. That is a <em>choke group</em>, and it is behaviour
			in the instrument rather than anything the protocol expresses.
		</p>
		<!-- Channel 10 is the kit; there is no melodic program to choose. -->
		<PhrasePlayer
			notes={CHOKE}
			bpm={100}
			label="Two open hats, then two choked"
			variant="default"
			channel={9}
			program={null}
		/>
		<p class="text-sm leading-relaxed text-muted-foreground">
			The first two ring out. The last two are cut off by a closed hat landing on the off-beat after
			them, which is the sound of almost every drum groove ever recorded.
		</p>
		<Callout variant="gotcha" title="Note length does almost nothing on a drum channel">
			<p>
				Draw a two-bar-long kick in your <Xref to="in-the-daw" label="piano roll" /> and it will not sustain
				for two bars. Sample playback ignores Note Off entirely on most drum instruments — the sample
				runs to its end. This is why a drum grid shows squares rather than bars, and why the
				<Xref to="envelope" /> lesson's warning that "Note Off is not silence" cuts both ways here.
			</p>
		</Callout>
	</Section>

	<TryThis title="Build one">
		<p class="text-sm leading-relaxed">
			Start from the kick on 1 and the snare on 3. Then add hi-hats and vary their velocities —
			click a step twice to cycle it. Everything you place is a Note On on channel 10, and you can
			export the result as a <Xref to="midi-files" label="Standard MIDI File" /> and open it in your DAW.
		</p>
		<StepSequencer steps={16} />
	</TryThis>

	<Section title="Programming drums that do not sound programmed">
		<ol class="prose-body flex list-decimal flex-col gap-2.5 pl-5">
			<li>
				<strong>Never leave two identical velocities in a row.</strong> This one change does more than
				every other item on this list put together.
			</li>
			<li>
				<strong>Put ghost notes between the real hits.</strong> A snare at velocity 30 on the sixteenths
				either side of the backbeat is what makes a pattern feel like it is being played.
			</li>
			<li>
				<strong>Accent the backbeat, not everything.</strong> If every hit is loud, none of them is.
			</li>
			<li>
				<strong>Move the snare a few milliseconds late.</strong> Almost every groove that feels good has
				a snare fractionally behind the grid. Three to eight milliseconds is plenty.
			</li>
			<li>
				<strong>Use the whole kit.</strong> A ride is not a hi-hat; a rim shot is not a snare. The GM
				map has forty-seven sounds and most programmed drums use four.
			</li>
			<li>
				<strong>Check for velocity layers.</strong> A well-sampled kit has a different recording at
				each strength — see <Term>velocity layer</Term>. If yours only gets louder rather than also
				changing tone, the instrument is doing the cheap thing and no amount of programming will fix
				it.
			</li>
		</ol>
	</Section>

	<Quiz
		question="You copy a drum part from a General MIDI song into your favourite sampler's kit, and every drum is wrong."
		options={[
			'The MIDI file is corrupt',
			'The sampler maps note numbers to its own pads, which are not the GM map',
			'The part is on the wrong channel'
		]}
		answer={1}
		explanation="The note numbers came through perfectly — they just mean something else on the receiving instrument. This is the whole 'the receiver decides' principle applied to percussion, and it is why hardware manuals print a drum map."
	/>

	<Quiz
		question="Which of these makes the biggest difference to whether a programmed beat sounds human?"
		options={['Choosing better drum samples', 'Varying the velocity of every hit', 'Adding reverb']}
		answer={1}
		explanation="Samples and reverb change what it sounds like; a column of identical velocities is what makes it sound machine-made. Fix the numbers first — the same kit with three velocity levels and some ghost notes will outperform a better kit played flat."
	/>

	<Further
		refs={['spec-gm', 'wikipedia-gm', 'spec-gm2']}
		lead="The percussion map is defined in the General MIDI agreement rather than in MIDI itself, and GM 2 extends it considerably."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="kick"
			label="Trigger a kick — note 36 on channel 10"
			hint="Bottom-left pad, or the first step sequencer row."
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 9 && e.message.note === 36}
		/>
		<Checkpoint
			lesson={meta.id}
			id="kit"
			label="Use four different drums in one session"
			hint="Any four distinct note numbers on channel 10."
			count={4}
			key={(e) => (e.message.type === 'noteOn' ? String(e.message.note) : '')}
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 9}
		/>
		<Checkpoint
			lesson={meta.id}
			id="dynamics"
			label="Hit the same drum at three different strengths"
			hint="Pads send a lower velocity when you press near the bottom of one."
			count={3}
			key={(e) =>
				e.message.type === 'noteOn' && e.message.channel === 9
					? String(Math.floor((e.message.velocity - 1) / 43))
					: ''}
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 9}
		/>
		<Checkpoint
			lesson={meta.id}
			id="flam"
			label="Hit two drums at once"
			hint="Two pads together — on a drum channel that is a chord."
			test={() => noteState.heldCount >= 2}
		/>
	</Checkpoints>
</LessonShell>
