/**
 * The message monitor: a ring buffer over the bus, with filters and live stats.
 *
 * Performance note that is also a lesson: a running MIDI clock is 24 messages
 * per quarter note — 48/second at 120 BPM, before a single note is played. Dense
 * CC automation can push that into the hundreds. So the buffer is a plain array
 * and reactivity is coalesced to one bump per animation frame; naively making
 * every incoming message a reactive array push will melt the UI, which is
 * exactly the "dense automation has a cost" point from Lesson 17.
 */

import { browser } from '$app/environment';
import { bus, type Direction, type MidiEvent } from './bus';
import { family, type MessageFamily } from './messages';

const CAPACITY = 4000;

export interface MonitorFilters {
	families: Set<MessageFamily>;
	directions: Set<Direction>;
	channels: Set<number>;
	ports: Set<string>;
	/** Clock, Active Sensing and friends drown everything else out by default. */
	hideRealTime: boolean;
	search: string;
}

const ALL_FAMILIES: MessageFamily[] = ['note', 'cc', 'expr', 'program', 'clock', 'sysex', 'common'];

export class MonitorStore {
	/** Bumped once per frame when new events have arrived. */
	version = $state(0);
	paused = $state(false);
	hideRealTime = $state(true);
	search = $state('');
	families = $state<MessageFamily[]>([...ALL_FAMILIES]);
	directions = $state<Direction[]>(['in', 'out']);
	/** Empty means "all channels". Values are 0-based wire channels. */
	channels = $state<number[]>([]);
	ports = $state<string[]>([]);

	/** Live per-family activity, 0–1, decaying. Drives the dock meters. */
	activity = $state<Record<MessageFamily, number>>({
		note: 0,
		cc: 0,
		expr: 0,
		program: 0,
		clock: 0,
		sysex: 0,
		common: 0
	});

	total = $state(0);
	rate = $state(0);

	#buffer: MidiEvent[] = [];
	#dirty = false;
	#frame = 0;
	#rateWindow: number[] = [];
	#unsub: (() => void) | null = null;

	start(): () => void {
		if (this.#unsub) return this.#unsub;
		this.#unsub = bus.subscribe((event) => this.#ingest(event));
		if (browser) this.#tick();
		return () => this.stop();
	}

	stop(): void {
		this.#unsub?.();
		this.#unsub = null;
		if (this.#frame) cancelAnimationFrame(this.#frame);
		this.#frame = 0;
	}

	#ingest(event: MidiEvent) {
		this.#rateWindow.push(event.time);
		if (this.paused) return;
		this.#buffer.push(event);
		if (this.#buffer.length > CAPACITY) this.#buffer.splice(0, this.#buffer.length - CAPACITY);
		this.#dirty = true;
	}

	#tick = () => {
		this.#frame = requestAnimationFrame(this.#tick);

		// Decay the activity meters ~15%/frame so a burst reads as a flash.
		const decayed = { ...this.activity };
		let changed = false;
		for (const f of ALL_FAMILIES) {
			if (decayed[f] > 0.001) {
				decayed[f] *= 0.85;
				changed = true;
			} else if (decayed[f] !== 0) {
				decayed[f] = 0;
				changed = true;
			}
		}

		if (this.#dirty) {
			this.#dirty = false;
			// Light up meters for whatever arrived since the last frame.
			const since = this.version;
			void since;
			for (let i = Math.max(0, this.#buffer.length - 64); i < this.#buffer.length; i++) {
				const f = family(this.#buffer[i].message);
				decayed[f] = 1;
			}
			changed = true;
			this.total = this.#buffer.length;
			this.version++;
		}
		if (changed) this.activity = decayed;

		const now = performance.now();
		while (this.#rateWindow.length && now - this.#rateWindow[0] > 1000) this.#rateWindow.shift();
		const r = this.#rateWindow.length;
		if (r !== this.rate) this.rate = r;
	};

	/** Raw buffer, oldest first. Read `version` first to stay reactive. */
	get events(): readonly MidiEvent[] {
		void this.version;
		return this.#buffer;
	}

	get filtered(): MidiEvent[] {
		void this.version;
		const fams = new Set(this.families);
		const dirs = new Set(this.directions);
		const chans = new Set(this.channels);
		const ports = new Set(this.ports);
		const q = this.search.trim().toLowerCase();
		const out: MidiEvent[] = [];
		for (let i = this.#buffer.length - 1; i >= 0; i--) {
			const e = this.#buffer[i];
			const m = e.message;
			if (this.hideRealTime && (m.type === 'clock' || m.type === 'activeSensing')) continue;
			if (!fams.has(family(m))) continue;
			if (!dirs.has(e.direction)) continue;
			if (chans.size && (!('channel' in m) || !chans.has(m.channel))) continue;
			if (ports.size && !ports.has(e.portId)) continue;
			if (q && !`${e.portName} ${m.type}`.toLowerCase().includes(q)) continue;
			out.push(e);
			if (out.length >= 500) break;
		}
		return out;
	}

	clear(): void {
		this.#buffer = [];
		this.total = 0;
		this.version++;
	}

	toggleFamily(f: MessageFamily): void {
		this.families = this.families.includes(f)
			? this.families.filter((x) => x !== f)
			: [...this.families, f];
	}

	toggleDirection(d: Direction): void {
		this.directions = this.directions.includes(d)
			? this.directions.filter((x) => x !== d)
			: [...this.directions, d];
	}

	toggleChannel(c: number): void {
		this.channels = this.channels.includes(c)
			? this.channels.filter((x) => x !== c)
			: [...this.channels, c];
	}

	/** Tab-separated dump of what is currently visible. */
	export(): string {
		const rows = this.filtered.slice().reverse();
		const t0 = rows[0]?.time ?? 0;
		const lines = ['time_ms\tdir\tport\tbytes\tdecoded'];
		for (const e of rows) {
			lines.push(
				[
					(e.time - t0).toFixed(2),
					e.direction,
					e.portName,
					e.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' '),
					e.message.type
				].join('\t')
			);
		}
		return lines.join('\n');
	}
}

export const monitor = new MonitorStore();
