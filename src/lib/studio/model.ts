import type { MidiMessage } from '$lib/midi/messages';
import { writeMidiFile, type TrackEvent } from '$lib/midi/smf';

export type TrackId = 'drums' | 'bass' | 'chords' | 'melody';

export interface StudioNote {
	id: string;
	note: number;
	/** Quarter-note beats from the beginning of the piece. */
	start: number;
	duration: number;
	velocity: number;
}

export interface StudioTrack {
	id: TrackId;
	name: string;
	channel: number;
	program: number;
	muted: boolean;
	notes: StudioNote[];
}

/** The saved artifact is the music itself, including the voices it was made with. */
export interface StudioProject {
	version: 1;
	id: string;
	title: string;
	bpm: number;
	bars: 8;
	beatsPerBar: 4;
	key: string;
	exampleId: string;
	tracks: StudioTrack[];
	updatedAt: number;
}

export interface StudioEvent {
	tick: number;
	message: MidiMessage;
}

const MIN_DURATION = 1 / 96;
const TRACK_IDS: TrackId[] = ['drums', 'bass', 'chords', 'melody'];

export function studioId(): string {
	return crypto.randomUUID();
}

export function projectBeats(project: StudioProject): number {
	return project.bars * project.beatsPerBar;
}

export function makeNote(note: number, start: number, duration = 0.5, velocity = 96): StudioNote {
	return normalizeNote({ id: studioId(), note, start, duration, velocity });
}

export function cloneProject(project: StudioProject): StudioProject {
	return {
		...project,
		tracks: project.tracks.map((track) => ({
			...track,
			notes: track.notes.map((note) => ({ ...note }))
		}))
	};
}

/** All edits converge on the same legal note bounds, including notes at the last bar. */
export function normalizeNote(note: StudioNote, totalBeats = 32): StudioNote {
	const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
	const start = Math.max(0, Math.min(totalBeats - MIN_DURATION, finite(note.start, 0)));
	return {
		...note,
		note: Math.max(0, Math.min(127, Math.round(finite(note.note, 60)))),
		start,
		duration: Math.max(MIN_DURATION, Math.min(totalBeats - start, finite(note.duration, 0.5))),
		velocity: Math.max(1, Math.min(127, Math.round(finite(note.velocity, 96))))
	};
}

/** Move starts and ends toward a beat grid. Strength 0 preserves the take exactly. */
export function quantizeNotes(
	notes: StudioNote[],
	grid = 0.25,
	strength = 1,
	totalBeats = 32
): StudioNote[] {
	if (!Number.isFinite(grid) || grid <= 0) return notes.map((note) => ({ ...note }));
	const amount = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 1));
	if (amount === 0) return notes.map((note) => ({ ...note }));
	return notes.map((note) => {
		const end = note.start + note.duration;
		const start = note.start + (Math.round(note.start / grid) * grid - note.start) * amount;
		const snappedEnd = end + (Math.round(end / grid) * grid - end) * amount;
		return normalizeNote({ ...note, start, duration: snappedEnd - start }, totalBeats);
	});
}

function eventOrder(message: MidiMessage): number {
	return message.type === 'noteOff' ? 0 : 1;
}

/** Scheduled pairs retain an explicit final boundary so a loop can release before restarting. */
export function projectEvents(project: StudioProject, ppq = 96): StudioEvent[] {
	const events: StudioEvent[] = [];
	for (const track of project.tracks) {
		if (track.muted) continue;
		for (const raw of track.notes) {
			const note = normalizeNote(raw, projectBeats(project));
			const start = Math.round(note.start * ppq);
			const end = Math.max(start + 1, Math.round((note.start + note.duration) * ppq));
			events.push(
				{
					tick: start,
					message: {
						type: 'noteOn',
						channel: track.channel,
						note: note.note,
						velocity: note.velocity
					}
				},
				{
					tick: end,
					message: { type: 'noteOff', channel: track.channel, note: note.note, velocity: 0 }
				}
			);
		}
	}
	return events.sort((a, b) => a.tick - b.tick || eventOrder(a.message) - eventOrder(b.message));
}

export function projectToMidiFile(project: StudioProject): Uint8Array {
	const ppq = 480;
	const tracks = project.tracks
		.filter((track) => !track.muted && track.notes.length > 0)
		.map((track) => {
			const events: TrackEvent[] = [
				{
					delta: 0,
					tick: 0,
					event: { type: 'programChange', channel: track.channel, program: track.program }
				}
			];
			for (const note of track.notes) {
				const n = normalizeNote(note, projectBeats(project));
				const start = Math.round(n.start * ppq);
				events.push(
					{
						delta: 0,
						tick: start,
						event: { type: 'noteOn', channel: track.channel, note: n.note, velocity: n.velocity }
					},
					{
						delta: 0,
						tick: Math.max(start + 1, Math.round((n.start + n.duration) * ppq)),
						event: { type: 'noteOff', channel: track.channel, note: n.note, velocity: 0 }
					}
				);
			}
			events.sort(
				(a, b) =>
					a.tick - b.tick ||
					(a.event.type === 'programChange'
						? -1
						: b.event.type === 'programChange'
							? 1
							: eventOrder(a.event as MidiMessage) - eventOrder(b.event as MidiMessage))
			);
			return { name: track.name, events };
		});
	return writeMidiFile(tracks, {
		division: ppq,
		endTick: projectBeats(project) * ppq,
		bpm: project.bpm,
		timeSignature: [4, 4],
		name: project.title
	});
}

export function serializeProject(project: StudioProject): string {
	return JSON.stringify(project, null, 2);
}

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function number(value: unknown, min: number, max: number, integer = false): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		value >= min &&
		value <= max &&
		(!integer || Number.isInteger(value))
	);
}

function label(value: unknown, limit = 120): value is string {
	return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}

/** Validate backups before they can enter the audio scheduler or replace a working project. */
export function parseProject(json: string): StudioProject {
	if (json.length > 2_000_000)
		throw new Error('This project is too large. Choose a MIDI Lab project under 2 MB.');
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		throw new Error('This file is not valid JSON. Choose a MIDI Lab project backup.');
	}
	if (
		!object(value) ||
		value.version !== 1 ||
		value.bars !== 8 ||
		value.beatsPerBar !== 4 ||
		!label(value.id) ||
		!label(value.title) ||
		!label(value.key) ||
		!label(value.exampleId) ||
		!number(value.bpm, 40, 240) ||
		!number(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) ||
		!Array.isArray(value.tracks) ||
		value.tracks.length !== 4
	) {
		throw new Error('Choose an eight-bar MIDI Lab Studio project (.json).');
	}
	const ids = new Set<string>();
	const channels = new Set<number>();
	const noteIds = new Set<string>();
	for (const track of value.tracks) {
		if (
			!object(track) ||
			!TRACK_IDS.includes(track.id as TrackId) ||
			ids.has(track.id as string) ||
			!label(track.name) ||
			!number(track.channel, 0, 15, true) ||
			channels.has(track.channel as number) ||
			(track.id === 'drums' ? track.channel !== 9 : track.channel === 9) ||
			!number(track.program, 0, 127, true) ||
			typeof track.muted !== 'boolean' ||
			!Array.isArray(track.notes) ||
			track.notes.length > 10_000
		) {
			throw new Error(
				'This project has an invalid part. Each project needs drums, bass, chords and melody.'
			);
		}
		ids.add(track.id as string);
		channels.add(track.channel as number);
		for (const note of track.notes) {
			if (
				!object(note) ||
				!label(note.id) ||
				noteIds.has(note.id) ||
				!number(note.note, 0, 127, true) ||
				!number(note.start, 0, 32 - MIN_DURATION) ||
				!number(note.duration, MIN_DURATION, 32) ||
				(note.start as number) + (note.duration as number) > 32 + 0.000001 ||
				!number(note.velocity, 1, 127, true)
			) {
				throw new Error(
					'This project contains an invalid note. Notes must fit inside its eight bars.'
				);
			}
			noteIds.add(note.id);
		}
	}
	return value as unknown as StudioProject;
}
