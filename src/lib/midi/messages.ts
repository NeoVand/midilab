/**
 * The MIDI 1.0 message language, as a typed union plus a parser and an encoder.
 *
 * Everything visible in this app — the monitor rows, the byte inspector, the
 * piano roll blocks, the packets travelling the routing graph — renders from
 * this one type. There are no mock diagrams anywhere: if you see it, it went
 * through `parse()`.
 *
 * ## Channel numbering
 * `channel` is always the **wire value, 0–15**, because that is what is actually
 * in the byte. Humans count 1–16. Every display path goes through `ch1()`; every
 * byte path uses `channel` directly. Mixing these up is the single most common
 * MIDI bug, so the app keeps them lexically distinct rather than "being careful".
 */

import { ccName, gmProgramName, manufacturerName, GM_DRUMS } from './constants';
import { noteName } from './notes';

/* -------------------------------------------------------------------------- */
/* Status bytes                                                                */
/* -------------------------------------------------------------------------- */

export const Status = {
	NoteOff: 0x80,
	NoteOn: 0x90,
	PolyAftertouch: 0xa0,
	ControlChange: 0xb0,
	ProgramChange: 0xc0,
	ChannelAftertouch: 0xd0,
	PitchBend: 0xe0,
	SysExStart: 0xf0,
	MtcQuarterFrame: 0xf1,
	SongPosition: 0xf2,
	SongSelect: 0xf3,
	TuneRequest: 0xf6,
	SysExEnd: 0xf7,
	Clock: 0xf8,
	Start: 0xfa,
	Continue: 0xfb,
	Stop: 0xfc,
	ActiveSensing: 0xfe,
	Reset: 0xff
} as const;

/* -------------------------------------------------------------------------- */
/* The message union                                                           */
/* -------------------------------------------------------------------------- */

export interface ChannelScoped {
	/** Wire value 0–15. Display as `channel + 1`. */
	channel: number;
}

export type MidiMessage =
	| ({ type: 'noteOn'; note: number; velocity: number } & ChannelScoped)
	| ({ type: 'noteOff'; note: number; velocity: number } & ChannelScoped)
	| ({ type: 'polyAftertouch'; note: number; pressure: number } & ChannelScoped)
	| ({ type: 'controlChange'; controller: number; value: number } & ChannelScoped)
	| ({ type: 'programChange'; program: number } & ChannelScoped)
	| ({ type: 'channelAftertouch'; pressure: number } & ChannelScoped)
	| ({ type: 'pitchBend'; value: number } & ChannelScoped)
	| { type: 'sysex'; data: number[] }
	| { type: 'mtcQuarterFrame'; messageType: number; value: number }
	| { type: 'songPosition'; beats: number }
	| { type: 'songSelect'; song: number }
	| { type: 'tuneRequest' }
	| { type: 'clock' }
	| { type: 'start' }
	| { type: 'continue' }
	| { type: 'stop' }
	| { type: 'activeSensing' }
	| { type: 'reset' }
	| { type: 'unknown'; bytes: number[] };

export type MessageType = MidiMessage['type'];

/** The seven colour families. See `layout.css` for the palette. */
export type MessageFamily = 'note' | 'cc' | 'expr' | 'program' | 'clock' | 'sysex' | 'common';

export function family(msg: MidiMessage): MessageFamily {
	switch (msg.type) {
		case 'noteOn':
		case 'noteOff':
			return 'note';
		case 'controlChange':
			// Channel Mode messages (120–127) are structural, not continuous control.
			return msg.controller >= 120 ? 'common' : 'cc';
		case 'pitchBend':
		case 'polyAftertouch':
		case 'channelAftertouch':
			return 'expr';
		case 'programChange':
			return 'program';
		case 'clock':
		case 'start':
		case 'stop':
		case 'continue':
		case 'songPosition':
		case 'mtcQuarterFrame':
			return 'clock';
		case 'sysex':
			return 'sysex';
		default:
			return 'common';
	}
}

const FAMILY_CLASS: Record<
	MessageFamily,
	{ text: string; bg: string; border: string; raw: string }
> = {
	note: {
		text: 'text-msg-note',
		bg: 'bg-msg-note-bg',
		border: 'border-msg-note',
		raw: 'var(--msg-note)'
	},
	cc: { text: 'text-msg-cc', bg: 'bg-msg-cc-bg', border: 'border-msg-cc', raw: 'var(--msg-cc)' },
	expr: {
		text: 'text-msg-expr',
		bg: 'bg-msg-expr-bg',
		border: 'border-msg-expr',
		raw: 'var(--msg-expr)'
	},
	program: {
		text: 'text-msg-program',
		bg: 'bg-msg-program-bg',
		border: 'border-msg-program',
		raw: 'var(--msg-program)'
	},
	clock: {
		text: 'text-msg-clock',
		bg: 'bg-msg-clock-bg',
		border: 'border-msg-clock',
		raw: 'var(--msg-clock)'
	},
	sysex: {
		text: 'text-msg-sysex',
		bg: 'bg-msg-sysex-bg',
		border: 'border-msg-sysex',
		raw: 'var(--msg-sysex)'
	},
	common: {
		text: 'text-msg-common',
		bg: 'bg-msg-common-bg',
		border: 'border-msg-common',
		raw: 'var(--msg-common)'
	}
};

export function familyClasses(f: MessageFamily) {
	return FAMILY_CLASS[f];
}

export function familyColor(f: MessageFamily): string {
	return FAMILY_CLASS[f].raw;
}

export const FAMILY_LABELS: Record<MessageFamily, string> = {
	note: 'Notes',
	cc: 'Control Change',
	expr: 'Expression',
	program: 'Program & Bank',
	clock: 'Clock & Transport',
	sysex: 'System Exclusive',
	common: 'System & Mode'
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Human-facing channel number, 1–16. */
export function ch1(msg: MidiMessage): number | null {
	return 'channel' in msg ? msg.channel + 1 : null;
}

export function isChannelMessage(
	msg: MidiMessage
): msg is Extract<MidiMessage, { channel: number }> {
	return 'channel' in msg;
}

export function isRealTime(msg: MidiMessage): boolean {
	return (
		msg.type === 'clock' ||
		msg.type === 'start' ||
		msg.type === 'continue' ||
		msg.type === 'stop' ||
		msg.type === 'activeSensing' ||
		msg.type === 'reset'
	);
}

/** Combine two 7-bit halves into one 14-bit value (0–16383). */
export function combine14(msb: number, lsb: number): number {
	return ((msb & 0x7f) << 7) | (lsb & 0x7f);
}

/** Split a 14-bit value back into its MSB/LSB halves. */
export function split14(value: number): { msb: number; lsb: number } {
	const v = Math.max(0, Math.min(16383, Math.round(value)));
	return { msb: (v >> 7) & 0x7f, lsb: v & 0x7f };
}

export function clamp7(v: number): number {
	return Math.max(0, Math.min(127, Math.round(v)));
}

/** Pitch bend as a signed −1…+1 float, where 0 is the 8192 centre. */
export function bendToUnit(value: number): number {
	return value >= 8192 ? (value - 8192) / 8191 : (value - 8192) / 8192;
}

export function unitToBend(unit: number): number {
	const u = Math.max(-1, Math.min(1, unit));
	return Math.round(u >= 0 ? 8192 + u * 8191 : 8192 + u * 8192);
}

export function hex(byte: number, prefix = false): string {
	return (prefix ? '0x' : '') + byte.toString(16).toUpperCase().padStart(2, '0');
}

export function hexBytes(bytes: ArrayLike<number>): string {
	return Array.from(bytes, (b) => hex(b)).join(' ');
}

export function binary(byte: number): string {
	return byte.toString(2).padStart(8, '0');
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Parse one complete message. Web MIDI hands you complete messages, so this is
 * the common path; use `RunningStatusParser` for raw streams and MIDI files,
 * where running status can omit the repeated status byte.
 */
export function parse(bytes: ArrayLike<number>): MidiMessage {
	const b = Array.from(bytes);
	if (b.length === 0) return { type: 'unknown', bytes: b };
	const status = b[0];

	if (status < 0x80) return { type: 'unknown', bytes: b };

	if (status < 0xf0) {
		const channel = status & 0x0f;
		switch (status & 0xf0) {
			case Status.NoteOff:
				return { type: 'noteOff', channel, note: b[1] ?? 0, velocity: b[2] ?? 0 };
			case Status.NoteOn:
				// Velocity 0 is a Note Off in disguise — a running-status bandwidth trick
				// from 1983 that every device still honours.
				return (b[2] ?? 0) === 0
					? { type: 'noteOff', channel, note: b[1] ?? 0, velocity: 0 }
					: { type: 'noteOn', channel, note: b[1] ?? 0, velocity: b[2] ?? 0 };
			case Status.PolyAftertouch:
				return { type: 'polyAftertouch', channel, note: b[1] ?? 0, pressure: b[2] ?? 0 };
			case Status.ControlChange:
				return { type: 'controlChange', channel, controller: b[1] ?? 0, value: b[2] ?? 0 };
			case Status.ProgramChange:
				return { type: 'programChange', channel, program: b[1] ?? 0 };
			case Status.ChannelAftertouch:
				return { type: 'channelAftertouch', channel, pressure: b[1] ?? 0 };
			case Status.PitchBend:
				return { type: 'pitchBend', channel, value: combine14(b[2] ?? 0, b[1] ?? 0) };
		}
	}

	switch (status) {
		case Status.SysExStart: {
			const end = b[b.length - 1] === Status.SysExEnd ? b.length - 1 : b.length;
			return { type: 'sysex', data: b.slice(1, end) };
		}
		case Status.MtcQuarterFrame:
			return {
				type: 'mtcQuarterFrame',
				messageType: ((b[1] ?? 0) >> 4) & 0x07,
				value: (b[1] ?? 0) & 0x0f
			};
		case Status.SongPosition:
			return { type: 'songPosition', beats: combine14(b[2] ?? 0, b[1] ?? 0) };
		case Status.SongSelect:
			return { type: 'songSelect', song: b[1] ?? 0 };
		case Status.TuneRequest:
			return { type: 'tuneRequest' };
		case Status.Clock:
			return { type: 'clock' };
		case Status.Start:
			return { type: 'start' };
		case Status.Continue:
			return { type: 'continue' };
		case Status.Stop:
			return { type: 'stop' };
		case Status.ActiveSensing:
			return { type: 'activeSensing' };
		case Status.Reset:
			return { type: 'reset' };
	}
	return { type: 'unknown', bytes: b };
}

/** How many data bytes follow a given status byte. −1 means "until 0xF7". */
export function dataByteCount(status: number): number {
	if (status >= 0x80 && status < 0xf0) {
		const kind = status & 0xf0;
		return kind === Status.ProgramChange || kind === Status.ChannelAftertouch ? 1 : 2;
	}
	switch (status) {
		case Status.SysExStart:
			return -1;
		case Status.MtcQuarterFrame:
		case Status.SongSelect:
			return 1;
		case Status.SongPosition:
			return 2;
		default:
			return 0;
	}
}

/**
 * A streaming parser that understands running status — where a sender omits a
 * repeated status byte to save bandwidth on a 31,250 baud wire. Web MIDI never
 * needs this, but MIDI files and real DIN streams do, and Lesson 5 makes you
 * watch it happen.
 */
export class RunningStatusParser {
	private status = 0;
	private buffer: number[] = [];
	private inSysEx = false;
	private sysexData: number[] = [];

	reset(): void {
		this.status = 0;
		this.buffer = [];
		this.inSysEx = false;
		this.sysexData = [];
	}

	/** Feed bytes; returns every complete message found. */
	push(bytes: ArrayLike<number>): MidiMessage[] {
		const out: MidiMessage[] = [];
		for (let i = 0; i < bytes.length; i++) {
			const byte = bytes[i];

			// Real-time bytes may interleave *inside* any other message.
			if (byte >= 0xf8) {
				out.push(parse([byte]));
				continue;
			}

			if (this.inSysEx) {
				if (byte === Status.SysExEnd) {
					out.push({ type: 'sysex', data: this.sysexData });
					this.inSysEx = false;
					this.sysexData = [];
				} else if (byte >= 0x80) {
					// An unterminated SysEx interrupted by a new status byte.
					out.push({ type: 'sysex', data: this.sysexData });
					this.inSysEx = false;
					this.sysexData = [];
					i--;
				} else {
					this.sysexData.push(byte);
				}
				continue;
			}

			if (byte >= 0x80) {
				if (byte === Status.SysExStart) {
					this.inSysEx = true;
					this.sysexData = [];
					this.status = 0;
					continue;
				}
				this.status = byte < 0xf0 ? byte : 0;
				this.buffer = byte < 0xf0 ? [byte] : [byte];
				if (dataByteCount(byte) === 0) {
					out.push(parse(this.buffer));
					this.buffer = this.status ? [this.status] : [];
				}
				continue;
			}

			// A data byte with no preceding status: running status applies.
			if (this.buffer.length === 0) {
				if (!this.status) continue;
				this.buffer = [this.status];
			}
			this.buffer.push(byte);
			const need = dataByteCount(this.buffer[0]);
			if (need > 0 && this.buffer.length === need + 1) {
				out.push(parse(this.buffer));
				this.buffer = this.status ? [this.status] : [];
			}
		}
		return out;
	}
}

/* -------------------------------------------------------------------------- */
/* Encoding                                                                    */
/* -------------------------------------------------------------------------- */

export function encode(msg: MidiMessage): number[] {
	switch (msg.type) {
		case 'noteOff':
			return [Status.NoteOff | msg.channel, clamp7(msg.note), clamp7(msg.velocity)];
		case 'noteOn':
			return [Status.NoteOn | msg.channel, clamp7(msg.note), clamp7(msg.velocity)];
		case 'polyAftertouch':
			return [Status.PolyAftertouch | msg.channel, clamp7(msg.note), clamp7(msg.pressure)];
		case 'controlChange':
			return [Status.ControlChange | msg.channel, clamp7(msg.controller), clamp7(msg.value)];
		case 'programChange':
			return [Status.ProgramChange | msg.channel, clamp7(msg.program)];
		case 'channelAftertouch':
			return [Status.ChannelAftertouch | msg.channel, clamp7(msg.pressure)];
		case 'pitchBend': {
			const { msb, lsb } = split14(msg.value);
			return [Status.PitchBend | msg.channel, lsb, msb];
		}
		case 'sysex':
			return [Status.SysExStart, ...msg.data, Status.SysExEnd];
		case 'mtcQuarterFrame':
			return [Status.MtcQuarterFrame, ((msg.messageType & 0x07) << 4) | (msg.value & 0x0f)];
		case 'songPosition': {
			const { msb, lsb } = split14(msg.beats);
			return [Status.SongPosition, lsb, msb];
		}
		case 'songSelect':
			return [Status.SongSelect, clamp7(msg.song)];
		case 'tuneRequest':
			return [Status.TuneRequest];
		case 'clock':
			return [Status.Clock];
		case 'start':
			return [Status.Start];
		case 'continue':
			return [Status.Continue];
		case 'stop':
			return [Status.Stop];
		case 'activeSensing':
			return [Status.ActiveSensing];
		case 'reset':
			return [Status.Reset];
		case 'unknown':
			return msg.bytes;
	}
}

/* -------------------------------------------------------------------------- */
/* Description                                                                 */
/* -------------------------------------------------------------------------- */

export interface DescribeOptions {
	/** Interpret notes on this channel (0-based) as GM percussion names. */
	drumChannel?: number | null;
	octaveConvention?: 'c3' | 'c4';
	/** Include the channel number in the sentence. */
	channel?: boolean;
}

/** A short label for monitor rows and piano-roll tooltips. */
export function shortLabel(msg: MidiMessage, opts: DescribeOptions = {}): string {
	const conv = opts.octaveConvention ?? 'c3';
	switch (msg.type) {
		case 'noteOn':
			return `${noteName(msg.note, { convention: conv })} on · v${msg.velocity}`;
		case 'noteOff':
			return `${noteName(msg.note, { convention: conv })} off`;
		case 'controlChange':
			return `${ccName(msg.controller)} = ${msg.value}`;
		case 'programChange':
			return `Program ${msg.program}`;
		case 'pitchBend':
			return `Bend ${msg.value - 8192 >= 0 ? '+' : ''}${msg.value - 8192}`;
		case 'channelAftertouch':
			return `Pressure ${msg.pressure}`;
		case 'polyAftertouch':
			return `${noteName(msg.note, { convention: conv })} pressure ${msg.pressure}`;
		case 'sysex':
			return `SysEx · ${msg.data.length} bytes`;
		case 'songPosition':
			return `Song position ${msg.beats}`;
		case 'songSelect':
			return `Song ${msg.song}`;
		case 'mtcQuarterFrame':
			return `MTC frame ${msg.messageType}`;
		case 'clock':
			return 'Clock';
		case 'start':
			return 'Start';
		case 'continue':
			return 'Continue';
		case 'stop':
			return 'Stop';
		case 'activeSensing':
			return 'Active Sensing';
		case 'reset':
			return 'System Reset';
		case 'tuneRequest':
			return 'Tune Request';
		case 'unknown':
			return `Unrecognised (${hexBytes(msg.bytes)})`;
	}
}

/** A full plain-English sentence. This is what the byte inspector prints. */
export function describe(msg: MidiMessage, opts: DescribeOptions = {}): string {
	const conv = opts.octaveConvention ?? 'c3';
	const showCh = opts.channel ?? true;
	const on = showCh && 'channel' in msg ? ` on channel ${msg.channel + 1}` : '';
	const drums = opts.drumChannel ?? 9;

	const pitch = (n: number, channel: number) => {
		const gm = channel === drums ? drumName(n) : null;
		return gm ? `${gm} (note ${n})` : `${noteName(n, { convention: conv })} (note ${n})`;
	};

	switch (msg.type) {
		case 'noteOn':
			return `Start playing ${pitch(msg.note, msg.channel)}${on}, struck at velocity ${msg.velocity}${velocityFlavour(msg.velocity)}.`;
		case 'noteOff':
			return `Stop playing ${pitch(msg.note, msg.channel)}${on}${msg.velocity ? `, released at velocity ${msg.velocity}` : ''}.`;
		case 'polyAftertouch':
			return `Pressure ${msg.pressure} applied to ${pitch(msg.note, msg.channel)} alone${on} — this note only, not the whole chord.`;
		case 'controlChange':
			return describeCc(msg.controller, msg.value, msg.channel, showCh);
		case 'programChange':
			return `Switch${on} to program ${msg.program} — under General MIDI that is ${gmProgramName(msg.program)}, but your device decides what it actually means.`;
		case 'channelAftertouch':
			return `Pressure ${msg.pressure} applied to every note${on}.`;
		case 'pitchBend': {
			const delta = msg.value - 8192;
			if (delta === 0) return `Pitch bend returned to centre${on}.`;
			const pct = Math.round((Math.abs(delta) / (delta > 0 ? 8191 : 8192)) * 100);
			return `Bend pitch ${delta > 0 ? 'up' : 'down'} ${pct}% of the configured bend range${on} (raw value ${msg.value} of 16383, centre 8192).`;
		}
		case 'sysex':
			return describeSysEx(msg.data);
		case 'songPosition':
			return `Jump to song position ${msg.beats} — that is ${msg.beats} sixteenth notes from the start (${(msg.beats / 4).toFixed(2)} beats).`;
		case 'songSelect':
			return `Select song ${msg.song}.`;
		case 'mtcQuarterFrame':
			return `MIDI Time Code quarter frame, piece ${msg.messageType} of 8, nibble ${msg.value}. Eight of these spell out one timecode position.`;
		case 'clock':
			return 'One clock tick. Twenty-four of these make a quarter note, and they are sent continuously whether or not anything is playing.';
		case 'start':
			return 'Start — begin playback from the very beginning.';
		case 'continue':
			return 'Continue — resume playback from wherever the song position pointer left off.';
		case 'stop':
			return 'Stop playback.';
		case 'activeSensing':
			return 'Active Sensing — a heartbeat. If it stops arriving, the receiver assumes the cable was pulled and silences its notes.';
		case 'reset':
			return 'System Reset — return to power-on state. Rarely sent; some devices ignore it.';
		case 'tuneRequest':
			return 'Tune Request — asks analogue oscillators to retune themselves.';
		case 'unknown':
			return `These bytes do not form a valid MIDI message: ${hexBytes(msg.bytes)}.`;
	}
}

function velocityFlavour(v: number): string {
	if (v <= 20) return ' — barely touched';
	if (v <= 45) return ' — soft';
	if (v <= 80) return ' — moderate';
	if (v <= 110) return ' — firm';
	return ' — hammered';
}

function drumName(n: number): string | null {
	return GM_DRUMS[n] ?? null;
}

function describeCc(cc: number, value: number, channel: number, showCh: boolean): string {
	const on = showCh ? ` on channel ${channel + 1}` : '';
	switch (cc) {
		case 64:
			return value >= 64
				? `Sustain pedal down${on} — notes will keep ringing after their Note Off arrives.`
				: `Sustain pedal up${on} — everything being sustained is released now.`;
		case 120:
			return `All Sound Off${on}. Every voice is cut instantly, ignoring release tails and the sustain pedal. The blunt instrument.`;
		case 121:
			return `Reset All Controllers${on} — bend back to centre, mod wheel to zero, pedals up.`;
		case 122:
			return value >= 64
				? `Local Control on${on} — the keyboard is reconnected to its own sound engine.`
				: `Local Control off${on} — the keyboard stops playing its own sounds and becomes a pure controller. This is the fix for doubled notes when a sequencer echoes MIDI back.`;
		case 123:
			return `All Notes Off${on} — every held note is released, as if you lifted your hands. The sustain pedal still applies.`;
		case 124:
			return `Omni Mode Off${on} — listen only to this channel.`;
		case 125:
			return `Omni Mode On${on} — listen to every channel.`;
		case 126:
			return `Mono Mode On${on} — one note at a time, using ${value} channel${value === 1 ? '' : 's'}.`;
		case 127:
			return `Poly Mode On${on} — normal polyphonic behaviour.`;
		case 98:
		case 99:
			return `Select non-registered parameter, ${cc === 99 ? 'coarse' : 'fine'} half = ${value}${on}. Nothing changes until a Data Entry follows.`;
		case 100:
		case 101:
			return `Select registered parameter, ${cc === 101 ? 'coarse' : 'fine'} half = ${value}${on}.`;
		case 6:
			return `Data Entry ${value}${on} — sets the coarse value of whichever RPN or NRPN was last selected.`;
		case 38:
			return `Data Entry fine = ${value}${on}.`;
		case 0:
			return `Bank Select coarse = ${value}${on}. Held in waiting; the next Program Change picks a sound from this bank.`;
		case 32:
			return `Bank Select fine = ${value}${on}.`;
		case 7:
			return `Channel volume ${value} of 127${on} — the mix fader for this channel.`;
		case 10:
			return `Pan ${value}${on} — ${value === 64 ? 'dead centre' : value < 64 ? `${Math.round(((64 - value) / 64) * 100)}% left` : `${Math.round(((value - 64) / 63) * 100)}% right`}.`;
		case 11:
			return `Expression ${value} of 127${on} — a percentage of the channel volume, for swells within a phrase.`;
		case 1:
			return `Modulation wheel ${value} of 127${on}.`;
		default: {
			const info = ccName(cc);
			const isUndefined = info.startsWith('CC ');
			return isUndefined
				? `Controller ${cc} set to ${value}${on}. The spec leaves this one undefined, so it means whatever the receiving device says it means.`
				: `${info} set to ${value} of 127${on} — by convention. The receiver has the final say.`;
		}
	}
}

function describeSysEx(data: number[]): string {
	if (data.length === 0) return 'An empty System Exclusive message.';
	if (data[0] === 0x7e || data[0] === 0x7f) {
		const kind = data[0] === 0x7e ? 'Universal Non-Real Time' : 'Universal Real Time';
		if (data[0] === 0x7e && data[2] === 0x06 && data[3] === 0x01)
			return `${kind} Identity Request — "what are you?" Every compliant device answers with its manufacturer, family and firmware version. ${data.length} bytes.`;
		if (data[0] === 0x7e && data[2] === 0x06 && data[3] === 0x02)
			return `${kind} Identity Reply from ${manufacturerName(data.slice(4))}. ${data.length} bytes.`;
		return `${kind} System Exclusive, sub-ID 0x${hex(data[2] ?? 0)}. ${data.length} bytes.`;
	}
	return `System Exclusive addressed to ${manufacturerName(data)} — ${data.length} bytes of manufacturer-private data. Only that maker's devices know what it means.`;
}
