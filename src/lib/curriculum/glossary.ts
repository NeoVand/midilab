export interface GlossaryEntry {
	term: string;
	definition: string;
}

/** The vocabulary, in the words this course uses it in. */
export const GLOSSARY: GlossaryEntry[] = [
	{
		term: 'Aftertouch',
		definition:
			'Pressure applied to a key after it is already down. Channel aftertouch sends one value for the whole channel; polyphonic aftertouch sends one per note and is rare.'
	},
	{
		term: 'Bank Select',
		definition:
			'CC 0 (MSB) and CC 32 (LSB), sent before a Program Change to choose which bank of 128 sounds the program number refers to. Does nothing on its own.'
	},
	{
		term: 'Channel',
		definition:
			'The low nibble of a status byte: an address, 0–15 on the wire and 1–16 on every front panel. Each channel holds its own program, volume, bend and controller state.'
	},
	{
		term: 'Channel Mode message',
		definition:
			'Controllers 120–127, which change how a channel behaves rather than moving a parameter. All Notes Off, All Sound Off, Local Control and the Omni/Mono modes.'
	},
	{
		term: 'Class-compliant',
		definition:
			'A USB device that works with the operating system’s built-in driver and needs nothing installed. Almost all modern MIDI hardware, which is why browsers can talk to it.'
	},
	{
		term: 'Control Change (CC)',
		definition:
			'Status 0xBn. A controller number 0–127 and a value 0–127. Most meanings are conventions rather than guarantees.'
	},
	{
		term: 'Current loop',
		definition:
			'MIDI’s electrical scheme: about 5 mA is pushed through the cable rather than a voltage being applied. Combined with opto-isolation, it is why MIDI cannot create ground loops or damage equipment.'
	},
	{
		term: 'Data byte',
		definition:
			'A byte whose top bit is 0, so its value is 0–127. Every value in MIDI 1.0 is a data byte, which is why 127 appears everywhere.'
	},
	{
		term: 'Delta time',
		definition:
			'In a MIDI file, the number of ticks since the previous event, stored as a variable-length quantity. Files store deltas, not timestamps.'
	},
	{
		term: 'General MIDI (GM)',
		definition:
			'An agreement layered on top of MIDI fixing a 128-program list, a percussion map on channel 10, and minimum polyphony. A costume MIDI devices can wear, not their natural state.'
	},
	{
		term: 'Group',
		definition:
			'MIDI 2.0’s outer address level: sixteen groups, each with sixteen channels, on one connection.'
	},
	{
		term: 'Implementation chart',
		definition:
			'The table at the back of a manual listing what a device transmits and what it recognises. Read it as an API specification.'
	},
	{
		term: 'Jitter',
		definition:
			'Inconsistent delay. Unlike latency it cannot be compensated for, because the amount is different every time. It is what makes a rig feel loose.'
	},
	{
		term: 'Latency',
		definition: 'Consistent delay. Correctable by scheduling or playing earlier by the same amount.'
	},
	{
		term: 'Local Control',
		definition:
			'Whether a keyboard is connected to its own sound engine. Turning it off (CC 122 = 0) makes the instrument a pure controller, and is the fix for doubled notes when a computer echoes MIDI back.'
	},
	{
		term: 'Lookahead scheduler',
		definition:
			'The pattern that makes browser timing work: wake up coarsely, plan a little way into the future, and hand every event to the audio and MIDI layers with a timestamp instead of firing it from a timer.'
	},
	{
		term: 'MIDI Clock',
		definition:
			'A single byte (0xF8) sent 24 times per quarter note. Tempo is inferred from how fast the ticks arrive; no BPM number is ever transmitted.'
	},
	{
		term: 'MIDI-CI',
		definition:
			'MIDI 2.0’s Capability Inquiry: the bidirectional negotiation that lets two devices discover each other and agree on what to speak.'
	},
	{
		term: 'MPE',
		definition:
			'MIDI Polyphonic Expression. A convention for using MIDI 1.0 in which every simultaneously sounding note gets its own channel, so channel-wide bend, pressure and CC 74 become per-note.'
	},
	{
		term: 'MTC',
		definition:
			'MIDI Time Code. SMPTE hours, minutes, seconds and frames carried over MIDI, for synchronising to a fixed timeline rather than a tempo.'
	},
	{
		term: 'Multitimbral',
		definition: 'An instrument that plays different sounds on different channels simultaneously.'
	},
	{
		term: 'NRPN',
		definition:
			'Non-Registered Parameter Number. A parameter selected with CC 99/98 and set with CC 6/38, meaning whatever the manufacturer decided. Where deep synth editing lives.'
	},
	{
		term: 'Opto-isolator',
		definition:
			'An LED shining on a phototransistor at the receiving end of a MIDI input, so that two connected devices share no electrical path at all.'
	},
	{
		term: 'PPQN',
		definition:
			'Pulses per quarter note. Two different numbers use this name: MIDI Clock is fixed at 24, while a sequencer’s internal resolution is whatever it chooses — 480, 960, 1920.'
	},
	{
		term: 'Panic',
		definition:
			'Lift the pedals, then All Notes Off, then All Sound Off, then Reset All Controllers, on all sixteen channels — and an explicit Note Off sweep if something is still ringing.'
	},
	{
		term: 'Pitch bend',
		definition:
			'Status 0xEn. The only 14-bit channel voice message, centred at 8192, with the LSB sent before the MSB. Channel-wide, which is the limitation MPE exists to work around.'
	},
	{
		term: 'Program Change',
		definition:
			'Status 0xCn plus one data byte: switch to sound number n. Front panels usually number sounds from 1 while the byte counts from 0.'
	},
	{
		term: 'Property Exchange',
		definition:
			'MIDI 2.0’s mechanism for a device to publish structured information about its own controllers, programs and state.'
	},
	{
		term: 'RPN',
		definition:
			'Registered Parameter Number. Same mechanism as NRPN but with numbers assigned by the MIDI Association, so they mean the same thing everywhere. Bend range is RPN 0,0.'
	},
	{
		term: 'Running status',
		definition:
			'Omitting a repeated status byte to save bandwidth. Why a velocity-zero Note On means Note Off, and why MIDI file parsers must be stateful.'
	},
	{
		term: 'Song Position Pointer',
		definition:
			'A 14-bit count of sixteenth notes from the start of a song, sent before Continue to relocate a follower.'
	},
	{
		term: 'Status byte',
		definition:
			'A byte whose top bit is 1, so its value is 128–255. The high nibble says what kind of message; for channel messages the low nibble says which channel.'
	},
	{
		term: 'SysEx',
		definition:
			'System Exclusive. An arbitrarily long block addressed to one manufacturer, meaning whatever that manufacturer decided. Everything between F0 and F7 must be a data byte.'
	},
	{
		term: 'Thru',
		definition:
			'A socket carrying an exact regenerated copy of whatever arrived at MIDI In. It does not include anything this device is playing — that is MIDI Out.'
	},
	{
		term: 'TRS Type A / Type B',
		definition:
			'Two incompatible ways of wiring MIDI onto a 3.5 mm jack. Type A is the standard. Mixing them produces complete silence with no other symptom.'
	},
	{
		term: 'UMP',
		definition:
			'Universal MIDI Packet. MIDI 2.0’s container: 32-bit words whose first nibble gives the message type and second the group.'
	},
	{
		term: 'Variable-length quantity',
		definition:
			'MIDI file encoding for numbers: seven bits of value per byte, with the top bit meaning "another byte follows".'
	},
	{
		term: 'Velocity',
		definition:
			'How hard a note was struck, 1–127, measured once at the start and never updated. Velocity 0 in a Note On means Note Off.'
	},
	{
		term: 'Zipper noise',
		definition:
			'The audible stepping caused by applying 7-bit controller values directly to a parameter. Fixed at the receiving end by smoothing, or avoided with 14-bit resolution.'
	}
];
