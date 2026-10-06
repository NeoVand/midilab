import { expect, test, type Page } from '@playwright/test';

async function verified(page: Page) {
	return page.evaluate(() => {
		const data = JSON.parse(localStorage.getItem('midilab:progress') ?? '{}');
		return Object.values(data.done ?? {}).flat();
	});
}

test('roughness controls connect tuning, timbre and the partial spectrum without autoplay', async ({
	page
}) => {
	await page.goto('/learn/chords-and-movement');
	const lab = page.getByRole('region', { name: 'Hear the landscape', exact: true });
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
	await expect(lab.getByRole('slider', { name: /Interval 1/ })).toHaveAttribute(
		'aria-valuenow',
		'4'
	);
	await expect(lab.getByRole('slider', { name: /Interval 2/ })).toHaveAttribute(
		'aria-valuenow',
		'7'
	);
	await expect(lab.locator('[data-graphics]')).toHaveAttribute('data-graphics', 'ready');
	const middleSurface = await lab.locator('canvas').screenshot();
	await lab.getByLabel('Base register', { exact: true }).selectOption('130.8128');
	await expect(lab.locator('.readout')).toContainText('130.8 Hz / 164.8 Hz / 196.0 Hz');
	await expect
		.poll(async () => (await lab.locator('canvas').screenshot()).equals(middleSurface))
		.toBe(false);
	await lab.getByLabel('Base register', { exact: true }).selectOption('261.6256');
	const original = await lab.locator('.readout').innerText();
	await lab.getByRole('radio', { name: 'Pure tones', exact: true }).click();
	await expect(lab.locator('.tone-row line:not(.partial-baseline)')).toHaveCount(3);
	await expect(lab.locator('.readout')).not.toHaveText(original);
	await expect(lab.getByRole('slider', { name: /Interval 1/ })).toHaveAttribute(
		'aria-valuenow',
		'4'
	);
	await lab.getByRole('radio', { name: 'Stretched partials', exact: true }).click();
	await expect(lab.locator('.tone-row line:not(.partial-baseline)')).toHaveCount(18);
	await lab.getByRole('radio', { name: 'Pure-ratio major', exact: true }).click();
	expect(
		Number(await lab.getByRole('slider', { name: /Interval 1/ }).getAttribute('aria-valuenow'))
	).toBeCloseTo(12 * Math.log2(5 / 4), 2);
	expect(
		Number(await lab.getByRole('slider', { name: /Interval 2/ }).getAttribute('aria-valuenow'))
	).toBeCloseTo(12 * Math.log2(3 / 2), 2);
	await lab.getByRole('radio', { name: 'Harmonic partials', exact: true }).click();
	await expect(lab.locator('.readout')).toContainText('Model estimate 0.0174');
	await expect(lab.locator('.interval-detail').first()).toContainText('1.250 : 1');
	await expect(lab.locator('.interval-detail').last()).toContainText('1.500 : 1');
	await expect(lab.getByText(/third is slightly flatter/)).toBeVisible();
	await lab.getByRole('slider', { name: /Interval 1/ }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
	await expect(
		page.getByRole('heading', { name: 'Where this came from', exact: true })
	).toHaveCount(1);
});

test('surface taps choose and audition a chord while orbit gestures only move the view', async ({
	page
}) => {
	await page.goto('/learn/chords-and-movement');
	const lab = page.getByRole('region', { name: 'Hear the landscape', exact: true });
	const graph = lab.locator('[data-graphics]');
	await expect(graph).toHaveAttribute('data-graphics', 'ready');
	await lab.getByRole('button', { name: 'Top view', exact: true }).click();
	const canvas = lab.locator('canvas');
	await canvas.click({
		position: {
			x: (await canvas.boundingBox())!.width / 2,
			y: (await canvas.boundingBox())!.height / 2
		}
	});
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
	expect(
		Number(await lab.getByRole('slider', { name: /Interval 1/ }).getAttribute('aria-valuenow'))
	).toBeCloseTo(12 * Math.log2(1.5), 0);
	expect(
		Number(await lab.getByRole('slider', { name: /Interval 2/ }).getAttribute('aria-valuenow'))
	).toBeCloseTo(12 * Math.log2(1.5), 0);
	await lab.getByRole('button', { name: 'Stop', exact: true }).click();
	const first = await lab.getByRole('slider', { name: /Interval 1/ }).getAttribute('aria-valuenow');
	const second = await lab
		.getByRole('slider', { name: /Interval 2/ })
		.getAttribute('aria-valuenow');
	const box = (await canvas.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 30, { steps: 8 });
	await page.mouse.up();
	await expect(lab.getByRole('slider', { name: /Interval 1/ })).toHaveAttribute(
		'aria-valuenow',
		first!
	);
	await expect(lab.getByRole('slider', { name: /Interval 2/ })).toHaveAttribute(
		'aria-valuenow',
		second!
	);
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
});

test('WebGL failure keeps a useful tuning map, keyboard controls and sound', async ({ page }) => {
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (type, ...args) {
			if (String(type).startsWith('webgl')) return null;
			return Reflect.apply(original, this, [type, ...args]);
		} as typeof original;
	});
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/learn/chords-and-movement');
	const lab = page.getByRole('region', { name: 'Hear the landscape', exact: true });
	await expect(lab.locator('[data-graphics]')).toHaveAttribute('data-graphics', 'fallback');
	await expect(lab.getByText(/3D graphics are unavailable/)).toBeVisible();
	await expect(lab.getByRole('img', { name: /Top view of roughness/ })).toBeVisible();
	await lab.getByRole('radio', { name: 'Minor', exact: true }).click();
	await expect(lab.getByRole('slider', { name: /Interval 1/ })).toHaveAttribute(
		'aria-valuenow',
		'3'
	);
	await lab.getByRole('button', { name: 'Hear chord', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Panic', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
	expect(errors).toEqual([]);
});

test('additive and MIDI demonstrations replace each other and never verify learner progress', async ({
	page
}) => {
	await page.goto('/learn/chords-and-movement');
	const lab = page.getByRole('region', { name: 'Hear the landscape', exact: true });
	const circle = page.getByRole('region', { name: 'A map of musical neighbours', exact: true });
	const before = await verified(page);
	await lab.getByRole('button', { name: 'Hear chord', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
	await circle.getByRole('button', { name: 'Hear ii–V–I', exact: true }).click();
	await expect(circle.getByText(/Listening:/)).toBeVisible();
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
	await lab.getByRole('button', { name: 'Hear chord', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
	await expect(circle.getByText(/Listening:/)).toHaveCount(0);
	await expect.poll(() => verified(page)).toEqual(before);
	await page.evaluate(() => window.dispatchEvent(new Event('blur')));
	await expect(lab.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();
});

test('phrase comparisons reveal real shape, contextual endings and motif variation', async ({
	page
}) => {
	await page.goto('/learn/musical-expression');
	const lab = page.locator('.musicality-lab');
	await expect(lab.getByRole('button', { name: 'Stop phrases', exact: true })).toBeDisabled();
	const a = lab.locator('.phrase-0');
	const b = lab.locator('.phrase-1');
	const widths = async (selector: string) =>
		lab
			.locator(selector)
			.evaluateAll((elements) => elements.map((element) => element.getAttribute('width')));
	expect(await widths('.phrase-0 .ribbon')).not.toEqual(await widths('.phrase-1 .ribbon'));
	const before = await verified(page);
	await a.getByRole('button', { name: 'Hear A: Even delivery', exact: true }).click();
	await expect(a.locator('.playhead')).toHaveCount(1);
	await expect
		.poll(async () => Number(await a.locator('.playhead').getAttribute('x1')))
		.toBeGreaterThan(48);
	await b.getByRole('button', { name: 'Hear B: Shaped phrase', exact: true }).click();
	await expect(a.locator('.playhead')).toHaveCount(0);
	await expect(b.locator('.playhead')).toHaveCount(1);
	await lab.getByRole('radio', { name: 'Question & answer', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop phrases', exact: true })).toBeDisabled();
	await expect(a.getByText('Harmony: C → G7 → G7', { exact: true })).toBeVisible();
	await expect(b.getByText('Harmony: C → G7 → C', { exact: true })).toBeVisible();
	await lab.getByRole('radio', { name: 'Repeat & vary', exact: true }).click();
	await expect(a.locator('.note-label')).toHaveText(['C', 'E', 'G', 'E', 'C', 'E', 'G', 'E']);
	await expect(b.locator('.note-label')).toHaveText(['C', 'E', 'G', 'E', 'C', 'E', 'A', 'G']);
	await b.getByRole('button', { name: 'Hear B: Change the destination', exact: true }).click();
	await expect(b.locator('.playhead')).toHaveCount(1);
	await page.getByRole('button', { name: 'Panic', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop phrases', exact: true })).toBeDisabled();
	expect(await verified(page)).toEqual(before);
});

test('phone-sized music explorers fit the page and keep their controls reachable', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	for (const id of ['chords-and-movement', 'musical-expression']) {
		await page.goto(`/learn/${id}`);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390
		);
	}
	await page.getByRole('radio', { name: 'Repeat & vary', exact: true }).click();
	await page.getByRole('button', { name: 'Hear B: Change the destination', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Stop phrases', exact: true })).toBeEnabled();
});

test('ratio surface and phrase graphics repaint when the app theme changes', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('midilab:theme', JSON.stringify('light')));
	await page.goto('/learn/chords-and-movement');
	const lab = page.getByRole('region', { name: 'Hear the landscape', exact: true });
	await expect(lab.locator('[data-graphics]')).toHaveAttribute('data-graphics', 'ready');
	await expect(lab.locator('.landscape')).toHaveAttribute('data-theme', 'light');
	await expect(lab.locator('canvas')).toHaveAttribute(
		'aria-label',
		/Horizontal axes show frequency ratios from one to two/
	);
	await expect(
		lab.getByText('Contour lines on the floor join equal roughness estimates.')
	).toBeVisible();
	await expect(lab.locator('.height-legend')).toContainText('0.075');
	const lightCanvas = await lab.locator('canvas').screenshot();
	await page.getByRole('button', { name: 'Switch to the dark theme', exact: true }).click();
	await expect(lab.locator('.landscape')).toHaveAttribute('data-theme', 'dark');
	await expect
		.poll(async () => (await lab.locator('canvas').screenshot()).equals(lightCanvas))
		.toBe(false);
	const background = await lab.locator('canvas').evaluate((canvas) => {
		const context = canvas.getContext('webgl2')!;
		return Array.from(context.getParameter(context.COLOR_CLEAR_VALUE) as Float32Array);
	});
	expect(Math.max(...background.slice(0, 3))).toBeLessThan(0.2);
	await page.goto('/learn/musical-expression');
	const phrase = page.locator('.phrase-0 svg');
	const lightPhrase = await phrase.evaluate((element) => getComputedStyle(element).backgroundColor);
	await page.getByRole('button', { name: 'Switch to the dark theme', exact: true }).click();
	await expect
		.poll(() => phrase.evaluate((element) => getComputedStyle(element).backgroundColor))
		.not.toBe(lightPhrase);
	await expect(page.locator('.phrase-0 .note-label').first()).toBeVisible();
});
