import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioSession } from './session.svelte';
import { engine } from '$lib/midi/engine.svelte';
import { bus } from '$lib/midi/bus';
import { PPQ, transport, type TickListener } from '$lib/midi/clock.svelte';
import { createProject } from './examples';
import { encode, type MidiMessage } from '$lib/midi/messages';

type LocalListener = Parameters<typeof engine.onLocalSend>[0];
let session: StudioSession;
let tickListener: TickListener;
let localListener: LocalListener;
let now = 1000;
let nextTimer = 1;
const timers = new Map<number, { callback: () => void; delay: number }>();
let sent: { message: MidiMessage; origin: string | undefined }[];

beforeEach(() => {
	localStorage.removeItem('midilab:studio:autosave:v1');
	localStorage.removeItem('midilab:studio:projects:v1');
	now = 1000;
	nextTimer = 1;
	timers.clear();
	sent = [];
	vi.spyOn(performance, 'now').mockImplementation(() => now);
	vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
	vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay = 0) => {
		const id = nextTimer++;
		timers.set(id, { callback: callback as () => void, delay });
		return id as unknown as ReturnType<typeof window.setTimeout>;
	});
	vi.spyOn(window, 'clearTimeout').mockImplementation((id) => {
		if (typeof id === 'number') timers.delete(id);
	});
	vi.spyOn(engine, 'wake').mockResolvedValue(undefined);
	vi.spyOn(engine, 'onLocalSend').mockImplementation((listener) => {
		localListener = listener;
		return () => {};
	});
	vi.spyOn(engine, 'send').mockImplementation((message, at, audioTime, origin) => {
		sent.push({ message, origin });
		localListener?.(message, at, audioTime, origin ?? 'performer');
	});
	vi.spyOn(transport, 'onTick').mockImplementation((listener) => {
		tickListener = listener;
		return () => {};
	});
	vi.spyOn(transport, 'start').mockImplementation(async () => {
		transport.playing = true;
	});
	vi.spyOn(transport, 'stop').mockImplementation(() => {
		transport.playing = false;
	});
	session = new StudioSession();
	session.attach();
});

afterEach(() => {
	session.destroy();
	transport.playing = false;
	vi.restoreAllMocks();
	localStorage.removeItem('midilab:studio:autosave:v1');
	localStorage.removeItem('midilab:studio:projects:v1');
});

function scheduledTick(tick: number, perfTime = now) {
	tickListener({ tick, perfTime, audioTime: perfTime / 1000 });
}

describe('Studio playback and recording ownership', () => {
	it('cancels the old deferred silence before a new playback can sound', async () => {
		await session.play();
		session.stop();
		expect([...timers.values()].some((timer) => timer.delay === 150)).toBe(true);
		await session.play();
		expect([...timers.values()].some((timer) => timer.delay === 150)).toBe(false);
		sent = [];
		scheduledTick(0);
		expect(
			sent.some(({ message, origin }) => message.type === 'noteOn' && origin === 'sequence')
		).toBe(true);
	});

	it('keeps editing out of an armed count-in and excludes demonstration and sequence notes from a take', async () => {
		const before = session.track.notes.length;
		await session.play(true);
		expect(session.armed).toBe(true);
		session.addNote();
		expect(session.track.notes).toHaveLength(before);
		scheduledTick(4 * PPQ, now);
		expect(session.recording).toBe(true);
		for (const origin of ['demo', 'sequence'] as const) {
			localListener(
				{ type: 'noteOn', channel: 9, note: 45, velocity: 100 },
				now + 100,
				undefined,
				origin
			);
			localListener(
				{ type: 'noteOff', channel: 9, note: 45, velocity: 0 },
				now + 200,
				undefined,
				origin
			);
		}
		localListener(
			{ type: 'noteOn', channel: 9, note: 36, velocity: 111 },
			now + 100,
			undefined,
			'performer'
		);
		localListener(
			{ type: 'noteOff', channel: 9, note: 36, velocity: 0 },
			now + 400,
			undefined,
			'performer'
		);
		now += 500;
		session.finishTake();
		expect(session.track.notes).toHaveLength(before + 1);
		expect(session.track.notes.at(-1)).toMatchObject({ note: 36, velocity: 111 });
	});

	it('routes hardware into the selected part and records each input note once', async () => {
		session.selectTrack('bass');
		session.countIn = false;
		session.replaceTake = true;
		await session.play(true);
		scheduledTick(0, now);
		const on: MidiMessage = { type: 'noteOn', channel: 0, note: 43, velocity: 98 };
		const off: MidiMessage = { type: 'noteOff', channel: 0, note: 43, velocity: 0 };
		bus.emit({
			direction: 'in',
			portId: 'keyboard',
			portName: 'Test keyboard',
			time: now + 100,
			bytes: encode(on),
			message: on
		});
		bus.emit({
			direction: 'in',
			portId: 'keyboard',
			portName: 'Test keyboard',
			time: now + 400,
			bytes: encode(off),
			message: off
		});
		now += 500;
		session.finishTake();
		expect(session.track.notes).toHaveLength(1);
		expect(session.track.notes[0]).toMatchObject({ note: 43, velocity: 98 });
		expect(sent).toContainEqual({ message: { ...on, channel: 1 }, origin: 'performer' });
	});

	it('silences excluded parts immediately when solo changes and preserves playback on mute', async () => {
		await session.play();
		sent = [];
		session.toggleSolo('bass');
		const silenced = sent
			.filter(({ message }) => message.type === 'controlChange' && message.controller === 123)
			.map(({ message }) => ('channel' in message ? message.channel : -1));
		expect(silenced).toEqual([9, 2, 3]);
		session.toggleMute('drums');
		expect(session.playing).toBe(true);
		expect(session.project.tracks[0].muted).toBe(true);
	});

	it('releases a deleted sustained note by stopping before its scheduled off is removed', async () => {
		await session.play();
		session.selectTrack('chords');
		const note = session.track.notes[0];
		session.selectedNote = note.id;
		scheduledTick(Math.round(note.start * PPQ));
		sent = [];
		session.deleteNote();
		expect(session.playing).toBe(false);
		expect(session.track.notes.some((candidate) => candidate.id === note.id)).toBe(false);
		expect(
			sent.some(
				({ message }) =>
					message.type === 'controlChange' && message.channel === 2 && message.controller === 123
			)
		).toBe(true);
	});

	it('keeps the old draft when starting empty and retains saved projects beyond thirty', () => {
		for (let index = 0; index < 31; index++) {
			const project = createProject();
			project.title = `Sketch ${index + 1}`;
			session.loadProject(project);
		}
		const previous = session.project.id;
		session.startEmpty();
		expect(session.library.some((project) => project.id === previous)).toBe(true);
		expect(session.library.length).toBeGreaterThan(30);
		expect(session.project.tracks.every((track) => track.notes.length === 0)).toBe(true);
	});

	it('loads valid linked examples once per query change and preserves each working draft', () => {
		const original = session.project.id;
		session.edit((project) => {
			project.title = 'My first draft';
		});
		session.openLinkedExample('night-drive');
		expect(session.project.exampleId).toBe('night-drive');
		expect(session.library.find((project) => project.id === original)?.title).toBe(
			'My first draft'
		);
		session.edit((project) => {
			project.title = 'My night sketch';
		});
		const night = session.project.id;
		session.openLinkedExample('night-drive');
		expect(session.project.title).toBe('My night sketch');
		session.openLinkedExample('sunlit-pop');
		expect(session.project.exampleId).toBe('sunlit-pop');
		expect(session.library.find((project) => project.id === night)?.title).toBe('My night sketch');
		const sunlit = session.project.id;
		session.openLinkedExample('unknown-example');
		expect(session.project.id).toBe(sunlit);
	});

	it('preserves a restored draft on its matching deep link and saves it before a new query switch', () => {
		session.loadExample('night-drive');
		session.edit((project) => {
			project.title = 'Midnight postcards';
			project.tracks[0].notes[0].velocity = 41;
		});
		const draft = session.project.id;
		session.destroy();
		session = new StudioSession();
		session.attach();
		session.openLinkedExample('night-drive');
		expect(session.project.id).toBe(draft);
		expect(session.project.title).toBe('Midnight postcards');
		expect(session.project.tracks[0].notes[0].velocity).toBe(41);
		session.openLinkedExample('sunlit-pop');
		expect(session.project.exampleId).toBe('sunlit-pop');
		expect(session.library.find((project) => project.id === draft)?.title).toBe(
			'Midnight postcards'
		);
	});
});
