import { expect, test } from '@playwright/test';

/**
 * The phone layout, checked as a phone.
 *
 * Playwright's default project is a desktop Chromium, so none of the other
 * suites would notice the shell swapping over — and a layout that only one
 * person ever looks at in one window size is a layout that quietly rots.
 * These run at 375×812 with touch on, which is what the media queries the
 * phone layout is built from are actually asking about.
 */
test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test('navigation moves to the bottom and the rail stands down', async ({ page }) => {
	await page.goto('/');
	const bars = page.locator('nav[aria-label="Primary"]');
	// Both exist in the markup; exactly one is ever displayed, which also keeps
	// the accessibility tree to a single navigation landmark.
	await expect(bars).toHaveCount(2);
	await expect(bars.filter({ visible: true })).toHaveCount(1);

	const tabs = page.getByRole('navigation', { name: 'Primary' }).getByRole('link');
	await expect(tabs.first()).toBeVisible();
	for (const label of ['Play', 'Learn', 'Lab', 'Tables']) {
		const box = await page.getByRole('link', { name: label, exact: true }).boundingBox();
		expect(box, `${label} tab`).not.toBeNull();
		// Apple asks for 44 pt; these are the app's primary navigation.
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.width).toBeGreaterThanOrEqual(44);
	}
});

test('the keyboard gives its keys room for a finger', async ({ page }) => {
	await page.goto('/');
	const keys = page.locator('[data-playable]');
	await expect(keys.first()).toBeVisible();
	const box = await keys.first().boundingBox();
	// Three octaves across a phone is a white key ten pixels wide. The window
	// narrows until they are playable; the rest of the range moves to buttons.
	expect(box!.width).toBeGreaterThanOrEqual(28);
	await expect(page.getByRole('button', { name: 'Up an octave' })).toBeVisible();
	// And the caption for a keyboard the reader does not have is gone.
	await expect(page.getByText('shift octave with')).toHaveCount(0);
});

test('a page header stacks instead of squeezing its lead to one word', async ({ page }) => {
	await page.goto('/lab/monitor');
	const lead = page.getByText('Three views of the same stream', { exact: false });
	await expect(lead).toBeVisible();
	const box = await lead.boundingBox();
	// The bug: the actions row would not shrink, so the lead absorbed the whole
	// shortfall and came out about forty pixels wide.
	expect(box!.width).toBeGreaterThan(240);
});

test('the analyser draws at a density the width can show', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Output' }).click();
	const scope = page.getByRole('img', { name: /Live spectrum/ });
	await expect(scope).toBeVisible();
	await expect(scope).toHaveAttribute('aria-label', /third of an octave/);
	// Nine octave labels collide across 375 px; every other one does not.
	const labels = page.locator('.tnum.absolute');
	await expect(labels).toHaveCount(4);
});

test('the mobile landing keeps playing close and its destinations reachable', async ({ page }) => {
	await page.goto('/');
	const keyboard = page.getByRole('application', { name: 'Musical keyboard' });
	await expect(keyboard).toBeVisible();
	// The welcome now belongs on phones too, but the instrument should remain
	// close to the introduction rather than below a long marketing page.
	const keyboardBox = await keyboard.boundingBox();
	expect(keyboardBox!.y).toBeLessThan(812);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(
		page.locator('main a[href$="/learn"]').filter({ visible: true }).first()
	).toBeVisible();
	await expect(page.locator('a[href$="/lab/studio"]').first()).toBeVisible();
	await expect(page.locator('a[href$="/lab/mpe"]').first()).toBeVisible();
	const overflow = await page.evaluate(() => {
		const main = document.querySelector('main')!;
		return main.scrollWidth - main.clientWidth;
	});
	expect(overflow).toBeLessThanOrEqual(1);
});

test('the display sizes come down to meet the width', async ({ page }) => {
	await page.goto('/learn');
	const h1 = page.getByRole('heading', { level: 1 }).first();
	const size = await h1.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
	// 32 px is proportioned against a thousand pixels of width, not 375.
	expect(size).toBeLessThanOrEqual(26);
	expect(size).toBeGreaterThanOrEqual(20);
});
