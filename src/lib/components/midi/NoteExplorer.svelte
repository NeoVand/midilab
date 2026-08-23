<script lang="ts">
	/**
	 * One note number, seen from every angle: both octave conventions, the
	 * frequency, the key colour, and what it means on channel 10.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { isBlackKey, noteName, noteToFrequency, pitchClass } from '$lib/midi/notes';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		note?: number;
		class?: string;
	}
	let { note = $bindable(60), class: className }: Props = $props();

	function play() {
		engine.noteOn(note, 100, 0);
		setTimeout(() => engine.noteOff(note, 0), 500);
	}
</script>

<div class={cn('flex flex-col gap-4 rounded-lg border p-4', className)}>
	<div class="flex items-end gap-6">
		<div>
			<p class="label">Note number</p>
			<p class="tnum font-mono text-4xl leading-none text-msg-note">{note}</p>
		</div>
		<div class="flex-1">
			<Slider type="single" bind:value={note} min={0} max={127} step={1} />
		</div>
		<Button variant="outline" size="sm" class="gap-1.5" onclick={play}>
			<HugeiconsIcon icon={PlayIcon} size={13} /> Hear it
		</Button>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-lg border bg-surface-sunken p-3">
			<p class="label">Yamaha / Roland</p>
			<p class="tnum font-mono text-lg">{noteName(note, { convention: 'c3' })}</p>
			<p class="text-2xs text-muted-foreground">middle C = C3</p>
		</div>
		<div class="rounded-lg border bg-surface-sunken p-3">
			<p class="label">Scientific</p>
			<p class="tnum font-mono text-lg">{noteName(note, { convention: 'c4' })}</p>
			<p class="text-2xs text-muted-foreground">middle C = C4</p>
		</div>
		<div class="rounded-lg border bg-surface-sunken p-3">
			<p class="label">Frequency</p>
			<p class="tnum font-mono text-lg">
				{noteToFrequency(note).toFixed(1)}<span class="text-xs"> Hz</span>
			</p>
			<p class="text-2xs text-muted-foreground">A4 = 440 Hz</p>
		</div>
		<div class="rounded-lg border bg-surface-sunken p-3">
			<p class="label">On channel 10</p>
			<p class="truncate text-sm leading-tight font-medium">{GM_DRUMS[note] ?? '—'}</p>
			<p class="text-2xs text-muted-foreground">
				{isBlackKey(note) ? 'black key' : 'white key'} · pitch class {pitchClass(note)}
			</p>
		</div>
	</div>
</div>
