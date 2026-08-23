import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

function svelteFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) return svelteFiles(full);
		return name.endsWith('.svelte') ? [full] : [];
	});
}

/**
 * Every internal link has to go through `path` or `lessonHref`.
 *
 * SvelteKit does not rewrite hand-written links, so under a base path —
 * which is how this is served on GitHub Pages — `href="/learn"` points at the
 * root of the domain rather than at this app. It fails silently: the build
 * succeeds, the page renders, and the link is simply wrong. That is exactly
 * the kind of mistake worth spending a test on, because the next person to
 * write a link will reach for the obvious form.
 */
describe('internal links survive being served under a base path', () => {
	const offenders = svelteFiles(SRC).flatMap((file) => {
		const lines = readFileSync(file, 'utf8').split('\n');
		return lines.flatMap((line, i) => {
			const matches = [...line.matchAll(/href="(\/[^"]*)"/g)];
			return matches.map((m) => `${relative(process.cwd(), file)}:${i + 1} → href="${m[1]}"`);
		});
	});

	it('finds no root-relative href literals', () => {
		expect(offenders).toEqual([]);
	});
});
