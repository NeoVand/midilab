import { SvelteMap } from 'svelte/reactivity';
import { markPerformanceInput } from '$lib/a11y/focus-mode';

export interface InputSurface {
	enabled: () => boolean;
	keydown: (event: KeyboardEvent) => void;
	keyup: (event: KeyboardEvent) => void;
	release: () => void;
}

/** A focused UI control owns its keys. Musical typing only starts on the page itself. */
export function blocksMusicalTyping(target: EventTarget | null): boolean {
	if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		!!target.closest(
			'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"], [role="slider"], [role="combobox"], dialog, [role="dialog"], [role="alertdialog"]'
		)
	);
}

/** One laptop keyboard belongs to one visible instrument at a time. */
export class MusicalInput {
	active = $state<symbol | null>(null);
	#surfaces = new SvelteMap<symbol, InputSurface>();
	#listening = false;

	register(id: symbol, surface: InputSurface): () => void {
		this.#surfaces.set(id, surface);
		if (this.active === null && surface.enabled()) this.activate(id);
		this.#start();
		return () => {
			surface.release();
			this.#surfaces.delete(id);
			if (this.active === id) {
				this.active = null;
				this.#activateFirst();
			}
			if (this.#surfaces.size === 0) this.#stop();
		};
	}

	activate(id: symbol): void {
		const next = this.#surfaces.get(id);
		if (!next?.enabled() || this.active === id) return;
		if (this.active !== null) this.#surfaces.get(this.active)?.release();
		this.active = id;
	}

	release(): void {
		for (const surface of this.#surfaces.values()) surface.release();
	}

	keydown = (event: KeyboardEvent): void => {
		if (
			event.defaultPrevented ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey ||
			event.repeat ||
			blocksMusicalTyping(event.target) ||
			(typeof document !== 'undefined' &&
				!!document.querySelector(
					'dialog[open], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
				))
		)
			return;
		if (this.active !== null && !this.#surfaces.get(this.active)?.enabled()) {
			this.#surfaces.get(this.active)?.release();
			this.active = null;
		}
		if (this.active === null) this.#activateFirst();
		if (this.active !== null) {
			this.#surfaces.get(this.active)?.keydown(event);
			if (event.defaultPrevented) markPerformanceInput();
		}
	};

	// Releases are always delivered, even after focus or modifiers change.
	keyup = (event: KeyboardEvent): void => {
		if (this.active !== null) this.#surfaces.get(this.active)?.keyup(event);
	};

	#activateFirst(): void {
		for (const [id, surface] of this.#surfaces) {
			if (surface.enabled()) {
				this.activate(id);
				return;
			}
		}
	}

	#blur = (): void => this.release();
	#visibility = (): void => {
		if (document.hidden) this.release();
	};
	#start(): void {
		if (this.#listening || typeof window === 'undefined') return;
		this.#listening = true;
		window.addEventListener('keydown', this.keydown);
		window.addEventListener('keyup', this.keyup);
		window.addEventListener('blur', this.#blur);
		document.addEventListener('visibilitychange', this.#visibility);
	}
	#stop(): void {
		if (!this.#listening) return;
		window.removeEventListener('keydown', this.keydown);
		window.removeEventListener('keyup', this.keyup);
		window.removeEventListener('blur', this.#blur);
		document.removeEventListener('visibilitychange', this.#visibility);
		this.#listening = false;
	}
}

export const musicalInput = new MusicalInput();
