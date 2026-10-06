const NAVIGATION_ATTRIBUTE = 'data-focus-navigation';

/** Playing a note is keyboard input, but it does not navigate the interface. */
export function markPerformanceInput(): void {
	if (typeof document !== 'undefined')
		document.documentElement.removeAttribute(NAVIGATION_ATTRIBUTE);
}

/**
 * Browser :focus-visible heuristics treat every letter as UI navigation. A
 * musical shortcut can therefore light up a previously clicked control.
 * Track the user's actual intent while leaving DOM focus and native editing
 * alone. Printable note shortcuts also leave navigation mode; editable fields
 * and native typeahead controls keep their own keyboard behavior.
 */
export function trackFocusNavigation(): () => void {
	if (typeof document === 'undefined') return () => {};
	const root = document.documentElement;
	const navigationKeys = new Set([
		'Tab',
		'ArrowUp',
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight',
		'Home',
		'End',
		'PageUp',
		'PageDown',
		'Enter',
		' ',
		'Escape'
	]);
	function onKeydown(event: KeyboardEvent): void {
		const target = event.target;
		const textField =
			target instanceof HTMLInputElement &&
			!['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file'].includes(
				target.type
			);
		const editing =
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				textField ||
				!!target.closest('textarea, [contenteditable="true"], [role="textbox"]'));
		const unmodified = !event.metaKey && !event.ctrlKey && !event.altKey;
		if (editing || (unmodified && navigationKeys.has(event.key)))
			root.setAttribute(NAVIGATION_ATTRIBUTE, 'true');
		else if (
			unmodified &&
			event.key.length === 1 &&
			!(
				target instanceof Element &&
				target.closest(
					'select, [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menubar"], [role="menuitem"], [role="tree"], [role="treeitem"]'
				)
			)
		)
			markPerformanceInput();
	}

	// Capture runs before components handle navigation or shortcuts. An
	// instrument confirms accepted performance through markPerformanceInput.
	document.addEventListener('keydown', onKeydown, true);
	document.addEventListener('pointerdown', markPerformanceInput, true);
	return () => {
		document.removeEventListener('keydown', onKeydown, true);
		document.removeEventListener('pointerdown', markPerformanceInput, true);
		root.removeAttribute(NAVIGATION_ATTRIBUTE);
	};
}
