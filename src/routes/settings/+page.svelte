<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { ALL_LESSONS } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { audio } from '$lib/audio/engine';
	import { router } from '$lib/midi/router.svelte';
	import { devices } from '$lib/midi/devices/store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Slider } from '$lib/components/ui/slider';

	const completed = $derived(ALL_LESSONS.filter((l) => progress.isLessonComplete(l.id)).length);
	let confirmReset = $state(false);
</script>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-8">
	<PageHeader title="Settings" />

	<section class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold tracking-tight">Appearance</h2>
		<div class="flex flex-col rounded-lg border bg-card">
			<div class="flex items-center justify-between gap-4 px-4 py-3">
				<div>
					<p class="text-sm font-medium">Theme</p>
					<p class="text-xs text-muted-foreground">
						Dark is the default; the palette is tuned for both.
					</p>
				</div>
				<div class="flex shrink-0 gap-1">
					{#each [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']] as [v, l] (v)}
						<Button
							variant={settings.theme === v ? 'default' : 'outline'}
							size="sm"
							class="h-7 text-xs"
							onclick={() => (settings.theme = v as typeof settings.theme)}
						>
							{l}
						</Button>
					{/each}
				</div>
			</div>
			<div class="flex items-center justify-between gap-4 border-t px-4 py-3">
				<Label for="reduce-motion" class="flex-1 flex-col items-start gap-0.5 font-normal">
					<span class="block text-sm font-medium">Reduce motion</span>
					<span class="block text-xs leading-relaxed text-muted-foreground">
						Removes the decorative easing. The meters keep moving — they are what you came to read.
						Starts from your system preference.
					</span>
				</Label>
				<Switch id="reduce-motion" bind:checked={settings.reduceMotion} />
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold tracking-tight">Notation</h2>
		<div class="flex flex-col rounded-lg border bg-card">
			<div class="flex items-center justify-between gap-4 px-4 py-3">
				<div>
					<p class="text-sm font-medium">Octave convention</p>
					<p class="text-xs leading-relaxed text-muted-foreground">
						Note 60 is always middle C. What you call it is a labelling convention — Yamaha and
						Roland say C3, scientific pitch notation says C4.
					</p>
				</div>
				<div class="flex shrink-0 gap-1">
					{#each [['c3', 'C3'], ['c4', 'C4']] as [v, l] (v)}
						<Button
							variant={settings.octaveConvention === v ? 'default' : 'outline'}
							size="sm"
							class="h-7 text-xs"
							onclick={() => (settings.octaveConvention = v as 'c3' | 'c4')}
						>
							{l}
						</Button>
					{/each}
				</div>
			</div>
			<div class="flex items-center justify-between gap-4 border-t px-4 py-3">
				<Label for="note-numbers" class="flex-1 flex-col items-start gap-0.5 font-normal">
					<span class="block text-sm font-medium">Show MIDI note numbers</span>
					<span class="block text-xs leading-relaxed text-muted-foreground">
						Prints the wire value under the name on every keybed in the app. C3 and 60 are the same
						key; only one of them is what actually travels down the cable.
					</span>
				</Label>
				<Switch id="note-numbers" bind:checked={settings.showNoteNumbers} />
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold tracking-tight">Engine</h2>
		<div class="flex flex-col rounded-lg border bg-card">
			<label class="flex items-center gap-4 px-4 py-3">
				<span class="flex-1">
					<span class="block text-sm font-medium">Master volume</span>
					<span class="block text-xs text-muted-foreground">
						Internal synth output level. Hardware outputs are unaffected.
					</span>
				</span>
				<span class="tnum w-10 shrink-0 text-right font-mono text-xs text-readout">
					{Math.round(settings.masterVolume * 100)}
				</span>
				<div class="w-44 shrink-0">
					<Slider
						type="single"
						value={settings.masterVolume}
						min={0}
						max={1}
						step={0.01}
						onValueChange={(v) => {
							settings.masterVolume = v;
							audio.setVolume(v);
						}}
					/>
				</div>
			</label>
			<div class="flex items-center justify-between gap-4 border-t px-4 py-3">
				<Label for="audition" class="flex-1 flex-col items-start gap-0.5 font-normal">
					<span class="block text-sm font-medium">Audition incoming MIDI</span>
					<span class="block text-xs text-muted-foreground">
						Play whatever arrives from hardware through the internal synth.
					</span>
				</Label>
				<Switch id="audition" bind:checked={engine.auditionInput} />
			</div>
		</div>
		<DevicePanel />
	</section>

	<section class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold tracking-tight">Stored data</h2>
		<div class="flex flex-col gap-3 rounded-lg border bg-card p-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-sm font-medium">Course progress</p>
					<p class="text-xs text-muted-foreground">
						{completed} of {ALL_LESSONS.length} lessons complete · {progress.visited.length} visited
					</p>
				</div>
				{#if confirmReset}
					<div class="flex gap-2">
						<Button
							variant="destructive"
							size="sm"
							onclick={() => {
								progress.reset();
								confirmReset = false;
							}}
						>
							Yes, reset everything
						</Button>
						<Button variant="ghost" size="sm" onclick={() => (confirmReset = false)}>Cancel</Button>
					</div>
				{:else}
					<Button variant="outline" size="sm" onclick={() => (confirmReset = true)}>
						Reset progress
					</Button>
				{/if}
			</div>
			<div class="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
				<div>
					<p class="text-sm font-medium">Patchbay routes</p>
					<p class="text-xs text-muted-foreground">{router.routes.length} saved</p>
				</div>
				<Button variant="outline" size="sm" onclick={() => router.clear()}>Clear routes</Button>
			</div>
			<div class="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
				<div>
					<p class="text-sm font-medium">Device profiles</p>
					<p class="text-xs text-muted-foreground">
						{devices.user.length} of your own, plus the built-in ones
					</p>
				</div>
				<Button variant="outline" size="sm" href="/lab/devices">Open Device Lab</Button>
			</div>
			<p class="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
				Everything is stored in this browser's local storage. Nothing is sent anywhere — this app
				has no server.
			</p>
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<h2 class="text-lg font-semibold tracking-tight">About</h2>
		<div
			class="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm leading-relaxed text-muted-foreground"
		>
			<p>
				MIDI Lab is a static single-page application. The MIDI parser, the Standard MIDI File codec,
				the pattern language, the synthesiser and the scheduler are all written here rather than
				pulled from libraries, because reading them is part of the point.
			</p>
			<p>
				Web MIDI requires a Chromium browser or Firefox, on desktop or Android. Safari ships none,
				on any platform — everything except hardware still works there.
			</p>
		</div>
	</section>
</div>
