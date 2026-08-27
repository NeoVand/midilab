import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCES, referenceById, refHost } from './references';
import { GLOSSARY, glossaryLookup } from './glossary';
import { CURRICULUM } from './registry';

const DIR = join(process.cwd(), 'src/lib/curriculum/lessons');
const files = readdirSync(DIR).filter((f) => f.endsWith('.svelte'));
const sources = new Map(files.map((f) => [f, readFileSync(join(DIR, f), 'utf8')]));

/**
 * The reference table is the one place in this app that points at somebody
 * else's server, which makes it the one place that rots without anybody
 * touching it. Nothing here can check that a URL still resolves — that needs a
 * network and would make the suite flaky — but everything *else* about a
 * citation is checkable, and a broken key is far more likely than a moved page.
 */
describe('the reference table', () => {
	it('uses each id exactly once', () => {
		const ids = REFERENCES.map((r) => r.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('cites each URL exactly once', () => {
		// Two ids pointing at one page means one of them is a duplicate written
		// by somebody who could not find the first.
		const urls = REFERENCES.map((r) => r.url);
		expect(new Set(urls).size).toBe(urls.length);
	});

	it('gives every reference an absolute, parseable URL', () => {
		const bad = REFERENCES.filter((r) => {
			try {
				const u = new URL(r.url);
				return u.protocol !== 'https:' && u.protocol !== 'http:';
			} catch {
				return true;
			}
		});
		expect(bad.map((r) => r.id)).toEqual([]);
	});

	it('names a publisher and says why to read it', () => {
		const thin = REFERENCES.filter((r) => !r.publisher || r.note.length < 30);
		expect(thin.map((r) => r.id)).toEqual([]);
	});

	it('derives a hostname for the link hint', () => {
		expect(refHost({ ...REFERENCES[0], url: 'https://www.example.com/x' })).toBe('example.com');
	});
});

describe('every citation in a lesson resolves', () => {
	/** `<Further refs={['a', 'b']} />` and `<Ref to="c" />`, from the markup. */
	const cited = files.flatMap((f) => {
		const src = sources.get(f)!;
		const fromFurther = [...src.matchAll(/refs=\{\[([^\]]*)\]\}/g)].flatMap((m) =>
			[...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
		);
		const fromInline = [...src.matchAll(/<Ref\s[^>]*to="([^"]+)"/g)].map((m) => m[1]);
		return [...fromFurther, ...fromInline].map((id) => ({ from: f, id }));
	});

	it('finds citations at all', () => {
		expect(cited.length).toBeGreaterThan(50);
	});

	it('resolves every one of them', () => {
		expect(cited.filter((c) => !referenceById(c.id))).toEqual([]);
	});
});

describe('every lesson points somewhere outside this app', () => {
	const ids = CURRICULUM.flatMap((a) => a.lessons.map((l) => l.id));

	it('gives every lesson a reading list', () => {
		const without = ids.filter((id) => !sources.get(`${id}.svelte`)?.includes('<Further'));
		expect(without).toEqual([]);
	});

	it('never sends a lesson to fewer than two sources', () => {
		// One link reads as an afterthought; it is also a single point of rot.
		const thin = ids.filter((id) => {
			const m = /refs=\{\[([^\]]*)\]\}/.exec(sources.get(`${id}.svelte`) ?? '');
			return !m || [...m[1].matchAll(/'[^']+'/g)].length < 2;
		});
		expect(thin).toEqual([]);
	});
});

/**
 * `Term` resolves its own key from the text it wraps when none is given, and
 * renders a visible error when the lookup fails. That is the right runtime
 * behaviour and the wrong thing to find out about in production.
 */
describe('every glossary term used in the prose exists', () => {
	const used = files.flatMap((f) => {
		const src = sources.get(f)!;
		const explicit = [...src.matchAll(/<Term\s+of="([^"]+)"/g)].map((m) => m[1]);
		// `<Term>word</Term>` — only the simple, single-line form, which is all
		// the prose uses. Anything with markup inside it is skipped rather than
		// guessed at.
		const implicit = [...src.matchAll(/<Term>([^<>{}\n]+)<\/Term>/g)].map((m) => m[1]);
		return [...explicit, ...implicit].map((key) => ({ from: f, key }));
	});

	it('finds terms at all', () => {
		expect(used.length).toBeGreaterThan(20);
	});

	it('resolves every one of them', () => {
		expect(used.filter((u) => !glossaryLookup(u.key))).toEqual([]);
	});
});

describe('the glossary', () => {
	it('defines each headword once', () => {
		const terms = GLOSSARY.map((g) => g.term.toLowerCase());
		expect(new Set(terms).size).toBe(terms.length);
	});

	it('never lets an alias collide with a different entry’s headword', () => {
		const heads = new Map(GLOSSARY.map((g) => [g.term.toLowerCase(), g]));
		const clashes = GLOSSARY.flatMap((g) =>
			(g.aliases ?? [])
				.filter((a) => heads.has(a.toLowerCase()) && heads.get(a.toLowerCase()) !== g)
				.map((a) => `${g.term} → ${a}`)
		);
		expect(clashes).toEqual([]);
	});

	it('never lets two entries claim the same alias', () => {
		const seen = new Map<string, string>();
		const clashes: string[] = [];
		for (const g of GLOSSARY) {
			for (const a of g.aliases ?? []) {
				const k = a.toLowerCase();
				if (seen.has(k)) clashes.push(`${a}: ${seen.get(k)} and ${g.term}`);
				else seen.set(k, g.term);
			}
		}
		expect(clashes).toEqual([]);
	});

	it('points every cross-referenced lesson at one that exists', () => {
		const ids = new Set(CURRICULUM.flatMap((a) => a.lessons.map((l) => l.id)));
		expect(GLOSSARY.filter((g) => g.lesson && !ids.has(g.lesson)).map((g) => g.term)).toEqual([]);
	});

	it('gives every entry a category, now that the reference page filters by one', () => {
		expect(GLOSSARY.filter((g) => !g.category).map((g) => g.term)).toEqual([]);
	});
});
