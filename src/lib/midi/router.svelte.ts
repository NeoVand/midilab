/**
 * The patchbay: any input to any output, with transformation on the way.
 *
 * This is a real utility rather than a lesson prop — channel remapping,
 * transposition, velocity curves and message filtering are the four things you
 * actually need when connecting instruments that disagree with each other.
 *
 * Two safety properties matter. Routed messages are published to the bus as
 * outgoing, never incoming, so a route can never feed itself. And a route to
 * the port it came from is refused outright, because that is a feedback loop
 * with extra steps.
 */

import { browser } from '$app/environment';
import { bus, type MidiEvent } from './bus';
import { midiAccess } from './access.svelte';
import { encode, type MidiMessage } from './messages';
import { synth } from '$lib/audio/synth';
import { engine, INTERNAL_OUTPUT_ID, VIRTUAL_INPUT_ID } from './engine.svelte';
import { load, save } from '$lib/stores/persist';

export interface MessageFilters {
	notes: boolean;
	cc: boolean;
	pitchBend: boolean;
	aftertouch: boolean;
	program: boolean;
	clock: boolean;
	sysex: boolean;
}

export interface Route {
	id: string;
	name: string;
	enabled: boolean;
	fromPortId: string;
	toPortId: string;
	/** Wire channels 0–15 to accept; empty means every channel. */
	channels: number[];
	/** Force everything onto this wire channel; null leaves it alone. */
	remapTo: number | null;
	transpose: number;
	/** Multiplier applied to note velocity, 0–2. */
	velocityScale: number;
	/** Only pass notes in this inclusive range — for keyboard splits. */
	noteRange: [number, number];
	pass: MessageFilters;
}

export const ALL_PASS: MessageFilters = {
	notes: true,
	cc: true,
	pitchBend: true,
	aftertouch: true,
	program: true,
	clock: false,
	sysex: false
};

let counter = 0;

export function newRoute(fromPortId = '', toPortId = INTERNAL_OUTPUT_ID): Route {
	return {
		id: `route-${Date.now().toString(36)}-${counter++}`,
		name: '',
		enabled: true,
		fromPortId,
		toPortId,
		channels: [],
		remapTo: null,
		transpose: 0,
		velocityScale: 1,
		noteRange: [0, 127],
		pass: { ...ALL_PASS }
	};
}

function passes(msg: MidiMessage, f: MessageFilters): boolean {
	switch (msg.type) {
		case 'noteOn':
		case 'noteOff':
			return f.notes;
		case 'controlChange':
			return f.cc;
		case 'pitchBend':
			return f.pitchBend;
		case 'channelAftertouch':
		case 'polyAftertouch':
			return f.aftertouch;
		case 'programChange':
			return f.program;
		case 'clock':
		case 'start':
		case 'stop':
		case 'continue':
		case 'songPosition':
			return f.clock;
		case 'sysex':
			return f.sysex;
		default:
			return true;
	}
}

/** Apply a route's transformations. Returns null if the message is filtered out. */
export function transform(msg: MidiMessage, route: Route): MidiMessage | null {
	if (!passes(msg, route.pass)) return null;

	if ('channel' in msg) {
		if (route.channels.length && !route.channels.includes(msg.channel)) return null;
		const channel = route.remapTo ?? msg.channel;

		if (msg.type === 'noteOn' || msg.type === 'noteOff' || msg.type === 'polyAftertouch') {
			const note = msg.note + route.transpose;
			if (msg.note < route.noteRange[0] || msg.note > route.noteRange[1]) return null;
			if (note < 0 || note > 127) return null;
			if (msg.type === 'polyAftertouch') return { ...msg, channel, note };
			const velocity =
				msg.type === 'noteOn'
					? Math.max(1, Math.min(127, Math.round(msg.velocity * route.velocityScale)))
					: msg.velocity;
			return { ...msg, channel, note, velocity };
		}
		return { ...msg, channel };
	}
	return msg;
}

export class Router {
	routes = $state<Route[]>(load('routes', []));
	/** Route id → timestamp of the last message it passed, for the flow animation. */
	activity = $state<Record<string, number>>({});

	#unsub: (() => void) | null = null;
	#unsubLocal: (() => void) | null = null;
	#frame = 0;
	#pending = new Set<string>();

	start(): () => void {
		if (this.#unsub || !browser) return () => this.stop();
		this.#unsub = bus.subscribe((e) => this.#route(e));
		// The app's own controls are an input too, tapped once per message
		// rather than once per open output port.
		this.#unsubLocal = engine.onLocalSend((msg) => this.#routeLocal(msg));
		const tick = () => {
			this.#frame = requestAnimationFrame(tick);
			if (this.#pending.size === 0) return;
			const now = performance.now();
			const next = { ...this.activity };
			for (const id of this.#pending) next[id] = now;
			this.#pending.clear();
			this.activity = next;
		};
		this.#frame = requestAnimationFrame(tick);
		return () => this.stop();
	}

	stop(): void {
		this.#unsub?.();
		this.#unsub = null;
		this.#unsubLocal?.();
		this.#unsubLocal = null;
		cancelAnimationFrame(this.#frame);
	}

	#route(e: MidiEvent) {
		// Only messages arriving from outside are routed. Routed output is
		// published as 'out', so this can never recurse.
		if (e.direction !== 'in') return;
		for (const route of this.routes) {
			if (!route.enabled || route.fromPortId !== e.portId) continue;
			if (route.toPortId === route.fromPortId) continue;
			this.#pass(route, e.message);
		}
	}

	/** Messages this page generated, offered to routes from the virtual input. */
	#routeLocal(msg: MidiMessage) {
		for (const route of this.routes) {
			if (!route.enabled || route.fromPortId !== VIRTUAL_INPUT_ID) continue;
			this.#pass(route, msg);
		}
	}

	#pass(route: Route, message: MidiMessage) {
		const out = transform(message, route);
		if (!out) return;
		this.#pending.add(route.id);
		const bytes = encode(out);
		if (route.toPortId === INTERNAL_OUTPUT_ID) {
			synth.handle(out);
		} else {
			midiAccess.sendRaw(route.toPortId, bytes);
		}
		bus.emit({
			time: performance.now(),
			portId: route.toPortId,
			portName:
				route.toPortId === INTERNAL_OUTPUT_ID
					? 'Internal Synth'
					: midiAccess.outputName(route.toPortId),
			direction: 'out',
			bytes,
			message: out
		});
	}

	add(route: Route = newRoute()): void {
		this.routes = [...this.routes, route];
		this.persist();
	}

	remove(id: string): void {
		this.routes = this.routes.filter((r) => r.id !== id);
		this.persist();
	}

	update(id: string, patch: Partial<Route>): void {
		this.routes = this.routes.map((r) => (r.id === id ? { ...r, ...patch } : r));
		this.persist();
	}

	clear(): void {
		this.routes = [];
		this.persist();
	}

	persist(): void {
		save('routes', this.routes);
	}

	/** True if this route would send a port's traffic straight back to itself. */
	isLoop(route: Route): boolean {
		return route.fromPortId === route.toPortId;
	}

	/**
	 * A route from the app's own controls straight to the internal synth with
	 * nothing changed plays every note twice, in unison, which sounds like a
	 * bug rather than a layer. Worth saying out loud in the editor.
	 */
	isUnisonDouble(route: Route): boolean {
		return (
			route.fromPortId === VIRTUAL_INPUT_ID &&
			route.toPortId === INTERNAL_OUTPUT_ID &&
			route.transpose === 0 &&
			route.remapTo === null
		);
	}
}

export const router = new Router();
