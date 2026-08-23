import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * Where the site is mounted.
 *
 * Empty everywhere except a GitHub Pages build, where a project site is served
 * from /<repo>/ rather than from the root of the domain. The deploy workflow
 * sets BASE_PATH and nothing else does, so dev, preview and both test suites
 * keep running at the root.
 *
 * SvelteKit does not rewrite hand-written links, so this has a counterpart in
 * `$lib/nav`: every internal href goes through `path()`, which is what
 * actually puts the prefix on. A value that cannot work is worth catching here
 * rather than as four hundred subtly wrong links.
 */
const base = (() => {
	const value = process.env.BASE_PATH ?? '';
	if (value !== '' && !value.startsWith('/')) {
		throw new Error(`BASE_PATH must start with a slash; got ${JSON.stringify(value)}`);
	}
	if (value.endsWith('/')) {
		throw new Error(`BASE_PATH must not end with a slash; got ${JSON.stringify(value)}`);
	}
	return value as '' | `/${string}`;
})();

export default defineConfig({
	// Honour a PORT handed to us by the harness; fall back to Vite's default.
	server: { port: Number(process.env.PORT) || 5173 },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' }),
			paths: { base }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
