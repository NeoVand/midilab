/**
 * The application's MIDI engine — the thing the Engine Dock is a window onto.
 *
 * It owns the output list (real hardware ports plus the app's own internal
 * synth), the send path, and the decision about what happens to incoming
 * messages. Every lesson, widget and tool goes through here, which is why a
 * checkpoint can reliably observe anything you do.
 */

import { browser } from '$app/environment';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { bus, type MidiEvent, type MidiOrigin } from './bus';
import { midiAccess } from './access.svelte';
import { encode, parse, type MidiMessage } from './messages';
import { synth } from '$lib/audio/synth';
import { gm } from '$lib/audio/gm.svelte';
import { audio } from '$lib/audio/engine';
import { transport } from './clock.svelte';

export const INTERNAL_OUTPUT_ID = 'internal:synth';

/**
 * The app's own controls, as an input port.
 *
 * In a hardware rig your controller is an input; here the on-screen keyboard,
 * the pads, the sequencer and your own code are the controller. Naming that as
 * a port is not a fudge — it is what it is, and it means the patchbay is a
 * working instrument on a laptop with nothing plugged into it, which is what
 * the rest of the course promises.
 */
/**
 * The engine behind the internal output.
 *
 * Two, and only one of them at a time: the sampled General MIDI instruments,
 * which sound like the instruments they are named after, and the built-in
 * synth, which can be modulated while a note is sounding. Neither is a
 * replacement for the other, and the lessons on expression say so.
 */
function internalVoice() {
	return gm.enabled ? gm : synth;
}

export const VIRTUAL_INPUT_ID = 'app:controls';
export const VIRTUAL_INPUT_NAME = 'MIDI Lab controls';

export interface OutputTarget {
	id: string;
	name: string;
	/**
	 * Second line in the device list. Inputs have always shown the
	 * manufacturer under the port name; outputs are the same three devices and
	 * were showing one line, which put the two columns out of step by the third
	 * row. They carry it too now.
	 */
	subtitle: string;
	kind: 'internal' | 'hardware';
	connected: boolean;
}

export class MidiEngine {
	/** Output ports that `send()` fans out to. The internal synth is on by default. */
	activeOutputs = $state<string[]>([INTERNAL_OUTPUT_ID]);
	/** Play incoming hardware MIDI through the internal synth. */
	auditionInput = $state(true);
	/** Wire value 0–15 that the app treats as percussion. */
	drumChannel = $state(9);
	octaveConvention = $state<'c3' | 'c4'>('c3');
	/** The channel that widgets transmit on unless told otherwise. */
	channel = $state(0);

	voiceCount = $state(0);
	audioReady = $state(false);

	#started = false;
	#unsub: (() => void) | null = null;
	#meterTimer = 0;
	#localListeners = new SvelteSet<
		(msg: MidiMessage, at?: number, audioTime?: number, origin?: MidiOrigin) => void
	>();
	#inputAuditionInterceptors = new SvelteSet<(event: MidiEvent) => boolean>();
	#inputNotes = new SvelteMap<string, SvelteMap<string, { channel: number; note: number }>>();
	#browserVoiceCounts = new SvelteSet<() => number>();

	get outputs(): OutputTarget[] {
		const internal: OutputTarget = {
			id: INTERNAL_OUTPUT_ID,
			name: 'MIDI Lab Synth',
			subtitle: 'Built into this page',
			kind: 'internal',
			connected: true
		};
		return [
			internal,
			...midiAccess.outputs.map((p) => ({
				id: p.id,
				name: p.name,
				subtitle: p.manufacturer,
				kind: 'hardware' as const,
				connected: p.state === 'connected'
			}))
		];
	}

	start(): void {
		if (this.#started || !browser) return;
		this.#started = true;
		this.#unsub = bus.subscribe((e) => this.#onEvent(e));
		transport.bindOutput((bytes, at) => this.sendBytes(bytes, at));
		transport.watchExternal();
		this.#meterTimer = window.setInterval(() => {
			this.voiceCount =
				synth.voiceCount +
				gm.voiceCount +
				[...this.#browserVoiceCounts].reduce((total, count) => total + count(), 0);
			this.audioReady = audio.ready;
		}, 200);
	}

	stop(): void {
		this.#unsub?.();
		this.#unsub = null;
		clearInterval(this.#meterTimer);
		this.#started = false;
	}

	#onEvent(e: MidiEvent) {
		if (e.direction !== 'in') return;
		const message = e.message;
		if (message.type === 'noteOff' || (message.type === 'noteOn' && !message.velocity)) {
			this.#inputNotes.get(e.portId)?.delete(`${message.channel}:${message.note}`);
		}
		for (const intercept of this.#inputAuditionInterceptors) {
			try {
				if (intercept(e)) return;
			} catch (err) {
				console.error('[engine] input audition interceptor threw', err);
			}
		}
		if (this.auditionInput) {
			this.handleInternal(message);
			if (message.type === 'noteOn' && message.velocity > 0) {
				let notes = this.#inputNotes.get(e.portId);
				if (!notes) {
					notes = new SvelteMap();
					this.#inputNotes.set(e.portId, notes);
				}
				notes.set(`${message.channel}:${message.note}`, {
					channel: message.channel,
					note: message.note
				});
			}
		}
	}

	/** Release only this source's earlier GM notes when a browser monitor takes over. */
	releaseInputAudition(portId: string, channels: readonly number[]): void {
		const notes = this.#inputNotes.get(portId);
		if (!notes) return;
		for (const [id, note] of notes) {
			if (channels.includes(note.channel)) {
				this.handleInternal({
					type: 'noteOff',
					channel: note.channel,
					note: note.note,
					velocity: 0
				});
				notes.delete(id);
			}
		}
		if (!notes.size) this.#inputNotes.delete(portId);
	}

	/** Dedicated browser voices share the dock's meter without becoming MIDI outputs. */
	registerBrowserVoiceCount(count: () => number): () => void {
		this.#browserVoiceCounts.add(count);
		return () => this.#browserVoiceCounts.delete(count);
	}

	/**
	 * Let an explicitly enabled browser monitor replace the regular input voice.
	 * Returning true consumes only this audition; the original bus event and
	 * any user-created hardware routes retain their channels and destinations.
	 */
	interceptInputAudition(intercept: (event: MidiEvent) => boolean): () => void {
		this.#inputAuditionInterceptors.add(intercept);
		return () => this.#inputAuditionInterceptors.delete(intercept);
	}

	isOutputActive(id: string): boolean {
		return this.activeOutputs.includes(id);
	}

	toggleOutput(id: string): void {
		this.activeOutputs = this.activeOutputs.includes(id)
			? this.activeOutputs.filter((x) => x !== id)
			: [...this.activeOutputs, id];
	}

	/** Bring the audio context up. Must be called from a user gesture. */
	async wake(): Promise<void> {
		await synth.ensureStarted();
		this.audioReady = audio.ready;
	}

	/**
	 * Send a message to every active output and publish it on the bus.
	 *
	 * `at` is a `performance.now()`-domain timestamp. Passing one lets the
	 * browser's MIDI implementation deliver the bytes at that instant rather than
	 * whenever the JavaScript thread next gets a turn — the difference between
	 * a tight sequencer and a sloppy one. See Latency, jitter, and the lookahead scheduler.
	 */
	/**
	 * Called once per locally originated message, whatever it is sent to.
	 *
	 * The bus carries one event per active output, which is right for a monitor
	 * and wrong for anything that wants the *message* rather than its copies —
	 * the patchbay would route a single note once per open port. This is that
	 * single tap.
	 */
	onLocalSend(
		fn: (msg: MidiMessage, at?: number, audioTime?: number, origin?: MidiOrigin) => void
	): () => void {
		this.#localListeners.add(fn);
		return () => this.#localListeners.delete(fn);
	}

	send(msg: MidiMessage, at?: number, audioTime?: number, origin: MidiOrigin = 'performer'): void {
		for (const fn of this.#localListeners) {
			try {
				fn(msg, at, audioTime, origin);
			} catch (err) {
				console.error('[engine] local send listener threw', err);
			}
		}
		const bytes = encode(msg);
		for (const id of this.activeOutputs) {
			if (id === INTERNAL_OUTPUT_ID) {
				this.handleInternal(msg, audioTime);
			} else {
				midiAccess.sendRaw(id, bytes, at);
			}
			bus.emit({
				time: at ?? performance.now(),
				portId: id,
				portName: id === INTERNAL_OUTPUT_ID ? 'Internal Synth' : midiAccess.outputName(id),
				direction: 'out',
				bytes,
				message: msg,
				origin
			});
		}
	}

	/**
	 * A browser-only lesson surface. It stays visible to the monitor and lesson
	 * verifier without being broadcast to hardware or the virtual-input router.
	 * A dedicated audio monitor may supply the sound by passing audition=false.
	 */
	sendInternal(msg: MidiMessage, origin: MidiOrigin = 'performer', audition = true): void {
		if (audition) this.handleInternal(msg);
		bus.emit({
			time: performance.now(),
			portId: INTERNAL_OUTPUT_ID,
			portName: 'Browser lesson',
			direction: 'out',
			bytes: encode(msg),
			message: msg,
			origin
		});
	}

	/** The selected internal sound engine, shared by direct and routed performance. */
	handleInternal(msg: MidiMessage, audioTime?: number): void {
		internalVoice().handle(msg, audioTime);
	}

	/**
	 * Put raw bytes on every active *hardware* output and publish them.
	 *
	 * Used for clock and transport bytes, which the internal synth has no use
	 * for but which still belong in the monitor.
	 */
	sendBytes(bytes: number[], at?: number): void {
		const msg = parse(bytes);
		for (const id of this.activeOutputs) {
			if (id === INTERNAL_OUTPUT_ID) continue;
			midiAccess.sendRaw(id, bytes, at);
		}
		bus.emit({
			time: at ?? performance.now(),
			portId: 'engine',
			portName: 'Transport',
			direction: 'out',
			bytes,
			message: msg
		});
	}

	/** Send several messages as one logical burst, in order. */
	sendAll(messages: MidiMessage[], at?: number): void {
		for (const m of messages) this.send(m, at);
	}

	noteOn(
		note: number,
		velocity = 100,
		channel = this.channel,
		origin: MidiOrigin = 'performer'
	): void {
		void this.wake();
		this.send({ type: 'noteOn', channel, note, velocity }, undefined, undefined, origin);
	}

	noteOff(
		note: number,
		channel = this.channel,
		velocity = 0,
		origin: MidiOrigin = 'performer'
	): void {
		this.send({ type: 'noteOff', channel, note, velocity }, undefined, undefined, origin);
	}

	cc(controller: number, value: number, channel = this.channel): void {
		this.send({ type: 'controlChange', channel, controller, value });
	}

	programChange(program: number, channel = this.channel): void {
		this.send({ type: 'programChange', channel, program });
	}

	/** Bank Select MSB + LSB followed by the Program Change, in the required order. */
	selectProgram(bankMsb: number, bankLsb: number, program: number, channel = this.channel): void {
		this.sendAll([
			{ type: 'controlChange', channel, controller: 0, value: bankMsb },
			{ type: 'controlChange', channel, controller: 32, value: bankLsb },
			{ type: 'programChange', channel, program }
		]);
	}

	pitchBend(value: number, channel = this.channel): void {
		this.send({ type: 'pitchBend', channel, value });
	}

	/**
	 * The three-stage panic every MIDI tool needs on day one.
	 *
	 * All Notes Off is the polite request; All Sound Off is the blunt one; and
	 * some older devices honour neither, so a sweep of explicit Note Offs across
	 * all 128 notes on all 16 channels is the belt-and-braces final pass.
	 */
	panic(thorough = false): void {
		for (let ch = 0; ch < 16; ch++) {
			this.send({ type: 'controlChange', channel: ch, controller: 64, value: 0 });
			this.send({ type: 'controlChange', channel: ch, controller: 123, value: 0 });
			this.send({ type: 'controlChange', channel: ch, controller: 120, value: 0 });
			this.send({ type: 'controlChange', channel: ch, controller: 121, value: 0 });
		}
		if (thorough) {
			for (let ch = 0; ch < 16; ch++) {
				for (let n = 0; n < 128; n++) {
					this.send({ type: 'noteOff', channel: ch, note: n, velocity: 0 });
				}
			}
		}
		gm.allOff();
		this.#inputNotes.clear();
		// Browser-only lesson voices still exist when every output is unchecked.
		// This local reset reaches their schedulers without sending System Reset
		// to hardware, and gives pending audio wakes an unconditional cancellation.
		this.handleInternal({ type: 'reset' });
		bus.emit({
			time: performance.now(),
			portId: 'engine',
			portName: 'Engine Panic',
			direction: 'out',
			bytes: [],
			message: { type: 'reset' }
		});
	}
}

export const engine = new MidiEngine();
