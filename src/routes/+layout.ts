// A single-page application. Every screen here depends on Web MIDI, Web Audio,
// canvas measurement or pointer input, none of which a server can do, so there
// is nothing for SSR to usefully render.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
