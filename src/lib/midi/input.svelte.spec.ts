import { afterEach, describe, expect, it, vi } from 'vitest';
import { MusicalInput, type InputSurface } from './input.svelte';
import { mount, unmount, tick } from 'svelte';
import Keyboard from '$lib/components/midi/Keyboard.svelte';
import PadGrid from '$lib/components/midi/PadGrid.svelte';
import { engine } from './engine.svelte';

const cleanup: (() => void)[] = [];
afterEach(() => {
	for (const dispose of cleanup.splice(0)) dispose();
	document.body.replaceChildren();
});

function surface(): InputSurface {
	return { enabled: () => true, keydown: vi.fn(), keyup: vi.fn(), release: vi.fn() };
}

function press(target: HTMLElement = document.body, options: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', {
		code: 'KeyA',
		key: 'a',
		bubbles: true,
		cancelable: true,
		...options
	});
	target.dispatchEvent(event);
	return event;
}

describe('musical computer keyboard ownership', () => {
	it('starts on the first surface and switches exclusively, releasing the previous instrument', () => {
		const input = new MusicalInput();
		const piano = surface();
		const pads = surface();
		const pianoId = Symbol();
		const padId = Symbol();
		cleanup.push(input.register(pianoId, piano), input.register(padId, pads));
		press();
		expect(piano.keydown).toHaveBeenCalledTimes(1);
		expect(pads.keydown).not.toHaveBeenCalled();
		input.activate(padId);
		press();
		expect(piano.release).toHaveBeenCalledTimes(1);
		expect(piano.keydown).toHaveBeenCalledTimes(1);
		expect(pads.keydown).toHaveBeenCalledTimes(1);
	});

	it('respects editable fields, buttons, dialogs, modifiers, repeated and consumed events', () => {
		const input = new MusicalInput();
		const piano = surface();
		cleanup.push(input.register(Symbol(), piano));
		for (const tag of ['input', 'textarea', 'select', 'button']) {
			const node = document.createElement(tag);
			document.body.append(node);
			press(node);
		}
		const editor = document.createElement('div');
		editor.contentEditable = 'true';
		document.body.append(editor);
		press(editor);
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		dialog.innerHTML = '<span>Dialog content</span>';
		document.body.append(dialog);
		press(dialog.firstElementChild as HTMLElement);
		for (const options of [
			{ ctrlKey: true },
			{ metaKey: true },
			{ altKey: true },
			{ repeat: true }
		])
			press(document.body, options);
		const consumed = new KeyboardEvent('keydown', { code: 'KeyA', cancelable: true });
		consumed.preventDefault();
		input.keydown(consumed);
		expect(piano.keydown).not.toHaveBeenCalled();
	});

	it('delivers key releases after focus or Shift changes', () => {
		const input = new MusicalInput();
		const piano = surface();
		cleanup.push(input.register(Symbol(), piano));
		press();
		const field = document.createElement('input');
		document.body.append(field);
		const release = new KeyboardEvent('keyup', {
			code: 'KeyA',
			key: 'A',
			shiftKey: true,
			bubbles: true
		});
		field.dispatchEvent(release);
		expect(piano.keyup).toHaveBeenCalledWith(release);
	});

	it('clears navigation focus only for shortcuts accepted by the active instrument', () => {
		const input = new MusicalInput();
		const piano = surface();
		piano.keydown = (event) => {
			if (event.code === 'KeyA') event.preventDefault();
		};
		cleanup.push(input.register(Symbol(), piano));
		document.documentElement.setAttribute('data-focus-navigation', 'true');
		press(document.body, { code: 'KeyB', key: 'b' });
		expect(document.documentElement.hasAttribute('data-focus-navigation')).toBe(true);
		press();
		expect(document.documentElement.hasAttribute('data-focus-navigation')).toBe(false);
	});

	it('releases all held notes when the browser loses focus', () => {
		const input = new MusicalInput();
		const piano = surface();
		const pads = surface();
		cleanup.push(input.register(Symbol(), piano), input.register(Symbol(), pads));
		window.dispatchEvent(new Event('blur'));
		expect(piano.release).toHaveBeenCalledTimes(1);
		expect(pads.release).toHaveBeenCalledTimes(1);
	});

	it('releases unmounted surfaces and hands typing to the remaining instrument', () => {
		const input = new MusicalInput();
		const piano = surface();
		const pads = surface();
		const removePiano = input.register(Symbol(), piano);
		cleanup.push(input.register(Symbol(), pads));
		removePiano();
		press();
		expect(piano.release).toHaveBeenCalledTimes(1);
		expect(pads.keydown).toHaveBeenCalledTimes(1);
	});

	it('skips surfaces whose computer keyboard input is disabled', () => {
		const input = new MusicalInput();
		const piano = { ...surface(), enabled: () => false };
		const pads = surface();
		cleanup.push(input.register(Symbol(), piano), input.register(Symbol(), pads));
		press();
		expect(piano.keydown).not.toHaveBeenCalled();
		expect(pads.keydown).toHaveBeenCalledTimes(1);
	});

	it('plays piano and drum mappings exclusively and releases their original notes on switching and teardown', async () => {
		const noteOn = vi.spyOn(engine, 'noteOn').mockImplementation(() => {});
		const noteOff = vi.spyOn(engine, 'noteOff').mockImplementation(() => {});
		const target = document.createElement('div');
		document.body.append(target);
		const piano = mount(Keyboard, { target, props: { channel: 2, controls: false } });
		const pads = mount(PadGrid, { target, props: { channel: 9, controls: false } });
		try {
			await tick();
			press();
			expect(noteOn).toHaveBeenLastCalledWith(60, 96, 2);
			press(document.body, { code: 'KeyX', key: 'x' });
			expect(noteOff).toHaveBeenLastCalledWith(60, 2);
			press();
			expect(noteOn).toHaveBeenLastCalledWith(72, 96, 2);
			const activate = Array.from(target.querySelectorAll('button')).find(
				(button) =>
					button.getAttribute('aria-label') === 'Use computer keys' &&
					button.getAttribute('aria-pressed') === 'false'
			)!;
			activate.click();
			expect(noteOff).toHaveBeenLastCalledWith(72, 2);
			press();
			expect(noteOn).toHaveBeenLastCalledWith(40, 100, 9);
			document.body.dispatchEvent(
				new KeyboardEvent('keyup', { code: 'KeyA', key: 'A', shiftKey: true, bubbles: true })
			);
			expect(noteOff).toHaveBeenLastCalledWith(40, 9);
			press(document.body, { code: 'KeyZ', key: 'z' });
			expect(noteOn).toHaveBeenLastCalledWith(36, 100, 9);
		} finally {
			await unmount(pads);
			expect(noteOff).toHaveBeenLastCalledWith(36, 9);
			await unmount(piano);
			noteOn.mockRestore();
			noteOff.mockRestore();
		}
	});
});
