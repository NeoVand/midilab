import { browser } from '$app/environment';
import { load, save } from './persist';

export type ThemeMode = 'light' | 'dark' | 'system';

class Settings {
	theme = $state<ThemeMode>(load('theme', 'dark'));
	/** Middle C labelled C3 (Yamaha/Roland) or C4 (scientific). */
	octaveConvention = $state<'c3' | 'c4'>(load('octave', 'c3'));
	showNoteNumbers = $state<boolean>(load('showNoteNumbers', false));
	dockOpen = $state<boolean>(load('dockOpen', false));
	dockTab = $state<string>(load('dockTab', 'devices'));
	/** Height of the expanded dock in pixels — dragged, then remembered. */
	dockHeight = $state<number>(load('dockHeight', 240));
	/** Seeded from the operating system, then yours to override. */
	reduceMotion = $state<boolean>(
		load(
			'reduceMotion',
			browser ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
		)
	);
	masterVolume = $state<number>(load('masterVolume', 0.75));

	constructor() {
		if (browser) {
			$effect.root(() => {
				$effect(() => {
					save('theme', this.theme);
					this.applyTheme();
				});
				$effect(() => save('octave', this.octaveConvention));
				$effect(() => save('showNoteNumbers', this.showNoteNumbers));
				$effect(() => save('dockOpen', this.dockOpen));
				$effect(() => save('dockTab', this.dockTab));
				$effect(() => save('dockHeight', this.dockHeight));
				$effect(() => {
					save('reduceMotion', this.reduceMotion);
					this.applyMotion();
				});
				$effect(() => save('masterVolume', this.masterVolume));
			});
		}
	}

	get resolvedTheme(): 'light' | 'dark' {
		if (this.theme !== 'system') return this.theme;
		if (!browser) return 'dark';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	/**
	 * Flip the theme in one frame.
	 *
	 * Well over a hundred elements on a busy page carry `transition-colors`,
	 * which is right when a single button changes under the cursor and wrong
	 * when every colour on the page changes at once: the whole screen
	 * cross-fades for the length of the transition and the switch reads as
	 * slow and smeary. So transitions are turned off for the flip and turned
	 * back on the frame after, which is what makes it feel instant.
	 */
	applyTheme(): void {
		if (!browser) return;
		const root = document.documentElement;
		const freeze = document.createElement('style');
		freeze.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
		document.head.appendChild(freeze);

		root.style.colorScheme = this.resolvedTheme;
		root.classList.toggle('dark', this.resolvedTheme === 'dark');

		// Read something layout-dependent so the browser commits the new colours
		// while transitions are still suppressed.
		void root.offsetHeight;
		requestAnimationFrame(() => freeze.remove());
	}

	applyMotion(): void {
		if (!browser) return;
		document.documentElement.classList.toggle('reduce-motion', this.reduceMotion);
	}

	toggleTheme(): void {
		this.theme = this.resolvedTheme === 'dark' ? 'light' : 'dark';
	}
}

export const settings = new Settings();
