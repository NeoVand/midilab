import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import Keyboard from './Keyboard.svelte';
import PadGrid from './PadGrid.svelte';
import VoicePicker from './VoicePicker.svelte';
import { engine } from '$lib/midi/engine.svelte';
import '../../../routes/layout.css';

let component: ReturnType<typeof mount> | undefined;

afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	engine.channel = 0;
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

function container(width: number) {
	const target = document.createElement('div');
	target.style.width = `${width}px`;
	document.body.append(target);
	return target;
}

function assertReadableControls(target: HTMLElement) {
	const group = target.querySelector<HTMLElement>('[data-slot="field-group"]')!;
	const bounds = target.getBoundingClientRect();
	expect(group.getBoundingClientRect().width).toBeCloseTo(bounds.width, 0);
	const children = Array.from(group.children).map((child) => child.getBoundingClientRect());
	for (const child of children) {
		expect(child.right).toBeLessThanOrEqual(bounds.right + 1);
		expect(child.left).toBeGreaterThanOrEqual(bounds.left - 1);
	}
	for (let a = 0; a < children.length; a++) {
		for (let b = a + 1; b < children.length; b++) {
			const overlapWidth =
				Math.min(children[a].right, children[b].right) -
				Math.max(children[a].left, children[b].left);
			const overlapHeight =
				Math.min(children[a].bottom, children[b].bottom) -
				Math.max(children[a].top, children[b].top);
			expect(overlapWidth > 1 && overlapHeight > 1).toBe(false);
		}
	}
	for (const select of target.querySelectorAll('select')) {
		const label = target.querySelector<HTMLLabelElement>(`label[for="${select.id}"]`)!;
		expect(select.selectedOptions[0]?.textContent?.trim()).toBeTruthy();
		expect(select.getBoundingClientRect().width).toBeGreaterThanOrEqual(
			label.textContent === 'Channel' ? 100 : 140
		);
		expect(label.getBoundingClientRect().right).toBeLessThan(select.getBoundingClientRect().left);
	}
}

describe('instrument controls fit their container', () => {
	it.each([216, 264, 512, 768])('keeps keyboard controls readable at %ipx', async (width) => {
		const target = container(width);
		component = mount(Keyboard, { target, props: { typing: false } });
		await tick();
		assertReadableControls(target);
		expect(target.querySelectorAll('select')[0].selectedOptions[0].textContent).toBe('1');
		expect(target.querySelectorAll('select')[1].selectedOptions[0].textContent).toBe(
			'Touch dynamics'
		);
	});

	it.each([216, 264, 512, 768])('keeps drum controls readable at %ipx', async (width) => {
		const target = container(width);
		component = mount(PadGrid, { target, props: { typing: false } });
		await tick();
		assertReadableControls(target);
		expect(target.querySelector('select')!.selectedOptions[0].textContent).toBe('Touch dynamics');
	});

	it('shows fixed values and updates selectable values', async () => {
		const target = container(264);
		component = mount(Keyboard, { target, props: { channel: 9, velocity: 80, typing: false } });
		await tick();
		const [channel, velocity] = target.querySelectorAll('select');
		expect(channel.disabled).toBe(true);
		expect(channel.selectedOptions[0].textContent).toBe('10 · drums');
		expect(velocity.disabled).toBe(true);
		expect(velocity.selectedOptions[0].textContent).toBe('80 · fixed');
		assertReadableControls(target);
		await unmount(component);
		component = mount(Keyboard, { target, props: { typing: false } });
		await tick();
		const [editableChannel, editableVelocity] = target.querySelectorAll('select');
		editableChannel.value = '9';
		editableChannel.dispatchEvent(new Event('change', { bubbles: true }));
		editableVelocity.value = '48';
		editableVelocity.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(engine.channel).toBe(9);
		expect(editableChannel.selectedOptions[0].textContent).toBe('10 · drums');
		expect(editableVelocity.selectedOptions[0].textContent).toBe('Soft · 48');
		assertReadableControls(target);
	});

	it('keeps a long instrument name inside a narrow trigger', async () => {
		const target = container(90);
		component = mount(VoicePicker, { target, props: { value: 2, audition: false } });
		await tick();
		const trigger = target.querySelector('button')!;
		expect(trigger.textContent).toContain('Electric Grand Piano');
		expect(trigger.getBoundingClientRect().width).toBeLessThanOrEqual(90);
		expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth);
	});
});
