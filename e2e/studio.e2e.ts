import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readMidiFile } from '../src/lib/midi/smf';
import type { StudioProject } from '../src/lib/studio/model';

const AUTOSAVE = 'midilab:studio:autosave:v1';

async function draft(page: Page): Promise<StudioProject> {
	return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), AUTOSAVE);
}

test('an example can become an edited, named project and a real MIDI file', async ({ page }) => {
	await page.goto('/lab/studio?example=night-drive');
	await expect(page.getByRole('heading', { name: 'Your first eight bars.' })).toBeVisible();
	await expect(page.getByLabel('Project name')).toHaveValue('Night Drive');
	await expect(page.getByLabel('BPM', { exact: true })).toHaveValue('116');

	const editor = page.getByRole('region', { name: 'Note editor' });
	await editor.getByRole('button', { name: /Select Bass Drum 1, start beat 1,/ }).click();
	await editor.getByLabel('Velocity', { exact: true }).fill('73');
	await editor.getByLabel('Velocity', { exact: true }).press('Tab');
	await expect.poll(async () => (await draft(page)).tracks[0].notes[0].velocity).toBe(73);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect.poll(async () => (await draft(page)).tracks[0].notes[0].velocity).toBe(110);
	await page.getByRole('button', { name: 'Redo', exact: true }).click();
	await expect(editor.getByLabel('Velocity', { exact: true })).toHaveValue('73');

	await page.getByLabel('Project name').fill('Midnight postcards');
	await page.getByRole('button', { name: 'Save project', exact: true }).click();
	await expect(
		page.getByLabel('Your saved tracks').getByRole('option', { name: 'Midnight postcards' })
	).toHaveCount(1);
	await page.reload();
	await expect(page.getByLabel('Project name')).toHaveValue('Midnight postcards');
	await expect.poll(async () => (await draft(page)).tracks[0].notes[0].velocity).toBe(73);

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export MIDI', exact: true }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/\.mid$/);
	const bytes = await readFile((await download.path())!);
	const file = readMidiFile(Uint8Array.from(bytes).buffer);
	expect(file.tracks).toHaveLength(5);
	const messages = file.tracks.flatMap((track) => track.events.map((event) => event.event));
	expect(messages).toContainEqual({ type: 'programChange', channel: 9, program: 25 });
	expect(messages).toContainEqual({ type: 'noteOn', channel: 9, note: 36, velocity: 73 });
});

test('computer keys record only the performed drum take', async ({ page }) => {
	await page.goto('/lab/studio');
	await expect(page.getByRole('button', { name: 'Record drums', exact: true })).toBeVisible();
	await page.getByLabel('Four-beat count-in').uncheck();
	await page.getByLabel('Replace this part').check();
	await page.getByLabel('BPM', { exact: true }).fill('220');
	await page.getByLabel('BPM', { exact: true }).press('Tab');
	await page.getByRole('button', { name: 'Record drums', exact: true }).click();
	await expect(page.getByText('Recording drums', { exact: false }).first()).toBeVisible();
	// Focus the instrument rather than a toolbar button; form and button shortcuts stay inert.
	await page.getByRole('button', { name: 'Use computer keys', exact: true }).click();
	await page.keyboard.press('q', { delay: 120 });
	await page.keyboard.press('w', { delay: 120 });
	await page.getByRole('button', { name: 'Keep this take', exact: true }).click();
	await expect(page.getByText('2 notes recorded.', { exact: false })).toBeVisible();
	const project = await draft(page);
	expect(project.tracks[0].notes.map((note) => note.note)).toEqual([36, 38]);
	expect(project.tracks[0].notes.every((note) => note.duration > 0)).toBe(true);
	expect(project.tracks[1].notes.length).toBeGreaterThan(0);
});

test('invalid project import keeps the current music', async ({ page }) => {
	await page.goto('/lab/studio?example=sunlit-pop');
	await expect(page.getByLabel('Project name')).toHaveValue('Sunlit Pop');
	await page.getByLabel('Import MIDI Lab Studio project').setInputFiles({
		name: 'broken.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{"version":1,"tracks":[]}')
	});
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByLabel('Project name')).toHaveValue('Sunlit Pop');
	await expect(page.getByRole('button', { name: /Edit Melody, bar 1, \d+ notes/ })).toBeVisible();
});

test('starter switches, saved projects and imported backups survive reloads', async ({ page }) => {
	await page.goto('/lab/studio?example=pocket-soul');
	await page.getByRole('radio', { name: 'Night Drive', exact: true }).click();
	await expect(page).toHaveURL(/example=night-drive/);
	await expect(page.getByLabel('Project name')).toHaveValue('Night Drive');
	await page.getByLabel('Project name').fill('After hours');
	await page.getByLabel('Project name').press('Tab');
	await page.reload();
	await expect(page.getByLabel('Project name')).toHaveValue('After hours');

	await page.getByLabel('Your saved tracks').selectOption({ label: 'Pocket Soul' });
	await expect(page).toHaveURL(/\/lab\/studio$/);
	await expect(page.getByLabel('Project name')).toHaveValue('Pocket Soul');
	await page.reload();
	await expect(page.getByLabel('Project name')).toHaveValue('Pocket Soul');
	const backup = await draft(page);
	backup.title = 'My restored pocket';
	await page.getByRole('radio', { name: 'Night Drive', exact: true }).click();
	await expect(page).toHaveURL(/example=night-drive/);
	await page.getByLabel('Import MIDI Lab Studio project').setInputFiles({
		name: 'pocket.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(backup))
	});
	await expect(page).toHaveURL(/\/lab\/studio$/);
	await expect(page.getByLabel('Project name')).toHaveValue('My restored pocket');
	await page.reload();
	await expect(page.getByLabel('Project name')).toHaveValue('My restored pocket');
});

test('the studio fits a phone while its arrangement can scroll independently', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/lab/studio');
	await expect(page.getByRole('heading', { name: 'Your first eight bars.' })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
	await page.getByRole('button', { name: 'Melody Channel 4', exact: true }).click();
	await expect(page.getByRole('application', { name: 'Musical keyboard' })).toBeVisible();
	await page.getByRole('button', { name: 'Add note', exact: true }).click();
	await expect(page.getByLabel('Length in beats')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
