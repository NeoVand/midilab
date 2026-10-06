import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import CircleOfFifths from './CircleOfFifths.svelte';
import { engine } from '$lib/midi/engine.svelte';
import { SequencePlayer, type ScheduledEvent } from '$lib/midi/player.svelte';

let component: ReturnType<typeof mount> | undefined;
afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

async function setup() {
	vi.spyOn(engine, 'wake').mockResolvedValue();
	vi.spyOn(engine, 'send').mockImplementation(() => {});
	const play = vi.spyOn(SequencePlayer.prototype, 'play').mockResolvedValue();
	component = mount(CircleOfFifths, { target: document.body });
	await tick();
	return play;
}

function button(label: string) {
	return [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
		(candidate) => candidate.textContent?.trim() === label
	)!;
}

function pitches(events: ScheduledEvent[]) {
	return events.flatMap((event) => (event.message.type === 'noteOn' ? [event.message.note] : []));
}

describe('circle of fifths listening', () => {
	it('distinguishes relative and parallel minor without changing the major tonal centre', async () => {
		const play = await setup();
		button('Hear the relative-minor chord').click();
		await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
		expect(
			pitches(play.mock.calls[0][0])
				.map((note) => note % 12)
				.sort((a, b) => a - b)
		).toEqual([0, 4, 9]);
		button('Hear the parallel-minor chord').click();
		await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(2));
		expect(
			pitches(play.mock.calls[1][0])
				.map((note) => note % 12)
				.sort((a, b) => a - b)
		).toEqual([0, 3, 7]);
		expect(document.body.querySelector('[data-key="0"]')?.getAttribute('aria-pressed')).toBe(
			'true'
		);
	});

	it('hears the dominant chord while retaining the selected key', async () => {
		const play = await setup();
		(
			document.body.querySelector('button[aria-label="Hear G, V, Pull home"]') as HTMLButtonElement
		).click();
		await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
		expect(
			pitches(play.mock.calls[0][0])
				.map((note) => note % 12)
				.sort((a, b) => a - b)
		).toEqual([2, 7, 11]);
		expect(document.body.querySelector('[data-key="0"]')?.getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(document.body.querySelector('[data-key="1"]')?.getAttribute('aria-pressed')).toBe(
			'false'
		);
		expect(engine.send).toHaveBeenCalledWith(
			{ type: 'programChange', channel: 0, program: 0 },
			undefined,
			undefined,
			'demo'
		);
	});

	it('moves focus and key selection clockwise with an arrow key', async () => {
		const play = await setup();
		const c = document.body.querySelector<SVGPathElement>('[data-key="0"]')!;
		c.focus();
		c.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => expect(play).toHaveBeenCalledOnce());
		await tick();
		expect(document.activeElement).toBe(document.body.querySelector('[data-key="1"]'));
		expect(document.body.querySelector('[data-key="1"]')?.getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(document.body.querySelector('.key-summary')?.textContent).toContain('G major');
		expect(document.body.querySelector('.scale-notes')?.textContent).toContain('F♯');
	});

	it('cancels an audition awaiting audio when the component is removed', async () => {
		const play = await setup();
		let finishWake: (() => void) | undefined;
		vi.mocked(engine.wake).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishWake = resolve;
				})
		);
		button('Hear the relative-minor chord').click();
		await unmount(component!);
		component = undefined;
		finishWake!();
		await tick();
		expect(play).not.toHaveBeenCalled();
	});

	it('releases sounding demonstration notes when the component is removed', async () => {
		const play = await setup();
		play.mockRestore();
		button('Hear the relative-minor chord').click();
		await vi.waitFor(() =>
			expect(engine.send).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'noteOn' }),
				expect.any(Number),
				expect.any(Number),
				'demo'
			)
		);
		await unmount(component!);
		component = undefined;
		expect(engine.send).toHaveBeenCalledWith(
			{ type: 'controlChange', channel: 0, controller: 123, value: 0 },
			undefined,
			undefined,
			'demo'
		);
	});

	it('keeps the latest chord sounding when an older resume finishes late', async () => {
		const play = await setup();
		play.mockRestore();
		let finishWake: (() => void) | undefined;
		vi.mocked(engine.wake)
			.mockResolvedValueOnce()
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						finishWake = resolve;
					})
			);
		button('Hear the relative-minor chord').click();
		await vi.waitFor(() => expect(engine.wake).toHaveBeenCalledTimes(2));
		button('Hear the parallel-minor chord').click();
		await vi.waitFor(() =>
			expect(document.body.querySelector('.listening-status')?.textContent).toContain(
				'Listening: C minor chord'
			)
		);
		finishWake!();
		await tick();
		await tick();
		expect(document.body.querySelector('.listening-status')?.textContent).toContain(
			'Listening: C minor chord'
		);
	});
});
