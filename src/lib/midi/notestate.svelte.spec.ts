import { describe, expect, it } from 'vitest';
import { NoteState } from './notestate.svelte';
import { bus, type MidiOrigin } from './bus';
import { encode, type MidiMessage } from './messages';

function emit(message: MidiMessage, origin: MidiOrigin) {
	bus.emit({
		time: performance.now(),
		portId: 'test',
		portName: 'Test',
		direction: 'out',
		bytes: encode(message),
		message,
		origin
	});
}

describe('performer-only musical state', () => {
	it('keeps demonstrations visible without crediting a played chord', () => {
		const state = new NoteState();
		const stop = state.start();
		try {
			for (const note of [60, 64, 67])
				emit({ type: 'noteOn', note, channel: 0, velocity: 90 }, 'demo');
			expect(state.held).toEqual([60, 64, 67]);
			expect(state.performerHeld).toEqual([]);
			emit({ type: 'noteOn', note: 72, channel: 0, velocity: 90 }, 'performer');
			expect(state.performerHeld).toEqual([72]);
			emit({ type: 'noteOn', note: 55, channel: 1, velocity: 90 }, 'sequence');
			expect(state.performerHeldCount).toBe(1);
			emit({ type: 'noteOff', note: 72, channel: 0, velocity: 0 }, 'performer');
			expect(state.performerHeldCount).toBe(0);
		} finally {
			stop();
		}
	});
	it('clears performer notes on panic and reset', () => {
		const state = new NoteState();
		const stop = state.start();
		try {
			emit({ type: 'noteOn', note: 60, channel: 0, velocity: 90 }, 'performer');
			emit({ type: 'controlChange', controller: 123, value: 0, channel: 0 }, 'performer');
			expect(state.performerHeldCount).toBe(0);
			emit({ type: 'noteOn', note: 62, channel: 0, velocity: 90 }, 'performer');
			state.reset();
			expect(state.performerHeldCount).toBe(0);
		} finally {
			stop();
		}
	});
});
