import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURRICULUM, lessonById } from './registry';

const DIR = join(process.cwd(), 'src/lib/curriculum/lessons');
const files = readdirSync(DIR).filter((f) => f.endsWith('.svelte'));

/**
 * The course is data in one file and components in another directory, joined
 * by a string. Nothing in the type system holds those two together, so this
 * does: an id with no component renders the "not written yet" placeholder, and
 * a component with no id is unreachable — both fail silently in a browser and
 * loudly here.
 */
describe('the curriculum registry and the lesson files agree', () => {
	const ids = CURRICULUM.flatMap((act) => act.lessons.map((l) => l.id));

	it('gives every registered lesson a component', () => {
		const missing = ids.filter((id) => !files.includes(`${id}.svelte`));
		expect(missing).toEqual([]);
	});

	it('reaches every lesson component from the registry', () => {
		const orphans = files.map((f) => f.replace(/\.svelte$/, '')).filter((id) => !ids.includes(id));
		expect(orphans).toEqual([]);
	});

	it('numbers the lessons consecutively from one', () => {
		expect(CURRICULUM.flatMap((a) => a.lessons).map((l) => l.number)).toEqual(
			ids.map((_, i) => i + 1)
		);
	});

	it('uses each id exactly once', () => {
		expect(new Set(ids).size).toBe(ids.length);
	});
});

/**
 * Cross-references are written as `<Xref to="some-id" />` and resolve their own
 * link text from the registry, so a stale id degrades to a visible error rather
 * than a wrong link. Catching it here means it never gets that far.
 */
describe('every cross-reference points at a lesson that exists', () => {
	const refs = files.flatMap((f) => {
		const src = readFileSync(join(DIR, f), 'utf8');
		return [...src.matchAll(/<Xref\s[^>]*to="([^"]+)"/g)].map((m) => ({ from: f, to: m[1] }));
	});

	it('finds cross-references at all', () => {
		expect(refs.length).toBeGreaterThan(0);
	});

	it('resolves all of them', () => {
		expect(refs.filter((r) => !lessonById(r.to))).toEqual([]);
	});

	it('never links a lesson to itself', () => {
		expect(refs.filter((r) => `${r.to}.svelte` === r.from)).toEqual([]);
	});
});
