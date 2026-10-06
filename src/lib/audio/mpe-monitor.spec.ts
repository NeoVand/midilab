import { afterEach, describe, expect, it, vi } from 'vitest';
import { MpeMonitor, type MpeSoundVoice } from './mpe-monitor';
import type { SynthHost } from './engine';
import { MidiBus, type MidiEvent } from '$lib/midi/bus';
import { makeZone } from '$lib/midi/mpe';
import { MpeInputState } from '$lib/midi/mpe-state';
import { setBendRange } from '$lib/midi/rpn';
import { noteToFrequency } from '$lib/midi/notes';
import { claimDemoPlayback } from './demo-focus';

function parameter(value = 0) {
	return {
		value,
		setValueAtTime: vi.fn(),
		setTargetAtTime: vi.fn(),
		cancelScheduledValues: vi.fn()
	};
}

function host() {
	const oscillators: ReturnType<typeof oscillator>[] = [];
	const gains: ReturnType<typeof gain>[] = [];
	const filters: ReturnType<typeof filter>[] = [];
	const panners: ReturnType<typeof panner>[] = [];
	function node() {
		const result = { connect: vi.fn(), disconnect: vi.fn() };
		result.connect.mockImplementation((target) => target);
		return result;
	}
	function oscillator() {
		return {
			...node(),
			type: 'sine',
			frequency: parameter(),
			detune: parameter(),
			start: vi.fn(),
			stop: vi.fn(),
			onended: null as (() => void) | null
		};
	}
	function gain() {
		return { ...node(), gain: parameter(1) };
	}
	function filter() {
		return { ...node(), type: 'lowpass', frequency: parameter(), Q: parameter() };
	}
	function panner() {
		return { ...node(), pan: parameter() };
	}
	const context = {
		state: 'running',
		currentTime: 0,
		sampleRate: 48000,
		createOscillator: () => {
			const item = oscillator();
			oscillators.push(item);
			return item;
		},
		createGain: () => {
			const item = gain();
			gains.push(item);
			return item;
		},
		createBiquadFilter: () => {
			const item = filter();
			filters.push(item);
			return item;
		},
		createStereoPanner: () => {
			const item = panner();
			panners.push(item);
			return item;
		}
	} as unknown as BaseAudioContext;
	const audioHost = {
		context,
		destination: {} as GainNode,
		reverbSend: null,
		delaySend: null,
		noiseBuffer: null,
		resume: vi.fn(async () => context)
	} satisfies SynthHost;
	return { context, audioHost, oscillators, gains, filters, panners };
}

const voice = (values: Partial<MpeSoundVoice> = {}): MpeSoundVoice => ({
	id: 1,
	channel: 1,
	note: 60,
	velocity: 90,
	pitchSemitones: 0,
	effectivePressure: 0,
	timbre: 64,
	effectiveTimbre: 64,
	...values
});

const monitors: MpeMonitor[] = [];
function monitor(audioHost: SynthHost, eventBus = new MidiBus()) {
	const item = new MpeMonitor(audioHost, eventBus);
	monitors.push(item);
	return item;
}
afterEach(() => {
	for (const item of monitors.splice(0)) item.dispose();
	vi.restoreAllMocks();
});

describe('dedicated MPE browser sound', () => {
	it('maps CC74 to tone separately from pressure loudness and brightness', async () => {
		const { audioHost, oscillators, gains, filters } = host();
		const sound = monitor(audioHost);
		await sound.enable();
		const first = voice({ timbre: 0, effectiveTimbre: 0 });
		sound.update([first]);
		const level = gains[0].gain.setTargetAtTime.mock.lastCall![0];
		const tone = filters[0].frequency.setTargetAtTime.mock.lastCall![0];
		const pitch = oscillators[0].frequency.setTargetAtTime.mock.lastCall![0];
		sound.update([{ ...first, timbre: 127, effectiveTimbre: 127 }]);
		expect(gains[0].gain.setTargetAtTime.mock.lastCall![0]).toBe(level);
		expect(filters[0].frequency.setTargetAtTime.mock.lastCall![0]).toBeGreaterThan(tone);
		expect(oscillators[0].frequency.setTargetAtTime.mock.lastCall![0]).toBe(pitch);
		sound.update([{ ...first, effectivePressure: 127 }]);
		expect(gains[0].gain.setTargetAtTime.mock.lastCall![0]).toBeGreaterThan(level);
		expect(filters[0].frequency.setTargetAtTime.mock.lastCall![0]).toBeGreaterThan(tone);
	});

	it('renders more than sixteen sustained notes by their IDs even when channels repeat', async () => {
		const { audioHost } = host();
		const sound = monitor(audioHost);
		await sound.enable();
		sound.update(
			Array.from({ length: 24 }, (_, index) => voice({ id: index, channel: 1, note: 48 + index }))
		);
		expect(sound.voiceCount).toBe(24);
	});

	it('does not restart stopped voices from stale expression snapshots, but accepts a new note', async () => {
		const { audioHost, oscillators } = host();
		const sound = monitor(audioHost);
		await sound.enable();
		sound.update([voice()]);
		sound.stop();
		sound.update([voice({ effectivePressure: 127 })]);
		expect(sound.playing).toBe(false);
		expect(oscillators).toHaveLength(2);
		sound.update([voice({ id: 2 })]);
		expect(sound.playing).toBe(true);
		expect(oscillators).toHaveLength(4);
	});

	it('creates no audio until the user explicitly enables the monitor', async () => {
		const { audioHost, oscillators } = host();
		const sound = monitor(audioHost);
		sound.update([voice()]);
		expect(audioHost.resume).not.toHaveBeenCalled();
		expect(oscillators).toHaveLength(0);
		expect(await sound.enable()).toBe(true);
		sound.update([voice()]);
		expect(sound.voiceCount).toBe(1);
		expect(oscillators).toHaveLength(2);
	});

	it('changes one note’s pitch, pressure loudness and CC74 tone without touching another note', async () => {
		const { audioHost, oscillators, gains, filters } = host();
		const sound = monitor(audioHost);
		await sound.enable();
		const first = voice();
		const second = voice({ id: 2, channel: 2, note: 64 });
		sound.update([first, second]);
		const secondPitch = oscillators[2].frequency.setTargetAtTime.mock.lastCall![0];
		const secondLevel = gains[2].gain.setTargetAtTime.mock.lastCall![0];
		const secondTone = filters[1].frequency.setTargetAtTime.mock.lastCall![0];
		const firstLevel = gains[0].gain.setTargetAtTime.mock.lastCall![0];
		const firstTone = filters[0].frequency.setTargetAtTime.mock.lastCall![0];
		sound.update([
			{ ...first, pitchSemitones: 7, effectivePressure: 127, timbre: 127, effectiveTimbre: 127 },
			second
		]);
		expect(oscillators).toHaveLength(4);
		expect(oscillators[0].frequency.setTargetAtTime.mock.lastCall![0]).toBeCloseTo(
			noteToFrequency(67)
		);
		expect(gains[0].gain.setTargetAtTime.mock.lastCall![0]).toBeGreaterThan(firstLevel);
		expect(filters[0].frequency.setTargetAtTime.mock.lastCall![0]).toBeGreaterThan(firstTone);
		expect(oscillators[2].frequency.setTargetAtTime.mock.lastCall![0]).toBe(secondPitch);
		expect(gains[2].gain.setTargetAtTime.mock.lastCall![0]).toBe(secondLevel);
		expect(filters[1].frequency.setTargetAtTime.mock.lastCall![0]).toBe(secondTone);
	});

	it('uses the input helper’s matched member and master RPN bend ranges', async () => {
		const { audioHost, oscillators } = host();
		const sound = monitor(audioHost);
		const state = new MpeInputState(makeZone('lower', 2, 48));
		for (const message of setBendRange(1, 12)) state.push(message);
		for (const message of setBendRange(0, 2)) state.push(message);
		state.push({ type: 'noteOn', channel: 1, note: 60, velocity: 90 });
		state.push({ type: 'pitchBend', channel: 1, value: 12288 });
		state.push({ type: 'pitchBend', channel: 0, value: 12288 });
		await sound.enable();
		sound.update(state.active);
		expect(oscillators[0].frequency.setTargetAtTime.mock.lastCall![0]).toBeCloseTo(
			noteToFrequency(67),
			0
		);
		expect(state.getBendRange(1)).toBe(12);
	});

	it('uses master CC74 offsets and keeps sustained released expression frozen when its member channel is reused', async () => {
		const { audioHost, oscillators, filters } = host();
		const sound = monitor(audioHost);
		const state = new MpeInputState(makeZone('lower', 2, 48));
		state.push({ type: 'controlChange', channel: 0, controller: 64, value: 127 });
		state.push({ type: 'noteOn', channel: 1, note: 60, velocity: 90 });
		state.push({ type: 'controlChange', channel: 1, controller: 74, value: 64 });
		await sound.enable();
		sound.update(state.active);
		const originalBrightness = filters[0].frequency.setTargetAtTime.mock.lastCall![0];
		state.push({ type: 'controlChange', channel: 0, controller: 74, value: 96 });
		sound.update(state.active);
		expect(filters[0].frequency.setTargetAtTime.mock.lastCall![0]).toBeGreaterThan(
			originalBrightness
		);
		state.push({ type: 'noteOff', channel: 1, note: 60, velocity: 0 });
		state.push({ type: 'noteOn', channel: 1, note: 64, velocity: 90 });
		state.push({ type: 'pitchBend', channel: 1, value: 12288 });
		sound.update(state.active);
		expect(sound.voiceCount).toBe(2);
		expect(oscillators[0].frequency.setTargetAtTime.mock.lastCall![0]).toBeCloseTo(
			noteToFrequency(60)
		);
		expect(oscillators[2].frequency.setTargetAtTime.mock.lastCall![0]).toBeGreaterThan(
			noteToFrequency(64)
		);
	});

	it('releases removed IDs, handles channel reuse, and disconnects every node after release', async () => {
		const { audioHost, oscillators, gains, filters, panners } = host();
		const sound = monitor(audioHost);
		await sound.enable();
		sound.update([voice()]);
		sound.update([voice({ id: 2, note: 62 })]);
		expect(sound.voiceCount).toBe(1);
		expect(oscillators[0].stop).toHaveBeenCalledWith(0.16);
		sound.update([]);
		expect(sound.playing).toBe(false);
		for (const oscillator of oscillators) oscillator.onended?.();
		expect(
			[...oscillators, ...gains, ...filters, ...panners].every(
				(node) => node.disconnect.mock.calls.length === 1
			)
		).toBe(true);
	});

	it('intercepts only an enabled selected input and zone while retaining ordinary input behavior otherwise', async () => {
		const { audioHost } = host();
		const sound = monitor(audioHost);
		let intercept!: (event: MidiEvent) => boolean;
		const detach = vi.fn();
		const releaseInput = vi.fn();
		const detachCount = vi.fn();
		sound.attachInput({
			releaseInputAudition: releaseInput,
			registerBrowserVoiceCount: () => detachCount,
			interceptInputAudition: (fn) => {
				intercept = fn;
				return detach;
			}
		});
		sound.setInput('osmose-play', makeZone('lower', 2));
		const incoming = (portId: string, channel: number) => ({
			id: 1,
			time: 0,
			direction: 'in' as const,
			portId,
			portName: portId,
			bytes: [],
			message: { type: 'noteOn' as const, channel, note: 60, velocity: 90 }
		});
		expect(intercept(incoming('osmose-play', 1))).toBe(false);
		await sound.enable();
		expect(releaseInput).toHaveBeenCalledWith('osmose-play', [0, 1, 2]);
		expect(intercept(incoming('osmose-play', 1))).toBe(true);
		expect(
			intercept({
				...incoming('osmose-play', 1),
				message: { type: 'noteOff', channel: 1, note: 60, velocity: 0 }
			})
		).toBe(true);
		expect(intercept(incoming('osmose-play', 0))).toBe(true);
		expect(intercept(incoming('other', 1))).toBe(false);
		expect(intercept(incoming('osmose-play', 6))).toBe(false);
		sound.disable();
		expect(intercept(incoming('osmose-play', 1))).toBe(false);
		sound.setInput('osmose-play', makeZone('lower', 2), true);
		expect(intercept(incoming('osmose-play', 1))).toBe(true);
		expect(intercept(incoming('osmose-play', 6))).toBe(true);
		expect(releaseInput).toHaveBeenLastCalledWith(
			'osmose-play',
			Array.from({ length: 16 }, (_, channel) => channel)
		);
		expect(intercept(incoming('other', 1))).toBe(false);
		sound.dispose();
		expect(detach).toHaveBeenCalledOnce();
		expect(detachCount).toHaveBeenCalledOnce();
	});

	it('silences the previous source on disconnect and a selected source’s All Sound Off', async () => {
		const { audioHost, oscillators } = host();
		const eventBus = new MidiBus();
		const sound = monitor(audioHost, eventBus);
		sound.setInput('osmose-play', makeZone('lower', 15));
		await sound.enable();
		sound.update([voice()]);
		eventBus.emit({
			time: 0,
			direction: 'in',
			portId: 'other',
			portName: 'other',
			bytes: [],
			message: { type: 'controlChange', channel: 1, controller: 120, value: 0 }
		});
		expect(sound.playing).toBe(true);
		eventBus.emit({
			time: 0,
			direction: 'in',
			portId: 'osmose-play',
			portName: 'Osmose',
			bytes: [],
			message: { type: 'controlChange', channel: 1, controller: 120, value: 0 }
		});
		expect(sound.playing).toBe(true);
		eventBus.emit({
			time: 0,
			direction: 'in',
			portId: 'osmose-play',
			portName: 'Osmose',
			bytes: [],
			message: { type: 'controlChange', channel: 0, controller: 120, value: 0 }
		});
		expect(sound.playing).toBe(false);
		expect(oscillators[0].stop.mock.lastCall![0]).toBe(0.025);
		sound.update([voice({ id: 2 })]);
		sound.setInput(null, makeZone('lower', 15));
		expect(sound.playing).toBe(false);
	});

	it.each(['disable', 'stop', 'dispose'] as const)(
		'cannot revive a pending enable after %s',
		async (action) => {
			const { audioHost, context, oscillators } = host();
			let wake!: (context: BaseAudioContext) => void;
			audioHost.resume.mockImplementation(
				() =>
					new Promise((resolve) => {
						wake = resolve;
					})
			);
			const sound = monitor(audioHost);
			const pending = sound.enable();
			sound[action]();
			wake(context);
			expect(await pending).toBe(false);
			sound.update([voice()]);
			expect(oscillators).toHaveLength(0);
		}
	);

	it('cancels a pending enable on Panic and removes its bus listener on disposal', async () => {
		const { audioHost, context } = host();
		let wake!: (context: BaseAudioContext) => void;
		audioHost.resume.mockImplementation(
			() =>
				new Promise((resolve) => {
					wake = resolve;
				})
		);
		const eventBus = new MidiBus();
		const sound = monitor(audioHost, eventBus);
		const pending = sound.enable();
		eventBus.emit({
			time: 0,
			direction: 'out',
			portId: 'engine',
			portName: 'engine',
			bytes: [],
			message: { type: 'controlChange', channel: 0, controller: 120, value: 0 }
		});
		wake(context);
		expect(await pending).toBe(false);
		sound.dispose();
		expect(eventBus.listenerCount).toBe(0);
	});

	it('shares demo ownership without claiming foreground merely by enabling live monitoring', async () => {
		const { audioHost } = host();
		const sound = monitor(audioHost);
		const stopOther = vi.fn();
		const releaseOther = claimDemoPlayback(stopOther);
		await sound.enable();
		expect(stopOther).not.toHaveBeenCalled();
		sound.update([voice()], 'demo');
		expect(stopOther).toHaveBeenCalledOnce();
		const releaseNewer = claimDemoPlayback(vi.fn());
		expect(sound.playing).toBe(false);
		releaseOther();
		releaseNewer();
	});

	it('claims a demo before resume and cancels its future UI frames when a newer example interrupts', async () => {
		const { audioHost, context, oscillators } = host();
		let wake!: (context: BaseAudioContext) => void;
		audioHost.resume.mockImplementation(
			() =>
				new Promise((resolve) => {
					wake = resolve;
				})
		);
		const sound = monitor(audioHost);
		const interrupted = vi.fn();
		sound.onDemoInterrupted(interrupted);
		const oldStop = vi.fn();
		const releaseOld = claimDemoPlayback(oldStop);
		const pending = sound.enable('demo');
		expect(oldStop).toHaveBeenCalledOnce();
		const releaseNewer = claimDemoPlayback(vi.fn());
		wake(context);
		expect(await pending).toBe(false);
		expect(interrupted).toHaveBeenCalledOnce();
		sound.update([voice()], 'demo');
		expect(oscillators).toHaveLength(0);
		releaseOld();
		releaseNewer();
	});
});
