/**
 * A control you press, not a place you go.
 *
 * A button that has been clicked keeps focus, and the moment any key is
 * pressed the browser decides that focus is now "visible" and draws a ring
 * around it. On an ordinary page that is exactly right. On this one, the next
 * key you press is usually a note — the keybed plays from the computer
 * keyboard — so choosing a voice with the mouse and then playing lit up a
 * focus ring on the voice button, six inches from where you were looking.
 *
 * So: a pointer press on these controls does not hand them focus. It does
 * take focus away from wherever it was, because clicking a pad while the
 * cursor sits in the tempo field should stop you typing into the tempo field.
 *
 * Keyboard operation is untouched — Tab still reaches these, arrows still move
 * within a grid, Enter and Space still activate, and the ring still shows for
 * anyone who got there with the keyboard, which is the only person it is for.
 */
export function momentary(node: HTMLElement) {
	function onMouseDown(event: MouseEvent) {
		if (event.button !== 0) return;
		// Suppressing the default is what prevents the focus, and it has to
		// happen on mousedown: by click the browser has already moved it.
		event.preventDefault();
		const active = document.activeElement;
		if (active instanceof HTMLElement && active !== document.body) active.blur();
	}

	node.addEventListener('mousedown', onMouseDown);
	return {
		destroy() {
			node.removeEventListener('mousedown', onMouseDown);
		}
	};
}
