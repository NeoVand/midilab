/**
 * System Exclusive — the manufacturer-private escape hatch.
 *
 * Everything else in MIDI is a fixed, tiny, universally understood message.
 * SysEx is the opposite: an arbitrarily long block of bytes addressed to one
 * manufacturer, meaning whatever that manufacturer decided. Patch dumps, global
 * settings, sample transfers, deep parameter edits and — importantly — firmware
 * updates all travel this way.
 *
 * That last one is why browsers gate SysEx behind a separate permission. A page
 * with unrestricted SysEx access can, in principle, brick a synthesiser.
 */

import { MANUFACTURERS_1BYTE, MANUFACTURERS_3BYTE, manufacturerName } from './constants';

export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

export const UNIVERSAL_NON_REALTIME = 0x7e;
export const UNIVERSAL_REALTIME = 0x7f;
/** "Any device, please answer." */
export const ALL_CALL = 0x7f;

/**
 * The one SysEx message every compliant device understands:
 * "identify yourself".
 */
export function identityRequest(deviceId = ALL_CALL): number[] {
	return [SYSEX_START, UNIVERSAL_NON_REALTIME, deviceId, 0x06, 0x01, SYSEX_END];
}

export interface IdentityReply {
	deviceId: number;
	manufacturerId: number[];
	manufacturer: string;
	family: number;
	member: number;
	/** Four version bytes as reported, plus a readable form. */
	version: number[];
	versionString: string;
}

/** Parse the payload of a 0x7E … 06 02 reply. Pass the bytes between F0 and F7. */
export function parseIdentityReply(data: number[]): IdentityReply | null {
	if (data[0] !== UNIVERSAL_NON_REALTIME || data[2] !== 0x06 || data[3] !== 0x02) return null;
	const deviceId = data[1];
	const threeByte = data[4] === 0x00;
	const manufacturerId = threeByte ? data.slice(4, 7) : data.slice(4, 5);
	const i = 4 + manufacturerId.length;
	const family = (data[i] ?? 0) | ((data[i + 1] ?? 0) << 7);
	const member = (data[i + 2] ?? 0) | ((data[i + 3] ?? 0) << 7);
	const version = data.slice(i + 4, i + 8);
	return {
		deviceId,
		manufacturerId,
		manufacturer: manufacturerName(manufacturerId),
		family,
		member,
		version,
		versionString: version.join('.')
	};
}

/** Roland-style checksum: the value that makes the addressed bytes sum to 0 mod 128. */
export function rolandChecksum(bytes: number[]): number {
	const sum = bytes.reduce((a, b) => a + (b & 0x7f), 0);
	return (128 - (sum % 128)) % 128;
}

/** Yamaha-style checksum over a data block, same arithmetic, different framing. */
export function yamahaChecksum(bytes: number[]): number {
	return rolandChecksum(bytes);
}

/** Are these bytes safe to hand to a device? Data bytes only between F0 and F7. */
export function validateSysEx(bytes: number[]): { ok: boolean; problem?: string } {
	if (bytes.length < 3) return { ok: false, problem: 'Too short to be a SysEx message.' };
	if (bytes[0] !== SYSEX_START) return { ok: false, problem: 'Must begin with F0.' };
	if (bytes[bytes.length - 1] !== SYSEX_END) return { ok: false, problem: 'Must end with F7.' };
	for (let i = 1; i < bytes.length - 1; i++) {
		if (bytes[i] > 0x7f) {
			return {
				ok: false,
				problem: `Byte ${i} is 0x${bytes[i].toString(16).toUpperCase()} — everything between F0 and F7 must be a data byte (00–7F).`
			};
		}
	}
	return { ok: true };
}

/** Parse a loose hex string — "F0 7E 7F 06 01 F7", "f07e7f0601f7", commas, newlines. */
export function parseHexString(input: string): number[] {
	const cleaned = input.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
	const out: number[] = [];
	for (let i = 0; i + 1 < cleaned.length; i += 2) out.push(parseInt(cleaned.slice(i, i + 2), 16));
	return out;
}

export function formatHexString(bytes: number[], perLine = 16): string {
	const lines: string[] = [];
	for (let i = 0; i < bytes.length; i += perLine) {
		lines.push(
			bytes
				.slice(i, i + perLine)
				.map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
				.join(' ')
		);
	}
	return lines.join('\n');
}

export interface SysExDescription {
	kind: 'universal-nonrealtime' | 'universal-realtime' | 'manufacturer' | 'invalid';
	manufacturer: string;
	summary: string;
}

const UNIVERSAL_SUBIDS: Record<number, string> = {
	0x01: 'Sample Dump Header',
	0x02: 'Sample Data Packet',
	0x03: 'Sample Dump Request',
	0x04: 'MIDI Time Code',
	0x05: 'Sample Dump Extensions',
	0x06: 'General Information (Identity)',
	0x07: 'File Dump',
	0x08: 'MIDI Tuning Standard',
	0x09: 'General MIDI On/Off',
	0x0b: 'File Reference',
	0x0c: 'MIDI Visual Control',
	0x0d: 'MIDI Capability Inquiry (MIDI-CI)'
};

/** A readable summary of a SysEx payload (the bytes between F0 and F7). */
export function describeSysEx(data: number[]): SysExDescription {
	if (data.length === 0) return { kind: 'invalid', manufacturer: '—', summary: 'Empty message.' };
	if (data[0] === UNIVERSAL_NON_REALTIME || data[0] === UNIVERSAL_REALTIME) {
		const realtime = data[0] === UNIVERSAL_REALTIME;
		const sub = UNIVERSAL_SUBIDS[data[2]] ?? `sub-ID 0x${data[2]?.toString(16)}`;
		return {
			kind: realtime ? 'universal-realtime' : 'universal-nonrealtime',
			manufacturer: realtime ? 'Universal Real Time' : 'Universal Non-Real Time',
			summary: `${sub}${data[3] !== undefined ? `, variant 0x${data[3].toString(16).padStart(2, '0')}` : ''} — understood by any compliant device, whoever made it.`
		};
	}
	return {
		kind: 'manufacturer',
		manufacturer: manufacturerName(data),
		summary: `${data.length} bytes of private data. Only that manufacturer's devices know what it means; everything else on the wire ignores it.`
	};
}

/** All the manufacturer names we know, for the reference tables. */
export function knownManufacturers(): Array<{ id: string; name: string }> {
	const out: Array<{ id: string; name: string }> = [];
	for (const [k, v] of Object.entries(MANUFACTURERS_1BYTE)) {
		out.push({ id: Number(k).toString(16).toUpperCase().padStart(2, '0'), name: v });
	}
	for (const [k, v] of Object.entries(MANUFACTURERS_3BYTE)) {
		out.push({ id: `00 ${k.replace(':', ' ').toUpperCase()}`, name: v });
	}
	return out.sort((a, b) => a.name.localeCompare(b.name));
}
