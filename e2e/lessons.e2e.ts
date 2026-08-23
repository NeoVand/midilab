import { expect, test } from '@playwright/test';
import { ALL_LESSONS } from '../src/lib/curriculum/registry';

/**
 * Every lesson must render without throwing.
 *
 * Lessons are components with live subscriptions, audio graph setup and
 * pointer handlers, so a broken one fails at runtime rather than at build
 * time. This catches that.
 */
test('every lesson renders cleanly', async ({ page }) => {
	const failures: string[] = [];

	page.on('pageerror', (err) => failures.push(`${page.url()} — ${err.message}`));
	page.on('console', (msg) => {
		if (msg.type() === 'error') failures.push(`${page.url()} — console: ${msg.text()}`);
	});

	for (const lesson of ALL_LESSONS) {
		await page.goto(`/learn/${lesson.id}`);
		await expect(page.getByRole('heading', { level: 1 })).toContainText(lesson.title);
		await expect(page.getByText('By the end you can')).toBeVisible();
	}

	expect(failures).toEqual([]);
});

test('the lesson list and the lesson files agree', async ({ page }) => {
	await page.goto('/learn');
	for (const lesson of ALL_LESSONS) {
		await expect(
			page.getByRole('link', { name: new RegExp(lesson.title, 'i') }).first()
		).toBeVisible();
	}
});
