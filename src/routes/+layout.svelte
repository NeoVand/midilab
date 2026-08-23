<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Rail from '$lib/components/shell/Rail.svelte';
	import EngineDock from '$lib/components/shell/EngineDock.svelte';
	import CommandPalette from '$lib/components/shell/CommandPalette.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import '$lib/midi/notestate.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { handleShortcut } from '$lib/stores/shortcuts.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { audio } from '$lib/audio/engine';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
	let paletteOpen = $state(false);

	/*
	 * The engine and the monitor are process-wide singletons, so their lifetime
	 * is the page's — not a reactive effect's. Starting them inside an effect
	 * that also reads the theme and the output level meant any change to either
	 * tore the bus subscriptions down and rebuilt them, which is both wasteful
	 * and a source of silent breakage.
	 */
	onMount(() => {
		engine.start();
		const stopMonitor = monitor.start();
		return () => {
			stopMonitor();
			engine.stop();
		};
	});

	// These genuinely are reactive: they follow settings the user can change.
	$effect(() => settings.applyTheme());
	$effect(() => audio.setVolume(settings.masterVolume));

	function onKeydown(e: KeyboardEvent) {
		handleShortcut(e, {
			togglePalette: () => (paletteOpen = !paletteOpen),
			toggleTransport: async () => {
				await engine.wake();
				transport.toggle();
			},
			panic: () => engine.panic(),
			toggleDock: () => (settings.dockOpen = !settings.dockOpen)
		});
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
