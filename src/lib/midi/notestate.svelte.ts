/**
 * Live per-channel state, observed from the bus.
 *
 * Which notes are sounding, where the bend is, what each controller was last
 * set to. Widgets read this instead of tracking their own copies, so a knob on
 * screen follows a knob on your hardware without either knowing about the other.
 */

import { browser } from '$app/environment';
import { bus, type MidiEvent } from './bus';

export interface ChannelSnapshot {
	/** note number → velocity, for notes currently held. */
	notes: Map<number, number>;
	cc: Map<number, number>;
	bend: number;
	pressure: number;
	program: number;
	lastActivity: number;
}

function blank(): ChannelSnapshot {
	return { notes: new Map(), cc: new Map(), bend: 8192, pressure: 0, program: 0, lastActivity: 0 };
}

export class NoteState {
	/** Bumped whenever anything changes, so `$derived` reads stay live. */
	version = $state(0);

	#channels: ChannelSnapshot[] = Array.from({ length: 16 }, blank);
	#unsub: (() => void) | null = null;
	#visibility: (() => void) | null = null;
	#dirty = false;
	#frame = 0;

	start(): () => void {
		if (this.#unsub) return () => this.stop();
		this.#unsub = bus.subscribe((e) => this.#ingest(e));
		const tick = () => {
			this.#frame = requestAnimationFrame(tick);
			if (this.#dirty) {
				this.#dirty = false;
				this.version++;
			}
		};
		this.#frame = requestAnimationFrame(tick);
		// A hidden tab pauses animation frames, which breaks this recursive
		// chain. Restart it and flush on the way back, or held notes stay drawn
		// as held after you return.
		this.#visibility = () => {
			if (document.hidden) return;
			this.#dirty = true;
			if (!this.#frame) this.#frame = requestAnimationFrame(tick);
		};
		document.addEventListener('visibilitychange', this.#visibility);
		return () => this.stop();
	}

	stop(): void {
		this.#unsub?.();
		this.#unsub = null;
		cancelAnimationFrame(this.#frame);
		this.#frame = 0;
		if (this.#visibility) {
			document.removeEventListener('visibilitychange', this.#visibility);
			this.#visibility = null;
		}
	}

	#ingest(e: MidiEvent) {
		const m = e.message;
		if (!('channel' in m)) return;
		const s = this.#channels[m.channel];
		switch (m.type) {
			case 'noteOn':
				s.notes.set(m.note, m.velocity);
				break;
			case 'noteOff':
				s.notes.delete(m.note);
				break;
			case 'controlChange':
				s.cc.set(m.controller, m.value);
				// All Notes Off / All Sound Off clear the held set too.
				if (m.controller === 120 || m.controller === 123) s.notes.clear();
				break;
			case 'pitchBend':
				s.bend = m.value;
				break;
			case 'channelAftertouch':
				s.pressure = m.pressure;
				break;
			case 'programChange':
				s.program = m.program;
				break;
			default:
				return;
		}
		s.lastActivity = e.time;
		this.#dirty = true;
	}

	channel(index: number): ChannelSnapshot {
		void this.version;
		return this.#channels[index & 0x0f];
	}

	/** Is this note sounding on the given channel, or on any channel? */
	isHeld(note: number, channel?: number): boolean {
		void this.version;
		if (channel !== undefined) return this.#channels[channel].notes.has(note);
		return this.#channels.some((c) => c.notes.has(note));
	}

	velocityOf(note: number, channel?: number): number {
		void this.version;
		if (channel !== undefined) return this.#channels[channel].notes.get(note) ?? 0;
		for (const c of this.#channels) {
			const v = c.notes.get(note);
			if (v !== undefined) return v;
		}
		return 0;
	}

	/** Which channel is sounding this note, for colour-coding. */
	channelOf(note: number): number | null {
		void this.version;
		for (let i = 0; i < 16; i++) if (this.#channels[i].notes.has(note)) return i;
		return null;
	}

	cc(channel: number, controller: number, fallback = 0): number {
		void this.version;
		return this.#channels[channel].cc.get(controller) ?? fallback;
	}

	get heldCount(): number {
		void this.version;
		return this.#channels.reduce((a, c) => a + c.notes.size, 0);
	}

	clear(): void {
		for (const c of this.#channels) {
			c.notes.clear();
		}
		this.version++;
	}
}

export const noteState = new NoteState();

// Started at module load, deliberately: lesson checkpoints subscribe to the bus
// when they mount, and they need this snapshot to already be up to date by the
// time their predicate runs on the very event that triggered it.
if (browser) noteState.start();
