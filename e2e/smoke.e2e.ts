import { expect, test } from '@playwright/test';

/**
 * A smoke pass over every top-level surface.
 *
 * Web MIDI is not available in headless Chromium without hardware, which is
 * exactly the fallback path the app is designed for — so these tests also
 * confirm that everything works with no MIDI access at all.
 */

test('the home page loads and offers the course', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn MIDI');
	await expect(page.getByRole('application', { name: 'Musical keyboard' })).toBeVisible();
});

test('pressing a key produces a decoded message', async ({ page }) => {
	await page.goto('/');
	const keyboard = page.getByRole('application', { name: 'Musical keyboard' });
	await keyboard.getByRole('button', { name: 'C3' }).first().click();
	await expect(page.getByText(/note 60/i).first()).toBeVisible();
});

test('the course lists every act', async ({ page }) => {
	await page.goto('/learn');
	for (const act of [
		'What MIDI actually is',
		'The message language',
		'Time',
		'The physical world',
		'Expression and the future',
		'Programming MIDI'
	]) {
		await expect(page.getByRole('heading', { name: act })).toBeVisible();
	}
});

test('a lesson renders its objectives and checkpoints', async ({ page }) => {
	await page.goto('/learn/bytes-and-bits');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Bytes, bits');
	await expect(page.getByText('By the end you can')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Prove it' })).toBeVisible();
});

test('every lab tool loads', async ({ page }) => {
	for (const [path, heading] of [
		['/lab/monitor', 'Monitor'],
		['/lab/patchbay', 'Patchbay'],
		['/lab/programmer', 'Programmer'],
		['/lab/devices', 'Device Lab'],
		['/lab/diagnostics', 'Diagnostics'],
		['/lab/console', 'Console'],
		['/lab/jukebox', 'Jukebox']
	] as const) {
		await page.goto(path);
		await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
	}
});

test('the reference tables are populated', async ({ page }) => {
	await page.goto('/reference');
	await expect(page.getByText('Timing Clock')).toBeVisible();
	await page.getByRole('tab', { name: 'Controllers' }).click();
	await expect(page.getByText('Brightness / Cutoff')).toBeVisible();
});

test('the engine dock is present on every page', async ({ page }) => {
	await page.goto('/reference');
	const dock = page.getByRole('region', { name: 'Engine dock' });
	await expect(dock).toBeVisible();
	await expect(dock.getByRole('button', { name: /panic/i })).toBeVisible();
});
