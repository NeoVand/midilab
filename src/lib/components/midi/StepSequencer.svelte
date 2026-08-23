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
	import { onDestroy, onMount, untrack } from 'svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { transport, PPQ } from '$lib/midi/clock.svelte';
	import { audioToPerf } from '$lib/midi/clock.svelte';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { writeMidiFile, type TrackEvent } from '$lib/midi/smf';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlayIcon,
		StopIcon,
		Delete02Icon,
		CloudDownloadIcon,
		Add01Icon,
		VolumeOffIcon,
		VolumeHighIcon,
		Delete01Icon
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

	/**
	 * Pattern length is a control, not a constant. One bar is where you start;
	 * two is where a drum part usually ends up. Shrinking never truncates the
	 * arrays, so going 32 → 16 → 32 gives you your second bar back.
	 */
	let stepCount = $state(untrack(() => steps));
	function setStepCount(n: number) {
		stepCount = n;
		tracks = tracks.map((t) => ({
			...t,
			steps: t.steps.length >= n ? t.steps : [...t.steps, ...Array(n - t.steps.length).fill(0)]
		}));
	}

	let current = $state(-1);
	let painting = $state<number | null>(null);
	let velocity = $state(100);

	const ticksPerStep = $derived(PPQ / 4);
	const stepSeconds = $derived(60 / transport.bpm / 4);

	onMount(() =>
		transport.onTick((t) => {
			if (t.tick % ticksPerStep !== 0) return;
			const step = Math.floor(t.tick / ticksPerStep) % stepCount;
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

	/*
	 * Roving tabindex over the step grid.
	 *
	 * Five tracks of sixteen steps is eighty tab stops sitting between the
	 * toolbar and everything below it — nobody is Tab-ing eighty times to reach
	 * the channel strip. The grid is one stop; arrow keys move inside it, which
	 * is how every hardware step sequencer already works.
	 */
	let gridEl = $state<HTMLElement | null>(null);
	let focusCol = $state(0);

	function moveFocus(row: number, col: number) {
		const rows = tracks.length;
		if (rows === 0) return;
		const r = ((row % rows) + rows) % rows;
		const c = Math.max(0, Math.min(stepCount - 1, col));
		focusCol = c;
		queueMicrotask(() => gridEl?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus());
	}

	function onCellKey(e: KeyboardEvent, track: SeqTrack, row: number, col: number) {
		switch (e.key) {
			case 'ArrowLeft':
				moveFocus(row, col - 1);
				break;
			case 'ArrowRight':
				moveFocus(row, col + 1);
				break;
			case 'ArrowUp':
				moveFocus(row - 1, col);
				break;
			case 'ArrowDown':
				moveFocus(row + 1, col);
				break;
			case 'Home':
				moveFocus(row, 0);
				break;
			case 'End':
				moveFocus(row, stepCount - 1);
				break;
			case 'Enter':
			case ' ':
				toggle(track, col);
				painting = null;
				break;
			default:
				return;
		}
		e.preventDefault();
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
				steps: Array(stepCount).fill(0),
				mute: false
			}
		];
	}

	function removeTrack(id: string) {
		const t = tracks.find((x) => x.id === id);
		if (t) engine.send({ type: 'noteOff', channel: t.channel, note: t.note, velocity: 0 });
		tracks = tracks.filter((x) => x.id !== id);
	}

	function clearAll() {
		tracks = tracks.map((t) => ({ ...t, steps: Array(stepCount).fill(0) }));
	}

	function exportMid() {
		const division = 480;
		const perStep = division / 4;
		const out = tracks.map((t) => {
			const events: TrackEvent[] = [];
			t.steps.slice(0, stepCount).forEach((v, i) => {
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

<div class={cn('flex flex-col overflow-hidden rounded-lg border bg-card', className)}>
	<!-- transport and pattern controls -->
	<div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
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
			<span class="label">Length</span>
			{#each [16, 32] as n (n)}
				<button
					class={cn(
						'tnum rounded-md border px-1.5 py-0.5 font-mono text-2xs transition-colors',
						stepCount === n
							? 'border-foreground/30 text-foreground'
							: 'text-muted-foreground hover:border-foreground/20'
					)}
					onclick={() => setStepCount(n)}
				>
					{n}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-1.5">
			<span class="label">Velocity</span>
			{#each [50, 80, 100, 127] as v (v)}
				<button
					class={cn(
						'tnum rounded-md border px-1.5 py-0.5 font-mono text-2xs transition-colors',
						velocity === v
							? 'border-msg-note bg-msg-note-bg text-msg-note'
							: 'text-muted-foreground hover:border-foreground/20'
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

	<div class="panel-sunken scrollbar-thin overflow-x-auto p-3">
		<div bind:this={gridEl} class={stepCount > 16 ? 'min-w-[62rem]' : 'min-w-[42rem]'}>
			<!--
				The ruler counts beats, and the grid is grouped in fours to match.
				Sixteen evenly spaced squares give the eye nothing to count against —
				you cannot see where beat three begins, which is exactly when you
				need to.
			-->
			<div class="mb-1.5 flex gap-1 pl-32">
				{#each Array.from({ length: stepCount }, (_, i) => i) as i (i)}
					<div
						class={cn(
							'tnum flex-1 text-center font-mono text-2xs',
							i % 4 === 0 && i > 0 && 'ml-2',
							current === i && transport.playing
								? 'text-msg-note'
								: i % 4 === 0
									? 'text-muted-foreground'
									: 'text-muted-foreground/45'
						)}
					>
						{i % 4 === 0 ? i / 4 + 1 : '·'}
					</div>
				{/each}
			</div>

			{#each tracks as track, row (track.id)}
				<div class="mb-1 flex items-center gap-1">
					<div class="flex w-32 shrink-0 items-center gap-1.5 pr-2">
						<button
							class={cn(
								'shrink-0 transition-colors',
								track.mute ? 'text-muted-foreground/40' : 'text-msg-note'
							)}
							onclick={() => (track.mute = !track.mute)}
							aria-label={track.mute ? `Unmute ${track.name}` : `Mute ${track.name}`}
						>
							<HugeiconsIcon icon={track.mute ? VolumeOffIcon : VolumeHighIcon} size={13} />
						</button>

						<!--
							A track you can add but cannot configure is a trap: the new
							one lands on note 60, channel 1, and nothing on screen lets
							you move it. Click the name.
						-->
						<Popover.Root>
							<Popover.Trigger
								class="min-w-0 flex-1 truncate rounded-sm px-0.5 text-left text-xs transition-colors hover:text-foreground"
								title="Edit track"
							>
								{label(track)}
							</Popover.Trigger>
							<Popover.Content class="flex w-60 flex-col gap-3" align="start">
								<div class="flex flex-col gap-1.5">
									<span class="label">Name</span>
									<Input bind:value={track.name} class="h-7 text-xs" />
								</div>
								<div class="flex gap-3">
									<div class="flex flex-col gap-1.5">
										<span class="label">Note</span>
										<Input
											type="number"
											min="0"
											max="127"
											value={track.note}
											oninput={(e) =>
												(track.note = Math.max(
													0,
													Math.min(127, Number(e.currentTarget.value) || 0)
												))}
											class="tnum h-7 w-20 font-mono text-xs"
										/>
									</div>
									<div class="flex flex-col gap-1.5">
										<span class="label">Channel</span>
										<NativeSelect
											value={String(track.channel)}
											onchange={(e) => (track.channel = Number(e.currentTarget.value))}
											class="w-20"
										>
											{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
												<NativeSelectOption value={String(c)}>
													{c + 1}{c === 9 ? ' · drums' : ''}
												</NativeSelectOption>
											{/each}
										</NativeSelect>
									</div>
								</div>
								<p class="text-2xs leading-relaxed text-muted-foreground">
									{track.channel === 9
										? (GM_DRUMS[track.note] ?? 'No General MIDI drum at this note.')
										: `Plays ${noteName(track.note, { convention: settings.octaveConvention })} on channel ${track.channel + 1}.`}
								</p>
								<Popover.Close
									class="flex items-center gap-1.5 self-start text-xs text-destructive hover:underline"
									onclick={() => removeTrack(track.id)}
								>
									<HugeiconsIcon icon={Delete01Icon} size={12} /> Remove track
								</Popover.Close>
							</Popover.Content>
						</Popover.Root>

						<span class="tnum shrink-0 font-mono text-2xs text-muted-foreground">
							{track.channel + 1}
						</span>
					</div>
					{#each track.steps.slice(0, stepCount) as v, i (i)}
						<button
							class={cn(
								'h-7 flex-1 rounded-xs border transition-colors',
								i % 4 === 0 && i > 0 && 'ml-2',
								current === i && transport.playing && 'ring-1 ring-msg-note/60'
							)}
							style:background={v
								? `color-mix(in oklch, var(--msg-note) ${25 + (v / 127) * 60}%, transparent)`
								: 'var(--background)'}
							style:border-color={v ? 'var(--msg-note)' : ''}
							data-cell="{row}-{i}"
							tabindex={i === focusCol ? 0 : -1}
							onpointerdown={() => toggle(track, i)}
							onpointerenter={() => paint(track, i)}
							onkeydown={(e) => onCellKey(e, track, row, i)}
							onfocus={() => (focusCol = i)}
							aria-label="{track.name}, step {i + 1} of {stepCount}"
							aria-pressed={!!v}
						></button>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<p class="border-t px-3 py-2 text-xs text-muted-foreground">
		Click a step to toggle it, drag across to paint. Click a track name to change its note or
		channel. The playhead is driven by the same transport as the dock, so this stays in time with
		anything else the app is doing.
	</p>
</div>
