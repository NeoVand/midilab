import { browser } from '$app/environment';

/**
 * What kind of thing is looking at this, and what is touching it.
 *
 * Two questions, deliberately separate, because they have different answers
 * and different consequences.
 *
 * *How wide* decides layout — whether navigation lives down the side or along
 * the bottom, whether the monitor is a table or a list. Most of that is
 * answered better in CSS than here, and where it can be, it is; this exists
 * for the decisions CSS cannot make, like how many octaves of keyboard to
 * build in the first place.
 *
 * *How you touch it* decides size, and is not the same question. A tablet is
 * wide and still driven by fingers; a laptop with a touchscreen is both. A
 * control sized for a mouse is a control a finger misses, whatever the
 * viewport is doing, so anything a finger drives is sized from `coarse` rather
 * than from the width.
 */
const NARROW = '(max-width: 767px)'; // Tailwind's `md`, from the other side
const COARSE = '(pointer: coarse)';

class Device {
	/** Narrower than the desktop shell wants. */
	narrow = $state(false);
	/** The primary pointer is a finger, whatever the width. */
	coarse = $state(false);
	/** Taller than it is wide. Phones in the hand; not a proxy for "phone". */
	portrait = $state(true);

	constructor() {
		if (!browser) return;
		const watch = (query: string, apply: (matches: boolean) => void) => {
			const mq = window.matchMedia(query);
			apply(mq.matches);
			mq.addEventListener('change', (e) => apply(e.matches));
		};
		watch(NARROW, (m) => (this.narrow = m));
		watch(COARSE, (m) => (this.coarse = m));
		watch('(orientation: portrait)', (m) => (this.portrait = m));
	}

	/**
	 * The one derived answer worth naming: a narrow screen being driven by a
	 * finger. Not "is this an iPhone" — a small window on a desktop is narrow
	 * but has a mouse, and gets the compact layout without the enlarged
	 * targets, which is exactly right for both.
	 */
	get phone(): boolean {
		return this.narrow && this.coarse;
	}
}

export const device = new Device();
