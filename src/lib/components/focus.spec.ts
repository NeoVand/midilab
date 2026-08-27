import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A focusable SVG shape must suppress the browser's own focus ring.
 *
 * Two separate things make this a rule rather than a preference.
 *
 * The first is what the ring looks like. An outline is drawn around an
 * element's bounding box, and the bounding box of a shape that is not a
 * rectangle is not the shape: around one wedge of the circle of fifths it is a
 * rounded box covering a quarter of the drawing and touching the wedge at
 * three points, which reads as a selection of everything nearby.
 *
 * The second is worse, and is the reason a hand-written rule cannot be relied
 * on to catch it in review. On SVG elements Chrome paints its default ring for
 * plain `:focus`, not only `:focus-visible` — so unlike every HTML control in
 * this app, a mouse click leaves one sitting there afterwards until you click
 * somewhere else. It looks like a bug in the widget, because it is one.
 *
 * The two acceptable answers are `.focus-shape`, which drops the outline and
 * lets the shape's own stroke carry focus, or `outline-none` plus an indicator
 * drawn inside the SVG. Both are in use; either passes.
 *
 * HTML controls are deliberately out of scope. They are rectangles, the ring
 * fits them, and `:focus-visible` behaves itself.
 */
describe('focusable SVG shapes', () => {
	const SOURCE = join(process.cwd(), 'src');
	/** The SVG elements that can sensibly be given focus. */
	const SVG_TAGS = 'path|g|circle|rect|ellipse|polygon|polyline|line|text|use|svg';

	function walk(dir: string): string[] {
		return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
			const full = join(dir, e.name);
			if (e.isDirectory()) return walk(full);
			return e.name.endsWith('.svelte') ? [full] : [];
		});
	}

	it('all suppress the browser ring', () => {
		const offenders = walk(SOURCE).flatMap((file) => {
			const src = readFileSync(file, 'utf8');
			const short = file.replace(process.cwd() + '/', '');
			// Each opening tag, from its name to the '>' that closes it. Attributes
			// are frequently spread over many lines, so this cannot be line-based.
			const tags = src.matchAll(new RegExp(`<(${SVG_TAGS})\\b([^>]*)>`, 'gs'));
			return (
				[...tags]
					.filter(([, , attrs]) => /\btabindex\s*=/.test(attrs))
					// A negative tabindex is not reachable by keyboard and is not
					// focused by a click either, so it never shows a ring.
					.filter(([, , attrs]) => !/\btabindex\s*=\s*["{]?-1/.test(attrs))
					.filter(([, , attrs]) => !/\bfocus-shape\b|\boutline-none\b/.test(attrs))
					.map(([, tag]) => `${short} <${tag}>`)
			);
		});
		expect(offenders).toEqual([]);
	});
});
