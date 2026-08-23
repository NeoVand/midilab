<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import Rail from '$lib/components/shell/Rail.svelte';
	import TabBar from '$lib/components/shell/TabBar.svelte';
	import EngineDock from '$lib/components/shell/EngineDock.svelte';
	import CommandPalette from '$lib/components/shell/CommandPalette.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import { router } from '$lib/midi/router.svelte';
	import { metronome } from '$lib/audio/metronome.svelte';
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
		// The patchbay used to start this itself, which meant a saved route
		// stopped routing the moment you navigated away from the page that drew
		// it — while the page promised the opposite in so many words.
		const stopRouter = router.start();
		const stopMetronome = metronome.start();
		return () => {
			stopMetronome();
			stopRouter();
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
	<!--
		The icon and the social metadata live in `app.html`, because this app
		renders nothing on the server and a crawler never sees anything set
		here. This title is the short one the tab wants; the long one that
		reads well as a link preview is in `app.html` too.
	-->
	<title>MIDI Lab</title>
</svelte:head>
<svelte:window onkeydown={onKeydown} />

<!--
	`h-dvh`, not `h-screen`.
	
	`100vh` on a phone is the viewport with the browser's toolbars *hidden* —
	a height the page does not actually have when it loads. Using it puts the
	bottom of the app underneath the address bar, which is where the dock and
	the tab bar live. `dvh` follows the toolbars as they come and go, which is
	the whole reason it exists.
	
	The navigation swaps sides at `md`: a rail down the edge on a desktop, a
	bar along the bottom on a phone. One at a time, never both.
-->
<div class="flex h-dvh w-screen overflow-hidden bg-background">
	<Rail class="hidden md:flex" onOpenPalette={() => (paletteOpen = true)} />
	<div class="flex min-w-0 flex-1 flex-col">
		<main class="px-safe min-h-0 flex-1 scrollbar-thin overflow-y-auto">
			{@render children()}
		</main>
		<EngineDock />
		<TabBar class="md:hidden" onOpenPalette={() => (paletteOpen = true)} />
	</div>
</div>

<CommandPalette bind:open={paletteOpen} />
<Toaster position="top-right" />
