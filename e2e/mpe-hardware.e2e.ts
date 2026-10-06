import { expect, test, type Page } from '@playwright/test';

interface MockMidi {
	send(portId: string, bytes: number[]): void;
	disconnect(portId: string): void;
	output: number[][];
}

async function mockOsmose(page: Page) {
	await page.addInitScript(() => {
		const output: number[][] = [];
		const ports = ['osmose-play', 'osmose-engine'].map((id, index) => ({
			id,
			name: index === 0 ? 'Osmose play' : 'Osmose sound engine',
			manufacturer: 'Expressive E',
			version: '2.3',
			type: 'input',
			state: 'connected',
			connection: 'open',
			onmidimessage: null as ((event: { data: Uint8Array; timeStamp: number }) => void) | null,
			open: async () => {},
			close: async () => {}
		}));
		const access = {
			inputs: new Map(ports.map((port) => [port.id, port])),
			outputs: new Map([
				[
					'osmose-out',
					{
						id: 'osmose-out',
						name: 'Osmose play',
						manufacturer: 'Expressive E',
						version: '2.3',
						type: 'output',
						state: 'connected',
						connection: 'open',
						send: (bytes: ArrayLike<number>) => output.push(Array.from(bytes)),
						open: async () => {},
						close: async () => {}
					}
				]
			]),
			onstatechange: null as ((event: { port: unknown }) => void) | null
		};
		Object.defineProperty(navigator, 'requestMIDIAccess', {
			configurable: true,
			value: async () => access
		});
		(window as unknown as { __mpeMidi: MockMidi }).__mpeMidi = {
			output,
			send(id, bytes) {
				const port = access.inputs.get(id)!;
				port.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp: performance.now() });
			},
			disconnect(id) {
				const port = access.inputs.get(id)!;
				port.state = 'disconnected';
				access.onstatechange?.({ port });
			}
		};
	});
}

async function send(page: Page, bytes: number[][], port = 'osmose-play') {
	await page.evaluate(
		({ bytes, port }) => {
			for (const message of bytes) {
				(window as unknown as { __mpeMidi: MockMidi }).__mpeMidi.send(port, message);
			}
		},
		{ bytes, port }
	);
}

async function connect(page: Page, path = '/learn/mpe') {
	await mockOsmose(page);
	await page.goto(path);
	const lab = page.getByRole('region', { name: 'Expression Playground', exact: true });
	await lab.getByRole('button', { name: 'Connect MIDI', exact: true }).click();
	await lab.getByLabel('MPE input', { exact: true }).selectOption('osmose-play');
	return lab;
}

test('Osmose Play input keeps pitch, pressure and deeper-touch CC74 independent and verifies actual playing', async ({
	page
}) => {
	const lab = await connect(page);
	await lab.getByRole('button', { name: 'Enable browser sound', exact: true }).click();
	await send(page, [
		[0x91, 60, 84],
		[0x92, 67, 90],
		[0xe1, 43, 65],
		[0xd1, 80],
		[0xb1, 74, 105]
	]);
	const first = lab.locator('[data-mpe-note="1:60"]');
	const second = lab.locator('[data-mpe-note="2:67"]');
	await expect(first).toContainText('+1.00');
	await expect(first).toContainText('effective 80');
	await expect(first).toContainText('effective 105');
	await expect(second).toContainText('+0.00');
	await expect(second).toContainText('effective 0');
	await expect(second).toContainText('effective 64');
	await expect(
		lab
			.getByRole('region', { name: 'Small gestures, real independence' })
			.getByText('Performed', { exact: true })
	).toHaveCount(3);
	await expect
		.poll(() =>
			page.evaluate(() => {
				const stored = JSON.parse(localStorage.getItem('midilab:progress') ?? '{}');
				return stored.done?.mpe ?? [];
			})
		)
		.toEqual(expect.arrayContaining(['member', 'per-note-bend', 'pressure', 'slide']));
	await send(page, [[0x91, 72, 100]], 'osmose-engine');
	await expect(lab.locator('[data-mpe-note="1:72"]')).toHaveCount(0);
	await expect
		.poll(() =>
			page.evaluate(() => (window as unknown as { __mpeMidi: MockMidi }).__mpeMidi.output)
		)
		.toEqual([]);
});

test('incoming range and sustain affect the receiver; channel reuse preserves pedal-held voices', async ({
	page
}) => {
	const lab = await connect(page, '/lab/mpe');
	await send(page, [
		[0xb1, 101, 0],
		[0xb1, 100, 0],
		[0xb1, 6, 12],
		[0xb1, 101, 127],
		[0xb1, 100, 127],
		[0x91, 60, 84],
		[0x92, 67, 90],
		[0xe1, 0, 96]
	]);
	const first = lab.locator('[data-mpe-note="1:60"]');
	await expect(first).toContainText('+6.00');
	await expect(lab.locator('[data-mpe-note="2:67"]')).toContainText('±12 st');
	await send(page, [
		[0xb0, 64, 127],
		[0x81, 60, 35],
		[0x91, 64, 90],
		[0xe1, 0, 64]
	]);
	await expect(first).toContainText('pedal held');
	await expect(first).toContainText('+6.00');
	await expect(lab.locator('[data-mpe-note="1:64"]')).toContainText('+0.00');
	await send(page, [[0xb0, 64, 0]]);
	await expect(first).toContainText('released');
	await page.getByRole('button', { name: 'Panic', exact: true }).click();
	await expect(lab).toContainText('0 sounding voices');
});

test('unplugging the selected controller clears live voices and leaves local sound controls usable', async ({
	page
}) => {
	const lab = await connect(page, '/lab/mpe');
	await lab.getByRole('button', { name: 'Enable browser sound', exact: true }).click();
	await send(page, [
		[0x91, 60, 84],
		[0x92, 67, 90]
	]);
	await expect(lab).toContainText('2 sounding voices');
	await page.evaluate(() =>
		(window as unknown as { __mpeMidi: MockMidi }).__mpeMidi.disconnect('osmose-play')
	);
	await expect(lab).toContainText('0 sounding voices');
	await lab.getByLabel('MPE input', { exact: true }).selectOption('surface');
	await lab.getByRole('button', { name: 'Hold C3', exact: true }).click();
	await expect(lab).toContainText('1 sounding voice');
});

test('selected hardware stays silent until enabled and muting preserves live observation', async ({
	page
}) => {
	const lab = await connect(page, '/lab/mpe');
	const dock = page.getByRole('region', { name: 'Engine dock', exact: true });
	await send(page, [
		[0x91, 60, 84],
		[0x92, 67, 90]
	]);
	await expect(lab).toContainText('2 sounding voices');
	await expect(dock).toContainText('0 voices');
	await lab.getByRole('button', { name: 'Enable browser sound', exact: true }).click();
	await expect(dock).toContainText('2 voices');
	await lab.getByRole('button', { name: 'Mute browser sound', exact: true }).click();
	await send(page, [
		[0x93, 64, 95],
		[0xd3, 100]
	]);
	await expect(lab).toContainText('3 sounding voices');
	await expect(lab.locator('[data-mpe-note="3:64"]')).toContainText('effective 100');
	await expect(dock).toContainText('0 voices');
});
