import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Icons come in four sizes.
 *
 * They came in twelve — 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21 and 22 —
 * for what are really four jobs, and most files mixed two or three of them for
 * the same job. Nobody notices a 13 beside a 14; everybody notices the result,
 * which is a set of pages that feel assembled rather than designed.
 *
 * The steps here are far enough apart to be choices:
 *
 * - **11** a mark inside something small — a dismiss cross, the tick in a quiz
 *   badge, the arrow on an outbound link.
 * - **14** the default, and by a distance the commonest: anything inside a
 *   control, anything sitting inline with body or metadata text.
 * - **18** a section mark — the glyph on a callout, on the checkpoints header,
 *   at the top of a card.
 * - **22** primary navigation and empty states, where an icon is the thing
 *   being looked at rather than an accent on something else.
 *
 * Adding a fifth size is allowed. Adding a fifth size *by accident*, because
 * some component wanted one more pixel than the one next to it, is what this
 * test is for — say what the new step is for, here, and then add it.
 *
 * Knob and Fader take a `size` too, and theirs is a diameter in a completely
 * different range. Only sizes written inside a `<HugeiconsIcon>` tag are
 * checked.
 */
describe('the icon scale', () => {
	const SCALE = [11, 14, 18, 22];
	const SOURCE = join(process.cwd(), 'src');
	/** An opening tag, self-closing or not — attributes often span many lines. */
	const TAG = /<HugeiconsIcon\b[^>]*?>/gs;
	const SIZE = /\bsize=\{(\d+)\}/g;

	function walk(dir: string): string[] {
		return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
			const full = join(dir, e.name);
			if (e.isDirectory()) return walk(full);
			return e.name.endsWith('.svelte') ? [full] : [];
		});
	}

	it('has nothing outside it', () => {
		const offenders = walk(SOURCE).flatMap((file) => {
			const src = readFileSync(file, 'utf8');
			if (!src.includes('HugeiconsIcon')) return [];
			const short = file.replace(process.cwd() + '/', '');
			return [...src.matchAll(TAG)].flatMap((tag) =>
				[...tag[0].matchAll(SIZE)]
					.map((m) => Number(m[1]))
					.filter((px) => !SCALE.includes(px))
					.map((px) => `${short} size={${px}}`)
			);
		});
		expect(offenders).toEqual([]);
	});
});
