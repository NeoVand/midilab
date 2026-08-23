<script lang="ts">
	/**
	 * Jump anywhere, or drive the engine.
	 *
	 * Two things a palette owes you that a list of links does not: it remembers
	 * what you actually reach for, and it teaches you the shortcut so that next
	 * time you do not need the palette at all.
	 */
	import * as Command from '$lib/components/ui/command';
	import { goto } from '$app/navigation';
	import { engine } from '$lib/midi/engine.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { CURRICULUM, ALL_LESSONS } from '$lib/curriculum/registry';
	import { lessonHref, path } from '$lib/nav';
	import { load, save } from '$lib/stores/persist';

	interface Props {
		open: boolean;
	}
	let { open = $bindable(false) }: Props = $props();

	interface Cmd {
		id: string;
		label: string;
		keywords?: string[];
		shortcut?: string;
		run: () => void;
	}

	let query = $state('');
	let recentIds = $state<string[]>(load('palette-recent', []));

	const go = (id: string, label: string, href: string, keywords: string[] = []): Cmd => ({
		id,
		label,
		keywords,
		run: () => goto(path(href))
	});

	const destinations: Cmd[] = [
		go('go-learn', 'Course overview', '/learn', ['lessons', 'acts', 'curriculum']),
		go('go-lab', 'The Lab', '/lab', ['tools']),
		go('go-monitor', 'MIDI Monitor', '/lab/monitor', ['bytes', 'inspect', 'log', 'sniff']),
		go('go-patchbay', 'Patchbay', '/lab/patchbay', ['route', 'remap', 'transpose', 'split']),
		go('go-programmer', 'Programmer', '/lab/programmer', ['sequencer', 'steps', 'patterns', 'mid']),
		go('go-devices', 'Device Lab', '/lab/devices', ['profile', 'sysex', 'identify', 'learn']),
		go('go-diagnostics', 'Diagnostics', '/lab/diagnostics', ['latency', 'jitter', 'loopback']),
		go('go-console', 'Console', '/lab/console', ['javascript', 'code', 'script', 'repl']),
		go('go-reference', 'Reference', '/reference', ['cc', 'table', 'gm', 'glossary', 'notes']),
		go('go-settings', 'Settings', '/settings', ['theme', 'volume', 'octave', 'preferences'])
	];

	const actions: Cmd[] = $derived([
		{
			id: 'act-panic',
			label: 'Panic — all notes off',
			keywords: ['stuck', 'hanging', 'silence'],
			shortcut: '⌘.',
			run: () => engine.panic()
		},
		{
			id: 'act-transport',
			label: transport.playing ? 'Stop transport' : 'Start transport',
			keywords: ['play', 'clock', 'tempo'],
			shortcut: 'Space',
			run: () => transport.toggle()
		},
		{
			id: 'act-dock',
			label: 'Toggle engine dock',
			keywords: ['ports', 'outputs'],
			shortcut: '`',
			run: () => (settings.dockOpen = !settings.dockOpen)
		},
		{
			id: 'act-theme',
			label: `Switch to ${settings.resolvedTheme === 'dark' ? 'light' : 'dark'} theme`,
			keywords: ['dark', 'light', 'appearance'],
			run: () => settings.toggleTheme()
		}
	]);

	/*
	 * Distinctive words, not whole sentences.
	 *
	 * Feeding each lesson's blurb in as one long keyword meant the fuzzy matcher
	 * could find the query's letters scattered anywhere across it, so almost
	 * everything matched almost everything: searching "latency" put "Control,
	 * not sound" and "Pitch bend" above the lesson actually called "Latency,
	 * jitter, and the lookahead scheduler", and "swing" did not surface the
	 * swing lesson at all. Short topic words score on meaning instead of on
	 * coincidence.
	 */
	const STOP = new Set([
		'and',
		'are',
		'both',
		'but',
		'can',
		'cannot',
		'for',
		'from',
		'has',
		'have',
		'how',
		'into',
		'its',
		'made',
		'make',
		'makes',
		'not',
		'one',
		'onto',
		'own',
		'same',
		'than',
		'that',
		'the',
		'their',
		'them',
		'then',
		'they',
		'this',
		'two',
		'used',
		'what',
		'when',
		'which',
		'with',
		'you',
		'your'
	]);

	function terms(text: string): string[] {
		const words = text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
		return [...new Set(words)].filter((w) => !STOP.has(w));
	}

	const lessons: Cmd[] = ALL_LESSONS.map((l) => ({
		id: `lesson-${l.id}`,
		label: `${l.number}. ${l.title}`,
		keywords: terms(`${l.blurb} ${l.objectives.join(' ')}`),
		run: () => goto(lessonHref(l))
	}));

	const all = $derived([...destinations, ...actions, ...lessons]);
	const byId = $derived(new Map(all.map((c) => [c.id, c] as const)));

	/*
	 * Ranking is ours, not the matcher's.
	 *
	 * Left to itself the list filtered but effectively did not rank: searching
	 * "latency" returned Velocity and dynamics, Notes and pitch and Control, not
	 * sound, while the lesson actually called "Latency, jitter, and the
	 * lookahead scheduler" — three groups further down — never appeared at all.
	 * A whole-word hit in a title has to beat a fuzzy hit in a topic word, and
	 * that ordering has to hold across the whole list rather than inside each
	 * group.
	 */
	const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	function scoreTerm(cmd: Cmd, term: string): number {
		// Lesson labels start with their number; match on the title itself.
		const title = cmd.label.toLowerCase().replace(/^\d+\.\s*/, '');
		if (title === term) return 100;
		if (title.startsWith(term)) return 90;
		if (new RegExp(`\\b${escapeRe(term)}`).test(title)) return 75;
		if (title.includes(term)) return 55;
		const kw = cmd.keywords ?? [];
		if (kw.some((k) => k.toLowerCase() === term)) return 40;
		if (kw.some((k) => k.toLowerCase().startsWith(term))) return 30;
		if (kw.some((k) => k.toLowerCase().includes(term))) return 15;
		return 0;
	}

	const results = $derived.by(() => {
		const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (!terms.length) return [];
		return all
			.map((cmd) => {
				// Every word you typed has to land somewhere, or it is not a match.
				let total = 0;
				for (const t of terms) {
					const s = scoreTerm(cmd, t);
					if (!s) return null;
					total += s;
				}
				return { cmd, total };
			})
			.filter((r): r is { cmd: Cmd; total: number } => r !== null)
			.sort((a, b) => b.total - a.total || a.cmd.label.localeCompare(b.cmd.label))
			.slice(0, 12)
			.map((r) => r.cmd);
	});
	/** Recents are only meaningful on an empty query; when searching, the search wins. */
	const recent = $derived(
		query.trim() ? [] : recentIds.map((id) => byId.get(id)).filter((c): c is Cmd => !!c)
	);
	/**
	 * Anything promoted to Recent is hidden from the group it came from. Seeing
	 * "Diagnostics" twice in one list makes you check whether they do the same
	 * thing, which is the opposite of what a palette is for.
	 */
	const promoted = $derived(new Set(recent.map((c) => c.id)));

	function invoke(cmd: Cmd) {
		recentIds = [cmd.id, ...recentIds.filter((id) => id !== cmd.id)].slice(0, 5);
		save('palette-recent', recentIds);
		open = false;
		query = '';
		queueMicrotask(cmd.run);
	}
</script>

<Command.Dialog
	bind:open
	shouldFilter={false}
	title="Command palette"
	description="Jump anywhere, or drive the engine"
>
	<Command.Input bind:value={query} placeholder="Search lessons, tools and actions…" />
	<Command.List>
		<Command.Empty>Nothing matches.</Command.Empty>

		{#if query.trim()}
			<Command.Group heading="Results">
				{#each results as cmd (cmd.id)}
					<Command.Item value={cmd.id} onSelect={() => invoke(cmd)}>
						{cmd.label}
						{#if cmd.shortcut}<Command.Shortcut>{cmd.shortcut}</Command.Shortcut>{/if}
					</Command.Item>
				{/each}
			</Command.Group>
		{:else}
			{#if recent.length}
				<Command.Group heading="Recent">
					{#each recent as cmd (cmd.id)}
						<Command.Item value={`recent-${cmd.id}`} onSelect={() => invoke(cmd)}>
							{cmd.label}
							{#if cmd.shortcut}<Command.Shortcut>{cmd.shortcut}</Command.Shortcut>{/if}
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}

			<Command.Group heading="Go">
				{#each destinations.filter((c) => !promoted.has(c.id)) as cmd (cmd.id)}
					<Command.Item keywords={cmd.keywords} onSelect={() => invoke(cmd)}>
						{cmd.label}
					</Command.Item>
				{/each}
			</Command.Group>

			<Command.Group heading="Engine">
				{#each actions.filter((c) => !promoted.has(c.id)) as cmd (cmd.id)}
					<Command.Item keywords={cmd.keywords} onSelect={() => invoke(cmd)}>
						{cmd.label}
						{#if cmd.shortcut}<Command.Shortcut>{cmd.shortcut}</Command.Shortcut>{/if}
					</Command.Item>
				{/each}
			</Command.Group>

			{#each CURRICULUM as act (act.id)}
				{@const items = act.lessons
					.map((l) => byId.get(`lesson-${l.id}`)!)
					.filter((c) => !promoted.has(c.id))}
				{#if items.length}
					<Command.Group heading="Act {act.number} · {act.title}">
						{#each items as cmd (cmd.id)}
							<Command.Item keywords={cmd.keywords} onSelect={() => invoke(cmd)}>
								{cmd.label}
							</Command.Item>
						{/each}
					</Command.Group>
				{/if}
			{/each}
		{/if}
	</Command.List>

	<!-- The palette's job is to make itself unnecessary, so it keeps saying how. -->
	<div
		class="flex items-center gap-4 border-t px-3 py-2 text-2xs text-muted-foreground select-none"
	>
		<span><kbd class="font-mono">↑</kbd> <kbd class="font-mono">↓</kbd> move</span>
		<span><kbd class="font-mono">↵</kbd> open</span>
		<span><kbd class="font-mono">esc</kbd> close</span>
		<span class="ml-auto"><kbd class="font-mono">⌘K</kbd> reopens this</span>
	</div>
</Command.Dialog>
