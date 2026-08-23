/**
 * The course: six acts, thirty lessons.
 *
 * Metadata lives here; the lessons themselves are Svelte components under
 * `lessons/`, because almost every one of them needs a live instrument, a
 * checkpoint wired to the MIDI bus, or a layout that no prose format would
 * survive. A lesson with no component yet renders an honest placeholder rather
 * than a broken route.
 */

export interface LessonMeta {
	/** URL slug and progress key. */
	id: string;
	number: number;
	title: string;
	blurb: string;
	minutes: number;
	/** Works fully without hardware? Almost all do. */
	hardware?: 'none' | 'better' | 'required';
	objectives: string[];
}

export interface Act {
	id: string;
	number: number;
	title: string;
	subtitle: string;
	lessons: LessonMeta[];
}

let counter = 0;
function lesson(
	id: string,
	title: string,
	blurb: string,
	minutes: number,
	objectives: string[],
	hardware: LessonMeta['hardware'] = 'none'
): LessonMeta {
	return { id, number: ++counter, title, blurb, minutes, objectives, hardware };
}

export const CURRICULUM: Act[] = [
	{
		id: 'foundations',
		number: 1,
		title: 'What MIDI actually is',
		subtitle: 'Control, not sound — and the single bit the whole protocol rests on',
		lessons: [
			lesson(
				'control-not-sound',
				'Control, not sound',
				'The same performance is a few dozen bytes as MIDI and close to a megabyte as audio — and that difference explains everything else.',
				8,
				[
					'Explain what a MIDI message does and does not carry',
					'Predict what happens when you change the instrument but not the notes',
					'Say why a MIDI file cannot be "played" without an instrument'
				]
			),
			lesson(
				'notes-and-pitch',
				'Notes and pitch',
				'Note numbers 0–127, middle C = 60, and the C3-versus-C4 argument that will follow you forever.',
				10,
				[
					'Convert freely between note numbers, names and frequencies',
					'Explain why two devices can disagree about what to call note 60',
					'Read the keyboard as a map of semitones'
				]
			),
			lesson(
				'velocity',
				'Velocity and dynamics',
				'How hard you hit it is a number from 1 to 127 — and what the receiver does with it is entirely up to the receiver.',
				8,
				[
					'Describe velocity as a performance measurement, not a volume setting',
					'Shape a velocity curve and hear the difference',
					'Explain why velocity 0 is special'
				]
			),
			lesson(
				'bytes-and-bits',
				'Bytes, bits, and the one that matters',
				'Every MIDI byte announces what it is with its top bit. Everything else in the protocol follows from that.',
				14,
				[
					'Read any MIDI byte as status or data at a glance',
					'Split a status byte into its type and channel nibbles',
					'Explain why every MIDI value stops at 127'
				]
			),
			lesson(
				'note-on-off',
				'Note On, Note Off, and running status',
				'Notes are two messages, not one — which is exactly why notes get stuck.',
				12,
				[
					'Build a Note On and its matching Note Off by hand',
					'Explain the velocity-zero Note Off trick and why it exists',
					'Deliberately create and then fix a stuck note'
				]
			)
		]
	},
	{
		id: 'language',
		number: 2,
		title: 'The message language',
		subtitle: 'Channels, controllers, bend, pressure, programs, and the escape hatches',
		lessons: [
			lesson(
				'channels',
				'Sixteen channels',
				'One cable, sixteen addressees — and one of them is drums by convention rather than by law.',
				12,
				[
					'Route different parts to different channels on one port',
					'Explain multitimbral operation',
					'Say what is and is not guaranteed about channel 10'
				]
			),
			lesson(
				'control-change',
				'Control Change',
				'The 128 knobs every MIDI device has, only some of which mean the same thing on any two devices.',
				16,
				[
					'Use the nine CCs worth memorising',
					'Explain the difference between a standard CC and a device mapping',
					'Hear seven-bit stepping and know when it matters'
				]
			),
			lesson(
				'pitch-bend',
				'Pitch bend',
				'The one channel message that gets fourteen bits, why it is centred at 8192, and why two devices bending differently is your fault.',
				12,
				[
					'Read and construct a pitch bend message',
					'Set a bend range with RPN 0 and hear it take effect',
					'Explain why bend is channel-wide and what that costs'
				]
			),
			lesson(
				'aftertouch',
				'Aftertouch and pressure',
				'Channel pressure is one number for the whole hand; polyphonic aftertouch is one number per finger.',
				10,
				[
					'Distinguish channel from polyphonic aftertouch',
					'Explain why poly aftertouch is rare and expensive',
					'Recognise pressure as the ancestor of MPE'
				]
			),
			lesson(
				'programs-and-banks',
				'Programs and banks',
				'Program Change picks one of 128 sounds. Bank Select is the two extra messages that make 128 into two million.',
				14,
				[
					'Send a correct Bank Select + Program Change sequence in the right order',
					'Explain the off-by-one that makes program 5 arrive as program 4',
					'Read a manufacturer bank map'
				]
			),
			lesson(
				'rpn-nrpn',
				'RPN and NRPN',
				'Four control changes in a row to move one parameter — and why that clumsy handshake is how deep editing works.',
				16,
				[
					'Build an RPN edit byte by byte and watch it land',
					'Explain the difference between registered and non-registered parameters',
					'Say why the RPN Null message matters'
				]
			),
			lesson(
				'panic',
				'Channel Mode, Local Control, and Panic',
				'The messages that turn things off — and the reason every MIDI tool ever written has a big red button.',
				12,
				[
					'Explain All Notes Off versus All Sound Off',
					'Diagnose doubled notes and fix them with Local Control',
					'Write a panic routine that actually works on stubborn hardware'
				]
			),
			lesson(
				'sysex',
				'System Exclusive',
				'The manufacturer-private escape hatch: patch dumps, firmware, and the reason your browser asks twice.',
				16,
				[
					'Read the structure of a SysEx message',
					'Send a Universal Identity Request and decode the reply',
					'Explain why Web MIDI gates SysEx separately'
				],
				'better'
			)
		]
	},
	{
		id: 'time',
		number: 3,
		title: 'Time',
		subtitle: 'Clock, sync, latency, jitter, and files',
		lessons: [
			lesson(
				'midi-clock',
				'MIDI Clock and transport',
				'Twenty-four ticks a quarter note, sent forever, carrying no tempo number at all.',
				14,
				[
					'Explain how tempo is communicated without ever sending a BPM',
					'Use Start, Stop, Continue and Song Position Pointer correctly',
					'Choose a clock master on purpose rather than by accident'
				],
				'better'
			),
			lesson(
				'ppqn-and-groove',
				'Resolution, quantisation and swing',
				'Clock PPQN and sequencer PPQN are different numbers, and confusing them makes timing arguments unresolvable.',
				12,
				[
					'Distinguish transmission resolution from sequencer resolution',
					'Quantise and un-quantise a pattern and hear what is lost',
					'Implement swing as a timing offset rather than a feel setting'
				]
			),
			lesson(
				'sync-options',
				'MTC, Link and choosing a master',
				'Three different answers to "who is in charge of time", and when each one is right.',
				12,
				[
					'Explain MIDI Clock versus MIDI Time Code',
					'Say what Ableton Link does that neither of them does',
					'Write a studio sync policy for your own rig'
				]
			),
			lesson(
				'latency-and-jitter',
				'Latency, jitter, and the lookahead scheduler',
				'Latency you can compensate for. Jitter you cannot. Measure both, then build the fix.',
				20,
				[
					'Measure round-trip latency and clock jitter on your own hardware',
					'Explain why setTimeout cannot sequence music',
					'Build a lookahead scheduler and prove it is tighter'
				],
				'better'
			),
			lesson(
				'midi-files',
				'Standard MIDI Files',
				'Chunks, delta times, variable-length quantities, and meta events — parsed and written from scratch.',
				18,
				[
					'Read a .mid file byte by byte',
					'Decode a variable-length quantity by hand',
					'Export a pattern you made and open it somewhere else'
				]
			)
		]
	},
	{
		id: 'physical',
		number: 4,
		title: 'The physical world',
		subtitle: 'Cables, ports, topologies, and what to check when nothing happens',
		lessons: [
			lesson(
				'transports',
				'DIN, TRS, USB and Bluetooth',
				'Five-pin current loops, the Type A/B TRS split that fails completely silently, and who is the host.',
				16,
				[
					'Identify TRS Type A versus Type B and predict the failure',
					'Explain USB host versus device and why two hosts cannot talk',
					'Choose a transport for a given pair of devices'
				]
			),
			lesson(
				'in-out-thru',
				'In, Out, Thru — and loops',
				'Three sockets, one of which is not what most people think it is, plus the feedback loop they create together.',
				14,
				[
					'Explain what Thru copies and what it does not',
					'Predict where a daisy chain will run out of headroom',
					'Recognise a MIDI loop from its symptoms'
				]
			),
			lesson(
				'studio-routing',
				'Routing a real studio',
				'Build your own rig in the patchbay: ports, channels, clock master, and a plan you can write down.',
				20,
				[
					'Draw your rig as a signal-flow graph',
					'Assign channels deliberately across devices',
					'Document a routing plan you can rebuild from memory'
				],
				'better'
			),
			lesson(
				'troubleshooting',
				'Troubleshooting in the right order',
				'A decision tree that starts with the cheapest possible cause and ends with the expensive one.',
				14,
				[
					'Diagnose a silent connection in a fixed, repeatable order',
					'Use the monitor to prove where a message stops',
					'Know the five failures that account for most MIDI problems'
				]
			)
		]
	},
	{
		id: 'expression',
		number: 5,
		title: 'Expression and the future',
		subtitle: 'MPE, and what MIDI 2.0 actually changes',
		lessons: [
			lesson(
				'mpe',
				'MIDI Polyphonic Expression',
				'One channel per note — a clever exploit of MIDI 1.0 that buys per-note bend, pressure and timbre.',
				20,
				[
					'Explain zones, the master channel and member channels',
					'Set up an MPE zone with the configuration message',
					'Say why bend range must match on both ends or nothing feels right'
				],
				'better'
			),
			lesson(
				'midi-2',
				'MIDI 2.0 and the Universal MIDI Packet',
				'Thirty-two bits, bidirectional negotiation, per-note controllers — and an honest look at where it actually is.',
				16,
				[
					'Read a Universal MIDI Packet',
					'Explain MIDI-CI, Profiles and Property Exchange',
					'Decide whether any of it matters for your current rig'
				]
			)
		]
	},
	{
		id: 'programming',
		number: 6,
		title: 'Programming MIDI',
		subtitle: 'From requestMIDIAccess to a rig you drive with code',
		lessons: [
			lesson(
				'web-midi',
				'The Web MIDI API',
				'Permissions, ports, hot-plug and raw bytes — written in a sandbox that runs against your actual devices.',
				20,
				[
					'Enumerate ports and react to hot-plug',
					'Send and receive raw bytes from code',
					'Explain the secure-context and permission model'
				],
				'better'
			),
			lesson(
				'web-audio',
				'Web Audio for MIDI people',
				'Oscillators, envelopes, filters — and the second clock that makes browser timing possible.',
				20,
				[
					'Build a voice from nodes and trigger it from a message',
					'Explain AudioContext.currentTime versus performance.now()',
					'Say why the audio thread must never wait for the main thread'
				],
				'better'
			),
			lesson(
				'building-a-sequencer',
				'Building a sequencer',
				'Put the scheduler, the transport and the note data together into something that actually plays in time.',
				22,
				[
					'Schedule notes ahead of time instead of firing them late',
					'Handle note lifecycles so nothing ever hangs',
					'Sync your own sequencer to external clock'
				]
			),
			lesson(
				'device-profiles',
				'Device abstraction',
				'Stop writing CC numbers into your song. Describe the instrument once, then speak in parameters.',
				18,
				[
					'Write a device profile with semantic parameters',
					'Map the same parameter to CC, NRPN or SysEx without changing callers',
					'Build a profile for one of your own instruments by learning it'
				],
				'better'
			),
			lesson(
				'patterns',
				'Patterns and algorithmic composition',
				'Mini-notation, Euclidean rhythms and generative lines, driving real hardware.',
				20,
				[
					'Express a rhythm as a pattern rather than a list of events',
					'Generate Euclidean rhythms and understand why they sound musical',
					'Drive several devices from one pattern engine'
				]
			),
			lesson(
				'capstone',
				'Capstone: run the rig',
				'Three devices, one clock master, CC automation, program recall, and a clean stop. Verified end to end.',
				30,
				[
					'Sequence multiple devices on separate channels from one master',
					'Automate a parameter and recall a patch by bank and program',
					'Bring everything to a clean, silent stop on purpose'
				],
				'better'
			)
		]
	}
];

export const ALL_LESSONS: LessonMeta[] = CURRICULUM.flatMap((a) => a.lessons);

export function lessonById(id: string): LessonMeta | undefined {
	return ALL_LESSONS.find((l) => l.id === id);
}

export function actOf(id: string): Act | undefined {
	return CURRICULUM.find((a) => a.lessons.some((l) => l.id === id));
}

export function lessonPath(l: LessonMeta | string): string {
	return `/learn/${typeof l === 'string' ? l : l.id}`;
}

export function neighbours(id: string): { prev?: LessonMeta; next?: LessonMeta } {
	const i = ALL_LESSONS.findIndex((l) => l.id === id);
	return { prev: ALL_LESSONS[i - 1], next: ALL_LESSONS[i + 1] };
}

export const TOTAL_MINUTES = ALL_LESSONS.reduce((a, l) => a + l.minutes, 0);
