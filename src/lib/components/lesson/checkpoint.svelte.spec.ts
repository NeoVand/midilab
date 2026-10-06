import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRawSnippet, mount, unmount, tick } from 'svelte';
import Checkpoint from './Checkpoint.svelte';
import Checkpoints from './Checkpoints.svelte';
import { progress } from '$lib/curriculum/progress.svelte';
import { bus, type MidiOrigin } from '$lib/midi/bus';

let component: ReturnType<typeof mount> | undefined;
let progressPanel: ReturnType<typeof mount> | undefined;
beforeEach(() => progress.reset());
afterEach(async () => {
	if (component) await unmount(component);
	if (progressPanel) await unmount(progressPanel);
	component = undefined;
	progressPanel = undefined;
	document.body.replaceChildren();
	progress.reset();
});

function note(origin: MidiOrigin) {
	bus.emit({
		time: performance.now(),
		portId: 'test',
		portName: 'Test',
		direction: 'out',
		bytes: [0x90, 60, 90],
		message: { type: 'noteOn', channel: 0, note: 60, velocity: 90 },
		origin
	});
}

describe('checkpoint evidence', () => {
	it('rejects demos and sequences for performer-only objectives', async () => {
		component = mount(Checkpoint, {
			target: document.body,
			props: {
				lesson: 'pulse-and-rhythm',
				id: 'pulse',
				label: 'Play the pulse',
				learnerOnly: true,
				test: () => true
			}
		});
		await tick();
		note('demo');
		note('sequence');
		expect(progress.isDone('pulse-and-rhythm', 'pulse')).toBe(false);
		note('performer');
		expect(progress.isVerified('pulse-and-rhythm', 'pulse')).toBe(true);
		await unmount(component);
		component = undefined;
		expect(progress.totalFor('pulse-and-rhythm')).toBe(3);
		expect(progress.isLessonComplete('pulse-and-rhythm')).toBe(false);
	});
	it('labels manual checks separately and upgrades them after real evidence', async () => {
		progressPanel = mount(Checkpoints, {
			target: document.body,
			props: {
				lesson: 'pulse-and-rhythm',
				children: createRawSnippet(() => ({ render: () => '<span></span>' }))
			}
		});
		component = mount(Checkpoint, {
			target: document.body,
			props: {
				lesson: 'pulse-and-rhythm',
				id: 'pulse',
				label: 'Play the pulse',
				learnerOnly: true,
				test: () => true
			}
		});
		await tick();
		expect(document.body.textContent).toContain('0/3');
		(document.body.querySelector('button') as HTMLButtonElement).click();
		await tick();
		expect(progress.isDone('pulse-and-rhythm', 'pulse')).toBe(true);
		expect(progress.isVerified('pulse-and-rhythm', 'pulse')).toBe(false);
		expect(document.body.textContent).toContain('Self-checked');
		expect(document.body.textContent).toContain('1/3');
		note('performer');
		await tick();
		expect(document.body.textContent).toContain('Verified');
		expect(document.body.textContent).toContain('1/3');
		(document.body.querySelector('button') as HTMLButtonElement).click();
		await tick();
		expect(document.body.textContent).toContain('0/3');
		expect(document.body.textContent).not.toContain('Verified');
		expect(progress.fractionOf(['pulse-and-rhythm'])).toBe(0);
	});
	it('preserves sequencer evidence for protocol objectives while rejecting demos', async () => {
		component = mount(Checkpoint, {
			target: document.body,
			props: {
				lesson: 'building-a-sequencer',
				id: 'pattern',
				label: 'Play the sequencer',
				test: () => true
			}
		});
		await tick();
		note('demo');
		expect(progress.isDone('building-a-sequencer', 'pattern')).toBe(false);
		note('sequence');
		expect(progress.isVerified('building-a-sequencer', 'pattern')).toBe(true);
	});
});
