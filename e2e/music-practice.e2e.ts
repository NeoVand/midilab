import { expect, test } from '@playwright/test';

test('Act 0 exposes music practice and lets musicians start at Act I', async ({ page }) => {
	await page.goto('/learn');
	await expect(page.getByRole('heading', { name: 'Music basics' })).toBeVisible();
	await page.getByRole('link', { name: 'Start with Act I', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Control, not sound');
	for (const id of [
		'pulse-and-rhythm',
		'pitch-and-melody',
		'chords-and-movement',
		'bass-and-drums',
		'musical-expression',
		'first-composition'
	]) {
		await page.goto(`/learn/${id}`);
		await expect(page.getByRole('heading', { name: 'Prove it' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Open the Studio' })).toHaveAttribute(
			'href',
			/\/lab\/studio\?example=/
		);
	}
});

test('auditioning major and minor chords does not pass performer checkpoints', async ({ page }) => {
	await page.goto('/learn/just-enough-music');
	const major = page.getByRole('button', { name: 'Mark done: Play a major triad — root, +4, +7' });
	const minor = page.getByRole('button', { name: 'Mark done: Play a minor triad — root, +3, +7' });
	await page.getByRole('button', { name: 'C major, then C minor', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'C major, then C minor', exact: true })
	).toBeVisible({ timeout: 10000 });
	await expect(major).toHaveAttribute('aria-pressed', 'false');
	await expect(minor).toHaveAttribute('aria-pressed', 'false');
});

test('practice supplies a count-in and feedback for an empty attempt', async ({ page }) => {
	await page.goto('/learn/pulse-and-rhythm');
	const practice = page.locator('[data-practice="pulse-and-rhythm-pulse"]');
	await practice.getByRole('button', { name: 'Play it back', exact: true }).click();
	await expect(practice.getByText(/Count in:/)).toBeVisible();
	await expect(practice.getByText(/Play — beat/)).toBeVisible({ timeout: 8000 });
	await expect(practice.getByText('0 of 4 notes matched.', { exact: false })).toBeVisible({
		timeout: 10000
	});
	await expect(practice.getByText(/missing — leave the rests/)).toHaveCount(4);
	const pulse = page.getByRole('button', { name: 'Mark done: Keep four steady beats' });
	await expect(pulse).toHaveAttribute('aria-pressed', 'false');
	await practice.getByRole('button', { name: 'Slower retry' }).click();
	await expect(practice.getByText('62 BPM', { exact: true })).toBeVisible();
});

test('partial progress stays partial after leaving the lesson', async ({ page }) => {
	await page.goto('/learn/pulse-and-rhythm');
	await page.getByRole('button', { name: 'Mark done: Keep four steady beats' }).click();
	await expect(page.getByText('Self-checked', { exact: true })).toBeVisible();
	await page.goto('/learn');
	await expect(page.getByText(/0 of \d+ done/)).toBeVisible();
	await page.goto('/learn/pulse-and-rhythm');
	await expect(
		page.getByRole('button', { name: 'Mark done: Keep four steady beats' })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(
		page.getByRole('button', { name: 'Mark done: Keep counting through a rest' })
	).toHaveAttribute('aria-pressed', 'false');
});

test('computer playing after the count-in verifies a whole practice phrase', async ({ page }) => {
	await page.goto('/learn/pulse-and-rhythm');
	const practice = page.locator('[data-practice="pulse-and-rhythm-pulse"]');
	await practice.getByRole('button', { name: 'Play it back', exact: true }).click();
	for (let beat = 1; beat <= 4; beat++) {
		await page.waitForFunction(
			(expectedBeat) =>
				document
					.querySelector('[data-practice="pulse-and-rhythm-pulse"] [aria-live="polite"]')
					?.textContent?.trim() === expectedBeat,
			`Play — beat ${beat}, bar 1`,
			{ polling: 'raf', timeout: 8000 }
		);
		await page.keyboard.down('a');
		await page.waitForTimeout(60);
		await page.keyboard.up('a');
	}
	await expect(practice.getByText('You played the whole phrase in time.')).toBeVisible({
		timeout: 5000
	});
	await expect(page.getByText('Verified', { exact: true })).toBeVisible();
});

test('holding a key through a rest receives duration feedback instead of verification', async ({
	page
}) => {
	await page.goto('/learn/pulse-and-rhythm');
	const practice = page.locator('[data-practice="pulse-and-rhythm-rests"]');
	await practice.getByRole('button', { name: 'Play it back', exact: true }).click();
	await expect(practice.getByText(/Play — beat 1/)).toBeVisible({ timeout: 8000 });
	await page.keyboard.down('a');
	await expect(practice.getByText(/held too long — lift the key/)).toBeVisible({ timeout: 10000 });
	await page.keyboard.up('a');
	await expect(
		page.getByRole('button', { name: 'Mark done: Keep counting through a rest' })
	).toHaveAttribute('aria-pressed', 'false');
});
