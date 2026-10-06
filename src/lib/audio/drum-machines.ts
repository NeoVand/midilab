import { DrumMachine } from 'smplr';
import type { LoadState } from './gm.svelte';

export const DRUM_KITS = [
	{
		program: 0,
		name: 'Studio kit',
		machine: 'LM-2',
		description: 'Warm kick, crisp snare, and a roomy clap.'
	},
	{
		program: 24,
		name: 'Crunch kit',
		machine: 'Casio-RZ1',
		description: 'Short, grainy hits that leave room for a melody.'
	},
	{
		program: 25,
		name: '808 kit',
		machine: 'TR-808',
		description: 'Round bass drum, bright hats, and an airy clap.'
	}
] as const;

export function drumKit(program: number) {
	return DRUM_KITS.find((kit) => kit.program === program) ?? DRUM_KITS[0];
}

/** Exact sample names from the smplr drum-machine catalog, mapped onto GM note numbers. */
const SAMPLE_MAPS: Record<string, Record<number, string>> = {
	'LM-2': {
		35: 'kick-alt',
		36: 'kick',
		37: 'stick-m',
		38: 'snare-m',
		39: 'clap',
		40: 'snare-h',
		41: 'tom-ll',
		42: 'hhclosed',
		43: 'tom-l',
		44: 'hhclosed-short',
		45: 'tom-m',
		46: 'hhopen',
		47: 'tom-h',
		48: 'tom-hh',
		49: 'crash',
		50: 'tom-hh',
		51: 'ride',
		54: 'tambourine',
		56: 'cowbell',
		60: 'conga-h',
		61: 'conga-l',
		69: 'cabasa'
	},
	'Casio-RZ1': {
		35: 'kick',
		36: 'kick',
		37: 'clave',
		38: 'snare',
		39: 'clap',
		40: 'snare',
		41: 'tom-3',
		42: 'hihat-closed',
		43: 'tom-3',
		44: 'hihat-closed',
		45: 'tom-2',
		46: 'hihat-open',
		47: 'tom-2',
		48: 'tom-1',
		49: 'crash',
		50: 'tom-1',
		51: 'ride',
		56: 'cowbell',
		75: 'clave'
	},
	'TR-808': {
		35: 'kick/bd0050',
		36: 'kick/bd0050',
		37: 'rimshot/rs',
		38: 'snare/sd2550',
		39: 'clap/cp',
		40: 'snare/sd2550',
		41: 'tom-low/lt25',
		42: 'hihat-close/ch',
		43: 'tom-low/lt25',
		44: 'hihat-close/ch',
		45: 'mid-tom/mt25',
		46: 'hihat-open/oh25',
		47: 'mid-tom/mt25',
		48: 'tom-hi/ht25',
		49: 'cymbal/cy2550',
		50: 'tom-hi/ht25',
		51: 'cymbal/cy2550',
		56: 'cowbell/cb',
		60: 'conga-hi/hc25',
		61: 'conga-low/lc25',
		62: 'conga-hi/hc25',
		63: 'conga-mid/mc25',
		64: 'conga-low/lc25',
		70: 'maraca/ma',
		75: 'clave/cl'
	}
};

export function drumSample(program: number, note: number): string | undefined {
	return SAMPLE_MAPS[drumKit(program).machine][note];
}

/** Load only the chosen hits, not every tuning variant in a complete vintage machine. */
export function drumDescriptor(program: number) {
	const kit = drumKit(program);
	const samples = [...new Set(Object.values(SAMPLE_MAPS[kit.machine]))];
	return {
		name: kit.machine,
		baseUrl: `https://smpldsnds.github.io/drum-machines/${kit.machine}`,
		samples,
		groupNames: samples,
		nameToSampleName: Object.fromEntries(samples.map((sample) => [sample, sample])),
		sampleGroupVariations: {} as Record<string, string[]>
	};
}

class SampledDrums {
	#players = new Map<number, DrumMachine>();
	#states = new Map<number, LoadState>();

	stateOf(program: number): LoadState {
		return this.#states.get(drumKit(program).program) ?? 'idle';
	}

	prepare(
		program: number,
		context: BaseAudioContext,
		destination: AudioNode,
		onState?: (state: LoadState) => void
	): void {
		const selected = drumKit(program).program;
		const state = this.stateOf(selected);
		if (state !== 'idle') {
			onState?.(state);
			return;
		}
		this.#states.set(selected, 'loading');
		onState?.('loading');
		const player = DrumMachine(context, { instrument: drumDescriptor(selected), destination });
		player.ready
			.then(() => {
				this.#players.set(selected, player);
				this.#states.set(selected, 'ready');
				onState?.('ready');
			})
			.catch(() => {
				player.dispose();
				this.#states.set(selected, 'failed');
				onState?.('failed');
			});
	}

	/** True only when a real hit sounded; false asks the caller to use the built-in kit. */
	noteOn(
		program: number,
		note: number,
		velocity: number,
		time?: number,
		volume = 100,
		pan = 64
	): boolean {
		const player = this.#players.get(drumKit(program).program);
		const sample = drumSample(program, note);
		if (!player || !sample) return false;
		player.output.volume = volume;
		player.output.pan = Math.max(-1, Math.min(1, (pan - 64) / 63));
		// Closed and pedal hats choke the open hat, as on the physical instrument.
		if (note === 42 || note === 44) {
			const open = drumSample(program, 46);
			if (open) player.stop({ stopId: open, time });
		}
		player.start({ note: sample, velocity, time, stopId: sample });
		return true;
	}

	allOff(time?: number): void {
		for (const player of this.#players.values()) player.stop({ time });
	}
}

export const sampledDrums = new SampledDrums();
