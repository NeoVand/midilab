<script lang="ts">
	/**
	 * A play/stop button for a short demo phrase, with a progress bar.
	 *
	 * It sends a Program Change before it plays, and that is not a nicety.
	 * Every widget on a page shares the engine's channel, so a player that only
	 * sends notes inherits whatever instrument the last widget selected — which
	 * meant a demonstration of consonance could arrive on a woodblock, with no
	 * sustain for two notes to overlap in and therefore nothing whatsoever to
	 * hear. A phrase that is about *pitch* or *duration* needs an instrument
	 * that holds a note, and the only way to be sure of one is to ask for it.
	 *
	 * The default is an acoustic grand: familiar, clear attack, and a note that
	 * stops when its Note Off arrives, so length is audible rather than implied.
	 */
	import { untrack } from 'svelte';
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import VoicePicker from './VoicePicker.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		notes: NoteSpec[];
		bpm?: number;
		label?: string;
		loop?: boolean;
		/**
		 * General MIDI program to play through. Sent on every play, so the
		 * phrase always sounds the way the lesson intended however the reader
		 * arrived at it.
		 *
		 * `null` means "leave the instrument alone" — for an arrangement that
		 * spans several channels and has already set each one up itself, where
		 * sending one program would silently overwrite one of the parts.
		 */
		program?: number | null;
		/** Let the reader change the instrument. On by default. */
		voice?: boolean;
		channel?: number;
		variant?: 'default' | 'outline' | 'secondary' | 'ghost';
		class?: string;
	}
	let {
		notes,
		bpm = 110,
		label = 'Play',
		loop = false,
		program = 0,
		voice = true,
		channel = 0,
		variant = 'outline',
		class: className
	}: Props = $props();

	// Seeded from the prop, then owned by the picker: the lesson chooses the
	// voice it wants, and the reader may overrule it from there.
	let chosen = $state(untrack(() => program ?? 0));
	const fixed = $derived(program === null);

	const player = new SequencePlayer();
	const events = $derived(notesToEvents(notes, bpm));
	const pct = $derived(
		player.duration ? Math.min(100, (player.position / player.duration) * 100) : 0
	);

	async function toggle() {
		if (player.playing) {
			player.stop();
			return;
		}
		await engine.wake();
		if (!fixed) engine.programChange(chosen, channel);
		player.play(events, { loop });
	}
</script>

<div class={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
	<Button {variant} size="sm" class="gap-1.5" onclick={toggle}>
		<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={14} />
		{player.playing ? 'Stop' : label}
	</Button>
	<!-- The track only exists while there is progress to show. Idle, it was four
	     hundred pixels of grey line reading as an empty input field. -->
	{#if player.playing}
		<div class="h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
			<div class="h-full bg-msg-note" style="width: {pct}%"></div>
		</div>
	{:else}
		<div class="flex-1"></div>
	{/if}
	{#if voice && !fixed}
		<VoicePicker bind:value={chosen} {channel} />
	{/if}
</div>
