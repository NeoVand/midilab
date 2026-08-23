<script lang="ts">
	/**
	 * A step sequencer driven by the app's transport.
	 *
	 * Every step is placed with the tick's own timestamps rather than fired when
	 * the callback happens to run, so this is a working example of Lesson 17
	 * rather than a demonstration of the problem. Note Offs are scheduled at the
	 * same moment as their Note Ons, which is why stopping mid-pattern never
	 * leaves anything hanging.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { transport, PPQ } from '$lib/midi/clock.svelte';
	import { audioToPerf } from '$lib/midi/clock.svelte';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { writeMidiFile, type TrackEvent } from '$lib/midi/smf';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlayIcon,
		StopIcon,
		Delete02Icon,
		CloudDownloadIcon,
		Add01Icon,
		VolumeOffIcon,
		VolumeHighIcon
	} from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	export interface SeqTrack {
		id: string;
		name: string;
		note: number;
		channel: number;
		steps: number[];
		mute: boolean;
	}

	interface Props {
		steps?: number;
		tracks?: SeqTrack[];
		class?: string;
	}

	function drumTrack(name: string, note: number, pattern: number[]): SeqTrack {
		return {
			id: `t-${note}`,
			name,
			note,
			channel: 9,
			steps: pattern,
			mute: false
		};
	}

	const DEFAULT: SeqTrack[] = [
		drumTrack('Kick', 36, [110, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 96, 0]),
		drumTrack('Snare', 38, [0, 0, 0, 0, 104, 0, 0, 0, 0, 0, 0, 0, 104, 0, 0, 0]),
		drumTrack('Hat', 42, [70, 0, 58, 0, 70, 0, 58, 0, 70, 0, 58, 0, 70, 0, 62, 0]),
		drumTrack('Open hat', 46, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 78, 0, 0, 0, 0, 0]),
		{
			id: 't-bass',
			name: 'Bass',
			note: 36,
			channel: 0,
			steps: [100, 0, 0, 0, 0, 0, 96, 0, 0, 0, 100, 0, 0, 0, 0, 0],
			mute: false
		}
	];

	let { steps = 16, tracks = $bindable(DEFAULT), class: className }: Props = $props();

	let current = $state(-1);
	let painting = $state<number | null>(null);
	let velocity = $state(100);

	const ticksPerStep = $derived(PPQ / 4);
	const stepSeconds = $derived(60 / transport.bpm / 4);

	onMount(() =>
		transport.onTick((t) => {
			if (t.tick % ticksPerStep !== 0) return;
			const step = Math.floor(t.tick / ticksPerStep) % steps;
			current = step;
			for (const track of tracks) {
				if (track.mute) continue;
				const v = track.steps[step];
				if (!v) continue;
				engine.send(
					{ type: 'noteOn', channel: track.channel, note: track.note, velocity: v },
					audioToPerf(t.audioTime),
					t.audioTime
				);
				const off = t.audioTime + stepSeconds * 0.85;
				engine.send(
					{ type: 'noteOff', channel: track.channel, note: track.note, velocity: 0 },
					audioToPerf(off),
					off
				);
			}
		})
	);

	onDestroy(() => {
		for (const t of tracks)
			engine.send({ type: 'noteOff', channel: t.channel, note: t.note, velocity: 0 });
	});

	function toggle(track: SeqTrack, i: number) {
		const next = track.steps[i] ? 0 : velocity;
		track.steps[i] = next;
		painting = next;
	}

	function paint(track: SeqTrack, i: number) {
		if (painting === null) return;
		track.steps[i] = painting;
	}

	function label(t: SeqTrack): string {
		return t.channel === 9
			? (GM_DRUMS[t.note] ?? t.name)
			: `${t.name} · ${noteName(t.note, { convention: settings.octaveConvention })}`;
	}

	function addTrack() {
		tracks = [
			...tracks,
			{
				id: `t-${Date.now().toString(36)}`,
				name: 'Track',
				note: 60,
				channel: 0,
				steps: Array(steps).fill(0),
				mute: false
			}
		];
	}

	function clearAll() {
		tracks = tracks.map((t) => ({ ...t, steps: Array(steps).fill(0) }));
	}

	function exportMid() {
		const division = 480;
		const perStep = division / 4;
		const out = tracks.map((t) => {
			const events: TrackEvent[] = [];
			t.steps.forEach((v, i) => {
				if (!v) return;
				const tick = i * perStep;
				events.push({
					delta: 0,
					tick,
					event: { type: 'noteOn', channel: t.channel, note: t.note, velocity: v }
				});
				events.push({
					delta: 0,
					tick: tick + Math.round(perStep * 0.85),
					event: { type: 'noteOff', channel: t.channel, note: t.note, velocity: 0 }
				});
			});
			return { name: t.name, events };
		});
		const bytes = writeMidiFile(out, { division, bpm: transport.bpm, name: 'MIDI Lab pattern' });
		const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/midi' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'pattern.mid';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:window onpointerup={() => (painting = null)} />

<div class={cn('flex flex-col gap-3', className)}>
	<div class="flex flex-wrap items-center gap-2">
		<Button
			variant={transport.playing ? 'default' : 'outline'}
			size="sm"
			class="gap-1.5"
			onclick={async () => {
				await engine.wake();
				transport.toggle();
			}}
		>
			<HugeiconsIcon icon={transport.playing ? StopIcon : PlayIcon} size={14} />
			{transport.playing ? 'Stop' : 'Play'}
		</Button>
		<span class="tnum font-mono text-sm text-readout">{transport.bpm.toFixed(1)} BPM</span>
		<div class="flex items-center gap-1.5">
			<span class="text-xs text-muted-foreground">Paint velocity</span>
			{#each [50, 80, 100, 127] as v (v)}
				<button
					class={cn(
						'tnum rounded border px-1.5 py-0.5 font-mono text-[10px]',
						velocity === v
							? 'border-msg-note bg-msg-note-bg text-msg-note'
							: 'text-muted-foreground'
					)}
					onclick={() => (velocity = v)}
				>
					{v}
				</button>
			{/each}
		</div>
		<div class="flex-1"></div>
		<Button variant="ghost" size="sm" class="gap-1.5 text-xs" onclick={addTrack}>
			<HugeiconsIcon icon={Add01Icon} size={13} /> Track
		</Button>
		<Button variant="ghost" size="sm" class="gap-1.5 text-xs" onclick={clearAll}>
			<HugeiconsIcon icon={Delete02Icon} size={13} /> Clear
		</Button>
		<Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={exportMid}>
			<HugeiconsIcon icon={CloudDownloadIcon} size={13} /> Export .mid
		</Button>
	</div>

	<div class="scrollbar-thin overflow-x-auto">
		<div class="min-w-[42rem]">
			<!-- step ruler -->
			<div class="mb-1 flex gap-1 pl-32">
				{#each Array.from({ length: steps }, (_, i) => i) as i (i)}
					<div
						class={cn(
							'flex-1 text-center font-mono text-[9px]',
							current === i && transport.playing ? 'text-msg-note' : 'text-muted-foreground/40'
						)}
					>
						{i % 4 === 0 ? i / 4 + 1 : ''}
					</div>
				{/each}
			</div>

			{#each tracks as track (track.id)}
				<div class="mb-1 flex items-center gap-1">
					<div class="flex w-32 shrink-0 items-center gap-1.5 pr-2">
						<button
							class={cn('shrink-0', track.mute ? 'text-muted-foreground/40' : 'text-msg-note')}
							onclick={() => (track.mute = !track.mute)}
							aria-label={track.mute ? 'Unmute' : 'Mute'}
						>
							<HugeiconsIcon icon={track.mute ? VolumeOffIcon : VolumeHighIcon} size={13} />
						</button>
						<span class="truncate text-[11px]">{label(track)}</span>
						<span class="ml-auto font-mono text-[9px] text-muted-foreground/50">
							{track.channel + 1}
						</span>
					</div>
					{#each track.steps.slice(0, steps) as v, i (i)}
						<button
							class={cn(
								'h-7 flex-1 rounded-[3px] border transition-colors',
								i % 4 === 0 && 'border-l-grid-line-strong',
								current === i && transport.playing && 'ring-1 ring-msg-note/60'
							)}
							style:background={v
								? `color-mix(in oklch, var(--msg-note) ${25 + (v / 127) * 60}%, transparent)`
								: 'var(--surface-sunken)'}
							style:border-color={v ? 'var(--msg-note)' : ''}
							onpointerdown={() => toggle(track, i)}
							onpointerenter={() => paint(track, i)}
							aria-label="Step {i + 1} of {track.name}"
						></button>
					{/each}
				</div>
			{/each}
		</div>
	</div>
	<p class="text-[11px] text-muted-foreground">
		Click a step to toggle it, drag across to paint. The playhead is driven by the same transport as
		the dock, so this stays in time with anything else the app is doing.
	</p>
</div>
