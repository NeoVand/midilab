<script lang="ts">
	/**
	 * Holds a note or chord so you can hear a controller change take effect
	 * mid-note. Releases on unmount, because a lesson that leaves a drone
	 * running when you navigate away would be teaching the wrong lesson.
	 */
	import { onDestroy } from 'svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		notes?: number[];
		channel?: number;
		velocity?: number;
		label?: string;
		/**
		 * General MIDI program to hold the drone on, sent when it starts.
		 * `null` leaves whatever is selected alone.
		 *
		 * A drone exists so that something is still sounding while you turn a
		 * controller, which makes the instrument load-bearing rather than
		 * decorative: on a voice that decays away, the note has gone before you
		 * reach the knob and there is nothing left to hear the change in.
		 */
		program?: number | null;
		class?: string;
	}
	let {
		notes = [48, 55, 64],
		channel = 0,
		velocity = 90,
		label = 'Hold a drone',
		program = null,
		class: className
	}: Props = $props();

	let sounding = $state(false);

	async function toggle() {
		if (sounding) return stop();
		await engine.wake();
		if (program !== null) engine.programChange(program, channel);
		for (const n of notes) engine.noteOn(n, velocity, channel);
		sounding = true;
	}

	function stop() {
		for (const n of notes) engine.noteOff(n, channel);
		sounding = false;
	}

	onDestroy(stop);
</script>

<Button
	variant={sounding ? 'default' : 'outline'}
	size="sm"
	class={cn('gap-1.5', className)}
	onclick={toggle}
>
	<HugeiconsIcon icon={sounding ? StopIcon : PlayIcon} size={14} />
	{sounding ? 'Stop the drone' : label}
</Button>
