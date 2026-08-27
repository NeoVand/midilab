/**
 * The Universal MIDI Packet — MIDI 2.0's container format.
 *
 * Everything in MIDI 2.0 travels as 32-bit words. The first four bits are the
 * **message type**, which determines how many words the packet occupies; the
 * next four are the **group**, giving sixteen independent sets of sixteen
 * channels on one connection.
 *
 * The two types that matter for understanding the transition are 0x2 — a MIDI
 * 1.0 message wrapped unchanged in a single word — and 0x4, the native MIDI 2.0
 * channel voice message, which spends a whole second word on the value.
 */

import type { MidiMessage } from './messages';

export interface UmpPacket {
	words: number[];
	messageType: number;
	group: number;
	label: string;
	notes: string[];
}

export const MESSAGE_TYPES: Record<number, { name: string; words: number; note: string }> = {
	0x0: { name: 'Utility', words: 1, note: 'NOOP, jitter-reduction timestamps' },
	0x1: {
		name: 'System Real Time / Common',
		words: 1,
		note: 'Clock, Start, Stop — unchanged in meaning'
	},
	0x2: {
		name: 'MIDI 1.0 Channel Voice',
		words: 1,
		note: 'A MIDI 1.0 message, verbatim, in one word'
	},
	0x3: { name: 'Data (64-bit)', words: 2, note: 'SysEx7 — classic System Exclusive' },
	0x4: {
		name: 'MIDI 2.0 Channel Voice',
		words: 2,
		note: 'The new one: 16-bit velocity, 32-bit controllers, per-note controllers'
	},
	0x5: { name: 'Data (128-bit)', words: 4, note: 'SysEx8 and mixed data sets — full 8-bit bytes' },
	0xd: { name: 'Flex Data', words: 4, note: 'Tempo, time signature, lyrics, metadata' },
	0xf: { name: 'Stream', words: 4, note: 'Endpoint discovery and configuration' }
};

function word(...bytes: number[]): number {
	return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

export function hexWord(w: number): string {
	return w.toString(16).toUpperCase().padStart(8, '0');
}

/** Wrap a MIDI 1.0 message in a message-type-2 packet, unchanged. */
export function toUmpMidi1(msg: MidiMessage, group = 0): UmpPacket | null {
	if (!('channel' in msg)) return null;
	const statusMap: Record<string, number> = {
		noteOff: 0x80,
		noteOn: 0x90,
		polyAftertouch: 0xa0,
		controlChange: 0xb0,
		programChange: 0xc0,
		channelAftertouch: 0xd0,
		pitchBend: 0xe0
	};
	const status = statusMap[msg.type];
	if (status === undefined) return null;
	const [d1, d2] = dataBytes(msg);
	return {
		words: [word((0x2 << 4) | group, status | msg.channel, d1, d2)],
		messageType: 0x2,
		group,
		label: 'MIDI 1.0 Channel Voice, wrapped',
		notes: [
			'One 32-bit word. The MIDI 1.0 bytes are unchanged inside it.',
			'This is how a MIDI 2.0 connection carries legacy traffic — nothing is translated or lost.'
		]
	};
}

/** The native MIDI 2.0 form, with the value promoted to a full 32-bit word. */
export function toUmpMidi2(msg: MidiMessage, group = 0): UmpPacket | null {
	if (!('channel' in msg)) return null;
	switch (msg.type) {
		case 'noteOn':
		case 'noteOff': {
			const status = msg.type === 'noteOn' ? 0x90 : 0x80;
			const velocity16 = scale7to16(msg.velocity);
			return {
				words: [
					word((0x4 << 4) | group, status | msg.channel, msg.note, 0x00),
					word((velocity16 >> 8) & 0xff, velocity16 & 0xff, 0x00, 0x00)
				],
				messageType: 0x4,
				group,
				label: `MIDI 2.0 ${msg.type === 'noteOn' ? 'Note On' : 'Note Off'}`,
				notes: [
					`Velocity is 16-bit: ${msg.velocity} of 127 becomes ${velocity16} of 65535.`,
					'The second half of the first word carries an attribute type — pitch 7.9, articulation, or manufacturer-defined.'
				]
			};
		}
		case 'controlChange': {
			const v32 = scale7to32(msg.value);
			return {
				words: [word((0x4 << 4) | group, 0xb0 | msg.channel, msg.controller, 0x00), v32],
				messageType: 0x4,
				group,
				label: 'MIDI 2.0 Control Change',
				notes: [
					`The value gets a whole 32-bit word: ${msg.value} of 127 becomes ${v32 >>> 0} of 4,294,967,295.`,
					'No MSB/LSB pairing, no RPN handshake — one message, full resolution.'
				]
			};
		}
		case 'pitchBend': {
			const v32 = scale14to32(msg.value);
			return {
				words: [word((0x4 << 4) | group, 0xe0 | msg.channel, 0x00, 0x00), v32],
				messageType: 0x4,
				group,
				label: 'MIDI 2.0 Pitch Bend',
				notes: [
					`14-bit ${msg.value} becomes 32-bit ${v32 >>> 0}.`,
					'Per-note pitch bend also exists as its own status, addressed by note number.'
				]
			};
		}
		case 'programChange': {
			return {
				words: [
					word((0x4 << 4) | group, 0xc0 | msg.channel, 0x00, 0x01),
					word(msg.program, 0x00, 0x00, 0x00)
				],
				messageType: 0x4,
				group,
				label: 'MIDI 2.0 Program Change',
				notes: [
					'Program and Bank Select travel in ONE message, with a flag saying whether the bank is valid.',
					'The three-message ordering problem from Programs and banks simply does not exist here.'
				]
			};
		}
		default:
			return null;
	}
}

function dataBytes(msg: MidiMessage): [number, number] {
	switch (msg.type) {
		case 'noteOn':
		case 'noteOff':
			return [msg.note, msg.velocity];
		case 'polyAftertouch':
			return [msg.note, msg.pressure];
		case 'controlChange':
			return [msg.controller, msg.value];
		case 'programChange':
			return [msg.program, 0];
		case 'channelAftertouch':
			return [msg.pressure, 0];
		case 'pitchBend':
			return [msg.value & 0x7f, (msg.value >> 7) & 0x7f];
		default:
			return [0, 0];
	}
}

/**
 * MIDI 2.0's scaling is not a plain multiply. It preserves the minimum, the
 * centre and the maximum exactly, so a 7-bit 64 maps to precisely the middle of
 * the wider range rather than a fraction below it.
 */
export function scale7to16(v: number): number {
	const src = v & 0x7f;
	const bitShift = 9;
	const scaled = src << bitShift;
	if (src <= 0x40) return scaled;
	const repeat = src & 0x3f;
	const repeatBits = 5;
	let extended = repeat;
	for (let i = repeatBits; i < bitShift; i += repeatBits)
		extended = (extended << repeatBits) | repeat;
	return scaled + (extended >> 1);
}

export function scale7to32(v: number): number {
	return (scale7to16(v) * 0x10001) >>> 0;
}

export function scale14to32(v: number): number {
	const src = v & 0x3fff;
	const scaled = src << 18;
	if (src <= 0x2000) return scaled >>> 0;
	const repeat = src & 0x1fff;
	return (scaled + ((repeat * 0x20) >> 1)) >>> 0;
}
