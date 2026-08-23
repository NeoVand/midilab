/**
 * Semantic device profiles.
 *
 * The idea, stated once and then relied on everywhere: a caller should be able
 * to say `device.set('filter.cutoff', 0.75)` without knowing whether that
 * becomes CC 74, an NRPN pair or a SysEx packet. The profile holds the
 * translation; the caller holds the intent.
 *
 * This matters because CC numbers are not portable. Writing CC 74 into a song
 * ties that song to one instrument forever. Writing `filter.cutoff` and keeping
 * a profile per instrument means the same part can drive different hardware.
 *
 * It is also, not coincidentally, what MIDI 2.0's Property Exchange is for —
 * this is that abstraction, filled in by hand until instruments can publish it
 * themselves.
 */

import type { MidiMessage } from '../messages';
import { split14 } from '../messages';
import { parameterEdit } from '../rpn';
import { rolandChecksum } from '../sysex';

export type ParamProtocol =
	| { kind: 'cc'; number: number; lsb?: number }
	| { kind: 'nrpn'; msb: number; lsb: number; fine?: boolean }
	| { kind: 'rpn'; msb: number; lsb: number; fine?: boolean }
	| {
			kind: 'sysex';
			/** Bytes between F0 and F7, with the value byte(s) as placeholders. */
			template: number[];
			valueIndex: number;
			checksum?: 'roland' | 'none';
			/** Index at which the checksum byte sits, if any. */
			checksumIndex?: number;
			/** Bytes covered by the checksum, as [start, end). */
			checksumRange?: [number, number];
	  };

export interface Parameter {
	/** Dotted semantic id, e.g. `filter.cutoff`. */
	id: string;
	name: string;
	protocol: ParamProtocol;
	min: number;
	max: number;
	default?: number;
	unit?: string;
	group?: string;
	/** Set when the mapping comes from community reports rather than the manual. */
	unverified?: boolean;
}

export interface ProgramEntry {
	name: string;
	bankMsb?: number;
	bankLsb?: number;
	program: number;
}

export interface DeviceProfile {
	id: string;
	name: string;
	manufacturer?: string;
	notes?: string;
	/** Web MIDI port id this profile is bound to, if any. */
	portId?: string | null;
	/** Wire channel 0–15. */
	channel: number;
	parameters: Parameter[];
	programs: ProgramEntry[];
	/** True for the profiles that ship with the app. */
	builtin?: boolean;
}

export function emptyProfile(name = 'New device'): DeviceProfile {
	return {
		id: `dev-${Date.now().toString(36)}`,
		name,
		channel: 0,
		parameters: [],
		programs: []
	};
}

/**
 * The adapter. Give it a profile; it gives you messages.
 *
 * `set` takes a normalised 0–1 value by default because that is what a
 * composition or a generative process wants to speak in. Pass `raw: true` when
 * you genuinely mean the device's own units.
 */
export class Device {
	constructor(public profile: DeviceProfile) {}

	get channel(): number {
		return this.profile.channel;
	}

	parameter(id: string): Parameter | undefined {
		return this.profile.parameters.find((p) => p.id === id);
	}

	/** Translate a semantic parameter change into whatever this device wants. */
	set(id: string, value: number, opts: { raw?: boolean; channel?: number } = {}): MidiMessage[] {
		const param = this.parameter(id);
		if (!param) return [];
		const channel = opts.channel ?? this.profile.channel;
		const raw = opts.raw
			? value
			: param.min + Math.max(0, Math.min(1, value)) * (param.max - param.min);
		const v = Math.round(raw);

		switch (param.protocol.kind) {
			case 'cc': {
				const out: MidiMessage[] = [];
				if (param.protocol.lsb !== undefined && param.max > 127) {
					const { msb, lsb } = split14(v);
					out.push({
						type: 'controlChange',
						channel,
						controller: param.protocol.number,
						value: msb
					});
					out.push({ type: 'controlChange', channel, controller: param.protocol.lsb, value: lsb });
				} else {
					out.push({
						type: 'controlChange',
						channel,
						controller: param.protocol.number,
						value: Math.max(0, Math.min(127, v))
					});
				}
				return out;
			}
			case 'nrpn':
			case 'rpn':
				return parameterEdit(
					param.protocol.kind,
					channel,
					param.protocol.msb,
					param.protocol.lsb,
					v,
					{
						fine: param.protocol.fine ?? param.max > 127
					}
				);
			case 'sysex': {
				const data = [...param.protocol.template];
				data[param.protocol.valueIndex] = Math.max(0, Math.min(127, v));
				if (param.protocol.checksum === 'roland' && param.protocol.checksumIndex !== undefined) {
					const [a, b] = param.protocol.checksumRange ?? [0, data.length];
					data[param.protocol.checksumIndex] = rolandChecksum(data.slice(a, b));
				}
				return [{ type: 'sysex', data }];
			}
		}
	}

	/** Bank Select MSB, LSB then Program Change, in the required order. */
	selectProgram(nameOrIndex: string | number, channel = this.profile.channel): MidiMessage[] {
		const entry =
			typeof nameOrIndex === 'number'
				? this.profile.programs[nameOrIndex]
				: this.profile.programs.find((p) => p.name === nameOrIndex);
		if (!entry) return [];
		const out: MidiMessage[] = [];
		if (entry.bankMsb !== undefined)
			out.push({ type: 'controlChange', channel, controller: 0, value: entry.bankMsb });
		if (entry.bankLsb !== undefined)
			out.push({ type: 'controlChange', channel, controller: 32, value: entry.bankLsb });
		out.push({ type: 'programChange', channel, program: entry.program });
		return out;
	}

	noteOn(note: number, velocity = 100, channel = this.profile.channel): MidiMessage {
		return { type: 'noteOn', channel, note, velocity };
	}

	noteOff(note: number, channel = this.profile.channel): MidiMessage {
		return { type: 'noteOff', channel, note, velocity: 0 };
	}

	/** A readable description of what `set` would actually transmit. */
	explain(id: string): string {
		const p = this.parameter(id);
		if (!p) return 'unknown parameter';
		switch (p.protocol.kind) {
			case 'cc':
				return p.protocol.lsb !== undefined
					? `CC ${p.protocol.number} + CC ${p.protocol.lsb} (14-bit)`
					: `CC ${p.protocol.number}`;
			case 'nrpn':
				return `NRPN ${p.protocol.msb},${p.protocol.lsb}`;
			case 'rpn':
				return `RPN ${p.protocol.msb},${p.protocol.lsb}`;
			case 'sysex':
				return `SysEx, ${p.protocol.template.length} bytes`;
		}
	}
}

/* -------------------------------------------------------------------------- */
/* Built-in profiles                                                           */
/* -------------------------------------------------------------------------- */

function cc(
	id: string,
	name: string,
	number: number,
	group?: string,
	unverified = false
): Parameter {
	return { id, name, protocol: { kind: 'cc', number }, min: 0, max: 127, group, unverified };
}

export const GENERAL_MIDI: DeviceProfile = {
	id: 'builtin-gm',
	name: 'General MIDI',
	manufacturer: 'MIDI Association',
	builtin: true,
	channel: 0,
	notes:
		'The standard recommendations. Any GM-compliant device should honour these; a synth in its own native mode may not.',
	parameters: [
		cc('mix.volume', 'Volume', 7, 'Mix'),
		cc('mix.pan', 'Pan', 10, 'Mix'),
		cc('mix.expression', 'Expression', 11, 'Mix'),
		cc('mod.wheel', 'Modulation', 1, 'Performance'),
		cc('pedal.sustain', 'Sustain pedal', 64, 'Performance'),
		cc('filter.cutoff', 'Filter cutoff', 74, 'Filter'),
		cc('filter.resonance', 'Filter resonance', 71, 'Filter'),
		cc('env.attack', 'Attack time', 73, 'Envelope'),
		cc('env.decay', 'Decay time', 75, 'Envelope'),
		cc('env.release', 'Release time', 72, 'Envelope'),
		cc('fx.reverb', 'Reverb send', 91, 'Effects'),
		cc('fx.chorus', 'Chorus send', 93, 'Effects'),
		{
			id: 'tune.bendRange',
			name: 'Pitch bend range',
			protocol: { kind: 'rpn', msb: 0, lsb: 0 },
			min: 0,
			max: 48,
			default: 2,
			unit: 'semitones',
			group: 'Tuning'
		}
	],
	programs: [
		{ name: 'Acoustic Grand Piano', program: 0 },
		{ name: 'Electric Piano 1', program: 4 },
		{ name: 'Drawbar Organ', program: 16 },
		{ name: 'Acoustic Bass', program: 32 },
		{ name: 'String Ensemble 1', program: 48 },
		{ name: 'Trumpet', program: 56 },
		{ name: 'Lead 2 (sawtooth)', program: 81 },
		{ name: 'Pad 2 (warm)', program: 89 }
	]
};

export const OP_XY: DeviceProfile = {
	id: 'builtin-opxy',
	name: 'OP-XY',
	manufacturer: 'Teenage Engineering',
	builtin: true,
	channel: 0,
	notes:
		'Community-reported control map. Teenage Engineering documents CC control of most parameters but the individual numbers below come from community mapping rather than an official chart — verify each one against your own unit and firmware before relying on it. Use the Device Lab’s learn mode to confirm.',
	parameters: [
		cc('mix.volume', 'Track volume', 7, 'Mix'),
		cc('mix.pan', 'Pan', 10, 'Mix'),
		cc('filter.cutoff', 'Filter cutoff', 32, 'Filter', true),
		cc('filter.resonance', 'Filter resonance', 33, 'Filter', true),
		cc('ampEnv.attack', 'Amp attack', 20, 'Amp envelope', true),
		cc('ampEnv.decay', 'Amp decay', 21, 'Amp envelope', true),
		cc('ampEnv.sustain', 'Amp sustain', 22, 'Amp envelope', true),
		cc('ampEnv.release', 'Amp release', 23, 'Amp envelope', true),
		cc('filterEnv.attack', 'Filter attack', 24, 'Filter envelope', true),
		cc('filterEnv.decay', 'Filter decay', 25, 'Filter envelope', true),
		cc('filterEnv.sustain', 'Filter sustain', 26, 'Filter envelope', true),
		cc('filterEnv.release', 'Filter release', 27, 'Filter envelope', true),
		cc('transport.tempo', 'Tempo', 80, 'Transport', true)
	],
	programs: []
};

export const OP_1_FIELD: DeviceProfile = {
	id: 'builtin-op1field',
	name: 'OP-1 field',
	manufacturer: 'Teenage Engineering',
	builtin: true,
	channel: 0,
	notes:
		'Program Change selects slots rather than named presets: 0–7 are the synth slots and 8–15 the drum slots. A good example of why a program number means nothing without the device’s own documentation.',
	parameters: [
		cc('mix.volume', 'Volume', 7, 'Mix'),
		cc('mod.wheel', 'Modulation', 1, 'Performance')
	],
	programs: [
		{ name: 'Synth slot 1', program: 0 },
		{ name: 'Synth slot 2', program: 1 },
		{ name: 'Synth slot 3', program: 2 },
		{ name: 'Synth slot 4', program: 3 },
		{ name: 'Drum slot 1', program: 8 },
		{ name: 'Drum slot 2', program: 9 },
		{ name: 'Drum slot 3', program: 10 },
		{ name: 'Drum slot 4', program: 11 }
	]
};

export const BUILTIN_PROFILES: DeviceProfile[] = [GENERAL_MIDI, OP_XY, OP_1_FIELD];
