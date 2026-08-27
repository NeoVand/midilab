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
	import Timeline from '$lib/components/lesson/Timeline.svelte';
	import Figure from '$lib/components/lesson/Figure.svelte';
	import type { FigureImage } from '$lib/components/lesson/Figure.svelte';
	import type { TimelineEntry } from '$lib/components/lesson/Timeline.svelte';
	import MelodyPlayer from '$lib/components/midi/MelodyPlayer.svelte';
	import WireLoad from '$lib/components/midi/WireLoad.svelte';
	import { lessonById } from '$lib/curriculum/registry';

	const meta = lessonById('how-midi-happened')!;

	/**
	 * The two instruments from the January 1983 demonstration.
	 *
	 * Left is the one that had MIDI first; right is the one nobody had tested it
	 * against. Shown together because that is the entire point — separately they
	 * are two vintage synthesisers, and side by side they are the first two
	 * machines that ever spoke this language to each other.
	 */
	const NAMM_1983: FigureImage[] = [
		{
			src: '/img/prophet-600.jpg',
			alt: 'A Sequential Circuits Prophet-600: a black five-octave analogue synthesiser in a wooden end-cheek case, its upper panel covered in small knobs and a numeric keypad.',
			label: 'Sequential Circuits Prophet-600, 1982',
			width: 1280,
			height: 414,
			credit: 'M Maeghan Donovan (derivative by Clusternote)',
			license: 'CC BY 2.0',
			licenseUrl: 'https://creativecommons.org/licenses/by/2.0',
			source: 'https://commons.wikimedia.org/wiki/File:SCI_Prophet_600_(angled).jpg'
		},
		{
			src: '/img/jupiter-6.jpg',
			alt: 'A Roland Jupiter-6: a black five-octave analogue synthesiser with rows of sliders and blue and red illuminated buttons, the name JUPITER-6 printed at the right of the panel.',
			label: 'Roland Jupiter-6, 1983',
			width: 1280,
			height: 351,
			credit: 'Svuntutheysari',
			license: 'CC BY-SA 3.0',
			licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
			source: 'https://commons.wikimedia.org/wiki/File:Roland_Jupiter-6.jpg'
		}
	];

	const HISTORY: TimelineEntry[] = [
		{
			when: 'Jun 1981',
			what: 'Dave Smith starts asking around',
			detail:
				'Sequential Circuits’ founder talks to Tom Oberheim and to Roland’s Ikutaro Kakehashi about a shared way for instruments to talk. Every manufacturer already had one; none of them interoperated.'
		},
		{
			when: 'Oct 1981',
			what: '“Universal Synthesizer Interface” presented at the AES',
			detail:
				'Smith and Chet Wood put the proposal to the Audio Engineering Society. It is recognisably MIDI: a serial link, one direction per cable, addressed messages.'
		},
		{
			when: '1982',
			what: 'Five companies converge',
			detail:
				'Sequential Circuits, Roland, Yamaha, Korg and Kawai negotiate the details. The Prophet-600’s manual, dated December 1982, already lists their manufacturer IDs.'
		},
		{
			when: 'Jan 1983',
			what: 'Two synthesisers from rival companies play each other',
			detail:
				'At the Winter NAMM show, a Sequential Prophet-600 is connected to a Roland Jupiter-6. Nobody had tested that pair before. It worked.',
			pivot: true
		},
		{
			when: 'Aug 1983',
			what: 'MIDI 1.0 published',
			detail: 'The specification is released, and costs nothing to implement. It still does.'
		},
		{
			when: '1984–85',
			what: 'The MIDI Manufacturers Association forms',
			detail:
				'A trade body to hold the standard, alongside the Japan MIDI Standards Committee. The far more thorough Detailed Specification arrives at the 1985 Summer NAMM.'
		},
		{
			when: '1991',
			what: 'General MIDI, and Standard MIDI Files',
			detail:
				'An agreement about what the numbers mean, so a file made on one machine is roughly recognisable on another.'
		},
		{
			when: '2013',
			what: 'A Technical Grammy',
			detail:
				'Awarded to Dave Smith and Ikutaro Kakehashi, thirty years after the handshake on the NAMM floor.'
		},
		{
			when: '2020',
			what: 'MIDI 2.0',
			detail:
				'The first change to the wire format in thirty-seven years — and carefully designed so that the old one keeps working.'
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			In 1981 every synthesiser manufacturer had a way for its instruments to talk to each other,
			and not one of them worked with anybody else's. Roland had DCB. Oberheim had its own. Yamaha
			had its own. If you owned two brands, you owned two islands.
		</p>
		<p class="prose-body">
			What happened next is genuinely unusual in the history of technology: five direct competitors
			agreed on one standard, published it, and charged nothing for it. The result is that a
			keyboard built in 1984 will still drive a synthesiser built this year — not through an
			adapter, not through emulation, but because they are speaking the same language.
		</p>
		<Timeline entries={HISTORY} />
	</Section>

	<Section title="The demonstration">
		<p class="prose-body">
			At the Winter NAMM show in January 1983, Dave Smith connected a Sequential Prophet-600 to a
			Roland Jupiter-6 and played one from the other. Sequential had tested a Prophet-600 against
			another Prophet-600. Nobody had tried it against a Roland.
		</p>
		<Figure images={NAMM_1983}>
			Both are five-octave analogue polysynths from rival companies, built months apart, and neither
			was designed with the other in mind. The only thing they had in common was a five-pin socket
			on the back and eighteen months of arguing about what should come out of it.
		</Figure>
		<blockquote class="border-l-2 border-msg-note py-1 pl-4 text-base leading-relaxed">
			<p>
				"They really had no idea if it would work when they connected it to the Roland Jupiter 6.
				But it did, and everybody was pretty amazed."
			</p>
			<footer class="mt-2 text-sm text-muted-foreground">
				— John Bowen, then head of sound design at Sequential, recalling the demonstration
			</footer>
		</blockquote>
		<p class="prose-body">
			That is the whole of MIDI's origin story: two boxes from companies that were trying to put
			each other out of business, talking on the first attempt, because the people building them had
			spent eighteen months agreeing on what a note was.
		</p>
	</Section>

	<Section title="Why the numbers are the numbers">
		<p class="prose-body">
			Almost every constraint that makes MIDI 1.0 feel dated is a 1983 constraint you can price out
			exactly. This is worth doing, because it separates the parts that were <em>cheap</em> from the
			parts that were <em>wrong</em>.
		</p>

		<div class="flex flex-col gap-3">
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">31,250 bits per second</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					A 1 MHz clock divided by 32, exactly. The cheap microcontrollers of the era could produce
					that rate with no error at all from a crystal they already had, where the standard
					computing rates of the day — 9,600, 19,200 — needed a different crystal or drifted. The
					specification never explains the choice; the arithmetic does.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Seven bits of value, 0–127</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					The eighth bit was spent on telling a receiver whether a byte begins a message or
					continues one — which is what lets a device that joins the stream halfway resynchronise
					within one byte. A very good trade in 1983, and the reason every value in
					<Xref to="bytes-and-bits" /> stops at 127.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">A current loop, not a voltage</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					About 5 mA pushed down the cable, with an
					<Term>opto-isolator</Term> at the receiving end — an LED shining at a phototransistor, so the
					two devices share no electrical path whatsoever. This is why MIDI cannot hum, cannot create
					a ground loop, and cannot damage the thing you plug it into. Forty years on it is still the
					single most robust connector in the studio.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Sixteen channels</p>
				<p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					Four bits of the status byte, because the other four were needed for the message type. In
					1983 nobody owned sixteen synthesisers. It is the constraint that has aged worst, and
					<Xref to="mpe" /> is an entire technique invented to work around it.
				</p>
			</div>
		</div>

		<Callout variant="key" title="Cheap is not the same as wrong">
			<p>
				The bit rate is a 1983 economy and MIDI 2.0 abandons it without regret. The status bit is
				not — it is a genuinely good piece of protocol design that would still be a reasonable
				choice today. When someone tells you MIDI is "primitive", it is worth knowing which of the
				two they are pointing at.
			</p>
		</Callout>
	</Section>

	<TryThis title="Feel 1983 for yourself">
		<p class="text-sm leading-relaxed">
			At 31,250 bits per second with a start and stop bit, one byte takes 320 microseconds and a
			three-byte Note On takes just under a millisecond. That is fine for playing. Send a dense
			controller sweep across ten channels and the cable fills up — and notes start arriving late,
			in the order they were queued.
		</p>
		<WireLoad />
	</TryThis>

	<Section title="The decision that actually mattered">
		<p class="prose-body">
			Not the bit rate, and not the connector. The decision that made MIDI outlast every instrument
			it was designed for was that it was <strong>given away</strong>. No licence, no royalty, no
			certification fee for the protocol itself. Smith's reasoning was blunt: it could only work if
			everybody adopted it, so it had to cost nothing to adopt.
		</p>
		<p class="prose-body">
			Compare that to essentially every other interconnect standard of the following decade. The
			ones that charged are gone. The one that did not is in the phone in your pocket, which speaks
			MIDI over Bluetooth to a keyboard designed forty years after the specification was written.
		</p>
		<Callout variant="note" title="Kakehashi's other contribution">
			<p>
				Roland's founder is usually credited for the standard. He should also be credited for the
				posture: he had spent the 1970s watching incompatible drum machines and sequencers fail to
				find a market, and he argued for a shared standard from a position where Roland was large
				enough to have imposed its own. That is a harder thing to give up than a patent.
			</p>
		</Callout>
	</Section>

	<Section title="What has changed since, and what has not">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border border-msg-note/30 bg-msg-note-bg p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">
					Unchanged since 1983
				</p>
				<ul class="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed">
					<li>The status byte and its top bit</li>
					<li>Note On, Note Off, velocity 0–127</li>
					<li>Sixteen channels per port</li>
					<li>Twenty-four clocks to a <Term>quarter note</Term></li>
					<li>The five-pin DIN pinout</li>
				</ul>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
				<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Added since
				</p>
				<ul class="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed">
					<li>
						Standard MIDI Files and <Xref to="programs-and-banks" label="General MIDI" />, 1991
					</li>
					<li>USB, 1999 — and with it, the computer as the centre</li>
					<li>MPE, standardised 2018 after years of practice</li>
					<li>Bluetooth LE MIDI, and MIDI over the network</li>
					<li>MIDI 2.0 and the Universal MIDI Packet, 2020</li>
				</ul>
			</div>
		</div>
		<p class="prose-body">
			Everything in the left column is what you are learning in Act I, and it is the same thing
			those two synthesisers said to each other on a trade-show floor in January 1983. Everything in
			the right column is a layer on top that was careful not to break it. Whether that caution is
			wisdom or inertia is the argument in <Xref to="midi-2" />.
		</p>
	</Section>

	<TryThis title="Something from before all of this">
		<p class="text-sm leading-relaxed">
			A last piece of perspective. This melody is from 1722 — two hundred and sixty-one years before
			MIDI, and it is being described to your machine in a format designed for a 1983
			microcontroller and played by a synthesiser written in a web browser. Every layer in that
			sentence was designed not to have an opinion about the layer above it.
		</p>
		<MelodyPlayer id="prelude-in-c" transpose />
	</TryThis>

	<Quiz
		question="Why does every value in MIDI stop at 127?"
		options={[
			'Because 128 sounds were considered enough in 1983',
			'Because the top bit of every byte is reserved to mark status bytes',
			'Because the cable could not carry eight bits reliably'
		]}
		answer={1}
		explanation="Seven bits of value, one bit of self-description. It is what lets a receiver joining a stream mid-message find the start of the next one within a single byte, and it is the design decision the whole protocol is built on."
	/>

	<Quiz
		question="Which of these is a 1983 cost constraint rather than a design choice?"
		options={['Sixteen channels per port', '31,250 bits per second', 'Both of them']}
		answer={2}
		explanation="The bit rate came from what a cheap crystal could divide down to exactly; the channel count came from having only four bits left in the status byte after the message type. Both are consequences of 1983 hardware economics, and MIDI 2.0 relaxes both."
	/>

	<Further
		refs={['history-midi', 'history-associations', 'dave-smith', 'kakehashi', 'spec-midi1-1996']}
		lead="The oral history is the good one — it is assembled from the people who were in the room, and it contradicts the tidy version in places."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="grammy"
			label="Say who received the 2013 Technical Grammy for MIDI, without scrolling up"
			hint="One founded Sequential Circuits, the other founded Roland."
		/>
		<Checkpoint
			lesson={meta.id}
			id="bitrate"
			label="Explain 31,250 to somebody — one megahertz divided by what?"
			hint="A power of two, and the reason a cheap 1983 crystal could hit the rate exactly."
		/>
		<Checkpoint
			lesson={meta.id}
			id="read"
			label="Open one of the primary sources at the foot of this page"
			hint="The oral history, or the 1996 specification scan. Both are free."
		/>
	</Checkpoints>
</LessonShell>
