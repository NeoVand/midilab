import { describe, expect, it } from 'vitest';
import { readMidiFile } from '$lib/midi/smf';
import { createProject, emptyProject, STUDIO_EXAMPLES } from './examples';
import {
	cloneProject,
	makeNote,
	normalizeNote,
	parseProject,
	projectEvents,
	projectToMidiFile,
	quantizeNotes,
	serializeProject
} from './model';

describe('original eight-bar studies', () => {
	for (const example of STUDIO_EXAMPLES) {
		it(`${example.title} is a complete, restorable piece with intentional space`, () => {
			const project = createProject(example.id);
			expect(parseProject(serializeProject(project))).toEqual(project);
			expect(project.tracks.map((track) => track.channel)).toEqual([9, 1, 2, 3]);
			expect(project.tracks.every((track) => track.notes.length > 0)).toBe(true);
			expect(
				project.tracks
					.flatMap((track) => track.notes)
					.every((note) => note.start >= 0 && note.start + note.duration <= 32)
			).toBe(true);
			const melody = project.tracks.find((track) => track.id === 'melody')!;
			expect(melody.notes.reduce((sum, note) => sum + note.duration, 0)).toBeLessThan(28);
		});
	}

	it('starts a blank piece without losing its chosen voices and musical context', () => {
		const project = emptyProject('night-drive');
		expect(project.tracks.every((track) => track.notes.length === 0)).toBe(true);
		expect(project.key).toBe('A minor');
		expect(project.bpm).toBe(116);
		expect(project.tracks[1].program).toBe(38);
	});

	it('includes the named ninths in Pocket Soul harmony', () => {
		const project = createProject('pocket-soul');
		const chords = project.tracks.find((track) => track.id === 'chords')!;
		const pitchClassesAt = (beat: number) =>
			chords.notes.filter((note) => note.start === beat).map((note) => note.note % 12);
		expect(pitchClassesAt(8)).toContain(9); // A is the ninth of Gm9.
		expect(pitchClassesAt(24)).toContain(7); // G is the ninth of Fmaj9.
	});
});

describe('safe musical edits', () => {
	it('clamps a last-bar edit instead of leaving notes beyond the loop', () => {
		const note = normalizeNote({ id: 'last', note: 145, start: 31.75, duration: 4, velocity: 0 });
		expect(note).toMatchObject({ note: 127, start: 31.75, duration: 0.25, velocity: 1 });
	});

	it('partially quantizes both boundaries while retaining pitch and expression', () => {
		const note = makeNote(64, 0.12, 0.42, 73);
		const [half] = quantizeNotes([note], 0.25, 0.5);
		expect(half.start).toBeCloseTo(0.06);
		expect(half.start + half.duration).toBeCloseTo(0.52);
		expect(half.velocity).toBe(73);
		expect(quantizeNotes([note], 0.25, 0)).toEqual([note]);
	});

	it('gives undo snapshots independent note arrays', () => {
		const project = createProject();
		const copy = cloneProject(project);
		copy.tracks[0].notes[0].velocity = 1;
		expect(project.tracks[0].notes[0].velocity).toBe(110);
	});

	it('rejects malformed backups before they replace a project', () => {
		const project = createProject();
		project.tracks[1].notes[0].start = 40;
		expect(() => parseProject(serializeProject(project))).toThrow('invalid note');
		expect(() => parseProject('{')).toThrow('valid JSON');
		const duplicate = createProject();
		duplicate.tracks[1].id = 'drums';
		expect(() => parseProject(serializeProject(duplicate))).toThrow('invalid part');
		const collision = createProject();
		collision.tracks[2].channel = collision.tracks[1].channel;
		expect(() => parseProject(serializeProject(collision))).toThrow('invalid part');
		const melodicDrums = createProject();
		melodicDrums.tracks[0].channel = 0;
		expect(() => parseProject(serializeProject(melodicDrums))).toThrow('invalid part');
	});
});

describe('audible and portable playback', () => {
	it('preserves eight bars even when the final bars are silent', () => {
		const project = emptyProject();
		project.tracks[3].notes = [makeNote(60, 0, 1)];
		for (const sketch of [project, emptyProject()]) {
			const file = readMidiFile(Uint8Array.from(projectToMidiFile(sketch)).buffer);
			expect(file.tracks.every((track) => track.events.at(-1)?.tick === 32 * 480)).toBe(true);
		}
	});
	it('releases repeated pitches before starting the next articulation and retains the loop boundary', () => {
		const project = emptyProject();
		project.tracks[3].notes = [makeNote(60, 0, 1), makeNote(60, 1, 31)];
		const events = projectEvents(project);
		expect(events.filter((event) => event.tick === 96).map((event) => event.message.type)).toEqual([
			'noteOff',
			'noteOn'
		]);
		expect(events.at(-1)?.tick).toBe(32 * 96);
	});

	it('exports the chosen voices, timing, velocities and tempo, with muted parts excluded', () => {
		const project = createProject('sunlit-pop');
		project.tracks[3].muted = true;
		const bytes = projectToMidiFile(project);
		const file = readMidiFile(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
		);
		expect(file.tracks).toHaveLength(4);
		const tempo = file.tracks[0].events.find(
			(event) => event.event.type === 'meta' && event.event.tempo !== undefined
		)!.event;
		expect(tempo.type === 'meta' ? tempo.tempo : undefined).toBeCloseTo(project.bpm, 3);
		const chordEvents = file.tracks.find((track) => track.name === 'Chords')!.events;
		expect(
			chordEvents.some(
				(event) =>
					event.event.type === 'programChange' &&
					event.event.program === 24 &&
					event.event.channel === 2
			)
		).toBe(true);
		expect(chordEvents.filter((event) => event.event.type === 'noteOn')).toHaveLength(
			project.tracks[2].notes.length
		);
		expect(file.tracks.some((track) => track.name === 'Melody')).toBe(false);
	});
});
