<script lang="ts">
	/**
	 * Quantisation and swing, as timing offsets rather than as a "feel" knob.
	 *
	 * The grid shows where each hit is *supposed* to be; the marker shows where
	 * it will actually be sent. Swing is nothing more mysterious than pushing
	 * every second sixteenth later by a fraction of its own length.
	 */
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		bpm?: number;
		swing?: number;
		humanise?: number;
		class?: string;
	}
	let {
		bpm = 96,
		swing = $bindable(0),
		humanise = $bindable(0),
		class: className
	}: Props = $props();

	const LANES = [
		{ note: 36, name: 'Kick', steps: [0, 4, 8, 10, 14] },
		{ note: 38, name: 'Snare', steps: [4, 12] },
		{ note: 42, name: 'Hat', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }
	];

	/** Deterministic per-step wobble so the display matches what is played. */
	const wobble = LANES.map((l) =>
		l.steps.map((s) => (Math.sin(s * 12.9898 + l.note) * 43758.5453) % 1)
	);

	const player = new SequencePlayer();

	function offsetFor(step: number, laneIndex: number, stepIndex: number): number {
		// Swing delays every odd sixteenth by a fraction of a sixteenth.
		const swung = step % 2 === 1 ? (swing / 100) * 0.5 : 0;
		const human = (wobble[laneIndex][stepIndex] * 2 - 1) * (humanise / 1000) * (bpm / 60);
		return swung * 0.25 + human;
	}

	const notes = $derived.by((): NoteSpec[] => {
		const out: NoteSpec[] = [];
		LANES.forEach((lane, li) => {
			lane.steps.forEach((step, si) => {
				out.push({
					note: lane.note,
					start: Math.max(0, step * 0.25 + offsetFor(step, li, si)),
					duration: 0.12,
					velocity: lane.note === 42 ? (step % 4 === 0 ? 92 : 62) : 112,
					channel: 9
				});
			});
		});
		return out;
	});

	const events = $derived(notesToEvents(notes, bpm));
</script>

<div class={cn('flex flex-col gap-4 rounded-lg border p-4', className)}>
	<div class="flex flex-wrap items-center gap-5">
		<Button
			variant={player.playing ? 'default' : 'outline'}
			size="sm"
			class="gap-1.5"
			onclick={() => player.toggle(events, { loop: true })}
		>
			<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={14} />
			{player.playing ? 'Stop' : 'Play the loop'}
		</Button>

		<label class="flex min-w-48 flex-1 items-center gap-3">
			<span class="w-14 text-xs text-muted-foreground">Swing</span>
			<Slider type="single" bind:value={swing} min={0} max={75} step={1} />
			<span class="tnum w-10 text-right font-mono text-xs">{swing}%</span>
		</label>

		<label class="flex min-w-48 flex-1 items-center gap-3">
			<span class="w-16 text-xs text-muted-foreground">Humanise</span>
			<Slider type="single" bind:value={humanise} min={0} max={40} step={1} />
			<span class="tnum w-12 text-right font-mono text-xs">±{humanise}ms</span>
		</label>
	</div>

	<div class="flex flex-col gap-1.5">
		{#each LANES as lane, li (lane.note)}
			<div class="flex items-center gap-2">
				<span class="w-12 shrink-0 text-xs text-muted-foreground">{lane.name}</span>
				<div class="panel-sunken relative h-7 flex-1 overflow-hidden rounded-md border">
					<!-- the grid the notes are "supposed" to sit on -->
					{#each Array.from({ length: 16 }, (_, i) => i) as i (i)}
						<div
							class={cn(
								'absolute inset-y-0 w-px',
								i % 4 === 0 ? 'bg-grid-line-strong' : 'bg-grid-line'
							)}
							style="left: {(i / 16) * 100}%"
						></div>
					{/each}
					{#each lane.steps as step, si (step)}
						{@const nominal = (step / 16) * 100}
						{@const actual = ((step * 0.25 + offsetFor(step, li, si)) / 4) * 100}
						<div
							class="absolute inset-y-2 w-[3px] rounded-full bg-muted-foreground/25"
							style="left: {nominal}%"
						></div>
						<div
							class="absolute inset-y-1 w-[3px] rounded-full bg-msg-note transition-[left] duration-150"
							style="left: {actual}%"
						></div>
					{/each}
				</div>
			</div>
		{/each}
		<p class="pl-14 text-xs text-muted-foreground">
			Grey marks the exact grid position; green marks where the note is actually sent.
		</p>
	</div>
</div>
