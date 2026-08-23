/**
 * Standard MIDI Files, read and written from scratch.
 *
 * A .mid file is a container with a header chunk and one or more track chunks.
 * Inside a track, every event is preceded by a **delta time** — how many ticks
 * since the previous event — encoded as a *variable-length quantity*, which is
 * the same seven-bits-per-byte trick that runs through the whole protocol: each
 * byte carries seven bits of number, and its top bit means "another byte
 * follows".
 *
 * Tracks also use running status, exactly as a live cable does, so the streaming
 * parser from `messages.ts` is reused here rather than reimplemented.
 */

import { dataByteCount, encode, parse, Status, type MidiMessage } from './messages';

export type Format = 0 | 1 | 2;

export interface MetaEvent {
	type: 'meta';
	subtype: number;
	name: string;
	data: number[];
	/** Decoded value for the meta events worth decoding. */
	text?: string;
	tempo?: number;
	timeSignature?: { numerator: number; denominator: number };
	keySignature?: { sharps: number; minor: boolean };
}

export interface TrackEvent {
	/** Ticks since the previous event in this track. */
	delta: number;
	/** Absolute tick from the start of the track. */
	tick: number;
	event: MidiMessage | MetaEvent;
}

export interface MidiTrack {
	name?: string;
	events: TrackEvent[];
}

export interface MidiFile {
	format: Format;
	/** Ticks per quarter note. The file's own time resolution. */
	division: number;
	tracks: MidiTrack[];
}

/* -------------------------------------------------------------------------- */
/* Variable-length quantities                                                  */
/* -------------------------------------------------------------------------- */

export function encodeVlq(value: number): number[] {
	let v = Math.max(0, Math.floor(value));
	const out = [v & 0x7f];
	v >>= 7;
	while (v > 0) {
		out.unshift((v & 0x7f) | 0x80);
		v >>= 7;
	}
	return out;
}

export function decodeVlq(
	bytes: ArrayLike<number>,
	offset: number
): { value: number; next: number } {
	let value = 0;
	let i = offset;
	for (let guard = 0; guard < 5; guard++) {
		const byte = bytes[i++];
		value = (value << 7) | (byte & 0x7f);
		if ((byte & 0x80) === 0) break;
	}
	return { value, next: i };
}

/** Human-readable breakdown of a VLQ, for the lesson that teaches it. */
export function explainVlq(value: number): { bytes: number[]; steps: string[] } {
	const bytes = encodeVlq(value);
	const steps = bytes.map((b) => {
		const cont = (b & 0x80) !== 0;
		return `0x${b.toString(16).toUpperCase().padStart(2, '0')} → carries ${b & 0x7f}${cont ? ', and another byte follows' : ', last byte'}`;
	});
	return { bytes, steps };
}

/* -------------------------------------------------------------------------- */
/* Meta events                                                                 */
/* -------------------------------------------------------------------------- */

const META_NAMES: Record<number, string> = {
	0x00: 'Sequence Number',
	0x01: 'Text',
	0x02: 'Copyright',
	0x03: 'Track Name',
	0x04: 'Instrument Name',
	0x05: 'Lyric',
	0x06: 'Marker',
	0x07: 'Cue Point',
	0x20: 'Channel Prefix',
	0x21: 'Port',
	0x2f: 'End of Track',
	0x51: 'Set Tempo',
	0x54: 'SMPTE Offset',
	0x58: 'Time Signature',
	0x59: 'Key Signature',
	0x7f: 'Sequencer Specific'
};

function decodeMeta(subtype: number, data: number[]): MetaEvent {
	const meta: MetaEvent = {
		type: 'meta',
		subtype,
		name: META_NAMES[subtype] ?? `Meta 0x${subtype.toString(16)}`,
		data
	};
	if (subtype <= 0x07) meta.text = new TextDecoder().decode(new Uint8Array(data));
	if (subtype === 0x51 && data.length === 3) {
		// Tempo is microseconds per quarter note, not BPM.
		const usPerQuarter = (data[0] << 16) | (data[1] << 8) | data[2];
		meta.tempo = 60_000_000 / usPerQuarter;
	}
	if (subtype === 0x58 && data.length >= 2) {
		meta.timeSignature = { numerator: data[0], denominator: 2 ** data[1] };
	}
	if (subtype === 0x59 && data.length >= 2) {
		meta.keySignature = { sharps: (data[0] << 24) >> 24, minor: data[1] === 1 };
	}
	return meta;
}

export function isMeta(e: MidiMessage | MetaEvent): e is MetaEvent {
	return (e as MetaEvent).type === 'meta';
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

function readChunk(view: DataView, offset: number): { id: string; length: number; start: number } {
	const id = String.fromCharCode(
		view.getUint8(offset),
		view.getUint8(offset + 1),
		view.getUint8(offset + 2),
		view.getUint8(offset + 3)
	);
	const length = view.getUint32(offset + 4);
	return { id, length, start: offset + 8 };
}

export function readMidiFile(buffer: ArrayBuffer): MidiFile {
	const bytes = new Uint8Array(buffer);
	const view = new DataView(buffer);

	const header = readChunk(view, 0);
	if (header.id !== 'MThd') throw new Error('Not a MIDI file: missing MThd header chunk.');

	const format = view.getUint16(header.start) as Format;
	const trackCount = view.getUint16(header.start + 2);
	const divisionRaw = view.getUint16(header.start + 4);
	if (divisionRaw & 0x8000) {
		// SMPTE timing. Rare; we normalise to something usable rather than fail.
		const framesPerSecond = 256 - (divisionRaw >> 8);
		const ticksPerFrame = divisionRaw & 0xff;
		return readTracks(
			bytes,
			view,
			header.start + header.length,
			trackCount,
			format,
			Math.round(framesPerSecond * ticksPerFrame)
		);
	}
	return readTracks(bytes, view, header.start + header.length, trackCount, format, divisionRaw);
}

function readTracks(
	bytes: Uint8Array,
	view: DataView,
	offset: number,
	count: number,
	format: Format,
	division: number
): MidiFile {
	const tracks: MidiTrack[] = [];
	let pos = offset;

	for (let t = 0; t < count && pos < bytes.length; t++) {
		const chunk = readChunk(view, pos);
		pos = chunk.start + chunk.length;
		if (chunk.id !== 'MTrk') continue;

		const track: MidiTrack = { events: [] };
		let i = chunk.start;
		const end = chunk.start + chunk.length;
		let runningStatus = 0;
		let tick = 0;

		while (i < end) {
			const { value: delta, next } = decodeVlq(bytes, i);
			i = next;
			tick += delta;

			let status = bytes[i];
			if (status < 0x80) {
				status = runningStatus;
			} else {
				i++;
				if (status < 0xf0) runningStatus = status;
			}

			if (status === 0xff) {
				const subtype = bytes[i++];
				const { value: len, next: afterLen } = decodeVlq(bytes, i);
				i = afterLen;
				const data = Array.from(bytes.slice(i, i + len));
				i += len;
				const meta = decodeMeta(subtype, data);
				if (subtype === 0x03 && meta.text) track.name = meta.text;
				track.events.push({ delta, tick, event: meta });
				continue;
			}

			if (status === Status.SysExStart || status === 0xf7) {
				const { value: len, next: afterLen } = decodeVlq(bytes, i);
				i = afterLen;
				const data = Array.from(bytes.slice(i, i + len));
				i += len;
				track.events.push({
					delta,
					tick,
					event: { type: 'sysex', data: data[data.length - 1] === 0xf7 ? data.slice(0, -1) : data }
				});
				continue;
			}

			const n = dataByteCount(status);
			const raw = [status, ...Array.from(bytes.slice(i, i + Math.max(0, n)))];
			i += Math.max(0, n);
			track.events.push({ delta, tick, event: parse(raw) });
		}

		tracks.push(track);
	}

	return { format, division, tracks };
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

export interface WriteOptions {
	division?: number;
	bpm?: number;
	timeSignature?: [number, number];
	name?: string;
}

/** Build a track chunk body from absolute-tick events. */
function buildTrack(events: TrackEvent[]): number[] {
	const out: number[] = [];
	const sorted = [...events].sort((a, b) => a.tick - b.tick);
	let last = 0;
	for (const e of sorted) {
		out.push(...encodeVlq(Math.max(0, e.tick - last)));
		last = e.tick;
		if (isMeta(e.event)) {
			out.push(0xff, e.event.subtype, ...encodeVlq(e.event.data.length), ...e.event.data);
		} else if (e.event.type === 'sysex') {
			out.push(0xf0, ...encodeVlq(e.event.data.length + 1), ...e.event.data, 0xf7);
		} else {
			out.push(...encode(e.event));
		}
	}
	// Every track must end with End of Track.
	out.push(0x00, 0xff, 0x2f, 0x00);
	return out;
}

function chunk(id: string, body: number[]): number[] {
	const len = body.length;
	return [
		...[...id].map((c) => c.charCodeAt(0)),
		(len >> 24) & 0xff,
		(len >> 16) & 0xff,
		(len >> 8) & 0xff,
		len & 0xff,
		...body
	];
}

export function textMeta(subtype: number, text: string): MetaEvent {
	return {
		type: 'meta',
		subtype,
		name: META_NAMES[subtype] ?? 'Text',
		data: Array.from(new TextEncoder().encode(text)),
		text
	};
}

export function tempoMeta(bpm: number): MetaEvent {
	const us = Math.round(60_000_000 / bpm);
	return {
		type: 'meta',
		subtype: 0x51,
		name: 'Set Tempo',
		data: [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff],
		tempo: bpm
	};
}

export function timeSignatureMeta(numerator: number, denominator: number): MetaEvent {
	return {
		type: 'meta',
		subtype: 0x58,
		name: 'Time Signature',
		data: [numerator, Math.log2(denominator), 24, 8],
		timeSignature: { numerator, denominator }
	};
}

/** Write a format-1 file: one conductor track plus one track per part. */
export function writeMidiFile(tracks: MidiTrack[], opts: WriteOptions = {}): Uint8Array {
	const { division = 480, bpm = 120, timeSignature = [4, 4], name } = opts;

	const conductor: TrackEvent[] = [
		{ delta: 0, tick: 0, event: tempoMeta(bpm) },
		{ delta: 0, tick: 0, event: timeSignatureMeta(timeSignature[0], timeSignature[1]) }
	];
	if (name) conductor.unshift({ delta: 0, tick: 0, event: textMeta(0x03, name) });

	const bodies: number[][] = [buildTrack(conductor)];
	for (const t of tracks) {
		const events = [...t.events];
		if (t.name) events.unshift({ delta: 0, tick: 0, event: textMeta(0x03, t.name) });
		bodies.push(buildTrack(events));
	}

	const header = chunk('MThd', [
		0x00,
		0x01, // format 1
		(bodies.length >> 8) & 0xff,
		bodies.length & 0xff,
		(division >> 8) & 0xff,
		division & 0xff
	]);

	const out = [...header];
	for (const b of bodies) out.push(...chunk('MTrk', b));
	return new Uint8Array(out);
}

/* -------------------------------------------------------------------------- */
/* Analysis                                                                    */
/* -------------------------------------------------------------------------- */

export interface FileSummary {
	format: Format;
	division: number;
	trackCount: number;
	eventCount: number;
	noteCount: number;
	channelsUsed: number[];
	durationTicks: number;
	durationSeconds: number;
	tempo: number;
	timeSignature: string;
	names: string[];
}

export function summarise(file: MidiFile): FileSummary {
	let events = 0;
	let notes = 0;
	let durationTicks = 0;
	let tempo = 120;
	let timeSignature = '4/4';
	const channels = new Set<number>();
	const names: string[] = [];

	for (const track of file.tracks) {
		if (track.name) names.push(track.name);
		for (const e of track.events) {
			events++;
			durationTicks = Math.max(durationTicks, e.tick);
			if (isMeta(e.event)) {
				if (e.event.tempo) tempo = e.event.tempo;
				if (e.event.timeSignature) {
					timeSignature = `${e.event.timeSignature.numerator}/${e.event.timeSignature.denominator}`;
				}
			} else {
				if (e.event.type === 'noteOn') notes++;
				if ('channel' in e.event) channels.add(e.event.channel);
			}
		}
	}

	return {
		format: file.format,
		division: file.division,
		trackCount: file.tracks.length,
		eventCount: events,
		noteCount: notes,
		channelsUsed: [...channels].sort((a, b) => a - b),
		durationTicks,
		durationSeconds: (durationTicks / file.division) * (60 / tempo),
		tempo,
		timeSignature,
		names
	};
}

/** Flatten every track into one time-ordered stream, for playback. */
export function flatten(file: MidiFile): TrackEvent[] {
	return file.tracks
		.flatMap((t) => t.events)
		.filter((e) => !isMeta(e.event))
		.sort((a, b) => a.tick - b.tick);
}
