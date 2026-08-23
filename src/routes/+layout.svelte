<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Rail from '$lib/components/shell/Rail.svelte';
	import EngineDock from '$lib/components/shell/EngineDock.svelte';
	import CommandPalette from '$lib/components/shell/CommandPalette.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import '$lib/midi/notestate.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { audio } from '$lib/audio/engine';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
	let paletteOpen = $state(false);

	$effect(() => {
		settings.applyTheme();
		audio.setVolume(settings.masterVolume);
		engine.start();
		const stopMonitor = monitor.start();
		return () => {
			stopMonitor();
			engine.stop();
		};
	});

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			paletteOpen = !paletteOpen;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MIDI Lab</title>
</svelte:head>
<svelte:window onkeydown={onKeydown} />

<div class="flex h-screen w-screen overflow-hidden bg-background">
	<Rail onOpenPalette={() => (paletteOpen = true)} />
	<div class="flex min-w-0 flex-1 flex-col">
		<main class="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
			{@render children()}
		</main>
		<EngineDock />
	</div>
</div>

<CommandPalette bind:open={paletteOpen} />
<Toaster position="top-right" />
