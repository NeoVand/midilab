import type { Component } from 'svelte';

const modules = import.meta.glob<{ default: Component }>('./*.svelte');

export function hasLesson(id: string): boolean {
	return `./${id}.svelte` in modules;
}

export async function loadLesson(id: string): Promise<Component | null> {
	const loader = modules[`./${id}.svelte`];
	if (!loader) return null;
	return (await loader()).default;
}
