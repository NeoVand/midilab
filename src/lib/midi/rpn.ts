/**
 * Registered and Non-Registered Parameter Numbers.
 *
 * RPN and NRPN are not new message types — they are a *protocol built out of
 * ordinary Control Changes*, which is why they feel so clumsy. To change one
 * parameter you send: which parameter (two CCs), then the value (one or two
 * CCs), then ideally a Null to deselect so a stray Data Entry cannot move
 * something by accident. Four to five messages to set one number.
 *
 * RPNs are defined by the MIDI specification and mean the same thing
 * everywhere — bend range, fine tuning, MPE configuration. NRPNs are
 * manufacturer territory: the numbers mean whatever the device's
 * implementation chart says, and nothing at all to anything else.
 */

import type { MidiMessage } from './messages';
import { split14 } from './messages';

export const CC = {
	DataEntryMsb: 6,
	DataEntryLsb: 38,
	DataIncrement: 96,
	DataDecrement: 97,
	NrpnLsb: 98,
	NrpnMsb: 99,
	RpnLsb: 100,
	RpnMsb: 101
} as const;

export const RPN_NULL = { msb: 0x7f, lsb: 0x7f } as const;

export interface ParameterEdit {
	kind: 'rpn' | 'nrpn';
	msb: number;
	lsb: number;
	/** 14-bit value if an LSB was sent, otherwise the 7-bit MSB. */
	value: number;
	fine: boolean;
}

function cc(channel: number, controller: number, value: number): MidiMessage {
	return { type: 'controlChange', channel, controller, value };
}

/**
 * The full message sequence for one parameter edit.
 *
 * `value` is 14-bit when `fine` is true, otherwise 7-bit. The trailing Null is
 * good hygiene: without it, any later Data Entry — from a different track, a
 * different app, a controller you forgot about — lands on this parameter.
 */
export function parameterEdit(
	kind: 'rpn' | 'nrpn',
	channel: number,
	msb: number,
	lsb: number,
	value: number,
	opts: { fine?: boolean; nullAfter?: boolean } = {}
): MidiMessage[] {
	const { fine = false, nullAfter = true } = opts;
	const selMsb = kind === 'rpn' ? CC.RpnMsb : CC.NrpnMsb;
	const selLsb = kind === 'rpn' ? CC.RpnLsb : CC.NrpnLsb;
	const out: MidiMessage[] = [cc(channel, selMsb, msb), cc(channel, selLsb, lsb)];
	if (fine) {
		const { msb: vm, lsb: vl } = split14(value);
		out.push(cc(channel, CC.DataEntryMsb, vm), cc(channel, CC.DataEntryLsb, vl));
	} else {
		out.push(cc(channel, CC.DataEntryMsb, value & 0x7f));
	}
	if (nullAfter) {
		out.push(cc(channel, CC.RpnMsb, RPN_NULL.msb), cc(channel, CC.RpnLsb, RPN_NULL.lsb));
	}
	return out;
}

export function rpn(
	channel: number,
	msb: number,
	lsb: number,
	value: number,
	opts?: { fine?: boolean; nullAfter?: boolean }
) {
	return parameterEdit('rpn', channel, msb, lsb, value, opts);
}

export function nrpn(
	channel: number,
	msb: number,
	lsb: number,
	value: number,
	opts?: { fine?: boolean; nullAfter?: boolean }
) {
	return parameterEdit('nrpn', channel, msb, lsb, value, opts);
}

/** RPN 0,0 — how many semitones a full pitch bend covers. */
export function setBendRange(channel: number, semitones: number, cents = 0): MidiMessage[] {
	return [
		cc(channel, CC.RpnMsb, 0),
		cc(channel, CC.RpnLsb, 0),
		cc(channel, CC.DataEntryMsb, Math.max(0, Math.min(96, Math.round(semitones)))),
		cc(channel, CC.DataEntryLsb, Math.max(0, Math.min(127, Math.round(cents)))),
		cc(channel, CC.RpnMsb, RPN_NULL.msb),
		cc(channel, CC.RpnLsb, RPN_NULL.lsb)
	];
}

/**
 * Reassembles parameter edits from a stream of Control Changes.
 *
 * Used by the monitor and by Lesson 11 to show "those five CCs were actually
 * one thing" — which is the insight that makes NRPNs stop looking like noise.
 */
export class RpnParser {
	#state = Array.from({ length: 16 }, () => ({
		kind: null as 'rpn' | 'nrpn' | null,
		msb: 0,
		lsb: 0,
		valueMsb: 0
	}));

	/** Returns a completed edit when a Data Entry lands on a selected parameter. */
	push(msg: MidiMessage): ParameterEdit | null {
		if (msg.type !== 'controlChange') return null;
		const s = this.#state[msg.channel];
		switch (msg.controller) {
			case CC.RpnMsb:
				s.kind = 'rpn';
				s.msb = msg.value;
				return null;
			case CC.RpnLsb:
				s.kind = 'rpn';
				s.lsb = msg.value;
				return null;
			case CC.NrpnMsb:
				s.kind = 'nrpn';
				s.msb = msg.value;
				return null;
			case CC.NrpnLsb:
				s.kind = 'nrpn';
				s.lsb = msg.value;
				return null;
			case CC.DataEntryMsb:
				if (!s.kind || isNull(s)) return null;
				s.valueMsb = msg.value;
				return { kind: s.kind, msb: s.msb, lsb: s.lsb, value: msg.value, fine: false };
			case CC.DataEntryLsb:
				if (!s.kind || isNull(s)) return null;
				return {
					kind: s.kind,
					msb: s.msb,
					lsb: s.lsb,
					value: (s.valueMsb << 7) | msg.value,
					fine: true
				};
			default:
				return null;
		}
	}

	selected(channel: number) {
		const s = this.#state[channel];
		return s.kind && !isNull(s) ? { kind: s.kind, msb: s.msb, lsb: s.lsb } : null;
	}
}

function isNull(s: { kind: 'rpn' | 'nrpn' | null; msb: number; lsb: number }): boolean {
	return s.kind === 'rpn' && s.msb === RPN_NULL.msb && s.lsb === RPN_NULL.lsb;
}
