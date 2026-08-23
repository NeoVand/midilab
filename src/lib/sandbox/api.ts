/**
 * The API handed to code you write in the console.
 *
 * Two design decisions worth stating. First, everything the script starts —
 * timers, intervals, bus subscriptions, held notes — is tracked, so Stop really
 * stops and a runaway loop cannot outlive the page you left. Second, the raw
 * layer is not hidden: `midi.raw` gives you the actual Web MIDI ports and
 * `midi.send([0x90, 60, 100])` takes literal bytes, because the point of Act VI
 * is that you can now read those bytes.
 */

import { engine } from '$lib/midi/engine.svelte';
import { midiAccess } from '$lib/midi/access.svelte';
import { audio } from '$lib/audio/engine';
import { bus, type MidiEvent } from '$lib/midi/bus';
import { audioToPerf, transport } from '$lib/midi/clock.svelte';
import { parse, type MidiMessage } from '$lib/midi/messages';
import { noteToFrequency, noteName, parseNoteName } from '$lib/midi/notes';

export interface SandboxLog {
	level: 'log' | 'warn' | 'error';
	text: string;
	at: number;
}

export class SandboxSession {
	logs: SandboxLog[] = [];
	onLog?: (log: SandboxLog) => void;

	#timers = new Set<number>();
	#intervals = new Set<number>();
	#unsubs: Array<() => void> = [];
	#held = new Set<string>();
	#stopped = false;

	log(level: SandboxLog['level'], ...args: unknown[]): void {
		const text = args
			.map((a) => {
				if (typeof a === 'string') return a;
				try {
					return JSON.stringify(a, null, 1);
				} catch {
					return String(a);
				}
			})
			.join(' ');
		const entry: SandboxLog = { level, text, at: performance.now() };
		this.logs.push(entry);
		this.onLog?.(entry);
	}

	get stopped(): boolean {
		return this.#stopped;
	}

	/** Cancel everything this session started, and release anything it is holding. */
	dispose(): void {
		this.#stopped = true;
		for (const t of this.#timers) clearTimeout(t);
		for (const i of this.#intervals) clearInterval(i);
		this.#timers.clear();
		this.#intervals.clear();
		for (const u of this.#unsubs) u();
		this.#unsubs = [];
		for (const key of this.#held) {
			const [ch, n] = key.split(':').map(Number);
			engine.send({ type: 'noteOff', channel: ch, note: n, velocity: 0 });
		}
		this.#held.clear();
	}

	build(): Record<string, unknown> {
		// Aliased because the API object below uses shorthand methods, which get
		// their own `this`.
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const session = this;

		const setTimeoutTracked = (fn: () => void, ms: number): number => {
			const id = window.setTimeout(() => {
				session.#timers.delete(id);
				if (!session.#stopped) fn();
			}, ms);
			session.#timers.add(id);
			return id;
		};

		const setIntervalTracked = (fn: () => void, ms: number): number => {
			const id = window.setInterval(() => {
				if (session.#stopped) return clearInterval(id);
				fn();
			}, ms);
			session.#intervals.add(id);
			return id;
		};

		const midi = {
			/** Every output the engine will fan out to, plus the internal synth. */
			get outputs() {
				return engine.outputs.map((o) => ({ id: o.id, name: o.name, kind: o.kind }));
			},
			get inputs() {
				return midiAccess.inputs.map((i) => ({
					id: i.id,
					name: i.name,
					listening: midiAccess.isListening(i.id)
				}));
			},
			/** The real MIDIAccess object, if you want to do it the hard way. */
			get raw() {
				return midiAccess.access;
			},

			/** Send raw bytes or a decoded message. Optionally at a future time. */
			send(what: number[] | MidiMessage, at?: number) {
				if (session.#stopped) return;
				const msg = Array.isArray(what) ? parse(what) : what;
				engine.send(msg, at);
			},

			/** Play a note and release it after `duration` milliseconds. */
			note(note: number | string, velocity = 100, duration = 300, channel = 0) {
				if (session.#stopped) return;
				const n = typeof note === 'string' ? (parseNoteName(note) ?? 60) : note;
				engine.send({ type: 'noteOn', channel, note: n, velocity });
				session.#held.add(`${channel}:${n}`);
				setTimeoutTracked(() => {
					engine.send({ type: 'noteOff', channel, note: n, velocity: 0 });
					session.#held.delete(`${channel}:${n}`);
				}, duration);
			},

			cc(controller: number, value: number, channel = 0) {
				if (!session.#stopped) engine.send({ type: 'controlChange', channel, controller, value });
			},
			program(program: number, channel = 0) {
				if (!session.#stopped) engine.send({ type: 'programChange', channel, program });
			},
			bend(value: number, channel = 0) {
				if (!session.#stopped) engine.send({ type: 'pitchBend', channel, value });
			},
			panic() {
				engine.panic();
			},

			/** Subscribe to everything on the bus. Returns an unsubscribe function. */
			onMessage(fn: (event: MidiEvent) => void) {
				const off = bus.subscribe((e) => {
					if (!session.#stopped) fn(e);
				});
				session.#unsubs.push(off);
				return off;
			},
			/** Subscribe to incoming Note On messages only — the common case. */
			onNote(fn: (note: number, velocity: number, channel: number) => void) {
				return midi.onMessage((e) => {
					if (e.direction === 'in' && e.message.type === 'noteOn') {
						fn(e.message.note, e.message.velocity, e.message.channel);
					}
				});
			},

			/** Clocks. `now` is the audio clock; `perf` is the page clock. */
			now: () => audio.now,
			perf: () => performance.now(),
			toPerf: audioToPerf,

			transport: {
				start: () => transport.start(),
				stop: () => transport.stop(),
				get bpm() {
					return transport.bpm;
				},
				set bpm(v: number) {
					transport.bpm = v;
				},
				get playing() {
					return transport.playing;
				},
				onTick(fn: (tick: { tick: number; audioTime: number; perfTime: number }) => void) {
					const off = transport.onTick((t) => {
						if (!session.#stopped) fn(t);
					});
					session.#unsubs.push(off);
					return off;
				}
			},

			// Small conveniences that would otherwise be re-typed constantly.
			freq: noteToFrequency,
			name: (n: number) => noteName(n),
			parse: parseNoteName
		};

		return {
			midi,
			audio: {
				get context() {
					return audio.context;
				},
				get now() {
					return audio.now;
				},
				resume: () => audio.resume()
			},
			log: (...a: unknown[]) => session.log('log', ...a),
			console: {
				log: (...a: unknown[]) => session.log('log', ...a),
				warn: (...a: unknown[]) => session.log('warn', ...a),
				error: (...a: unknown[]) => session.log('error', ...a),
				info: (...a: unknown[]) => session.log('log', ...a)
			},
			sleep: (ms: number) =>
				new Promise<void>((resolve) => {
					if (session.#stopped) return resolve();
					setTimeoutTracked(() => resolve(), ms);
				}),
			setTimeout: setTimeoutTracked,
			setInterval: setIntervalTracked,
			clearTimeout: (id: number) => {
				clearTimeout(id);
				session.#timers.delete(id);
			},
			clearInterval: (id: number) => {
				clearInterval(id);
				session.#intervals.delete(id);
			}
		};
	}
}

/** Run a snippet with the sandbox API in scope. Returns the session. */
export async function run(code: string, onLog?: (l: SandboxLog) => void): Promise<SandboxSession> {
	const session = new SandboxSession();
	session.onLog = onLog;
	await audio.resume();
	const api = session.build();
	const names = Object.keys(api);
	const values = names.map((n) => api[n]);
	try {
		const fn = new Function(...names, `"use strict";\nreturn (async () => {\n${code}\n})();`);
		await fn(...values);
	} catch (err) {
		session.log('error', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
	}
	return session;
}
