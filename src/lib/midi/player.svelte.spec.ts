import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import PlayerHarness from './__tests__/PlayerHarness.svelte';
import { SequencePlayer, notesToEvents } from './player.svelte';
import { engine } from './engine.svelte';
import { bus } from './bus';
import { audio } from '$lib/audio/engine';
import { claimDemoPlayback } from '$lib/audio/demo-focus';

const notes = notesToEvents([{ note: 60, start: 0, duration: 1, channel: 0 }], 100);
let component: ReturnType<typeof mount> | undefined;
let release: (() => void) | undefined;
let now = 0;
beforeEach(() => {
	now = 0;
	vi.spyOn(engine, 'wake').mockResolvedValue();
	vi.spyOn(engine, 'send').mockImplementation(() => {});
	vi.spyOn(audio, 'now', 'get').mockImplementation(() => now);
});
afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	release?.();
	release = undefined;
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});
async function setup() {
	let player: SequencePlayer | undefined;
	component = mount(PlayerHarness, {
		target: document.body,
		props: {
			receive: (value) => {
				player = value;
			}
		}
	});
	await tick();
	return player!;
}

function emitCommand(command: 120 | 123 | 'reset') {
	bus.emit({
		time: performance.now(),
		portId: 'test:panic',
		portName: 'Panic test',
		direction: 'out',
		bytes: command === 'reset' ? [0xff] : [0xb0, command, 0],
		message:
			command === 'reset'
				? { type: 'reset' }
				: { type: 'controlChange', channel: 0, controller: command, value: 0 }
	});
}

describe('shared demonstration playback', () => {
	it('switches from non-MIDI sound to a sequence and back without overlapping', async () => {
		const player = await setup();
		const stopAcoustic = vi.fn();
		release = claimDemoPlayback(stopAcoustic);
		await player.play(notes);
		expect(stopAcoustic).toHaveBeenCalledOnce();
		expect(player.playing).toBe(true);
		release = claimDemoPlayback(vi.fn());
		expect(player.playing).toBe(false);
		expect(engine.send).toHaveBeenCalledWith(
			{ type: 'controlChange', channel: 0, controller: 123, value: 0 },
			undefined,
			undefined,
			'demo'
		);
	});

	it('cancels a sequence still awaiting audio when another demo claims playback', async () => {
		const player = await setup();
		let finish: (() => void) | undefined;
		vi.mocked(engine.wake).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const pending = player.play(notes);
		release = claimDemoPlayback(vi.fn());
		finish!();
		await pending;
		expect(player.playing).toBe(false);
		expect(engine.send).not.toHaveBeenCalled();
	});

	it('keeps the newest sequence when an older audio resume resolves afterward', async () => {
		const player = await setup();
		let finish: (() => void) | undefined;
		vi.mocked(engine.wake).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const pending = player.play(notes);
		await player.play(notesToEvents([{ note: 67, start: 0, duration: 1, channel: 0 }], 100));
		finish!();
		await pending;
		expect(player.playing).toBe(true);
		expect(engine.send).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'noteOn', note: 67 }),
			expect.any(Number),
			expect.any(Number),
			'demo'
		);
		expect(engine.send).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: 'noteOn', note: 60 }),
			expect.any(Number),
			expect.any(Number),
			'demo'
		);
	});

	it('does not restart after component teardown while awaiting audio', async () => {
		const player = await setup();
		let finish: (() => void) | undefined;
		vi.mocked(engine.wake).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const pending = player.play(notes);
		await unmount(component!);
		component = undefined;
		finish!();
		await pending;
		expect(player.playing).toBe(false);
		expect(engine.send).not.toHaveBeenCalled();
	});

	it('releases a failed request without stopping a later demonstration', async () => {
		const player = await setup();
		let fail: ((error: Error) => void) | undefined;
		vi.mocked(engine.wake).mockImplementationOnce(
			() =>
				new Promise<void>((_resolve, reject) => {
					fail = reject;
				})
		);
		const pending = player.play(notes);
		const stopAcoustic = vi.fn();
		release = claimDemoPlayback(stopAcoustic);
		fail!(new Error('Interrupted audio resume'));
		await pending;
		expect(stopAcoustic).not.toHaveBeenCalled();
		release = claimDemoPlayback(vi.fn());
		expect(stopAcoustic).toHaveBeenCalledOnce();
	});

	it('releases the playback claim at the natural end', async () => {
		vi.useFakeTimers();
		const player = await setup();
		await player.play(notes);
		now = 2;
		await vi.advanceTimersByTimeAsync(25);
		expect(player.playing).toBe(false);
		vi.mocked(engine.send).mockClear();
		release = claimDemoPlayback(vi.fn());
		expect(engine.send).not.toHaveBeenCalled();
	});

	it.each([120, 'reset'] as const)('cancels later notes after %s', async (command) => {
		vi.useFakeTimers();
		const player = await setup();
		await player.play(
			notesToEvents(
				[
					{ note: 60, start: 0, duration: 0.2, channel: 0 },
					{ note: 67, start: 1, duration: 0.4, channel: 0 }
				],
				60
			)
		);
		emitCommand(command);
		expect(player.playing).toBe(false);
		now = 3;
		await vi.advanceTimersByTimeAsync(3000);
		expect(engine.send).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: 'noteOn', note: 67 }),
			expect.any(Number),
			expect.any(Number),
			'demo'
		);
	});

	it('cancels a pending audio wake on Panic', async () => {
		const player = await setup();
		let finish: (() => void) | undefined;
		vi.mocked(engine.wake).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const pending = player.play(notes);
		emitCommand(120);
		finish!();
		await pending;
		expect(player.playing).toBe(false);
		expect(engine.send).not.toHaveBeenCalled();
	});

	it('keeps playing through normal All Notes Off messages and removes its bus subscription at teardown', async () => {
		const listeners = bus.listenerCount;
		const player = await setup();
		expect(bus.listenerCount).toBe(listeners + 1);
		await player.play(notes);
		emitCommand(123);
		expect(player.playing).toBe(true);
		await unmount(component!);
		component = undefined;
		expect(bus.listenerCount).toBe(listeners);
	});
});
