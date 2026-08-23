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
	reduceMotion = $state<boolean>(load('reduceMotion', false));
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
				$effect(() => save('reduceMotion', this.reduceMotion));
				$effect(() => save('masterVolume', this.masterVolume));
			});
		}
	}

	get resolvedTheme(): 'light' | 'dark' {
		if (this.theme !== 'system') return this.theme;
		if (!browser) return 'dark';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	applyTheme(): void {
		if (!browser) return;
		document.documentElement.classList.toggle('dark', this.resolvedTheme === 'dark');
		document.documentElement.style.colorScheme = this.resolvedTheme;
	}

	toggleTheme(): void {
		this.theme = this.resolvedTheme === 'dark' ? 'light' : 'dark';
	}
}

export const settings = new Settings();
