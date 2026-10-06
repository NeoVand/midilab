/**
 * One event bus for every byte that enters or leaves the application.
 *
 * The monitor, the byte inspector, the routing graph's packet animation, the
 * lesson checkpoint verifier, the synth and the recorder are all just
 * subscribers. Nothing in the app is allowed a private side channel — if a
 * message happened, it appeared here first. That invariant is what lets a
 * lesson say "play a C above middle C" and actually know when you did.
 */

import type { MidiMessage } from './messages';

export type Direction = 'in' | 'out';

/** Why a message was sent. Demonstrations must never count as learner playing. */
export type MidiOrigin = 'performer' | 'demo' | 'sequence';

export interface MidiEvent {
	/** Monotonically increasing, unique for the session. */
	id: number;
	/** `performance.now()` milliseconds — the same clock Web MIDI timestamps use. */
	time: number;
	portId: string;
	portName: string;
	direction: Direction;
	/** Incoming hardware and older producers without a tag are performer input. */
	origin?: MidiOrigin;
	bytes: number[];
	message: MidiMessage;
}

export type MidiListener = (event: MidiEvent) => void;

let nextId = 1;

export class MidiBus {
	#listeners = new Set<MidiListener>();

	subscribe(listener: MidiListener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	emit(event: Omit<MidiEvent, 'id'>): MidiEvent {
		const full: MidiEvent = { ...event, origin: event.origin ?? 'performer', id: nextId++ };
		for (const listener of this.#listeners) {
			try {
				listener(full);
			} catch (err) {
				// A broken subscriber must never stop the stream.
				console.error('[midi bus] listener threw', err);
			}
		}
		return full;
	}

	get listenerCount(): number {
		return this.#listeners.size;
	}
}

export const bus = new MidiBus();
