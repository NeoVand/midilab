import { audio, type SynthHost } from './engine';
import { bus, type MidiBus } from '$lib/midi/bus';
import { spectrum, type TimbreId } from '$lib/music/acoustics';
import { claimDemoPlayback } from './demo-focus';

interface ToneGroup {
	context: BaseAudioContext;
	gain: GainNode;
	oscillators: OscillatorNode[];
}

/**
 * Additive acoustic demonstrations share the master volume and analyser.
 * Their frequencies need not be MIDI notes. The exact same partial spectra
 * drive the roughness graph and the sound; they never emit performer events.
 */
export class IntervalTone {
	#host: SynthHost;
	#group: ToneGroup | null = null;
	#generation = 0;
	#disposed = false;
	#listeners = new Set<() => void>();
	#unsubscribe: () => void;
	#releaseDemo: (() => void) | null = null;
	#onBlur = () => this.stop();
	#onVisibility = () => {
		if (document.hidden) this.stop();
	};

	constructor(host: SynthHost = audio, eventBus: MidiBus = bus) {
		this.#host = host;
		this.#unsubscribe = eventBus.subscribe(({ message, origin }) => {
			if (
				message.type === 'reset' ||
				(origin === 'demo' && message.type === 'noteOn' && message.velocity > 0) ||
				(message.type === 'controlChange' && [120, 123].includes(message.controller))
			) {
				this.stop();
			}
		});
		if (typeof window !== 'undefined') {
			window.addEventListener('blur', this.#onBlur);
			document.addEventListener('visibilitychange', this.#onVisibility);
		}
	}

	get playing(): boolean {
		return this.#group !== null;
	}

	onStop(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Returns false when audio could not start or a newer action cancelled it. */
	async play(frequencies: number[], timbre: TimbreId, duration = 3): Promise<boolean> {
		this.stop();
		if (
			this.#disposed ||
			frequencies.length < 1 ||
			frequencies.length > 3 ||
			frequencies.some(
				(frequency) => !Number.isFinite(frequency) || frequency < 20 || frequency > 6000
			)
		)
			return false;
		this.#releaseDemo = claimDemoPlayback(() => this.stop());
		const generation = this.#generation;
		let context: BaseAudioContext | null;
		try {
			context = await this.#host.resume();
		} catch {
			if (generation === this.#generation) this.stop();
			return false;
		}
		if (
			this.#disposed ||
			generation !== this.#generation ||
			!context ||
			context.state !== 'running' ||
			!this.#host.destination
		) {
			if (generation === this.#generation) this.stop();
			return false;
		}
		const gain = context.createGain();
		gain.gain.value = 0;
		const start = context.currentTime + 0.008;
		const length = Number.isFinite(duration) ? Math.max(0.15, Math.min(8, duration)) : 3;
		const end = start + length;
		gain.gain.setValueAtTime(0, start);
		gain.gain.linearRampToValueAtTime(0.18 / frequencies.length, start + 0.025);
		gain.gain.setValueAtTime(0.18 / frequencies.length, end - 0.06);
		gain.gain.linearRampToValueAtTime(0, end);
		gain.connect(this.#host.destination);
		const group: ToneGroup = { context, gain, oscillators: [] };
		const partialGains: GainNode[] = [];
		for (const frequency of frequencies) {
			const partials = spectrum(frequency, timbre);
			const sum = partials.reduce((total, partial) => total + partial.amplitude, 0);
			for (const partial of partials) {
				if (partial.frequency >= context.sampleRate / 2 - 100) continue;
				const oscillator = context.createOscillator();
				const partialGain = context.createGain();
				oscillator.type = 'sine';
				oscillator.frequency.setValueAtTime(partial.frequency, start);
				partialGain.gain.setValueAtTime(partial.amplitude / sum, start);
				oscillator.connect(partialGain).connect(gain);
				group.oscillators.push(oscillator);
				partialGains.push(partialGain);
			}
		}
		this.#group = group;
		let remaining = group.oscillators.length;
		group.oscillators.forEach((oscillator, index) => {
			oscillator.onended = () => {
				oscillator.disconnect();
				partialGains[index].disconnect();
				if (--remaining === 0) {
					gain.disconnect();
					if (this.#group === group) {
						this.#group = null;
						this.#releaseDemo?.();
						this.#releaseDemo = null;
						this.#notifyStopped();
					}
				}
			};
			oscillator.start(start);
			oscillator.stop(end + 0.01);
		});
		return true;
	}

	stop(): void {
		this.#generation++;
		const group = this.#group;
		this.#group = null;
		this.#releaseDemo?.();
		this.#releaseDemo = null;
		if (group) {
			const now = group.context.currentTime;
			group.gain.gain.cancelScheduledValues(now);
			group.gain.gain.setValueAtTime(group.gain.gain.value, now);
			group.gain.gain.linearRampToValueAtTime(0, now + 0.03);
			for (const oscillator of group.oscillators) oscillator.stop(now + 0.035);
		}
		this.#notifyStopped();
	}

	#notifyStopped(): void {
		for (const listener of this.#listeners) listener();
	}

	dispose(): void {
		this.#disposed = true;
		this.stop();
		this.#unsubscribe();
		this.#listeners.clear();
		if (typeof window !== 'undefined') {
			window.removeEventListener('blur', this.#onBlur);
			document.removeEventListener('visibilitychange', this.#onVisibility);
		}
	}
}
