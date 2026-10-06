<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import MpeLab from '$lib/components/midi/MpeLab.svelte';
	import ZoneMap from '$lib/components/midi/ZoneMap.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { path } from '$lib/nav';
	const meta = lessonById('mpe')!;
	const CHAPTER = [
		['mpe-musical', 'A living note'],
		['mpe-play', 'Playground'],
		['mpe-osmose', 'Osmose setup'],
		['mpe-zones', 'Channels & zones'],
		['mpe-touch', 'Touch & messages'],
		['mpe-phrasing', 'Musical gestures'],
		['mpe-range', 'Bend ranges'],
		['mpe-diagnose', 'Find the problem'],
		['mpe-wire', 'On the wire']
	];
	const DIMENSIONS = [
		[
			'Strike',
			'Note On velocity',
			'The attack: how the note begins. This is a starting value, not continuous pressure.'
		],
		[
			'Press',
			'Channel Pressure',
			'Change a held note. On Osmose, ordinary key travel supplies this expressive pressure axis.'
		],
		[
			'Glide',
			'Pitch Bend',
			'Move pitch around the note. Osmose uses lateral key movement; a continuous surface uses finger position.'
		],
		[
			'Color',
			'CC74',
			'A per-note timbre control. Osmose’s deeper Aftertouch travel sends it; a Seaboard typically uses front-to-back movement.'
		],
		[
			'Lift',
			'Note Off velocity',
			'Release speed, when the controller transmits it and the patch uses it. A patch may map it to the ending.'
		]
	];
</script>

<LessonShell lesson={meta}>
	<nav
		aria-label="In this chapter"
		class="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border bg-card p-4"
	>
		{#each CHAPTER as [id, label] (id)}<a
				href={`#${id}`}
				class="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
				>{label}</a
			>{/each}
	</nav>
	<Section id="mpe-musical" title="A note is more than its beginning">
		<p class="prose-body">
			On a piano, most of a note’s identity arrives with the strike. A singer can lean into a held
			pitch, grow its intensity, change its vowel and soften its ending. A violinist can shape each
			note inside a chord. An expressive controller gives your fingers some of that continuing
			conversation.
		</p>
		<p class="prose-body">
			<strong
				>MIDI Polyphonic Expression — MPE — lets each sounding note carry its own pitch, pressure
				and timbre.</strong
			> You can hold a calm bass note while another voice bends, or let one note inside a chord bloom.
			The point is the musical shape you make with that freedom.
		</p>
		<Callout variant="key" title="Start with one gesture that means something"
			><p>
				Hold two notes. Keep one steady. Let the other approach its pitch, grow, then settle. You
				will learn more from that small phrase than from moving every dimension at its maximum.
			</p></Callout
		>
		<p class="prose-body">
			The playground below works with Expressive E Osmose, other MPE controllers, a touchscreen, a
			mouse or keyboard-accessible note buttons. Its browser sound is a sustained expressive pad,
			designed so you can hear changes while a note is held.
		</p>
	</Section>

	<Section id="mpe-play" title="Play it, hear it, see inside it">
		<TryThis title="An instrument inside every note"
			><MpeLab onAchievement={(id) => progress.complete(meta.id, id)} /></TryThis
		>
		<p class="prose-body">
			The trails come from the messages you produce. Pitch runs horizontally; pressure moves the
			note upward and grows its halo; CC74 moves its color from blue toward gold. The voice cards
			show raw data as well as the interpreted bend. A listening example has its own state and
			cannot verify your practice.
		</p>
		<p class="prose-body">
			Keep the <a href={path('/lab/mpe')} class="underline underline-offset-4"
				>standalone MPE Playground</a
			> open when you want a larger workbench.
		</p>
	</Section>

	<Section id="mpe-osmose" title="Set up your Osmose for this receiver">
		<p class="prose-body">
			Osmose has an internal EaganMatrix instrument and an external MIDI-controller mode. Their USB
			streams have different jobs. This lab listens to the external playing stream and makes its own
			browser sound.
		</p>
		<ol class="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
			<li>
				Connect Osmose to the computer by USB. Open its <strong>External MIDI</strong> mode and the
				<strong>config</strong> tab.
			</li>
			<li>
				Select the <strong>mpe</strong> configuration with <strong>Value Encoder 4</strong>, then
				press that encoder to load it. This selects the MPE controller configuration; a label alone
				is not the loaded state.
			</li>
			<li>
				Choose <strong>Connect MIDI</strong> in the playground, then select the input called
				<strong>Play</strong>
				or <strong>Port 1</strong>. With firmware 2.3, macOS calls this <strong>Osmose play</strong>
				or
				<strong>Osmose61 play</strong>; Windows calls it <strong>Osmose</strong> or
				<strong>Osmose61</strong>. Avoid MIDIIN2 and higher numbered inputs. This firmware exposes
				five USB MIDI ports; older versions can show different names.
			</li>
			<li>
				Use the external MPE defaults: <strong
					>lower zone, master channel 1, member channels 2–16, member bend ±48 semitones</strong
				>. The lab starts with that interpretation. Open its diagnostics to change it if you
				deliberately changed the controller.
			</li>
			<li>
				Select <strong>Enable browser sound</strong>. Play two keys, then move just one sideways or
				press it deeper. Watch their separate channels and expression values.
			</li>
		</ol>
		<Callout variant="gotcha" title="Choose the playing stream"
			><p>
				Sound Engine / Port 2 addresses Osmose’s internal sound engine. Its internal ±96-semitone
				convention is a different setup. Haken / Port 5 is another stream, not the external Play
				input this receiver expects. Keep the selected Play stream separate from editor and
				sound-engine streams.
			</p></Callout
		>
		<p class="prose-body">
			<strong>USB MIDI carries messages, not Osmose’s audio.</strong> To hear the internal instrument
			you still use its audio outputs. To hear this lab, enable the browser pad. Receiving its Play stream
			does not require changing Local Control. If both instruments are audible, decide which one you want
			to listen to.
		</p>
		<p class="prose-body">
			Normal vertical key travel supplies the pressure axis; sideways key motion supplies pitch
			bend; pushing into the deeper Aftertouch travel sends CC74. Osmose calls that deeper physical
			axis “Aftertouch,” while its MIDI message here is a Control Change. Do not look for a second
			Channel Pressure message to represent it.
		</p>
	</Section>

	<Section id="mpe-zones" title="One voice, one member channel">
		<p class="prose-body">
			Ordinary MIDI 1.0 pitch bend and Channel Pressure are channel-wide. If a chord shares one
			channel, changing either message changes every note on that channel. <Xref
				to="aftertouch"
				label="Polyphonic key pressure"
			/> can identify a note for pressure, but it does not make Pitch Bend or CC74 per-note.
		</p>
		<p class="prose-body">
			MPE uses the messages MIDI already has and changes their addressing. Each independently
			expressive note is assigned a <strong>member channel</strong>. Its Channel Pressure, Pitch
			Bend and CC74 then belong to that note. The controller can reuse channels as notes end;
			release tails and a sustain pedal make that lifecycle part of the receiver’s job.
		</p>
		<p class="prose-body">
			A usual MPE playing mode gives each held finger its own member. Sustained release tails can
			remain after a channel is reused, and a poly mode can deliberately place several held notes on
			one channel. Those notes share that channel’s expression; the member count is not a hard limit
			on all sounding audio voices.
		</p>
		<ZoneMap members={15} />
		<p class="prose-body">
			A <strong>lower zone</strong> starts with master channel 1 and places members above it. An
			<strong>upper zone</strong> starts with master channel 16 and places members below it. The master,
			also called the manager, carries zone-wide expression: a master bend moves the zone together, and
			sustain holds notes across it.
		</p>
		<Callout variant="convention" title="Two different kinds of together"
			><p>
				Keeping two notes on different members lets you move one independently. Sending a
				master-channel expression message lets you move the group together. Both can be musical: a
				stable lower voice with a singing upper note, or a whole chord rising into an arrival.
			</p></Callout
		>
		<p class="prose-body">
			A channel number identifies an expression address, not a pitch, a left hand, or a permanent
			voice. On the next chord, C may use a different member. Read the active note and its channel
			together.
		</p>
	</Section>

	<Section id="mpe-touch" title="Five useful parts of a gesture">
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full min-w-[35rem] text-sm">
				<thead class="bg-muted/50"
					><tr
						><th class="px-3 py-2 text-left font-medium">Gesture</th><th
							class="px-3 py-2 text-left font-medium">MIDI message</th
						><th class="px-3 py-2 text-left font-medium">Musical job</th></tr
					></thead
				><tbody
					>{#each DIMENSIONS as [gesture, message, meaning] (gesture)}<tr class="border-t"
							><td class="px-3 py-3 font-medium">{gesture}</td><td
								class="px-3 py-3 font-mono text-xs">{message}</td
							><td class="px-3 py-3 text-xs leading-relaxed text-muted-foreground">{meaning}</td
							></tr
						>{/each}</tbody
				>
			</table>
		</div>
		<p class="prose-body">
			The physical gesture and the MIDI carrier are separate ideas. Different controllers reach the
			same message in different ways. A synthesizer patch decides what that message sounds like:
			CC74 might open a filter, change a resonator or crossfade a texture. Here it opens each note’s
			filter, while pressure adds intensity and some brightness.
		</p>
		<p class="prose-body">
			The voice ledger captures Note Off velocity too. This browser pad uses a fixed release
			envelope; lift speed changes the sound only when a receiving patch maps that value.
		</p>
		<Callout variant="note" title="More axes do not require more motion"
			><p>
				A warm attack can be followed by a steady, unbent note. A small pressure change can carry a
				phrase while CC74 stays quiet. Leaving a dimension alone makes the next intentional change
				easier to hear.
			</p></Callout
		>
	</Section>

	<Section id="mpe-phrasing" title="Make the gesture serve the phrase">
		<p class="prose-body">
			<strong>Give pitch a destination.</strong> Approach a note from slightly below, settle at its centre,
			then add vibrato after the arrival. Delaying the vibrato makes the arrival clearer. Listen for a
			consistent centre rather than treating the entire bend range as a place to wander.
		</p>
		<p class="prose-body">
			<strong>Let a chord have an inner voice.</strong> Keep a low note calm while an upper note swells.
			Then switch roles: let the lower note move and keep the upper one as a reference. The independence
			matters because you can hear one action against something stable.
		</p>
		<p class="prose-body">
			<strong>Shape color over time.</strong> Open one voice as it answers another; soften its timbre
			as the phrase finishes. Pressure and CC74 can both brighten this pad, but try them separately first.
			Find out which change makes the phrase’s direction clearer.
		</p>
		<p class="prose-body">
			<strong>Leave a rest.</strong> Release the notes and wait before repeating. Play the same small
			idea twice, changing only one aspect on the second pass. Repetition gives the listener a reference;
			a single changed gesture becomes easier to recognise.
		</p>
		<TryThis title="A four-minute practice ritual"
			><ol class="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
				<li>
					One minute: hold two notes and make a small bend in only one. Return to the centre before
					releasing.
				</li>
				<li>
					One minute: keep pitch still and grow one note’s pressure. Finish more quietly than the
					peak.
				</li>
				<li>One minute: keep the other dimensions still and give CC74 an opening and a closing.</li>
				<li>
					One minute: play a short idea, leave a rest, then answer it. Choose one expressive change
					that makes the answer different.
				</li>
			</ol></TryThis
		>
		<p class="prose-body">
			The playground’s automatic challenges verify that a member’s expression changes while another
			note is held. They establish technical independence. Deciding whether the gesture has a good
			shape, an appropriate ending or the feeling you intended still belongs to listening.
		</p>
	</Section>

	<Section id="mpe-range" title="Bend data needs a matching interpretation">
		<p class="prose-body">
			A Pitch Bend message has a centre at <strong>8192</strong> and values from 0 to 16383. Those values
			do not name a number of semitones. The sender and receiver must agree how far a full bend goes.
		</p>
		<p class="prose-body">
			MPE member channels conventionally use <strong>±48 semitones</strong>; the master
			conventionally uses <strong>±2</strong>. A physical Osmose key normally explores a small
			musical portion of that member range. Setting the receiver to ±2 while the sender uses ±48
			makes the heard motion twenty-four times smaller than intended. Reversing that mismatch makes
			it twenty-four times larger.
		</p>
		<Callout variant="key" title="Check the raw value and the interpreted pitch"
			><p>
				Hold a note and move it slightly. The card shows the raw Pitch Bend and its semitone
				interpretation. If raw values change but the movement sounds too small or too large, check
				the range on both ends. A wrong base note, transpose or tuning offset is a different
				problem.
			</p></Callout
		>
		<p class="prose-body">
			The lab follows received <strong>RPN 0,0</strong> Pitch Bend Sensitivity and
			<strong>RPN 0,6</strong> zone declarations. Its local controls are a receiver calibration. They
			do not send configuration to your controller or overwrite its preset.
		</p>
	</Section>

	<Section id="mpe-diagnose" title="Find the problem by watching one note">
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full min-w-[36rem] text-sm">
				<thead class="bg-muted/50"
					><tr
						><th class="px-3 py-2 text-left font-medium">What you see or hear</th><th
							class="px-3 py-2 text-left font-medium">What to check</th
						></tr
					></thead
				><tbody
					>{#each [['No messages', 'Browser MIDI permission, USB connection and the selected input. Use Play / Port 1 on Osmose.'], ['Every note stays on channel 1', 'Ordinary MIDI mode or a zone mismatch. Notes sharing a channel also share its expression.'], ['One gesture moves the whole chord', 'Check whether it is on the master channel or whether the notes share a member. Compare their individual cards.'], ['Bend is much too small or too large', 'Match the sender’s and receiver’s Pitch Bend Sensitivity. External Osmose MPE uses the ±48 member convention.'], ['Pressure moves, CC74 does not', 'On Osmose, explore the deeper Aftertouch key travel. These are separate axes and MIDI carriers.'], ['Notes sound twice', 'Multiple input streams, a duplicated route, or hearing the internal instrument and browser pad together.'], ['Values move, but sound does not', 'Enable browser sound, check the shared mute/volume, then try the expressive pad rather than an unresponsive sampled patch.'], ['A note remains after release', 'Check sustain, the selected stream and Note Off messages. All notes off silences this lab; the global Panic also clears the app’s instruments.']] as [symptom, check] (symptom)}<tr
							class="border-t"
							><td class="px-3 py-3 align-top font-medium">{symptom}</td><td
								class="px-3 py-3 text-xs leading-relaxed text-muted-foreground">{check}</td
							></tr
						>{/each}</tbody
				>
			</table>
		</div>
		<p class="prose-body">
			Begin with one connected controller and one selected playing stream. The playground filters to
			that input even if the dock has other ports open. Once one note’s attack, bend, pressure, CC74
			and release are clear, add a second voice, then a chord.
		</p>
	</Section>

	<Section id="mpe-wire" title="The expression already fits inside MIDI 1.0">
		<p class="prose-body">
			A controller declares a zone with the <strong>MPE Configuration Message: RPN 0,6</strong> on its
			master channel. The Data Entry value is the member count. Pitch Bend Sensitivity is a separate RPN
			setting; the configuration message alone is not a substitute for matching that range.
		</p>
		<div class="rounded-lg border bg-surface-sunken p-4 font-mono text-xs leading-loose">
			<p>CC101 = 0 · select RPN MSB</p>
			<p>CC100 = 6 · select MPE Configuration</p>
			<p>CC6 = 15 · fifteen member channels</p>
			<p>CC101 = 127, CC100 = 127 · deselect</p>
		</div>
		<p class="prose-body">
			Channel Pressure is an existing MIDI 1.0 message. Pitch Bend and CC74 are existing messages
			too. MPE makes them independent by using member channels. <Xref
				to="midi-2"
				label="MIDI 2.0"
			/> can address more expression per note directly; that is a different mechanism serving a related
			musical purpose.
		</p>
		<Quiz
			question="You hold C and G on two different member channels. Which message bends only G?"
			options={[
				'Pitch Bend on the master channel',
				'Pitch Bend on G’s member channel',
				'CC74 on C’s member channel',
				'A Program Change on either member'
			]}
			answer={1}
			explanation="The member channel is the note’s expression address. A master bend moves the zone together; CC74 changes timbre rather than pitch."
		/>
		<Quiz
			question="Osmose sends external MPE with a ±48-semitone member range. Your receiver interprets those values as ±2. What happens?"
			options={[
				'The bend sounds twenty-four times smaller than intended',
				'The bend sounds twenty-four times larger than intended',
				'Every note becomes an octave higher',
				'Pressure stops working'
			]}
			answer={0}
			explanation="The raw data is the same, but the receiver applies 2/48 of the intended pitch range. Match the range first, then work on the size of your physical gesture."
		/>
	</Section>

	<Further
		refs={[
			'spec-mpe',
			'osmose-config',
			'osmose-ports',
			'osmose-controller',
			'osmose-hardware',
			'spec-midi2'
		]}
		lead="The MPE recommended practice, official Osmose controller configuration and USB port mapping, and the related per-note direction of MIDI 2.0."
	/>
	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="configure"
			learnerOnly
			label="Set a local MPE zone or receive its real configuration message"
			hint="Open Zone & range diagnostics and apply the receiver settings, or observe an incoming RPN 0,6 declaration."
		/>
		<Checkpoint
			lesson={meta.id}
			id="member"
			learnerOnly
			label="Play a held note on a member channel"
			hint="Use your MPE controller or one of the playground’s hold-note buttons."
		/>
		<Checkpoint
			lesson={meta.id}
			id="per-note-bend"
			learnerOnly
			label="Bend one member note while another is held"
			hint="Hold a dyad. Move one note at least 8 cents while keeping the other as a reference."
		/>
		<Checkpoint
			lesson={meta.id}
			id="pressure"
			learnerOnly
			label="Change one member note’s pressure while another is held"
			hint="Grow and ease one voice by at least 8 pressure steps."
		/>
		<Checkpoint
			lesson={meta.id}
			id="slide"
			learnerOnly
			label="Change one member note’s CC74 while another is held"
			hint="Give the color of one voice an opening and a closing; on Osmose use the deeper Aftertouch travel."
		/>
	</Checkpoints>
</LessonShell>
