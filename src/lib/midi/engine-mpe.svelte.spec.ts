import { afterEach, describe, expect, it, vi } from 'vitest';
import { MidiEngine, INTERNAL_OUTPUT_ID } from './engine.svelte';
import { bus, type MidiEvent } from './bus';
import { midiAccess } from './access.svelte';
import { transport } from './clock.svelte';
import { MpeMonitor } from '$lib/audio/mpe-monitor';
import { makeZone } from './mpe';

let engine: MidiEngine | null = null;
afterEach(() => {
	engine?.stop();
	engine = null;
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('MPE browser input/output isolation', () => {
	it('claimed MPE releases cannot silence another input holding the same channel and pitch', () => {
		engine = new MidiEngine();
		vi.spyOn(transport, 'bindOutput').mockImplementation(() => {});
		vi.spyOn(transport, 'watchExternal').mockImplementation(() => () => {});
		const internal = vi.spyOn(engine, 'handleInternal').mockImplementation(() => {});
		const monitor = new MpeMonitor();
		monitor.attachInput(engine);
		monitor.setInput('osmose-play', makeZone('lower', 2), true);
		engine.start();
		try {
			bus.emit({
				time: 0,
				direction: 'in',
				portId: 'ordinary-keyboard',
				portName: 'Ordinary keyboard',
				bytes: [],
				message: { type: 'noteOn', channel: 1, note: 60, velocity: 90 }
			});
			expect(internal).toHaveBeenCalledOnce();
			internal.mockClear();
			bus.emit({
				time: 0,
				direction: 'in',
				portId: 'osmose-play',
				portName: 'Osmose Play',
				bytes: [],
				message: { type: 'noteOff', channel: 1, note: 60, velocity: 64 }
			});
			expect(internal).not.toHaveBeenCalled();
		} finally {
			monitor.dispose();
		}
	});

	it('releases an earlier GM note only for the selected source and claimed channels', () => {
		engine = new MidiEngine();
		vi.spyOn(transport, 'bindOutput').mockImplementation(() => {});
		vi.spyOn(transport, 'watchExternal').mockImplementation(() => () => {});
		const internal = vi.spyOn(engine, 'handleInternal').mockImplementation(() => {});
		engine.start();
		const input = (portId: string, channel: number, note: number) =>
			bus.emit({
				time: 0,
				direction: 'in',
				portId,
				portName: portId,
				bytes: [],
				message: { type: 'noteOn', channel, note, velocity: 90 }
			});
		input('osmose-play', 1, 60);
		input('osmose-play', 5, 64);
		input('other', 1, 67);
		internal.mockClear();
		engine.releaseInputAudition('osmose-play', [0, 1, 2]);
		expect(internal).toHaveBeenCalledExactlyOnceWith({
			type: 'noteOff',
			channel: 1,
			note: 60,
			velocity: 0
		});
		engine.releaseInputAudition('osmose-play', [0, 1, 2]);
		expect(internal).toHaveBeenCalledOnce();
	});

	it('counts dedicated browser voices and removes their counter on teardown', () => {
		vi.useFakeTimers();
		engine = new MidiEngine();
		vi.spyOn(transport, 'bindOutput').mockImplementation(() => {});
		vi.spyOn(transport, 'watchExternal').mockImplementation(() => () => {});
		const detach = engine.registerBrowserVoiceCount(() => 7);
		engine.start();
		vi.advanceTimersByTime(200);
		expect(engine.voiceCount).toBe(7);
		detach();
		vi.advanceTimersByTime(200);
		expect(engine.voiceCount).toBe(0);
	});

	it('Panic reaches browser-only voices even when no outputs are active', () => {
		engine = new MidiEngine();
		engine.activeOutputs = [];
		const hardware = vi.spyOn(midiAccess, 'sendRaw').mockReturnValue(true);
		const internal = vi.spyOn(engine, 'handleInternal').mockImplementation(() => {});
		const events: MidiEvent[] = [];
		const unsubscribe = bus.subscribe((event) => events.push(event));
		try {
			engine.panic();
			expect(hardware).not.toHaveBeenCalled();
			expect(internal).toHaveBeenCalledWith({ type: 'reset' });
			expect(events).toHaveLength(1);
			expect(events[0]).toMatchObject({
				portId: 'engine',
				direction: 'out',
				bytes: [],
				message: { type: 'reset' }
			});
		} finally {
			unsubscribe();
		}
	});

	it('publishes exactly one internal event with original channel/provenance, without broadcasting or routing', () => {
		engine = new MidiEngine();
		engine.activeOutputs = [INTERNAL_OUTPUT_ID, 'hardware'];
		const hardware = vi.spyOn(midiAccess, 'sendRaw').mockReturnValue(true);
		const internal = vi.spyOn(engine, 'handleInternal').mockImplementation(() => {});
		const local = vi.fn();
		const detachLocal = engine.onLocalSend(local);
		const events: MidiEvent[] = [];
		const unsubscribe = bus.subscribe((event) => events.push(event));
		try {
			engine.sendInternal({ type: 'noteOn', channel: 9, note: 60, velocity: 90 }, 'demo', false);
			expect(hardware).not.toHaveBeenCalled();
			expect(local).not.toHaveBeenCalled();
			expect(internal).not.toHaveBeenCalled();
			expect(events).toHaveLength(1);
			expect(events[0]).toMatchObject({
				portId: INTERNAL_OUTPUT_ID,
				direction: 'out',
				origin: 'demo',
				message: { type: 'noteOn', channel: 9, note: 60, velocity: 90 },
				bytes: [0x99, 60, 90]
			});
			engine.sendInternal({ type: 'noteOff', channel: 9, note: 60, velocity: 0 });
			expect(events[1].origin).toBe('performer');
			expect(internal).toHaveBeenCalledOnce();
		} finally {
			detachLocal();
			unsubscribe();
		}
	});

	it('replaces selected input audition without hiding the input event or changing its channel', () => {
		engine = new MidiEngine();
		vi.spyOn(transport, 'bindOutput').mockImplementation(() => {});
		vi.spyOn(transport, 'watchExternal').mockImplementation(() => () => {});
		const internal = vi.spyOn(engine, 'handleInternal').mockImplementation(() => {});
		const intercept = vi.fn((event: MidiEvent) => event.portId === 'osmose-play');
		const detach = engine.interceptInputAudition(intercept);
		const observed: MidiEvent[] = [];
		const unsubscribe = bus.subscribe((event) => observed.push(event));
		engine.start();
		const input = (portId: string) =>
			bus.emit({
				time: 0,
				direction: 'in',
				portId,
				portName: portId,
				bytes: [0x91, 60, 90],
				message: { type: 'noteOn', channel: 1, note: 60, velocity: 90 }
			});
		try {
			input('osmose-play');
			expect(internal).not.toHaveBeenCalled();
			expect(observed[0].message).toMatchObject({ channel: 1 });
			input('ordinary-keyboard');
			expect(internal).toHaveBeenCalledOnce();
			detach();
			input('osmose-play');
			expect(internal).toHaveBeenCalledTimes(2);
		} finally {
			detach();
			unsubscribe();
		}
	});
});
