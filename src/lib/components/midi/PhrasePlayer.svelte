<script lang="ts">
	/** A play/stop button for a short demo phrase, with a progress bar. */
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		notes: NoteSpec[];
		bpm?: number;
		label?: string;
		loop?: boolean;
		variant?: 'default' | 'outline' | 'secondary' | 'ghost';
		class?: string;
	}
	let {
		notes,
		bpm = 110,
		label = 'Play',
		loop = false,
		variant = 'outline',
		class: className
	}: Props = $props();

	const player = new SequencePlayer();
	const events = $derived(notesToEvents(notes, bpm));
	const pct = $derived(
		player.duration ? Math.min(100, (player.position / player.duration) * 100) : 0
	);
</script>

<div class={cn('flex items-center gap-3', className)}>
	<Button {variant} size="sm" class="gap-1.5" onclick={() => player.toggle(events, { loop })}>
		<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={14} />
		{player.playing ? 'Stop' : label}
	</Button>
	<div class="h-1 flex-1 overflow-hidden rounded-full bg-muted">
		<div class="h-full bg-msg-note" style="width: {pct}%"></div>
	</div>
</div>
