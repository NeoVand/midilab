import { describe, expect, it, vi } from 'vitest';
import { IntervalTone } from './interval-tone';
import type { SynthHost } from './engine';
import { MidiBus } from '$lib/midi/bus';
import { claimDemoPlayback } from './demo-focus';

function host() {
	const oscillators: { stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
	const destination = {} as GainNode;
	const context = {
		state: 'running',
		currentTime: 0,
		sampleRate: 48000,
		createGain: () => {
			const node = {
				gain: {
					value: 1,
					setValueAtTime: vi.fn(),
					linearRampToValueAtTime: vi.fn(),
					cancelScheduledValues: vi.fn()
				},
				connect: vi.fn((destination: unknown) => destination),
				disconnect: vi.fn()
			};
			node.connect.mockReturnValue(node);
			return node;
		},
		createOscillator: () => {
			const node = {
				type: 'sine',
				frequency: { setValueAtTime: vi.fn() },
				connect: vi.fn((destination: unknown) => destination),
				disconnect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn(),
				onended: null
			};
			oscillators.push(node);
			return node;
		}
	} as unknown as BaseAudioContext;
	const audioHost = {
		context,
		destination,
		reverbSend: null,
		delaySend: null,
		noiseBuffer: null,
		resume: vi.fn(async () => context)
	} satisfies SynthHost;
	return { context, audioHost, oscillators };
}

describe('the acoustic audition lifecycle', () => {
	it('shares playback ownership with MIDI examples and stops for demo notes', async () => {
		const { audioHost } = host();
		const eventBus = new MidiBus();
		const tone = new IntervalTone(audioHost, eventBus);
		const sequenceStop = vi.fn();
		const releaseSequence = claimDemoPlayback(sequenceStop);
		try {
			await tone.play([220], 'pure');
			expect(sequenceStop).toHaveBeenCalledOnce();
			expect(tone.playing).toBe(true);
			eventBus.emit({
				time: 0,
				direction: 'out',
				portId: 'demo',
				portName: 'demo',
				origin: 'demo',
				bytes: [0x90, 60, 90],
				message: { type: 'noteOn', channel: 0, note: 60, velocity: 90 }
			});
			expect(tone.playing).toBe(false);
		} finally {
			tone.dispose();
			releaseSequence();
		}
	});

	it('stops its partials on Panic and unsubscribes on disposal', async () => {
		const { audioHost, oscillators } = host();
		const eventBus = new MidiBus();
		const tone = new IntervalTone(audioHost, eventBus);
		try {
			expect(await tone.play([220, 330], 'harmonic')).toBe(true);
			expect(oscillators).toHaveLength(12);
			expect(tone.playing).toBe(true);
			eventBus.emit({
				time: 0,
				direction: 'out',
				portId: 'test',
				portName: 'test',
				bytes: [0xb0, 120, 0],
				message: { type: 'controlChange', channel: 0, controller: 120, value: 0 }
			});
			expect(tone.playing).toBe(false);
			expect(oscillators.every((oscillator) => oscillator.stop.mock.lastCall?.[0] === 0.035)).toBe(
				true
			);
		} finally {
			tone.dispose();
		}
		expect(eventBus.listenerCount).toBe(0);
	});

	it('cannot start later after a pending audio wake was cancelled', async () => {
		const { audioHost, context, oscillators } = host();
		let wake!: (context: BaseAudioContext) => void;
		audioHost.resume.mockImplementation(
			() =>
				new Promise((resolve) => {
					wake = resolve;
				})
		);
		const tone = new IntervalTone(audioHost, new MidiBus());
		try {
			const pending = tone.play([220], 'pure');
			tone.stop();
			wake(context);
			expect(await pending).toBe(false);
			expect(oscillators).toHaveLength(0);
		} finally {
			tone.dispose();
		}
	});

	it('lets a newer demo cancel a pending acoustic audition before audio wakes', async () => {
		const { audioHost, context, oscillators } = host();
		let wake!: (context: BaseAudioContext) => void;
		audioHost.resume.mockImplementation(
			() =>
				new Promise((resolve) => {
					wake = resolve;
				})
		);
		const tone = new IntervalTone(audioHost, new MidiBus());
		const pending = tone.play([220], 'pure');
		const releaseNewer = claimDemoPlayback(vi.fn());
		try {
			wake(context);
			expect(await pending).toBe(false);
			expect(oscillators).toHaveLength(0);
		} finally {
			tone.dispose();
			releaseNewer();
		}
	});

	it('notifies the UI after the last partial ends naturally', async () => {
		const { audioHost, oscillators } = host();
		const tone = new IntervalTone(audioHost, new MidiBus());
		try {
			await tone.play([220], 'pure', 0.2);
			const stopped = vi.fn();
			tone.onStop(stopped);
			oscillators[0].onended?.();
			expect(tone.playing).toBe(false);
			expect(stopped).toHaveBeenCalledOnce();
		} finally {
			tone.dispose();
		}
	});
});
