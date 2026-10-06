import { expect, test, type Page } from '@playwright/test';

async function verified(page: Page) {
	return page.evaluate(() => {
		const stored = JSON.parse(localStorage.getItem('midilab:progress') ?? '{}');
		return stored.done?.mpe ?? [];
	});
}

async function openPlayground(page: Page, path = '/lab/mpe') {
	await page.goto(path);
	const lab = page.getByRole('region', { name: 'Expression Playground', exact: true });
	await expect(lab.getByLabel('MPE input', { exact: true })).toHaveValue('surface');
	return lab;
}

test('Lab discovery opens a complete instrument and keyboard controls move just one voice', async ({
	page
}) => {
	await page.goto('/lab');
	await page.locator('a[href$="/lab/mpe"]').click();
	await expect(page.getByRole('heading', { name: 'MPE Playground', exact: true })).toBeVisible();
	const lab = page.getByRole('region', { name: 'Expression Playground', exact: true });
	await expect(lab.getByRole('button', { name: 'All notes off', exact: true })).toBeDisabled();
	await expect(lab.getByRole('button', { name: 'Stop example', exact: true })).toBeDisabled();
	await lab.getByRole('button', { name: 'Hold C2', exact: true }).focus();
	await page.keyboard.press('Space');
	await lab.getByRole('button', { name: 'Hold E2', exact: true }).focus();
	await page.keyboard.press('Enter');
	const anchor = lab.locator('[data-mpe-note="1:48"]');
	const moving = lab.locator('[data-mpe-note="2:52"]');
	await expect(anchor).toContainText('+0.00');
	await expect(moving).toContainText('+0.00');
	for (const label of [
		'Selected note bend in semitones',
		'Selected note pressure',
		'Selected note CC74'
	]) {
		await lab.getByRole('slider', { name: label, exact: true }).focus();
		await page.keyboard.press('End');
	}
	await expect(moving).toContainText('+2.00');
	await expect(moving).toContainText('effective 127');
	await expect(anchor).toContainText('+0.00');
	await expect(anchor).toContainText('effective 38');
	await expect(anchor).toContainText('effective 58');
	await expect(lab.locator('[data-challenge]').getByText('Performed', { exact: true })).toHaveCount(
		3
	);
	await lab.getByRole('button', { name: 'All notes off', exact: true }).click();
	await expect(lab.locator('[data-mpe-note]')).toHaveCount(0);
	await expect(
		lab.getByRole('slider', { name: 'Selected note pressure', exact: true })
	).toBeDisabled();
});

test('listening examples never verify playing and real independent gestures complete the chapter', async ({
	page
}) => {
	const lab = await openPlayground(page, '/learn/mpe');
	await expect(
		page.getByRole('navigation', { name: 'In this chapter', exact: true })
	).toBeVisible();
	await lab.getByRole('radio', { name: 'Let one voice bloom', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop example', exact: true })).toBeDisabled();
	const before = await verified(page);
	await lab.getByRole('button', { name: 'Hear gesture', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop example', exact: true })).toBeEnabled();
	await expect(lab.locator('[data-mpe-note]')).toHaveCount(3);
	await expect(lab.getByRole('progressbar', { name: 'Listening example progress' })).toBeVisible();
	await expect.poll(() => verified(page)).toEqual(before);
	await lab.getByRole('button', { name: 'Stop example', exact: true }).click();
	await lab.getByText('Zone & range diagnostics', { exact: true }).click();
	await lab.getByRole('button', { name: 'Apply local zone', exact: true }).click();
	await lab.getByRole('button', { name: 'Hold C2', exact: true }).click();
	await lab.getByRole('button', { name: 'Hold G2', exact: true }).click();
	for (const label of [
		'Selected note bend in semitones',
		'Selected note pressure',
		'Selected note CC74'
	]) {
		await lab.getByRole('slider', { name: label, exact: true }).focus();
		await page.keyboard.press('End');
	}
	await expect
		.poll(() => verified(page))
		.toEqual(expect.arrayContaining(['configure', 'member', 'per-note-bend', 'pressure', 'slide']));
});

test('switching or stopping an example releases bus notes and cancels its future answer', async ({
	page
}) => {
	const lab = await openPlayground(page);
	await lab.getByRole('radio', { name: 'Color an answer', exact: true }).click();
	await lab.getByRole('button', { name: 'Hear gesture', exact: true }).click();
	await expect(lab.locator('[data-mpe-note="2:67"]')).toHaveCount(1);
	await page.getByRole('button', { name: 'Expand dock', exact: true }).click();
	const dock = page.getByRole('region', { name: 'Engine dock', exact: true });
	await dock.getByRole('tab', { name: 'State', exact: true }).click();
	await expect(dock.getByText('1 held', { exact: true })).toHaveCount(2);
	await lab.getByRole('radio', { name: 'Let one voice bloom', exact: true }).click();
	await expect(dock.getByText('1 held', { exact: true })).toHaveCount(0);
	await expect(lab.getByRole('button', { name: 'Stop example', exact: true })).toBeDisabled();
	await lab.getByRole('button', { name: 'Hear gesture', exact: true }).click();
	await expect(dock.getByText('1 held', { exact: true })).toHaveCount(3);
	await lab.getByRole('button', { name: 'Stop example', exact: true }).click();
	await expect(dock.getByText('1 held', { exact: true })).toHaveCount(0);
	// The earlier color example would create a fresh answer note at 2.5 seconds.
	await page.waitForTimeout(2800);
	await expect(dock.getByText('1 held', { exact: true })).toHaveCount(0);
	await expect(lab.locator('[data-mpe-note]')).toHaveCount(0);
});

test('touch starts at the struck pitch, bends from there, and releases on pointer cancel', async ({
	page
}) => {
	const lab = await openPlayground(page);
	const surface = lab.getByRole('group', { name: 'MPE touch surface', exact: true });
	await surface.scrollIntoViewIfNeeded();
	const box = (await surface.boundingBox())!;
	const x = box.x + box.width * 0.43;
	const y = box.y + box.height * 0.6;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await expect(lab.locator('[data-mpe-note]')).toHaveCount(1);
	await expect(lab.locator('.voice-pitch')).toContainText('+0.00');
	await page.mouse.move(x + box.width * 0.04, y - box.height * 0.2, { steps: 5 });
	await expect(lab.locator('.voice-pitch')).not.toContainText('+0.00');
	await surface.dispatchEvent('pointercancel', { pointerId: 1 });
	await page.mouse.up();
	await expect(lab.locator('[data-mpe-note]')).toContainText('released');
	await expect(lab.getByText('0 sounding voices', { exact: true })).toBeVisible();
});

test('Panic, window blur and leaving the page stop examples and local held notes', async ({
	page
}) => {
	const lab = await openPlayground(page);
	await lab.getByRole('button', { name: 'Hear gesture', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop example', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Panic', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop example', exact: true })).toBeDisabled();
	await expect(lab.locator('[data-mpe-note]')).toHaveCount(0);
	await lab.getByRole('button', { name: 'Hold C2', exact: true }).click();
	await page.evaluate(() => window.dispatchEvent(new Event('blur')));
	await expect(lab.locator('[data-mpe-note]')).toHaveCount(0);
	await lab.getByRole('button', { name: 'Hear gesture', exact: true }).click();
	await expect(lab.getByRole('button', { name: 'Stop example', exact: true })).toBeEnabled();
	await page.getByRole('link', { name: 'The Lab', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'The Lab', exact: true })).toBeVisible();
	await page.locator('a[href$="/lab/monitor"]').click();
	await page.getByRole('button', { name: 'State', exact: true }).click();
	await expect(page.getByText('1 held', { exact: true })).toHaveCount(0);
});

test('expression graphics follow a live theme change and the full chapter fits a phone', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('midilab:theme', JSON.stringify('light')));
	const lab = await openPlayground(page);
	await lab.getByRole('button', { name: 'Hold C2', exact: true }).click();
	const surface = lab.locator('.expression-figure');
	const light = await surface.evaluate((element) => getComputedStyle(element).backgroundColor);
	const lightText = await lab
		.locator('.pressure-label')
		.first()
		.evaluate((element) => getComputedStyle(element).fill);
	await page.getByRole('button', { name: 'Switch to the dark theme', exact: true }).click();
	await expect
		.poll(() => surface.evaluate((element) => getComputedStyle(element).backgroundColor))
		.not.toBe(light);
	await expect
		.poll(() =>
			lab
				.locator('.pressure-label')
				.first()
				.evaluate((element) => getComputedStyle(element).fill)
		)
		.not.toBe(lightText);
	await expect(lab.locator('[data-mpe-note="1:48"]')).toContainText('held');
	await page.setViewportSize({ width: 390, height: 844 });
	for (const path of ['/lab/mpe', '/learn/mpe']) {
		await page.goto(path);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390
		);
		const phoneLab = page.getByRole('region', { name: 'Expression Playground', exact: true });
		await phoneLab.getByRole('button', { name: 'Hold E2', exact: true }).click();
		await expect(phoneLab.locator('[data-mpe-note]')).toContainText('held');
		await phoneLab.getByRole('button', { name: 'All notes off', exact: true }).click();
	}
});
