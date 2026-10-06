import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { engine } from '$lib/midi/engine.svelte';
import { transport, PPQ, type TickEvent } from '$lib/midi/clock.svelte';
import { bus } from '$lib/midi/bus';
import { audio } from '$lib/audio/engine';
import { metronome } from '$lib/audio/metronome.svelte';
import { createProject, emptyProject, STUDIO_EXAMPLES } from './examples';
import {
	cloneProject,
	makeNote,
	normalizeNote,
	parseProject,
	projectEvents,
	quantizeNotes,
	serializeProject,
	type StudioProject,
	type StudioNote,
	type TrackId
} from './model';
import { TakeRecorder } from './recorder';

const AUTOSAVE = 'midilab:studio:autosave:v1';
const LIBRARY = 'midilab:studio:projects:v1';

/** A single studio owns playback only while its page is mounted. */
export class StudioSession {
	project = $state<StudioProject>(createProject());
	selectedTrack = $state<TrackId>('drums');
	selectedBar = $state(0);
	selectedNote = $state<string | null>(null);
	library = $state<StudioProject[]>([]);
	position = $state(0);
	playing = $state(false);
	recording = $state(false);
	counting = $state(0);
	loop = $state(true);
	countIn = $state(true);
	replaceTake = $state(false);
	grid = $state(0.25);
	strength = $state(1);
	latencyMs = $state(0);
	solo = $state<TrackId | null>(null);
	status = $state('Ready when you are. Press play to hear all four parts.');
	storageError = $state('');
	history = $state<StudioProject[]>([]);
	future = $state<StudioProject[]>([]);

	#recorder: TakeRecorder | null = null;
	#takeTrack: TrackId = 'drums';
	#recordEnd = 0;
	#offset = 0;
	#recordPending = $state(false);
	#handlingHardware = false;
	#playVersion = 0;
	#stopTimer = 0;
	#linkedExample: string | null = null;
	#linkedQuerySeen = false;
	#finishTimer = 0;
	#silenceTimer = 0;
	#frame = 0;
	#anchor: TickEvent | null = null;
	#events: ReturnType<typeof projectEvents> = [];
	#activeNotes = new SvelteMap<string, { channel: number; note: number }>();
	#unsubscribe: (() => void)[] = [];
	#previous: {
		bpm: number;
		beats: number;
		loop: number;
		source: typeof transport.source;
		audition: boolean;
	} | null = null;

	get track() {
		return this.project.tracks.find((track) => track.id === this.selectedTrack)!;
	}
	get note() {
		return this.track.notes.find((note) => note.id === this.selectedNote) ?? null;
	}
	get canUndo() {
		return this.history.length > 0;
	}
	get canRedo() {
		return this.future.length > 0;
	}
	get armed() {
		return this.recording || this.#recordPending;
	}

	attach(): () => void {
		this.#previous = {
			bpm: transport.bpm,
			beats: transport.beatsPerBar,
			loop: transport.loopBars,
			source: transport.source,
			audition: engine.auditionInput
		};
		transport.stop();
		engine.auditionInput = false;
		try {
			const stored = localStorage.getItem(AUTOSAVE);
			if (stored) this.project = parseProject(stored);
			const projects = JSON.parse(localStorage.getItem(LIBRARY) ?? '[]');
			if (Array.isArray(projects))
				this.library = projects.map((p) => parseProject(JSON.stringify(p)));
		} catch {
			this.storageError = 'A saved project could not be read. Import a backup to restore it.';
		}
		this.#prepare();
		this.#unsubscribe.push(transport.onTick((tick) => this.#tick(tick)));
		this.#unsubscribe.push(
			engine.onLocalSend((message, at, _audioTime, origin) => {
				if (
					this.#handlingHardware ||
					origin !== 'performer' ||
					!this.#recorder ||
					!('channel' in message) ||
					message.channel !== this.track.channel
				)
					return;
				this.#recorder.handle(message, at ?? performance.now(), 'local');
			})
		);
		this.#unsubscribe.push(
			bus.subscribe((event) => {
				if (event.direction !== 'in' || !('channel' in event.message)) return;
				if (
					![
						'noteOn',
						'noteOff',
						'controlChange',
						'pitchBend',
						'channelPressure',
						'polyPressure'
					].includes(event.message.type)
				)
					return;
				const message = { ...event.message, channel: this.track.channel };
				this.#recorder?.handle(message, event.time, event.portId);
				this.#handlingHardware = true;
				try {
					engine.send(message, undefined, undefined, 'performer');
				} finally {
					this.#handlingHardware = false;
				}
			})
		);
		const frame = () => {
			if (this.armed && transport.bpm !== this.project.bpm) transport.bpm = this.project.bpm;
			if (!this.armed && transport.playing && transport.bpm !== this.project.bpm) {
				this.project.bpm = transport.bpm;
				this.project.updatedAt = Date.now();
				this.autosave();
			}
			if (!transport.playing && this.playing) this.#endPlayback();
			if (transport.playing && this.#anchor) {
				const tick =
					this.#anchor.tick +
					(performance.now() - this.#anchor.perfTime) / (60000 / transport.bpm / PPQ);
				const beat = tick / PPQ - this.#offset;
				this.counting = beat < 0 ? Math.max(1, Math.ceil(-beat)) : 0;
				this.position = beat < 0 ? 0 : ((beat % 32) + 32) % 32;
			}
			this.#frame = requestAnimationFrame(frame);
		};
		this.#frame = requestAnimationFrame(frame);
		return () => this.destroy();
	}

	#prepare() {
		transport.bpm = this.project.bpm;
		transport.beatsPerBar = 4;
		transport.loopBars = 0;
		transport.source = 'internal';
		this.#events = projectEvents(this.project, PPQ);
		for (const track of this.project.tracks)
			engine.send(
				{ type: 'programChange', channel: track.channel, program: track.program },
				undefined,
				undefined,
				'sequence'
			);
	}

	async play(record = false) {
		this.stop();
		const version = ++this.#playVersion;
		await engine.wake();
		if (version !== this.#playVersion) return;
		clearTimeout(this.#silenceTimer);
		this.#silenceTimer = 0;
		this.#prepare();
		this.#offset = record && this.countIn ? 4 : 0;
		this.#recordPending = record;
		this.#takeTrack = this.selectedTrack;
		this.#recordEnd = 0;
		this.counting = this.#offset;
		this.position = 0;
		this.playing = true;
		this.status = record
			? `Get ready to record ${this.track.name.toLowerCase()}.`
			: 'Listen for the change in the second half.';
		await transport.start(true);
	}

	#tick(tick: TickEvent) {
		this.#anchor = tick;
		this.playing = true;
		const localTick = tick.tick - this.#offset * PPQ;
		if (localTick < 0) {
			if (!metronome.enabled && tick.tick % PPQ === 0) this.#click(tick.audioTime, tick.tick === 0);
			return;
		}
		if (this.#recordPending && localTick === 0) {
			this.#recordPending = false;
			this.#recordEnd = tick.perfTime + (32 * 60000) / this.project.bpm;
			this.#recorder = new TakeRecorder({
				bpm: this.project.bpm,
				lengthBeats: 32,
				grid: this.grid,
				latencyMs: this.latencyMs
			});
			this.#recorder.start(tick.perfTime);
			this.recording = true;
			this.status = `Recording ${this.track.name.toLowerCase()}. Play with the other parts.`;
			this.#finishTimer = window.setTimeout(
				() => this.finishTake(),
				Math.max(0, this.#recordEnd - performance.now())
			);
		}
		const length = 32 * PPQ;
		const position = localTick % length;
		if (position === 0 && localTick > 0) {
			for (const event of this.#events.filter((event) => event.tick === length))
				this.#send(event.message, tick);
			if (!this.loop) {
				this.#stopTimer = window.setTimeout(
					() => this.stop(),
					Math.max(0, tick.perfTime - performance.now())
				);
				return;
			}
		}
		if (!this.loop && localTick >= length) return;
		for (const event of this.#events) if (event.tick === position) this.#send(event.message, tick);
	}

	#send(message: Parameters<typeof engine.send>[0], tick: TickEvent) {
		if (!('channel' in message)) return;
		const track = this.project.tracks.find((track) => track.channel === message.channel);
		if (
			!track ||
			(message.type === 'noteOn' &&
				(track.muted ||
					(this.solo && this.solo !== track.id) ||
					(this.replaceTake && this.armed && track.id === this.#takeTrack)))
		)
			return;
		engine.send(message, tick.perfTime, tick.audioTime, 'sequence');
		if (message.type === 'noteOn')
			this.#activeNotes.set(`${message.channel}:${message.note}`, {
				channel: message.channel,
				note: message.note
			});
		if (message.type === 'noteOff') this.#activeNotes.delete(`${message.channel}:${message.note}`);
	}

	#click(at: number, accent: boolean) {
		const context = audio.context;
		if (!context || !audio.destination) return;
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.frequency.setValueAtTime(accent ? 1400 : 1000, at);
		gain.gain.setValueAtTime(0.12, at);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
		oscillator.connect(gain).connect(audio.destination);
		oscillator.start(at);
		oscillator.stop(at + 0.05);
		oscillator.onended = () => {
			oscillator.disconnect();
			gain.disconnect();
		};
	}

	finishTake() {
		clearTimeout(this.#finishTimer);
		this.#finishTimer = 0;
		if (!this.#recorder) {
			this.#recordPending = false;
			return;
		}
		const notes = this.#recorder.finish(Math.min(performance.now(), this.#recordEnd || Infinity));
		this.#recorder = null;
		this.recording = false;
		if (notes.length) {
			this.edit((project) => {
				const track = project.tracks.find((track) => track.id === this.#takeTrack)!;
				track.notes = this.replaceTake ? notes : [...track.notes, ...notes];
			});
			this.status = `${notes.length} notes recorded. Your take is saved; select a note to refine it.`;
		} else
			this.status =
				'No notes in this take. Try the keys, pads, or a MIDI controller, then record again.';
	}

	stop() {
		this.#playVersion++;
		clearTimeout(this.#stopTimer);
		this.#stopTimer = 0;
		transport.stop();
		this.#endPlayback();
	}

	#endPlayback() {
		this.finishTake();
		this.#recordPending = false;
		this.playing = false;
		this.counting = 0;
		this.#offset = 0;
		this.#anchor = null;
		this.#silence();
		clearTimeout(this.#silenceTimer);
		// The scheduler may already have placed a note in its 120 ms lookahead.
		this.#silenceTimer = window.setTimeout(() => this.#silence(), 150);
	}

	#silence() {
		for (const track of this.project.tracks) {
			engine.send(
				{ type: 'controlChange', channel: track.channel, controller: 64, value: 0 },
				undefined,
				undefined,
				'sequence'
			);
			engine.send(
				{ type: 'controlChange', channel: track.channel, controller: 123, value: 0 },
				undefined,
				undefined,
				'sequence'
			);
		}
		for (const note of this.#activeNotes.values())
			engine.send({ type: 'noteOff', ...note, velocity: 0 }, undefined, undefined, 'sequence');
		this.#activeNotes.clear();
	}

	selectTrack(id: TrackId) {
		if (this.armed) this.stop();
		this.selectedTrack = id;
		this.selectedNote = null;
	}

	edit(change: (project: StudioProject) => void, stopPlayback = true) {
		if (this.armed) {
			this.status = 'Keep or stop this take before editing the arrangement.';
			return;
		}
		if (this.playing && stopPlayback) this.stop();
		const previous = cloneProject($state.snapshot(this.project));
		const next = cloneProject(previous);
		change(next);
		next.updatedAt = Date.now();
		this.history = [...this.history.slice(-39), previous];
		this.future = [];
		this.project = next;
		this.#events = projectEvents(next, PPQ);
		this.autosave();
	}

	updateNote(id: string, changes: Partial<StudioNote>) {
		this.edit((project) => {
			const track = project.tracks.find((track) => track.id === this.selectedTrack)!;
			track.notes = track.notes.map((note) =>
				note.id === id ? normalizeNote({ ...note, ...changes }) : note
			);
		});
	}

	addNote(start = this.selectedBar * 4, pitch?: number) {
		if (this.armed) {
			this.status = 'Keep or stop this take before adding notes.';
			return;
		}
		const note = makeNote(
			pitch ?? (this.selectedTrack === 'drums' ? 36 : this.selectedTrack === 'bass' ? 36 : 60),
			start,
			this.selectedTrack === 'drums' ? 0.15 : 0.5
		);
		this.edit((project) =>
			project.tracks.find((track) => track.id === this.selectedTrack)!.notes.push(note)
		);
		this.selectedNote = note.id;
	}

	deleteNote() {
		this.edit((project) => {
			const track = project.tracks.find((track) => track.id === this.selectedTrack)!;
			track.notes = track.notes.filter((note) => note.id !== this.selectedNote);
		});
		this.selectedNote = null;
	}

	quantize() {
		this.edit((project) => {
			const track = project.tracks.find((track) => track.id === this.selectedTrack)!;
			track.notes = quantizeNotes(track.notes, this.grid, this.strength);
		});
		this.status = `Timing tightened for ${this.track.name.toLowerCase()}. Undo brings your original feel back.`;
	}

	setProgram(program: number) {
		this.edit((project) => {
			project.tracks.find((track) => track.id === this.selectedTrack)!.program = program;
		}, false);
	}

	setTempo(bpm: number) {
		if (this.armed) this.stop();
		const next = Math.max(40, Math.min(220, Math.round(bpm || 100)));
		this.edit((project) => {
			project.bpm = next;
		});
		transport.bpm = next;
	}

	toggleMute(id: TrackId) {
		this.edit((project) => {
			const track = project.tracks.find((track) => track.id === id)!;
			track.muted = !track.muted;
		}, false);
		const track = this.project.tracks.find((track) => track.id === id)!;
		if (track.muted)
			engine.send(
				{ type: 'controlChange', channel: track.channel, controller: 123, value: 0 },
				undefined,
				undefined,
				'sequence'
			);
	}

	toggleSolo(id: TrackId) {
		this.solo = this.solo === id ? null : id;
		if (this.solo)
			for (const track of this.project.tracks) {
				if (track.id !== this.solo)
					engine.send(
						{ type: 'controlChange', channel: track.channel, controller: 123, value: 0 },
						undefined,
						undefined,
						'sequence'
					);
			}
	}

	undo() {
		if (!this.canUndo) return;
		this.stop();
		this.future = [cloneProject($state.snapshot(this.project)), ...this.future];
		this.project = this.history[this.history.length - 1];
		this.history = this.history.slice(0, -1);
		this.#prepare();
		this.autosave();
	}

	redo() {
		if (!this.canRedo) return;
		this.stop();
		this.history = [...this.history, cloneProject($state.snapshot(this.project))];
		this.project = this.future[0];
		this.future = this.future.slice(1);
		this.#prepare();
		this.autosave();
	}

	loadProject(project: StudioProject) {
		this.stop();
		this.saveProject(false);
		this.project = cloneProject(project);
		this.history = [];
		this.future = [];
		this.selectedNote = null;
		this.selectedBar = 0;
		this.solo = null;
		this.#prepare();
		this.autosave();
		this.status = `Loaded ${project.title}. Make it yours.`;
	}

	loadExample(id: string) {
		this.loadProject(createProject(id));
	}

	openLinkedExample(id: string | null) {
		const initial = !this.#linkedQuerySeen;
		this.#linkedQuerySeen = true;
		if (id === this.#linkedExample) return;
		this.#linkedExample = id;
		if (!STUDIO_EXAMPLES.some((example) => example.id === id)) return;
		if (initial && this.project.exampleId === id) return;
		this.loadExample(id!);
	}

	startEmpty() {
		this.loadProject(emptyProject(this.project.exampleId));
		this.status = 'An empty eight-bar canvas. Add notes or record one part at a time.';
	}
	importProject(json: string) {
		this.loadProject(parseProject(json));
		this.saveProject();
	}

	autosave() {
		try {
			localStorage.setItem(AUTOSAVE, serializeProject($state.snapshot(this.project)));
			this.storageError = '';
		} catch {
			this.storageError =
				'Browser storage is full or unavailable. Download a backup to keep this project.';
		}
	}

	saveProject(announce = true) {
		const project = cloneProject($state.snapshot(this.project));
		this.library = [project, ...this.library.filter((saved) => saved.id !== project.id)];
		try {
			localStorage.setItem(LIBRARY, JSON.stringify($state.snapshot(this.library)));
			this.autosave();
			if (announce) this.status = `Saved ${project.title} in this browser.`;
		} catch {
			this.storageError = 'Project could not be saved here. Download a backup to keep your work.';
		}
	}

	destroy() {
		this.stop();
		clearTimeout(this.#silenceTimer);
		this.#silenceTimer = 0;
		cancelAnimationFrame(this.#frame);
		for (const unsubscribe of this.#unsubscribe) unsubscribe();
		this.#unsubscribe = [];
		if (this.#previous) {
			transport.bpm = this.#previous.bpm;
			transport.beatsPerBar = this.#previous.beats;
			transport.loopBars = this.#previous.loop;
			transport.source = this.#previous.source;
			engine.auditionInput = this.#previous.audition;
		}
		untrack(() => this.autosave());
	}
}
