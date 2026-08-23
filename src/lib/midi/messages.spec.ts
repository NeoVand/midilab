import { describe, expect, it } from 'vitest';
import {
	combine14,
	encode,
	family,
	parse,
	RunningStatusParser,
	split14,
	unitToBend,
	bendToUnit,
	type MidiMessage
} from './messages';

const samples: Array<[string, number[], MidiMessage]> = [
	['note on', [0x90, 60, 100], { type: 'noteOn', channel: 0, note: 60, velocity: 100 }],
	['note off', [0x85, 60, 64], { type: 'noteOff', channel: 5, note: 60, velocity: 64 }],
	[
		'control change',
		[0xb2, 74, 96],
		{ type: 'controlChange', channel: 2, controller: 74, value: 96 }
	],
	['program change', [0xcf, 40], { type: 'programChange', channel: 15, program: 40 }],
	['channel pressure', [0xd0, 88], { type: 'channelAftertouch', channel: 0, pressure: 88 }],
	['poly pressure', [0xa1, 60, 20], { type: 'polyAftertouch', channel: 1, note: 60, pressure: 20 }],
	['pitch bend centre', [0xe0, 0x00, 0x40], { type: 'pitchBend', channel: 0, value: 8192 }],
	['clock', [0xf8], { type: 'clock' }],
	['song position', [0xf2, 0x10, 0x02], { type: 'songPosition', beats: combine14(2, 0x10) }]
];

describe('parse and encode', () => {
	for (const [name, bytes, message] of samples) {
		it(`parses ${name}`, () => expect(parse(bytes)).toEqual(message));
		it(`encodes ${name}`, () => expect(encode(message)).toEqual(bytes));
	}

	it('treats a velocity-zero Note On as a Note Off', () => {
		expect(parse([0x90, 60, 0])).toEqual({ type: 'noteOff', channel: 0, note: 60, velocity: 0 });
	});

	it('sends pitch bend LSB first', () => {
		// 8192 + 1 → MSB 64, LSB 1. The fine byte goes on the wire first.
		expect(encode({ type: 'pitchBend', channel: 0, value: 8193 })).toEqual([0xe0, 1, 64]);
	});

	it('round-trips sysex without its framing bytes', () => {
		const msg = parse([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
		expect(msg).toEqual({ type: 'sysex', data: [0x7e, 0x7f, 0x06, 0x01] });
		expect(encode(msg)).toEqual([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
	});
});

describe('14-bit helpers', () => {
	it('splits and recombines', () => {
		for (const v of [0, 1, 8191, 8192, 8193, 16383]) {
			const { msb, lsb } = split14(v);
			expect(combine14(msb, lsb)).toBe(v);
		}
	});

	it('maps bend to a signed unit range with an exact centre', () => {
		expect(bendToUnit(8192)).toBe(0);
		expect(bendToUnit(16383)).toBeCloseTo(1, 5);
		expect(bendToUnit(0)).toBeCloseTo(-1, 5);
		expect(unitToBend(0)).toBe(8192);
	});
});

describe('running status', () => {
	it('reuses the previous status byte', () => {
		const p = new RunningStatusParser();
		const out = p.push([0x90, 60, 100, 64, 96, 67, 92]);
		expect(out).toEqual([
			{ type: 'noteOn', channel: 0, note: 60, velocity: 100 },
			{ type: 'noteOn', channel: 0, note: 64, velocity: 96 },
			{ type: 'noteOn', channel: 0, note: 67, velocity: 92 }
		]);
	});

	it('lets real-time bytes interleave mid-message', () => {
		const p = new RunningStatusParser();
		const out = p.push([0x90, 60, 0xf8, 100]);
		expect(out).toEqual([
			{ type: 'clock' },
			{ type: 'noteOn', channel: 0, note: 60, velocity: 100 }
		]);
	});

	it('survives being fed one byte at a time', () => {
		const p = new RunningStatusParser();
		const out = [0xb0, 7, 127].flatMap((b) => p.push([b]));
		expect(out).toEqual([{ type: 'controlChange', channel: 0, controller: 7, value: 127 }]);
	});

	it('collects a sysex block', () => {
		const p = new RunningStatusParser();
		expect(p.push([0xf0, 0x43, 0x10, 0xf7])).toEqual([{ type: 'sysex', data: [0x43, 0x10] }]);
	});
});

describe('families', () => {
	it('puts channel mode messages with the system group, not with controllers', () => {
		expect(family(parse([0xb0, 74, 10]))).toBe('cc');
		expect(family(parse([0xb0, 123, 0]))).toBe('common');
	});
});
