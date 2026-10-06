import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import MusicPractice from './MusicPractice.svelte';
import { engine } from '$lib/midi/engine.svelte';

let component: ReturnType<typeof mount> | undefined;
afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe('practice computer keyboard pitch', () => {
	it.each([60, 48])('maps the first typing key to the phrase tonic %i', async (tonic) => {
		const noteOn = vi.spyOn(engine, 'noteOn').mockImplementation(() => {});
		vi.spyOn(engine, 'noteOff').mockImplementation(() => {});
		component = mount(MusicPractice, {
			target: document.body,
			props: {
				id: 'typing-pitch',
				title: 'Play the tonic',
				notes: [{ note: tonic, start: 0, duration: 1, channel: 0 }]
			}
		});
		await tick();
		const instrument = document.body.querySelector<HTMLElement>('[role="group"]')!;
		instrument.focus();
		instrument.dispatchEvent(
			new KeyboardEvent('keydown', {
				code: 'KeyA',
				key: 'a',
				bubbles: true,
				cancelable: true
			})
		);
		expect(noteOn).toHaveBeenCalledWith(tonic, 96, 0);
		instrument.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true }));
	});
});
