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
	import { CURRICULUM, ALL_LESSONS, lessonPath } from '$lib/curriculum/registry';
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
		run: () => goto(href)
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

	const lessons: Cmd[] = ALL_LESSONS.map((l) => ({
		id: `lesson-${l.id}`,
		label: `${l.number}. ${l.title}`,
		keywords: [l.blurb],
		run: () => goto(lessonPath(l))
	}));

	const byId = $derived(
		new Map([...destinations, ...actions, ...lessons].map((c) => [c.id, c] as const))
	);
	/** Recents are only meaningful on an empty query; when searching, the search wins. */
	const recent = $derived(
		query.trim() ? [] : recentIds.map((id) => byId.get(id)).filter((c): c is Cmd => !!c)
	);

	function invoke(cmd: Cmd) {
		recentIds = [cmd.id, ...recentIds.filter((id) => id !== cmd.id)].slice(0, 5);
		save('palette-recent', recentIds);
		open = false;
		query = '';
		queueMicrotask(cmd.run);
	}
</script>

<Command.Dialog bind:open title="Command palette" description="Jump anywhere, or drive the engine">
	<Command.Input bind:value={query} placeholder="Search lessons, tools and actions…" />
	<Command.List>
		<Command.Empty>Nothing matches.</Command.Empty>

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
			{#each destinations as cmd (cmd.id)}
				<Command.Item keywords={cmd.keywords} onSelect={() => invoke(cmd)}>
					{cmd.label}
				</Command.Item>
			{/each}
		</Command.Group>

		<Command.Group heading="Engine">
			{#each actions as cmd (cmd.id)}
				<Command.Item keywords={cmd.keywords} onSelect={() => invoke(cmd)}>
					{cmd.label}
					{#if cmd.shortcut}<Command.Shortcut>{cmd.shortcut}</Command.Shortcut>{/if}
				</Command.Item>
			{/each}
		</Command.Group>

		{#each CURRICULUM as act (act.id)}
			<Command.Group heading="Act {act.number} · {act.title}">
				{#each act.lessons as lesson (lesson.id)}
					{@const cmd = byId.get(`lesson-${lesson.id}`)!}
					<Command.Item keywords={cmd.keywords} onSelect={() => invoke(cmd)}>
						{cmd.label}
					</Command.Item>
				{/each}
			</Command.Group>
		{/each}
	</Command.List>
</Command.Dialog>
