<script lang="ts">
	import * as Command from '$lib/components/ui/command';
	import { goto } from '$app/navigation';
	import { engine } from '$lib/midi/engine.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { CURRICULUM, lessonPath } from '$lib/curriculum/registry';

	interface Props {
		open: boolean;
	}
	let { open = $bindable(false) }: Props = $props();

	function run(fn: () => void) {
		open = false;
		queueMicrotask(fn);
	}
</script>

<Command.Dialog bind:open title="Command palette" description="Jump anywhere, or drive the engine">
	<Command.Input placeholder="Search lessons, tools and actions…" />
	<Command.List>
		<Command.Empty>Nothing matches.</Command.Empty>

		<Command.Group heading="Go">
			<Command.Item onSelect={() => run(() => goto('/learn'))}>Course overview</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/lab'))}>The Lab</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/lab/monitor'))}>MIDI Monitor</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/lab/patchbay'))}>Patchbay</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/lab/programmer'))}>Programmer</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/lab/devices'))}>Device Lab</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/lab/diagnostics'))}>Diagnostics</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/reference'))}>Reference</Command.Item>
			<Command.Item onSelect={() => run(() => goto('/settings'))}>Settings</Command.Item>
		</Command.Group>

		<Command.Group heading="Engine">
			<Command.Item onSelect={() => run(() => engine.panic())}>Panic — all notes off</Command.Item>
			<Command.Item onSelect={() => run(() => transport.toggle())}>
				{transport.playing ? 'Stop transport' : 'Start transport'}
			</Command.Item>
			<Command.Item onSelect={() => run(() => (settings.dockOpen = !settings.dockOpen))}>
				Toggle engine dock
			</Command.Item>
			<Command.Item onSelect={() => run(() => settings.toggleTheme())}>
				Switch to {settings.resolvedTheme === 'dark' ? 'light' : 'dark'} theme
			</Command.Item>
		</Command.Group>

		{#each CURRICULUM as act (act.id)}
			<Command.Group heading={act.title}>
				{#each act.lessons as lesson (lesson.id)}
					<Command.Item onSelect={() => run(() => goto(lessonPath(lesson)))}>
						{lesson.number}. {lesson.title}
					</Command.Item>
				{/each}
			</Command.Group>
		{/each}
	</Command.List>
</Command.Dialog>
