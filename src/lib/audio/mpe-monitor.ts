import { audio, type SynthHost } from './engine';
import { claimDemoPlayback } from './demo-focus';
import { bus, type MidiBus, type MidiOrigin } from '$lib/midi/bus';
import type { MidiEngine } from '$lib/midi/engine.svelte';
import type { MpeZone } from '$lib/midi/mpe';
import { MPE_VOICE_LIMIT } from '$lib/midi/mpe-state';
import { noteToFrequency } from '$lib/midi/notes';

/** Effective expression comes from MpeInputState, including master/RPN state. */
export interface MpeSoundVoice {
	id: number;
	channel: number;
	note: number;
	velocity: number;
	pitchSemitones: number;
	effectivePressure: number;
	timbre: number;
	effectiveTimbre: number;
}

interface PadVoice {
	id: number;
	origin: MidiOrigin;
	channel: number;
	note: number;
	context: BaseAudioContext;
	oscillators: OscillatorNode[];
	filter: BiquadFilterNode;
	level: GainNode;
	mix: GainNode;
	panner: StereoPannerNode;
	released: boolean;
}

const clamp = (value: number, low: number, high: number) =>
	Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));

/**
 * A sustained, asset-free MPE sound: pressure grows loudness and brightness;
 * CC74 opens each note's filter, and bend tunes only that note's oscillators.
 * The matched zone/RPN interpretation lives in the input state, not this synth.
 */
export class MpeMonitor {
	#host: SynthHost;
	#enabled = false;
	#disposed = false;
	#generation = 0;
	#voices = new Map<number, PadVoice>();
	#retiring = new Set<PadVoice>();
	#blocked = new Set<string>();
	#inputPort: string | null = null;
	#master = 0;
	#channels = new Set<number>();
	#claimWhenDisabled = false;
	#detachInput: (() => void) | null = null;
	#detachCount: (() => void) | null = null;
	#inputEngine: Pick<
		MidiEngine,
		'interceptInputAudition' | 'releaseInputAudition' | 'registerBrowserVoiceCount'
	> | null = null;
	#unsubscribe: () => void;
	#releaseDemo: (() => void) | null = null;
	#listeners = new Set<() => void>();
	#demoInterrupted = new Set<() => void>();
	#onBlur = () => this.stop();
	#onVisibility = () => {
		if (document.hidden) this.stop();
	};

	constructor(host: SynthHost = audio, eventBus: MidiBus = bus) {
		this.#host = host;
		this.#unsubscribe = eventBus.subscribe(({ message, direction, portId }) => {
			if (
				message.type === 'reset' ||
				(message.type === 'controlChange' &&
					message.controller === 120 &&
					(direction === 'out' || (portId === this.#inputPort && message.channel === this.#master)))
			)
				this.stop();
		});
		if (typeof window !== 'undefined') {
			window.addEventListener('blur', this.#onBlur);
			document.addEventListener('visibilitychange', this.#onVisibility);
		}
	}

	get enabled(): boolean {
		return this.#enabled;
	}

	get playing(): boolean {
		return this.#voices.size > 0;
	}

	get voiceCount(): number {
		return this.#voices.size;
	}

	onChange(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Cancel the UI example's future frames when another listening demo takes focus. */
	onDemoInterrupted(listener: () => void): () => void {
		this.#demoInterrupted.add(listener);
		return () => this.#demoInterrupted.delete(listener);
	}

	#claimDemo(): void {
		if (this.#releaseDemo) return;
		this.#releaseDemo = claimDemoPlayback(() => {
			this.stop();
			for (const listener of this.#demoInterrupted) listener();
		});
	}

	/** The mounted lab may explicitly reserve its selected source for silent observation. */
	attachInput(
		engine: Pick<
			MidiEngine,
			'interceptInputAudition' | 'releaseInputAudition' | 'registerBrowserVoiceCount'
		>
	): void {
		this.#detachInput?.();
		this.#detachCount?.();
		if (this.#disposed) return;
		this.#inputEngine = engine;
		this.#detachCount = engine.registerBrowserVoiceCount(() => this.voiceCount);
		this.#detachInput = engine.interceptInputAudition((event) => {
			const message = event.message;
			if (
				event.portId !== this.#inputPort ||
				!('channel' in message) ||
				(!this.#claimWhenDisabled && !this.#channels.has(message.channel))
			)
				return false;
			return this.#enabled || this.#claimWhenDisabled;
		});
		this.#releaseOrdinaryNotes();
	}

	/** Changing or disconnecting the source releases its old voices immediately. */
	setInput(portId: string | null, zone: MpeZone, claimWhenDisabled = false): void {
		const channels = new Set([zone.master, ...zone.members]);
		if (
			portId !== this.#inputPort ||
			channels.size !== this.#channels.size ||
			[...channels].some((channel) => !this.#channels.has(channel))
		) {
			this.stop();
			this.#blocked.clear();
		}
		this.#inputPort = portId;
		this.#master = zone.master;
		this.#channels = channels;
		this.#claimWhenDisabled = claimWhenDisabled;
		this.#releaseOrdinaryNotes();
	}

	#releaseOrdinaryNotes(): void {
		if ((this.#enabled || this.#claimWhenDisabled) && this.#inputPort) {
			// A deliberately selected lab input stays silent even when its notes
			// fall outside the interpreted zone; they remain visible diagnostics.
			const channels = this.#claimWhenDisabled
				? Array.from({ length: 16 }, (_, channel) => channel)
				: [...this.#channels];
			this.#inputEngine?.releaseInputAudition(this.#inputPort, channels);
		}
	}

	/** Call from Enable browser sound or deliberate local play; never MIDI input. */
	async enable(origin: MidiOrigin = 'performer'): Promise<boolean> {
		if (this.#disposed) return false;
		if (origin === 'demo') {
			this.stop();
			this.#claimDemo();
		} else if (this.#enabled && this.#host.context?.state === 'running') return true;
		const generation = ++this.#generation;
		let context: BaseAudioContext | null;
		try {
			context = await this.#host.resume();
		} catch {
			if (generation === this.#generation) this.disable();
			return false;
		}
		if (
			this.#disposed ||
			generation !== this.#generation ||
			!context ||
			context.state !== 'running' ||
			!this.#host.destination
		) {
			if (generation === this.#generation) this.disable();
			return false;
		}
		this.#enabled = true;
		this.#blocked.clear();
		this.#releaseOrdinaryNotes();
		this.#notify();
		return true;
	}

	/** Pass only active/sustained voices; removed IDs release their envelopes. */
	update(snapshots: readonly MpeSoundVoice[], origin: MidiOrigin = 'performer'): void {
		const context = this.#host.context;
		if (
			!this.#enabled ||
			this.#disposed ||
			!context ||
			context.state !== 'running' ||
			!this.#host.destination
		)
			return;
		const present = new Set(snapshots.map((voice) => `${origin}:${voice.id}`));
		for (const id of this.#blocked)
			if (id.startsWith(`${origin}:`) && !present.has(id)) this.#blocked.delete(id);
		const voices = snapshots
			.filter(
				(voice) =>
					Number.isFinite(voice.id) &&
					Number.isInteger(voice.channel) &&
					voice.channel >= 0 &&
					voice.channel < 16 &&
					Number.isInteger(voice.note) &&
					voice.note >= 0 &&
					voice.note <= 127 &&
					voice.velocity > 0 &&
					!this.#blocked.has(`${origin}:${voice.id}`)
			)
			.slice(-MPE_VOICE_LIMIT);
		if (origin === 'demo' && voices.length && !this.#releaseDemo) {
			this.#claimDemo();
		} else if (origin !== 'demo' || !voices.length) {
			this.#releaseDemo?.();
			this.#releaseDemo = null;
		}
		const retained = new Set(voices.map((voice) => voice.id));
		for (const [id, voice] of this.#voices) {
			if (!retained.has(id)) {
				this.#voices.delete(id);
				this.#release(voice, 0.16);
			}
		}
		for (const snapshot of voices) {
			let voice = this.#voices.get(snapshot.id);
			if (
				voice &&
				(voice.channel !== snapshot.channel ||
					voice.note !== snapshot.note ||
					voice.origin !== origin)
			) {
				this.#release(voice, 0.02);
				voice = undefined;
			}
			if (!voice) {
				voice = this.#create(snapshot, context, origin);
				this.#voices.set(snapshot.id, voice);
			}
			this.#express(voice, snapshot);
		}
		this.#notify();
	}

	#create(snapshot: MpeSoundVoice, context: BaseAudioContext, origin: MidiOrigin): PadVoice {
		const now = context.currentTime;
		const filter = context.createBiquadFilter();
		filter.type = 'lowpass';
		filter.Q.value = 0.65;
		const level = context.createGain();
		level.gain.setValueAtTime(0, now);
		const mix = context.createGain();
		mix.gain.value = 0.28;
		const panner = context.createStereoPanner();
		panner.pan.value = ((snapshot.channel % 7) - 3) * 0.055;
		filter.connect(level).connect(panner).connect(this.#host.destination!);
		const triangle = context.createOscillator();
		triangle.type = 'triangle';
		triangle.detune.value = -3;
		triangle.connect(filter);
		const saw = context.createOscillator();
		saw.type = 'sawtooth';
		saw.detune.value = 3;
		saw.connect(mix).connect(filter);
		const voice: PadVoice = {
			id: snapshot.id,
			origin,
			channel: snapshot.channel,
			note: snapshot.note,
			context,
			filter,
			level,
			mix,
			panner,
			oscillators: [triangle, saw],
			released: false
		};
		let remaining = voice.oscillators.length;
		for (const oscillator of voice.oscillators) {
			oscillator.onended = () => {
				oscillator.disconnect();
				if (--remaining === 0) {
					filter.disconnect();
					level.disconnect();
					mix.disconnect();
					panner.disconnect();
					this.#retiring.delete(voice);
				}
			};
			oscillator.frequency.setValueAtTime(noteToFrequency(snapshot.note), now);
			oscillator.start(now);
		}
		return voice;
	}

	#express(voice: PadVoice, snapshot: MpeSoundVoice) {
		const now = voice.context.currentTime;
		const pressure = clamp(snapshot.effectivePressure, 0, 127) / 127;
		const timbre = clamp(snapshot.effectiveTimbre, 0, 127) / 127;
		const velocity = clamp(snapshot.velocity, 1, 127) / 127;
		const frequency = noteToFrequency(snapshot.note + clamp(snapshot.pitchSemitones, -192, 192));
		for (const oscillator of voice.oscillators) {
			oscillator.frequency.setTargetAtTime(
				clamp(frequency, 8, voice.context.sampleRate / 2 - 100),
				now,
				0.008
			);
		}
		voice.level.gain.setTargetAtTime(
			Math.pow(velocity, 0.7) * (0.035 + pressure * 0.095),
			now,
			0.025
		);
		voice.filter.frequency.setTargetAtTime(
			Math.min(14000, 180 * Math.pow(2, timbre * 5.5 + pressure * 1.8)),
			now,
			0.025
		);
	}

	#release(voice: PadVoice, duration: number): void {
		if (voice.released) return;
		voice.released = true;
		this.#retiring.add(voice);
		const now = voice.context.currentTime;
		voice.level.gain.cancelScheduledValues(now);
		voice.level.gain.setTargetAtTime(0, now, duration / 5);
		for (const oscillator of voice.oscillators) oscillator.stop(now + duration);
	}

	stop(): void {
		this.#generation++;
		this.#releaseDemo?.();
		this.#releaseDemo = null;
		for (const voice of this.#voices.values()) {
			this.#blocked.add(`${voice.origin}:${voice.id}`);
			this.#release(voice, 0.025);
		}
		this.#voices.clear();
		for (const voice of this.#retiring) {
			const now = voice.context.currentTime;
			voice.level.gain.cancelScheduledValues(now);
			voice.level.gain.setTargetAtTime(0, now, 0.004);
			for (const oscillator of voice.oscillators) oscillator.stop(now + 0.025);
		}
		this.#notify();
	}

	disable(): void {
		this.#enabled = false;
		this.stop();
	}

	#notify(): void {
		for (const listener of this.#listeners) listener();
	}

	dispose(): void {
		if (this.#disposed) return;
		this.#disposed = true;
		this.disable();
		this.#unsubscribe();
		this.#detachInput?.();
		this.#detachInput = null;
		this.#detachCount?.();
		this.#detachCount = null;
		this.#inputEngine = null;
		this.#blocked.clear();
		this.#listeners.clear();
		this.#demoInterrupted.clear();
		if (typeof window !== 'undefined') {
			window.removeEventListener('blur', this.#onBlur);
			document.removeEventListener('visibilitychange', this.#onVisibility);
		}
	}
}
