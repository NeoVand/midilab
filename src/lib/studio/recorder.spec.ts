import { describe, expect, it } from 'vitest';
import { TakeRecorder } from './recorder';

describe('recording a real performance', () => {
	it('bakes pedal sustain into note lengths without releasing keys that remain down', () => {
		const recorder = new TakeRecorder({ bpm: 60 });
		recorder.start(0);
		recorder.handle({ type: 'controlChange', channel: 3, controller: 64, value: 127 }, 0);
		recorder.handle({ type: 'noteOn', channel: 3, note: 60, velocity: 90 }, 0);
		recorder.handle({ type: 'noteOn', channel: 3, note: 64, velocity: 80 }, 0);
		recorder.handle({ type: 'noteOff', channel: 3, note: 60, velocity: 0 }, 500);
		recorder.handle({ type: 'controlChange', channel: 3, controller: 64, value: 0 }, 1500);
		recorder.handle({ type: 'noteOff', channel: 3, note: 64, velocity: 0 }, 2000);
		const notes = recorder.finish(3000);
		expect(notes.map(({ note, duration }) => ({ note, duration }))).toEqual([
			{ note: 60, duration: 1.5 },
			{ note: 64, duration: 2 }
		]);
	});
	it('uses actual input timestamps, excluding count-in notes', () => {
		const recorder = new TakeRecorder({ bpm: 120 });
		recorder.start(1000);
		recorder.handle({ type: 'noteOn', channel: 3, note: 60, velocity: 90 }, 900);
		recorder.handle({ type: 'noteOn', channel: 3, note: 64, velocity: 76 }, 1250);
		recorder.handle({ type: 'noteOff', channel: 3, note: 64, velocity: 0 }, 1625);
		const notes = recorder.finish(2000);
		expect(notes).toHaveLength(1);
		expect(notes[0]).toMatchObject({ note: 64, start: 0.5, duration: 0.75, velocity: 76 });
	});

	it('retains repeated strikes and closes held notes at the end of the take', () => {
		const recorder = new TakeRecorder({ bpm: 60 });
		recorder.start(0);
		recorder.handle({ type: 'noteOn', channel: 9, note: 38, velocity: 80 }, 0);
		recorder.handle({ type: 'noteOn', channel: 9, note: 38, velocity: 110 }, 500);
		const notes = recorder.finish(1000);
		expect(notes.map(({ start, duration, velocity }) => ({ start, duration, velocity }))).toEqual([
			{ start: 0, duration: 0.5, velocity: 80 },
			{ start: 0.5, duration: 0.5, velocity: 110 }
		]);
	});

	it('recognizes velocity-zero release and separates hardware sources', () => {
		const recorder = new TakeRecorder({ bpm: 120 });
		recorder.start(0);
		recorder.handle({ type: 'noteOn', channel: 0, note: 60, velocity: 88 }, 0, 'keyboard');
		recorder.handle({ type: 'noteOn', channel: 0, note: 60, velocity: 70 }, 250, 'pads');
		recorder.handle({ type: 'noteOn', channel: 0, note: 60, velocity: 0 }, 500, 'keyboard');
		const notes = recorder.finish(750);
		expect(notes.map(({ start, duration }) => ({ start, duration }))).toEqual([
			{ start: 0, duration: 1 },
			{ start: 0.5, duration: 1 }
		]);
	});

	it('clips the final sustain to eight bars and compensates a measured input delay', () => {
		const recorder = new TakeRecorder({ bpm: 60, latencyMs: 50, grid: 0.25 });
		recorder.start(0);
		recorder.handle({ type: 'noteOn', channel: 3, note: 67, velocity: 100 }, 31_850);
		const notes = recorder.finish(40_000);
		expect(notes[0]).toMatchObject({ start: 31.75, duration: 0.25 });
		expect(recorder.finish(41_000)).toEqual(notes);
	});
});
