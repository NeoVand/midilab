import { describe, expect, it } from 'vitest';
import { MidiBus, type MidiOrigin } from './bus';

describe('MIDI message provenance', () => {
	it('tags hardware and legacy producers as performer input while retaining explicit origins', () => {
		const bus = new MidiBus();
		const received: MidiOrigin[] = [];
		bus.subscribe((event) => received.push(event.origin!));
		const event = {
			time: 10,
			portId: 'controller',
			portName: 'Controller',
			direction: 'in' as const,
			bytes: [0x90, 60, 90],
			message: { type: 'noteOn' as const, channel: 0, note: 60, velocity: 90 }
		};
		bus.emit(event);
		bus.emit({ ...event, origin: 'demo' });
		bus.emit({ ...event, origin: 'sequence' });
		expect(received).toEqual(['performer', 'demo', 'sequence']);
	});
});
