import { browser } from '$app/environment';

const PREFIX = 'midilab:';

export function load<T>(key: string, fallback: T): T {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function save(key: string, value: unknown): void {
	if (!browser) return;
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		/* quota or private mode — preferences are not worth throwing over */
	}
}

export function remove(key: string): void {
	if (!browser) return;
	localStorage.removeItem(PREFIX + key);
}
