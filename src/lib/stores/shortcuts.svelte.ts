/**
 * Global keyboard shortcuts.
 *
 * Deliberately few, and deliberately the ones every sequencer already trains
 * your hands for: space plays, Cmd/Ctrl+K opens the palette, Cmd/Ctrl+. panics.
 * A shortcut you have to look up is worse than no shortcut, so this stays at
 * the size you can remember.
 *
 * The guard matters more than the bindings. Space is also how a focused button
 * is activated and how you type a space into a field, so a global handler that
 * swallows it is a bug that shows up as "the app randomly starts playing".
 */

const TYPING = /^(input|textarea|select)$/i;

export function isTypingTarget(target: EventTarget | null): boolean {
	// A keydown's target is not always an element — `document` and `window` are
	// both legal, and a handler that assumes otherwise throws on the way into
	// every shortcut, which takes the shortcuts down with it.
	if (!(target instanceof HTMLElement)) return false;
	const el = target;
	if (TYPING.test(el.tagName)) return true;
	if (el.isContentEditable) return true;
	// A focused button owns space and enter; let it have them.
	return el.tagName === 'BUTTON' || el.getAttribute('role') === 'slider';
}

export interface ShortcutHandlers {
	toggleTransport: () => void;
	togglePalette: () => void;
	panic: () => void;
	toggleDock: () => void;
}

export function handleShortcut(e: KeyboardEvent, h: ShortcutHandlers): boolean {
	const mod = e.metaKey || e.ctrlKey;

	if (mod && e.key.toLowerCase() === 'k') {
		e.preventDefault();
		h.togglePalette();
		return true;
	}
	if (mod && e.key === '.') {
		e.preventDefault();
		h.panic();
		return true;
	}
	if (mod || e.altKey) return false;
	if (isTypingTarget(e.target)) return false;

	if (e.key === ' ') {
		e.preventDefault();
		h.toggleTransport();
		return true;
	}
	if (e.key === '`') {
		e.preventDefault();
		h.toggleDock();
		return true;
	}
	return false;
}
