import { describe, expect, it } from 'vitest';
import {
	decodeVlq,
	encodeVlq,
	isMeta,
	readMidiFile,
	summarise,
	writeMidiFile,
	type TrackEvent
} from './smf';

describe('variable-length quantities', () => {
	// The canonical examples from the Standard MIDI File specification.
	const cases: Array<[number, number[]]> = [
		[0, [0x00]],
		[0x40, [0x40]],
		[0x7f, [0x7f]],
		[0x80, [0x81, 0x00]],
		[0x2000, [0xc0, 0x00]],
		[0x3fff, [0xff, 0x7f]],
		[0x100000, [0xc0, 0x80, 0x00]],
		[0x0fffffff, [0xff, 0xff, 0xff, 0x7f]]
	];

	it('encodes the spec examples', () => {
		for (const [value, bytes] of cases) expect(encodeVlq(value)).toEqual(bytes);
	});

	it('round-trips', () => {
		for (const [value] of cases) {
			const bytes = encodeVlq(value);
			expect(decodeVlq(bytes, 0)).toEqual({ value, next: bytes.length });
		}
	});
});

describe('midi files', () => {
	const events: TrackEvent[] = [
		{ delta: 0, tick: 0, event: { type: 'programChange', channel: 0, program: 4 } },
		{ delta: 0, tick: 0, event: { type: 'noteOn', channel: 0, note: 60, velocity: 100 } },
		{ delta: 480, tick: 480, event: { type: 'noteOff', channel: 0, note: 60, velocity: 0 } },
		{ delta: 0, tick: 480, event: { type: 'noteOn', channel: 0, note: 64, velocity: 88 } },
		{ delta: 960, tick: 1440, event: { type: 'noteOff', channel: 0, note: 64, velocity: 0 } }
	];

	it('writes a file that reads back identically', () => {
		const bytes = writeMidiFile([{ name: 'Lead', events }], { bpm: 96, name: 'Test' });
		const file = readMidiFile(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
		);

		expect(file.format).toBe(1);
		expect(file.division).toBe(480);
		// Conductor track plus one part.
		expect(file.tracks).toHaveLength(2);

		const summary = summarise(file);
		expect(summary.noteCount).toBe(2);
		expect(summary.tempo).toBeCloseTo(96, 1);
		expect(summary.channelsUsed).toEqual([0]);
		expect(summary.durationTicks).toBe(1440);
		expect(summary.names).toContain('Lead');
	});

	it('preserves note numbers and velocities through the round trip', () => {
		const bytes = writeMidiFile([{ events }]);
		const file = readMidiFile(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
		);
		const notes = file.tracks
			.flatMap((t) => t.events)
			.map((e) => e.event)
			.filter((e) => !isMeta(e) && e.type === 'noteOn');

		expect(notes).toEqual([
			{ type: 'noteOn', channel: 0, note: 60, velocity: 100 },
			{ type: 'noteOn', channel: 0, note: 64, velocity: 88 }
		]);
	});

	it('ends every track with End of Track', () => {
		const bytes = writeMidiFile([{ events }]);
		const file = readMidiFile(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
		);
		for (const track of file.tracks) {
			const last = track.events[track.events.length - 1].event;
			expect(isMeta(last) && last.subtype).toBe(0x2f);
		}
	});
});
