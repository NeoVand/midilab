<script lang="ts">
	import MpeLab from '$lib/components/midi/MpeLab.svelte';
	import { path } from '$lib/nav';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head
	><title>MPE Playground — MIDI Lab</title><meta
		name="description"
		content="Play, hear and see independent pitch, pressure and timbre. An expressive MPE playground for Osmose and other controllers, with a complete on-screen instrument."
	/></svelte:head
>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-8 sm:px-8">
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<a href={path('/lab')} class="text-xs text-muted-foreground underline underline-offset-4"
				>The Lab</a
			>
			<h1 class="mt-3 text-3xl font-semibold tracking-tight">MPE Playground</h1>
			<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
				Connect your expressive instrument or play on screen. Follow the touch of each note, then
				turn those gestures into a phrase.
			</p>
		</div>
		<Button variant="outline" href={path('/learn/mpe')}>Learn expressive playing</Button>
	</header>
	<MpeLab />
</div>
