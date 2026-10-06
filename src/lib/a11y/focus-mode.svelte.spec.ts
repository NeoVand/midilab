import { afterEach, describe, expect, it } from 'vitest';
import { markPerformanceInput, trackFocusNavigation } from './focus-mode';

let cleanup = () => {};
afterEach(() => {
	cleanup();
	document.body.replaceChildren();
});

function key(target: HTMLElement, value: string) {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
}

const showsFocus = () => document.documentElement.hasAttribute('data-focus-navigation');

describe('musical performance and keyboard navigation focus', () => {
	it('does not promote a previously clicked control when computer note letters are pressed', () => {
		cleanup = trackFocusNavigation();
		const button = document.createElement('button');
		document.body.append(button);
		key(document.body, 'Tab');
		button.focus();
		expect(showsFocus()).toBe(true);
		button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		key(button, 'a');
		expect(showsFocus()).toBe(false);
		expect(document.activeElement).toBe(button);
	});

	it('restores the indicator for Tab, grid navigation and keyboard activation', () => {
		cleanup = trackFocusNavigation();
		for (const navigation of ['Tab', 'ArrowRight', 'Home', 'Enter', ' ']) {
			markPerformanceInput();
			key(document.body, navigation);
			expect(showsFocus()).toBe(true);
		}
	});

	it('clears stale button focus from note letters even after a keyboard dismissal', () => {
		cleanup = trackFocusNavigation();
		const button = document.createElement('button');
		document.body.append(button);
		button.focus();
		key(button, 'Escape');
		expect(showsFocus()).toBe(true);
		key(button, 'a');
		expect(showsFocus()).toBe(false);
		expect(document.activeElement).toBe(button);
		key(button, 'Enter');
		expect(showsFocus()).toBe(true);
	});

	it('preserves focus for native select keyboard typeahead', () => {
		cleanup = trackFocusNavigation();
		const select = document.createElement('select');
		document.body.append(select);
		select.focus();
		key(select, 'Tab');
		key(select, 'a');
		expect(showsFocus()).toBe(true);
	});

	it('keeps native text editing and focus intact', () => {
		cleanup = trackFocusNavigation();
		const field = document.createElement('input');
		document.body.append(field);
		field.focus();
		key(field, 'a');
		expect(showsFocus()).toBe(true);
		expect(document.activeElement).toBe(field);
	});

	it('switches accepted musical performance out of navigation without moving focus', () => {
		cleanup = trackFocusNavigation();
		const keybed = document.createElement('div');
		keybed.tabIndex = -1;
		document.body.append(keybed);
		key(document.body, 'Tab');
		keybed.focus();
		markPerformanceInput();
		expect(showsFocus()).toBe(false);
		expect(document.activeElement).toBe(keybed);
		key(keybed, 'Tab');
		expect(showsFocus()).toBe(true);
	});
});
