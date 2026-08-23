/**
 * Web MIDI access, ports, permissions and hot-plug — as reactive state.
 *
 * Deliberate design choices, all of which are also lesson material:
 *
 * - **Support is not universal.** Safari (macOS and iOS) ships no Web MIDI at
 *   all. Rather than degrading into a broken page, the app detects this and
 *   falls back to its built-in synthesiser, which still teaches most of the
 *   curriculum. `status` drives that message.
 * - **SysEx is a second, separate permission gate**, because SysEx can reach
 *   firmware. It stays off until a lesson or the Device Lab actually needs it,
 *   and asking re-runs `requestMIDIAccess`.
 * - **Nothing is auto-connected.** Ports are listed; you choose what to listen
 *   to and what to send to. A tool that silently opens every port is how MIDI
 *   feedback loops get born.
 */

import { browser } from '$app/environment';
import { bus } from './bus';
import { parse } from './messages';
import { load, save } from '$lib/stores/persist';

export type AccessStatus = 'unsupported' | 'idle' | 'requesting' | 'granted' | 'denied';

export interface PortInfo {
	id: string;
	name: string;
	manufacturer: string;
	version: string;
	type: 'input' | 'output';
	/** `connected` or `disconnected` — whether the hardware is physically present. */
	state: 'connected' | 'disconnected';
	/** `open`, `closed` or `pending` — whether we have it open. */
	connection: 'open' | 'closed' | 'pending';
	/** True for the app's own internal synth port, which is not real hardware. */
	virtual: boolean;
}

function portInfo(port: MIDIPort): PortInfo {
	return {
		id: port.id,
		name: port.name ?? 'Unnamed port',
		manufacturer: port.manufacturer ?? '',
		version: port.version ?? '',
		type: port.type as 'input' | 'output',
		state: port.state as 'connected' | 'disconnected',
		connection: port.connection as 'open' | 'closed' | 'pending',
		virtual: false
	};
}

export class MidiAccessStore {
	status = $state<AccessStatus>('idle');
	error = $state<string | null>(null);
	sysexEnabled = $state(false);

	inputs = $state<PortInfo[]>([]);
	outputs = $state<PortInfo[]>([]);

	/** Input ports we are actively listening to. */
	listening = $state<string[]>([]);
	/**
	 * The ports you chose last time.
	 *
	 * Not the same thing as opening everything automatically — that is how MIDI
	 * loops are born and this panel still refuses to do it. This is remembering
	 * a decision you already made, which is what the app does with routes,
	 * profiles, patterns and every setting. A port only reopens if you had it
	 * open and it is still there.
	 */
	#remembered: string[] = load('listening', []);

	#access: MIDIAccess | null = null;
	#handlers = new Map<string, (e: MIDIMessageEvent) => void>();

	constructor() {
		if (browser && !('requestMIDIAccess' in navigator)) {
			this.status = 'unsupported';
		}
	}

	get supported(): boolean {
		return browser && 'requestMIDIAccess' in navigator;
	}

	get access(): MIDIAccess | null {
		return this.#access;
	}

	get connectedInputs(): PortInfo[] {
		return this.inputs.filter((p) => p.state === 'connected');
	}

	get connectedOutputs(): PortInfo[] {
		return this.outputs.filter((p) => p.state === 'connected');
	}

	/**
	 * Ask the browser for MIDI access. Chrome 124+ prompts for *all* access, not
	 * just SysEx, so this is a deliberate user action rather than something the
	 * app does on load.
	 */
	async request(sysex = false): Promise<boolean> {
		if (!this.supported) {
			this.status = 'unsupported';
			return false;
		}
		this.status = 'requesting';
		this.error = null;
		try {
			const access = await navigator.requestMIDIAccess({ sysex, software: true });
			this.#attach(access);
			this.sysexEnabled = sysex;
			this.status = 'granted';
			return true;
		} catch (err) {
			this.status = 'denied';
			this.error = err instanceof Error ? err.message : String(err);
			return false;
		}
	}

	/** Re-request with SysEx. The browser shows a second, separate prompt. */
	async enableSysEx(): Promise<boolean> {
		if (this.sysexEnabled) return true;
		const previouslyListening = [...this.listening];
		const ok = await this.request(true);
		if (ok) for (const id of previouslyListening) this.listen(id);
		return ok;
	}

	#attach(access: MIDIAccess) {
		this.#detachAll();
		this.#access = access;
		access.onstatechange = () => this.refresh();
		this.refresh();
	}

	refresh(): void {
		if (!this.#access) return;
		this.inputs = [...this.#access.inputs.values()].map(portInfo);
		this.outputs = [...this.#access.outputs.values()].map(portInfo);
		// A port that vanished cannot still be listened to.
		this.listening = this.listening.filter((id) => this.inputs.some((p) => p.id === id));
		// Reopen the ones you had open, now that they exist again.
		for (const id of this.#remembered) {
			if (!this.#handlers.has(id) && this.inputs.some((p) => p.id === id)) this.listen(id);
		}
	}

	isListening(portId: string): boolean {
		return this.listening.includes(portId);
	}

	listen(portId: string): void {
		if (!this.#access || this.#handlers.has(portId)) return;
		const port = this.#access.inputs.get(portId);
		if (!port) return;
		const handler = (event: MIDIMessageEvent) => {
			if (!event.data) return;
			const bytes = Array.from(event.data);
			bus.emit({
				time: event.timeStamp || performance.now(),
				portId,
				portName: port.name ?? portId,
				direction: 'in',
				bytes,
				message: parse(bytes)
			});
		};
		port.onmidimessage = handler;
		this.#handlers.set(portId, handler);
		if (!this.listening.includes(portId)) this.listening = [...this.listening, portId];
		this.#remember(portId, true);
	}

	unlisten(portId: string): void {
		const port = this.#access?.inputs.get(portId);
		if (port) port.onmidimessage = null;
		this.#handlers.delete(portId);
		this.listening = this.listening.filter((id) => id !== portId);
	}

	/**
	 * Closing a port during teardown is not the same as choosing to stop
	 * listening to it, so only the explicit toggle changes what is remembered.
	 */
	#remember(portId: string, on: boolean): void {
		const next = on
			? [...new Set([...this.#remembered, portId])]
			: this.#remembered.filter((id) => id !== portId);
		this.#remembered = next;
		save('listening', next);
	}

	toggleListen(portId: string): void {
		if (this.isListening(portId)) {
			this.unlisten(portId);
			this.#remember(portId, false);
		} else {
			this.listen(portId);
		}
	}

	/** Open every connected input. Convenient for lessons; never automatic. */
	listenAll(): void {
		for (const p of this.connectedInputs) this.listen(p.id);
	}

	#detachAll() {
		for (const id of [...this.#handlers.keys()]) this.unlisten(id);
		if (this.#access) this.#access.onstatechange = null;
	}

	/**
	 * Send raw bytes to a hardware port.
	 * `at` is a `performance.now()`-domain timestamp; omitting it means "now",
	 * which is exactly the sloppy behaviour Lesson 17 teaches you to avoid.
	 */
	sendRaw(portId: string, bytes: number[], at?: number): boolean {
		const port = this.#access?.outputs.get(portId);
		if (!port) return false;
		try {
			port.send(bytes, at);
			return true;
		} catch (err) {
			console.error('[midi] send failed', err);
			return false;
		}
	}

	outputName(portId: string): string {
		return this.outputs.find((p) => p.id === portId)?.name ?? portId;
	}

	inputName(portId: string): string {
		return this.inputs.find((p) => p.id === portId)?.name ?? portId;
	}
}

export const midiAccess = new MidiAccessStore();
