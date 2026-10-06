import { expect, test } from '@playwright/test';

test('lesson keyboards expose sound, channel, dynamics, sustain, and octave controls', async ({
	page
}) => {
	await page.goto('/learn/note-on-off');
	const instrument = page.getByRole('group', { name: 'Keyboard instrument', exact: true });
	await expect(instrument.getByTitle("Choose this keyboard's instrument")).toBeVisible();
	await expect(instrument.getByLabel('Channel', { exact: true })).toBeVisible();
	await expect(instrument.getByLabel('Velocity', { exact: true })).toBeVisible();
	await expect(instrument.getByRole('button', { name: 'Sustain', exact: true })).toBeVisible();
	await expect(instrument.getByRole('button', { name: 'Up an octave', exact: true })).toBeVisible();
	await instrument.getByTitle("Choose this keyboard's instrument").click();
	await page.getByRole('button', { name: '40 Violin', exact: true }).click();
	await expect(instrument.getByTitle("Choose this keyboard's instrument")).toHaveText('Violin');
	await page.getByRole('link', { name: 'MIDI Lab home', exact: true }).click();
	await expect(page.getByTitle("Choose this keyboard's instrument")).toHaveText('Violin');
});

test('computer keys belong exclusively to the last activated piano or drum surface', async ({
	page
}) => {
	await page.goto('/learn/channels');
	const piano = page.getByRole('group', { name: 'Keyboard instrument', exact: true });
	const pads = page.getByRole('group', { name: 'Drum pads', exact: true });
	await piano.getByRole('button', { name: 'Use computer keys', exact: true }).click();
	const middleC = piano.getByRole('application').getByRole('button', { name: 'C3', exact: true });
	await page.keyboard.down('a');
	await expect(middleC).toHaveAttribute('aria-pressed', 'true');
	await pads.getByRole('button', { name: 'Use computer keys', exact: true }).click();
	await expect(middleC).toHaveAttribute('aria-pressed', 'false');
	await page.keyboard.up('a');
	await page.keyboard.down('a');
	const snare = pads.getByRole('button', { name: /note 40,/ });
	await expect(snare).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.down('Shift');
	await page.keyboard.up('a');
	await page.keyboard.up('Shift');
	await expect(snare).toHaveAttribute('aria-pressed', 'false');
	await expect(pads.getByRole('button', { name: /note 36,/ })).toContainText('Z');
	await pads.getByTitle('Choose a drum kit').click();
	await page.getByRole('button', { name: /808 kit · TR-808/ }).click();
	await expect(pads.getByTitle('Choose a drum kit')).toHaveText('808 kit');
});

test('changing channel while holding a note releases its original channel; editing controls does not play', async ({
	page
}) => {
	await page.goto('/learn/channels');
	const instrument = page.getByRole('group', { name: 'Keyboard instrument', exact: true });
	const middleC = instrument
		.getByRole('application')
		.getByRole('button', { name: 'C3', exact: true });
	await instrument.getByRole('button', { name: 'Use computer keys', exact: true }).click();
	await page.keyboard.down('a');
	await expect(middleC).toHaveAttribute('aria-pressed', 'true');
	await instrument.getByLabel('Channel', { exact: true }).selectOption('2');
	await expect(middleC).toHaveAttribute('aria-pressed', 'false');
	await page.keyboard.up('a');
	await instrument.getByLabel('Channel', { exact: true }).focus();
	await page.keyboard.press('a');
	await expect(middleC).toHaveAttribute('aria-pressed', 'false');
	await instrument.getByRole('button', { name: 'Sustain', exact: true }).focus();
	await page.keyboard.press('a');
	await expect(middleC).toHaveAttribute('aria-pressed', 'false');
});
