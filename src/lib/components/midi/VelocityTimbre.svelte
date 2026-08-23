<script lang="ts">
	/**
	 * The same number, two receivers, two different results.
	 *
	 * The lesson's claim is that velocity is a number the sender chooses and
	 * the receiver interprets, and that what the receiver does with it is
	 * entirely up to the receiver. That is easy to assert and hard to believe
	 * until you hear the same byte land differently — so this plays one note at
	 * a velocity you pick, through whichever of the two engines this app has,
	 * and puts the spectrum on screen while it does.
	 *
	 * Sampled General MIDI switches to a different recording as you play
	 * harder; the built-in synth opens a filter. Both are legitimate readings
	 * of the same seven bits, and neither is in the message.
	 */
	import Scope from './Scope.svelte';
	import EngineToggle from './EngineToggle.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { gm } from '$lib/audio/gm.svelte';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		note?: number;
		class?: string;
	}
	let { note = 60, class: className }: Props = $props();

	/** Spread across the range, including the two ends that behave oddly. */
	const STEPS = [1, 24, 48, 72, 100, 127];

	let last = $state<number | null>(null);
	let timer = 0;

	function hit(velocity: number) {
		clearTimeout(timer);
		last = velocity;
		engine.noteOn(note, velocity, engine.channel);
		timer = window.setTimeout(() => engine.noteOff(note, engine.channel), 1200);
	}
	onDestroy(() => clearTimeout(timer));
</script>

<div class={cn('flex flex-col gap-3 rounded-lg border p-4', className)}>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<p class="text-sm">
			Play {noteName(note, { convention: settings.octaveConvention })} at
		</p>
		<EngineToggle />
	</div>

	<div class="flex flex-wrap gap-1.5">
		{#each STEPS as v (v)}
			<button
				type="button"
				onclick={() => hit(v)}
				aria-pressed={last === v}
				class="tnum flex-1 rounded-md border py-2 font-mono text-sm transition-colors
					hover:border-foreground/30 hover:bg-accent
					aria-pressed:border-msg-note aria-pressed:text-msg-note"
			>
				{v}
			</button>
		{/each}
	</div>

	<Scope label="What came out" height={110} />

	<p class="text-xs leading-relaxed text-muted-foreground">
		{#if gm.enabled}
			Sampled instruments are recorded several times at different strengths, and velocity picks
			which recording you get. A hard piano note is not a loud soft note — it is a different sound,
			with more high partials in it, which is why the bars on the right grow faster than the ones on
			the left.
		{:else}
			The built-in synth reads velocity as loudness <em>and</em> as brightness: harder notes open a filter
			further, so more of the harmonic series gets through. Watch the right-hand bars appear as you climb.
		{/if}
		Nothing in the message says to do either. The number is seven bits; the meaning is the receiver's.
	</p>
</div>
