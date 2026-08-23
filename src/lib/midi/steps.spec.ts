import { describe, it, expect } from 'vitest';
import { stepsToMidiFile, type SeqTrack } from './steps';
import { isMeta, readMidiFile, summarise } from './smf';

function toBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

const kick: SeqTrack = {
	id: 'k',
	name: 'Kick',
	note: 36,
	channel: 9,
	steps: [110, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0],
	mute: false
};
const hat: SeqTrack = {
	id: 'h',
	name: 'Hat',
	note: 42,
	channel: 9,
	steps: [70, 0, 58, 0, 70, 0, 58, 0, 70, 0, 58, 0, 70, 0, 58, 0],
	mute: false
};

describe('exporting a step pattern', () => {
	it('writes a file the reader accepts, one track per part plus the conductor', () => {
		const file = readMidiFile(toBuffer(stepsToMidiFile([kick, hat], { stepCount: 16, bpm: 128 })));
		expect(file.format).toBe(1);
		expect(file.tracks).toHaveLength(3);

		const summary = summarise(file);
		expect(summary.tempo).toBeCloseTo(128, 1);
		expect(summary.noteCount).toBe(10);
		expect(summary.channelsUsed).toEqual([9]);
		expect(summary.names).toEqual(expect.arrayContaining(['Kick', 'Hat']));
	});

	it('places every step where the grid says it is', () => {
		const file = readMidiFile(toBuffer(stepsToMidiFile([kick], { stepCount: 16, bpm: 120 })));
		const ons = file.tracks
			.flatMap((t) => t.events)
			.flatMap((e) =>
				!isMeta(e.event) && e.event.type === 'noteOn'
					? [{ tick: e.tick, velocity: e.event.velocity }]
					: []
			);
		// A sixteenth is a quarter of the 480-tick division.
		expect(ons.map((o) => o.tick)).toEqual([0, 8 * 120]);
		expect(ons.map((o) => o.velocity)).toEqual([110, 100]);
	});

	it('releases every note it starts', () => {
		const file = readMidiFile(toBuffer(stepsToMidiFile([kick, hat], { stepCount: 16, bpm: 120 })));
		const events = file.tracks.flatMap((t) => t.events).map((e) => e.event);
		const ons = events.filter((e) => !isMeta(e) && e.type === 'noteOn').length;
		const offs = events.filter((e) => !isMeta(e) && e.type === 'noteOff').length;
		expect(offs).toBe(ons);
	});

	it('leaves a muted part out — a MIDI file has no mute', () => {
		const file = readMidiFile(
			toBuffer(stepsToMidiFile([kick, { ...hat, mute: true }], { stepCount: 16, bpm: 120 }))
		);
		expect(summarise(file).names).not.toContain('Hat');
		expect(summarise(file).noteCount).toBe(2);
	});

	it('writes only the steps inside the current pattern length', () => {
		const long = { ...kick, steps: [...kick.steps, ...kick.steps.map(() => 90)] };
		const file = readMidiFile(toBuffer(stepsToMidiFile([long], { stepCount: 16, bpm: 120 })));
		expect(summarise(file).noteCount).toBe(2);
	});

	it('writes nothing but the conductor when every part is empty', () => {
		const file = readMidiFile(
			toBuffer(
				stepsToMidiFile([{ ...kick, steps: Array(16).fill(0) }], { stepCount: 16, bpm: 120 })
			)
		);
		expect(file.tracks).toHaveLength(1);
		expect(summarise(file).noteCount).toBe(0);
	});
});
