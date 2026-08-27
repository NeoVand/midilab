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
	import TuningLab from '$lib/components/midi/TuningLab.svelte';
	import CircleOfFifths from '$lib/components/midi/CircleOfFifths.svelte';
	import RpnLab from '$lib/components/midi/RpnLab.svelte';
	import Harmonics from '$lib/components/midi/Harmonics.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import Scope from '$lib/components/midi/Scope.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { noteToFrequency } from '$lib/midi/notes';

	const meta = lessonById('tuning')!;

	/** Derived, not typed: a table of constants can disagree with its own maths. */
	const INTERVALS = [
		{ name: 'Octave', semitones: 12, ratio: [2, 1] },
		{ name: 'Perfect fifth', semitones: 7, ratio: [3, 2] },
		{ name: 'Perfect fourth', semitones: 5, ratio: [4, 3] },
		{ name: 'Major third', semitones: 4, ratio: [5, 4] },
		{ name: 'Minor third', semitones: 3, ratio: [6, 5] },
		{ name: 'Harmonic seventh', semitones: 10, ratio: [7, 4] }
	].map((v) => ({
		...v,
		error: 1200 * Math.log2(v.ratio[0] / v.ratio[1]) - v.semitones * 100
	}));

	const A440 = noteToFrequency(69);
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Twelve equal steps to the octave is not a law of nature. It is a compromise made for
			keyboards, it is about three hundred years old, and it is slightly wrong on purpose in a way
			you can measure and hear.
		</p>
		<p class="prose-body">
			MIDI inherits it as a default — note 69 is 440 Hz and every semitone is the twelfth root of
			two above the last — but it also carries three separate mechanisms for disagreeing with it.
			One of them is genuinely good, and almost nobody knows it exists.
		</p>
	</Section>

	<Section title="Where the intervals actually come from">
		<p class="prose-body">
			A single note is a stack: a fundamental plus whole-number multiples of it. The intervals
			musicians name are the ratios already sitting inside that stack — an octave is 2:1, a fifth
			3:2, a major third 5:4. They sound consonant because they are literally already there.
		</p>
		<Harmonics />
		<p class="prose-body">
			So a tuning built from those exact ratios ought to be the obvious choice. It is, right up
			until you try to build a keyboard out of it.
		</p>
	</Section>

	<Section title="Why we gave that up">
		<p class="prose-body">
			Stack twelve pure fifths and you should arrive back where you started, twelve octaves up. You
			do not. Twelve fifths of 3:2 land about a quarter of a semitone above seven octaves — a gap
			known as the Pythagorean comma, and it does not close no matter how you rearrange it.
		</p>
		<CircleOfFifths minors={false} />
		<p class="prose-body">
			That circle only closes because we made it. Twelve pure fifths overshoot seven octaves by the
			comma above, so the drawing is a small lie told twelve times — each fifth shaved by about two
			cents until the ends meet. Every key on the circle is equally usable and not one of them is
			quite in tune.
		</p>
		<p class="prose-body">
			So a fixed keyboard has to choose. Tune it purely for one key and it is glorious in that key
			and unusable three keys away. <Term>Equal temperament</Term> takes the opposite deal: divide the
			octave into twelve identical steps, make every key equally usable, and pay for it by putting almost
			every interval slightly off its pure ratio.
		</p>
		<div class="overflow-x-auto">
			<table class="w-full min-w-[30rem] border-collapse text-sm">
				<thead>
					<tr class="border-b text-left">
						<th class="py-2 pr-4 font-medium">Interval</th>
						<th class="py-2 pr-4 font-medium">Pure</th>
						<th class="py-2 pr-4 font-medium">Semitones</th>
						<th class="py-2 font-medium">Error</th>
					</tr>
				</thead>
				<tbody>
					{#each INTERVALS as v (v.name)}
						<tr class="border-b border-border/50">
							<td class="py-2 pr-4">{v.name}</td>
							<td class="tnum py-2 pr-4 font-mono text-muted-foreground">
								{v.ratio[0]}:{v.ratio[1]}
							</td>
							<td class="tnum py-2 pr-4 font-mono text-muted-foreground">{v.semitones}</td>
							<td class="tnum py-2 font-mono">
								{#if Math.abs(v.error) < 0.5}
									<span class="text-ok">exact</span>
								{:else}
									<span class={Math.abs(v.error) > 10 ? 'text-warn' : 'text-muted-foreground'}>
										{v.error > 0 ? '+' : ''}{v.error.toFixed(1)}
										<span class="text-2xs">cents</span>
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="prose-body">
			The octave is exact because it is the one interval the system is defined by. The fifth is two
			cents out, which nobody can hear. The major third is fourteen cents out, which everybody can —
			and the harmonic seventh is a third of a semitone away, which is why it sounds wrong on a
			piano and right on a horn.
		</p>
		<Callout variant="note" title="Cents, and how small a cent is">
			<p>
				A <Term>cent</Term> is a hundredth of a semitone; 1200 to the octave. Trained listeners start
				noticing a mistuned sustained note somewhere around five cents, and a beating interval well below
				that. Fourteen cents on a third is not a rounding error — it is the faint shimmer you have heard
				on every piano chord of your life without knowing it was there.
			</p>
		</Callout>
	</Section>

	<TryThis title="Hear the compromise">
		<TuningLab />
		<Scope label="Watch the beating" height={110} />
		<p class="text-sm leading-relaxed">
			Play them one after the other. The equal-tempered triad has a slow pulsing in it — that is the
			third beating against the harmonics of the root. The pure one locks solid and sounds
			noticeably calmer. Both are C major.
		</p>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Note how it is done: one note per channel, each bent by exactly the number of cents it is out.
			Bend is channel-wide, so retuning individual notes and playing chords are the same problem —
			which is the problem <Xref to="mpe" /> exists to solve.
		</p>
	</TryThis>

	<Section title="MIDI's three ways to disagree">
		<p class="prose-body">
			They arrive in increasing order of how much they can express and decreasing order of how
			widely they are supported.
		</p>

		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-1.5 rounded-lg border p-4">
				<p class="text-sm font-semibold">1 · RPN 1 and 2 — move everything</p>
				<p class="text-sm leading-relaxed">
					<strong>Fine Tuning</strong> (RPN 0,1) shifts the whole instrument by up to ±100 cents;
					<strong>Coarse Tuning</strong> (RPN 0,2) by up to ±64 semitones. Widely implemented,
					because this is what "tune the synth to the piano" needs. It cannot change the
					<em>relationship</em> between notes — everything moves together.
				</p>
				<p class="text-xs leading-relaxed text-muted-foreground">
					Same four-message handshake as every other RPN: see <Xref to="rpn-nrpn" />.
				</p>
			</div>

			<div class="flex flex-col gap-1.5 rounded-lg border p-4">
				<p class="text-sm font-semibold">2 · Pitch bend, one note per channel</p>
				<p class="text-sm leading-relaxed">
					What the demonstration above does, and what almost every microtonal plugin did for twenty
					years. Works on literally any instrument that responds to bend, which is all of them.
					Costs you a channel per simultaneous note and needs both ends to agree on the bend range,
					or every offset is wrong by a scale factor.
				</p>
			</div>

			<div class="flex flex-col gap-1.5 rounded-lg border border-msg-sysex/30 p-4">
				<p class="text-sm font-semibold text-msg-sysex">
					3 · The MIDI Tuning Standard — the good one
				</p>
				<p class="text-sm leading-relaxed">
					A universal SysEx family that assigns an explicit frequency to each of the 128 note
					numbers. Three bytes per note: a semitone number and a fourteen-bit fraction, resolving to
					roughly <strong>0.0061 cents</strong> — far finer than anyone can hear. It comes in a bulk dump
					for a whole scale and a real-time form for changing single notes while they sound.
				</p>
				<p class="text-sm leading-relaxed">
					It costs no channels, survives chords, and expresses any tuning at all — scales with
					nineteen notes, or thirty-one, or the ones that do not repeat at the octave. Its problem
					is support: plenty of software, very little hardware.
				</p>
				<p class="text-xs leading-relaxed text-muted-foreground">
					It travels as SysEx, so everything in <Xref to="sysex" /> applies — including the browser permission
					it needs.
				</p>
			</div>
		</div>

		<Callout variant="key" title="Which one to reach for">
			<p>
				Matching a synth to a slightly flat piano: <strong>RPN 1</strong>. Playing a historical
				temperament on a software instrument that supports it: <strong>MTS</strong>. Playing one on
				anything else, or on hardware:
				<strong><Xref to="pitch-bend" label="pitch bend" /> per channel</strong>, which is ugly and
				works everywhere.
			</p>
		</Callout>
	</Section>

	<TryThis title="Retune this instrument by hand">
		<RpnLab />
		<p class="text-sm leading-relaxed">
			RPN 0,1 is Fine Tuning. Select it, send a Data Entry value away from centre, and the whole
			instrument moves. Then play the keyboard below — every note has shifted by the same amount,
			which is exactly what "tuning an instrument" means and exactly what it cannot do for
			microtonality.
		</p>
		<Keyboard low={48} octaves={2} height={120} />
	</TryThis>

	<Section title="A440 is also a decision">
		<p class="prose-body">
			Note 69 is {A440.toFixed(0)} Hz because a 1955 ISO standard says so. Orchestras in Europe frequently
			play at 442 or 443; period-instrument groups often use 415, a full semitone lower; Verdi argued
			for 432 and people still argue about it. None of these is more correct — the whole concept is a
			reference point everyone agreed to share.
		</p>
		<p class="prose-body">
			MIDI does not transmit the reference pitch either. It sends note 69 and the receiver decides
			what frequency that is, which is precisely the same arrangement as everything else in
			<Xref to="control-not-sound" />: the number is the message, the meaning belongs to the
			instrument.
		</p>
		<Callout
			variant="gotcha"
			title="Two instruments, two reference pitches, one very bad afternoon"
		>
			<p>
				If one synth is set to 440 and another to 442, they will be eight cents apart on every note
				and will beat against each other constantly. It sounds like a bad reverb rather than a
				tuning problem, which is why it can take an hour to find. Check the global tune setting on
				both boxes before you check anything else.
			</p>
		</Callout>
	</Section>

	<Section title="Why bother">
		<p class="prose-body">
			Because a great deal of the world's music does not use twelve equal steps and never did.
			Indian classical music, Turkish makam, Thai and Javanese tuning systems, blues intonation,
			barbershop harmony and every unaccompanied choir sing intervals that a piano cannot play.
			Equal temperament is not the default of music; it is the default of <em>keyboards</em>, which
			MIDI inherited by accident of history.
		</p>
		<p class="prose-body">
			None of this is exotic to reach. The mechanism is a table of frequencies and a SysEx message,
			and the archive of historical and invented scales already exists and is free.
		</p>
	</Section>

	<Quiz
		question="You want a plugin to play a historical meantone temperament across full chords, and it supports MTS. Why is that better than pitch bend?"
		options={[
			'MTS has higher pitch resolution',
			'MTS retunes the notes themselves, so chords work on one channel',
			'Pitch bend is not supported by most plugins'
		]}
		answer={1}
		explanation="Resolution is a real advantage but not the decisive one — pitch bend's 14 bits over ±2 semitones is already finer than the ear. The decisive thing is that bend is channel-wide, so per-note retuning by bend costs one channel per simultaneous note. MTS changes what the note numbers mean and chords just work."
	/>

	<Quiz
		question="Two synths are eight cents apart on every note. Which is the likely cause?"
		options={[
			'One of them has a different pitch bend range',
			'They are set to different reference pitches — 440 versus 442',
			'One is receiving RPN 0,2 coarse tuning'
		]}
		answer={1}
		explanation="A constant offset on every note is a master tuning difference. A bend range mismatch only shows up while the wheel is moved, and coarse tuning moves in whole semitones — a hundred cents at a time, not eight."
	/>

	<Further
		refs={['spec-mts', 'wikipedia-mts', 'scala', 'spec-universal-sysex']}
		lead="The tuning specification, and the archive of five thousand scales that most microtonal software can read."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="hear"
			label="Hear the same triad in equal temperament and in pure ratios"
			hint="Both buttons above. Listen for the slow pulsing in the first one."
		/>
		<Checkpoint
			lesson={meta.id}
			id="rpn-tune"
			label="Select RPN 0,1 — Fine Tuning"
			hint="CC 101 = 0, then CC 100 = 1."
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 100 && e.message.value === 1}
		/>
		<Checkpoint
			lesson={meta.id}
			id="detune"
			label="Send a Data Entry value and move the instrument off centre"
			hint="CC 6, away from 64."
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 6 && e.message.value !== 64}
		/>
		<Checkpoint
			lesson={meta.id}
			id="bend-cents"
			label="Retune a single note with pitch bend"
			hint="Any bend that is not dead centre is a retuning of everything on that channel."
			test={(e) => e.message.type === 'pitchBend' && e.message.value !== 8192}
		/>
	</Checkpoints>
</LessonShell>
