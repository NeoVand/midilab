/**
 * Roving tabindex over a grid of buttons.
 *
 * A hundred and twenty-eight note buttons is a hundred and twenty-eight tab
 * stops between you and whatever is under them. Every hardware grid — a pad
 * bank, a step row, a patch list — is one place your hands go to and then move
 * around inside, and that is what this makes it: the grid takes one stop,
 * arrows move within it, Home and End go to the ends.
 *
 * Children are re-read on every interaction and watched for changes, so it
 * survives filtering the list underneath it.
 */

interface Options {
	/** Columns for vertical movement. Read from the grid itself if omitted. */
	columns?: number;
	/** Selector for the focusable children. */
	items?: string;
	/**
	 * `'visual'` walks the children in the order they appear on screen rather
	 * than in the order they appear in the DOM. A piano keyboard draws its white
	 * keys in one layer and its black keys in another on top, so DOM order would
	 * march you through every white key and then come back for the sharps.
	 */
	order?: 'dom' | 'visual';
	/**
	 * Anything that changes when the set of items changes without the DOM
	 * gaining or losing children — a keybed that scrolls, say, where the same
	 * buttons stay put and only which of them are in play moves. The observer
	 * below cannot see that, and watching every attribute would fire on every
	 * note.
	 */
	revision?: unknown;
}

export function rovingGrid(node: HTMLElement, options: Options = {}) {
	let opts = options;
	let index = 0;

	function list(): HTMLElement[] {
		const found = Array.from(
			node.querySelectorAll<HTMLElement>(opts.items ?? 'button:not([disabled])')
		);
		if (opts.order !== 'visual') return found;
		return found
			.map((el) => ({ el, box: el.getBoundingClientRect() }))
			.sort(
				(a, b) => Math.round(a.box.top / 8) - Math.round(b.box.top / 8) || a.box.left - b.box.left
			)
			.map((x) => x.el);
	}

	function columns(): number {
		if (opts.columns) return opts.columns;
		const t = getComputedStyle(node).gridTemplateColumns;
		return t && t !== 'none' ? t.split(' ').length : 1;
	}

	/** Items that were in the set last time, so leavers can be stood down. */
	let previous: HTMLElement[] = [];

	function sync() {
		const items = list();
		if (!items.length) return;
		index = Math.max(0, Math.min(index, items.length - 1));
		// An item that has left the set keeps whatever tabindex it was given,
		// which is how a grid ends up with two tab stops.
		for (const el of previous) if (!items.includes(el)) el.tabIndex = -1;
		for (let i = 0; i < items.length; i++) items[i].tabIndex = i === index ? 0 : -1;
		previous = items;
	}

	function move(delta: number) {
		const items = list();
		if (!items.length) return;
		index = Math.max(0, Math.min(items.length - 1, index + delta));
		sync();
		items[index].focus();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const cols = columns();
		switch (e.key) {
			case 'ArrowRight':
				move(1);
				break;
			case 'ArrowLeft':
				move(-1);
				break;
			case 'ArrowDown':
				move(cols);
				break;
			case 'ArrowUp':
				move(-cols);
				break;
			case 'Home':
				move(-list().length);
				break;
			case 'End':
				move(list().length);
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	function mark(target: EventTarget | null) {
		const el = (target as HTMLElement | null)?.closest<HTMLElement>(
			opts.items ?? 'button:not([disabled])'
		);
		const i = el ? list().indexOf(el) : -1;
		if (i >= 0 && i !== index) {
			index = i;
			sync();
		}
	}

	function onFocusIn(e: FocusEvent) {
		mark(e.target);
	}

	/*
	 * Pressing an item with the mouse moves the grid's cursor to it even when
	 * the press deliberately does not take focus — see `momentary`. Without
	 * this, tabbing back into a grid you have been clicking around in returns
	 * you to wherever you last were with the keyboard, which is not where you
	 * are looking.
	 */
	function onPointerDown(e: PointerEvent) {
		mark(e.target);
	}

	const observer = new MutationObserver(() => sync());
	observer.observe(node, { childList: true, subtree: true });
	node.addEventListener('keydown', onKeydown);
	node.addEventListener('focusin', onFocusIn);
	node.addEventListener('pointerdown', onPointerDown);
	sync();

	return {
		update(next: Options) {
			opts = next;
			sync();
		},
		destroy() {
			observer.disconnect();
			node.removeEventListener('keydown', onKeydown);
			node.removeEventListener('focusin', onFocusIn);
			node.removeEventListener('pointerdown', onPointerDown);
		}
	};
}
