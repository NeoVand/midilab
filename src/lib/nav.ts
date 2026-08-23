import { base } from '$app/paths';
import { lessonRoute } from '$lib/curriculum/registry';
import type { LessonMeta } from '$lib/curriculum/registry';

/**
 * Links, once this is served from somewhere other than the root.
 *
 * On GitHub Pages a project site lives at `/<repo>/`, and SvelteKit does not
 * rewrite hand-written links: `href="/learn"` is a link to the root of the
 * domain, which on Pages is somebody else's project. Every internal link
 * therefore goes through `path`, which is a no-op in development and prepends
 * the base path in a build that has one.
 *
 * The distinction the names carry: a *route* is what the app calls a page
 * internally and is what comparisons and tests use; an *href* is a route with
 * wherever the app happens to be mounted in front of it, and is the only form
 * that belongs in markup or in `goto`.
 */
export const path = (route: string): string => `${base}${route}`;

/** The other direction: the route a browser location refers to. */
export function routeOf(pathname: string): string {
	if (!base || !pathname.startsWith(base)) return pathname;
	return pathname.slice(base.length) || '/';
}

/** A link to a lesson. */
export const lessonHref = (l: LessonMeta | string): string => path(lessonRoute(l));
