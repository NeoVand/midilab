import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKPOINTS } from './checkpoint-catalog';
import { MUSIC_FOUNDATIONS } from './music-foundations';
import { migrateProgress, lessonComplete, progressFraction } from './progress-model';

describe('honest and stable lesson completion', () => {
	it('keeps partial progress partial after navigation and reload', () => {
		const data = migrateProgress({ version: 2, done: { 'just-enough-music': ['fifth'] } });
		expect(CHECKPOINTS['just-enough-music']).toHaveLength(4);
		expect(lessonComplete(data, 'just-enough-music')).toBe(false);
		expect(progressFraction(data, ['just-enough-music'])).toBe(0.25);
		expect(
			lessonComplete(migrateProgress(JSON.parse(JSON.stringify(data))), 'just-enough-music')
		).toBe(false);
	});
	it('preserves legacy checks as self-assessed rather than verified', () => {
		const data = migrateProgress({
			done: { 'just-enough-music': ['fifth', 'major', 'minor', 'octave'] },
			visited: ['just-enough-music']
		});
		expect(lessonComplete(data, 'just-enough-music')).toBe(true);
		expect(lessonComplete(data, 'just-enough-music', true)).toBe(false);
		expect(data.done).toEqual({});
	});
	it('does not award completion for a visit or stale unknown checkpoint', () => {
		const data = migrateProgress({
			done: { 'just-enough-music': ['obsolete'] },
			visited: ['just-enough-music']
		});
		expect(progressFraction(data, ['just-enough-music'])).toBe(0);
		expect(lessonComplete(data, 'missing')).toBe(false);
	});
	it('ignores inherited property names in malformed persisted progress', () => {
		const stored = JSON.parse(
			'{"version":2,"done":{"toString":["bad"],"constructor":["bad"],"__proto__":["bad"]},"manual":{"hasOwnProperty":["bad"]}}'
		);
		const data = migrateProgress(stored);
		expect(data.done).toEqual({});
		expect(data.manual).toEqual({});
		expect(lessonComplete(data, 'toString')).toBe(false);
		expect(progressFraction(data, ['constructor'])).toBe(0);
	});
	it('matches every declared checkpoint and authored practice drill', () => {
		const dir = join(process.cwd(), 'src/lib/curriculum/lessons');
		for (const file of readdirSync(dir).filter((name) => name.endsWith('.svelte'))) {
			const id = file.replace('.svelte', '');
			const content = MUSIC_FOUNDATIONS[id];
			const ids = content
				? [...content.drills.map((drill) => drill.id), 'apply']
				: [
						...readFileSync(join(dir, file), 'utf8').matchAll(
							/<Checkpoint\s[\s\S]*?\bid="([^"]+)"/g
						)
					].map((match) => match[1]);
			expect(CHECKPOINTS[id] ?? []).toEqual(ids);
		}
	});
});
