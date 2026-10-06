import { expect, test, type Locator } from '@playwright/test';

async function expectReadableSoundControls(instrument: Locator) {
	const layout = await instrument.locator('[data-slot="field-group"]').evaluate((group) => {
		const bounds = group.getBoundingClientRect();
		const children = Array.from(group.children).map((el) => el.getBoundingClientRect().toJSON());
		const context = document.createElement('canvas').getContext('2d')!;
		const selects = Array.from(group.querySelectorAll('select')).map((select) => {
			const styles = getComputedStyle(select);
			context.font = styles.font;
			const text = select.selectedOptions[0]?.textContent?.trim() ?? '';
			return {
				text,
				textWidth: context.measureText(text).width,
				availableWidth:
					select.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
			};
		});
		return { bounds: bounds.toJSON(), children, selects };
	});
	const instrumentBounds = (await instrument.boundingBox())!;
	expect(layout.bounds.width).toBeGreaterThan(200);
	expect(layout.bounds.width).toBeLessThanOrEqual(instrumentBounds.width + 1);
	for (const select of layout.selects) {
		expect(select.text).not.toBe('');
		expect(select.availableWidth).toBeGreaterThanOrEqual(select.textWidth);
	}
	for (const child of layout.children) {
		expect(child.left).toBeGreaterThanOrEqual(layout.bounds.left - 1);
		expect(child.right).toBeLessThanOrEqual(layout.bounds.right + 1);
	}
	for (let a = 0; a < layout.children.length; a++) {
		for (let b = a + 1; b < layout.children.length; b++) {
			const overlapWidth =
				Math.min(layout.children[a].right, layout.children[b].right) -
				Math.max(layout.children[a].left, layout.children[b].left);
			const overlapHeight =
				Math.min(layout.children[a].bottom, layout.children[b].bottom) -
				Math.max(layout.children[a].top, layout.children[b].top);
			expect(overlapWidth > 1 && overlapHeight > 1).toBe(false);
		}
	}
}

for (const width of [320, 1280]) {
	test(`lesson sound controls fit their actual container at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 850 });
		await page.goto('/learn/chords-and-movement');
		const instruments = page.getByRole('group', { name: 'Keyboard instrument', exact: true });
		await expect(instruments).toHaveCount(2);
		for (const instrument of await instruments.all()) {
			await expect(instrument.getByLabel('Channel', { exact: true })).toHaveValue('0');
			await expect(instrument.getByLabel('Velocity', { exact: true })).toHaveValue('touch');
			await expectReadableSoundControls(instrument);
			await instrument.getByLabel('Velocity', { exact: true }).selectOption('48');
			await expectReadableSoundControls(instrument);
		}
	});
}

test('drum sound controls and complete instrument names fit on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 850 });
	await page.goto('/learn/channels');
	const pads = page.getByRole('group', { name: 'Drum pads', exact: true });
	await expectReadableSoundControls(pads);
	await pads.getByLabel('Velocity', { exact: true }).selectOption('100');
	await expectReadableSoundControls(pads);
	const piano = page.getByRole('group', { name: 'Keyboard instrument', exact: true });
	await piano.getByTitle("Choose this keyboard's instrument").click();
	const acoustic = page.getByRole('button', { name: '0 Acoustic Grand Piano', exact: true });
	const name = acoustic.locator('span').last();
	expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	await acoustic.click();
});

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
