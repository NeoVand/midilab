<script lang="ts">
	/**
	 * Open a .mid file and take it apart, or build one and write it out.
	 *
	 * Everything here runs through the codec in `smf.ts`, which was written from
	 * the specification rather than pulled from a library — because reading the
	 * bytes is the lesson.
	 */
	import {
		flatten,
		isMeta,
		readMidiFile,
		summarise,
		writeMidiFile,
		type MidiFile,
		type TrackEvent
	} from '$lib/midi/smf';
	import { hexBytes, shortLabel } from '$lib/midi/messages';
	import { SequencePlayer, type ScheduledEvent } from '$lib/midi/player.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import EmptyState from '$lib/components/shell/EmptyState.svelte';
	import SmfDiagram from './SmfDiagram.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		FileUploadIcon,
		PlayIcon,
		StopIcon,
		CloudDownloadIcon
	} from '@hugeicons/core-free-icons';
	import { cn, downloadFile } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	let file = $state<MidiFile | null>(null);
	let filename = $state('');
	let raw = $state<Uint8Array | null>(null);
	let error = $state<string | null>(null);
	let dragging = $state(false);
	const player = new SequencePlayer();

	const summary = $derived(file ? summarise(file) : null);

	async function load(f: File) {
		error = null;
		try {
			const buffer = await f.arrayBuffer();
			file = readMidiFile(buffer);
			raw = new Uint8Array(buffer);
			filename = f.name;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			file = null;
			raw = null;
			filename = f.name;
		}
	}

	function open(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (f) load(f);
	}

	/*
	 * Dropping a file onto the page is how people actually open one, and the
	 * drop target is the whole panel — including after a file is already
	 * loaded, so swapping files does not mean hunting for the button again.
	 */
	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) load(f);
	}

	function play() {
		if (!file || !summary) return;
		const secondsPerTick = 60 / summary.tempo / file.division;
		const events: ScheduledEvent[] = flatten(file)
			.filter(
				(e): e is TrackEvent & { event: Exclude<TrackEvent['event'], { type: 'meta' }> } =>
					!isMeta(e.event)
			)
			.map((e) => ({ time: e.tick * secondsPerTick, message: e.event }));
		player.toggle(events);
	}

	function download() {
		// A small demo file, written by the same codec that reads them.
		const events: TrackEvent[] = [];
		const div = 480;
		const line = [60, 62, 64, 65, 67, 65, 64, 62];
		line.forEach((note, i) => {
			events.push({
				delta: 0,
				tick: i * div,
				event: { type: 'noteOn', channel: 0, note, velocity: 90 }
			});
			events.push({
				delta: 0,
				tick: i * div + div - 20,
				event: { type: 'noteOff', channel: 0, note, velocity: 0 }
			});
		});
		const bytes = writeMidiFile([{ name: 'Scale', events }], {
			division: div,
			bpm: 110,
			name: 'MIDI Lab demo'
		});
		downloadFile(bytes as BlobPart, 'midi-lab-demo.mid', 'audio/midi');
	}

	/** Annotated view of the first bytes: the header chunk, byte by byte. */
	const headerBreakdown = $derived.by(() => {
		if (!raw || raw.length < 14) return null;
		return [
			{ bytes: Array.from(raw.slice(0, 4)), label: '"MThd"', note: 'chunk type' },
			{ bytes: Array.from(raw.slice(4, 8)), label: 'length = 6', note: 'always 6 for a header' },
			{
				bytes: Array.from(raw.slice(8, 10)),
				label: `format ${(raw[8] << 8) | raw[9]}`,
				note: '0 = one track, 1 = parallel tracks, 2 = independent'
			},
			{
				bytes: Array.from(raw.slice(10, 12)),
				label: `${(raw[10] << 8) | raw[11]} tracks`,
				note: 'how many MTrk chunks follow'
			},
			{
				bytes: Array.from(raw.slice(12, 14)),
				label: `${(raw[12] << 8) | raw[13]} PPQN`,
				note: 'ticks per quarter note — the file’s own resolution'
			}
		];
	});
</script>

<div
	class={cn('flex flex-col gap-4', className)}
	role="region"
	aria-label="MIDI file lab"
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
>
	{#if file}
		<div class="flex flex-wrap items-center gap-3">
			<label>
				<input type="file" accept=".mid,.midi,audio/midi" class="sr-only" onchange={open} />
				<span
					class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
				>
					<HugeiconsIcon icon={FileUploadIcon} size={14} />
					Open another
				</span>
			</label>
			<Button variant="default" size="sm" class="gap-1.5" onclick={play}>
				<HugeiconsIcon icon={player.playing ? StopIcon : PlayIcon} size={14} />
				{player.playing ? 'Stop' : 'Play it'}
			</Button>
			<Button variant="outline" size="sm" class="gap-1.5" onclick={download}>
				<HugeiconsIcon icon={CloudDownloadIcon} size={14} />
				Write one
			</Button>
			<span class="truncate font-mono text-xs text-muted-foreground">{filename}</span>
		</div>
	{:else}
		<!--
			The state this panel is in until you give it something. It has room to
			say what a Standard MIDI File actually is, so it does — and the whole
			panel is a drop target, because that is how a file gets opened.
		-->
		<EmptyState
			icon={FileUploadIcon}
			title="Drop a .mid file here"
			body="It is parsed in the browser by a codec written from the specification — nothing is uploaded anywhere. You get the header byte by byte, every track, every event and its delta time, and you can play the whole thing through your own hardware."
			class={cn('transition-colors', dragging && 'border-msg-note bg-msg-note-bg')}
		>
			{#snippet figure()}
				<!-- Its own cap, now that EmptyState no longer imposes one. -->
				<div class="mx-auto max-w-md"><SmfDiagram /></div>
			{/snippet}
			{#snippet action()}
				<label>
					<input type="file" accept=".mid,.midi,audio/midi" class="sr-only" onchange={open} />
					<span
						class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						<HugeiconsIcon icon={FileUploadIcon} size={14} />
						Choose a file
					</span>
				</label>
				<Button variant="outline" size="sm" class="gap-1.5" onclick={download}>
					<HugeiconsIcon icon={CloudDownloadIcon} size={14} />
					Write and download one
				</Button>
			{/snippet}
		</EmptyState>
	{/if}

	{#if error}
		<p
			class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
		>
			<span class="font-mono">{filename}</span> could not be read: {error}
		</p>
	{/if}

	{#if summary && file}
		<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
			{#each [['Format', String(summary.format)], ['Division', `${summary.division} PPQN`], ['Tracks', String(summary.trackCount)], ['Notes', String(summary.noteCount)], ['Tempo', `${summary.tempo.toFixed(1)} BPM`], ['Length', `${summary.durationSeconds.toFixed(1)} s`]] as [label, value] (label)}
				<div class="rounded-lg border bg-surface-sunken p-3">
					<p class="label">{label}</p>
					<p class="tnum font-mono text-lg leading-tight">{value}</p>
				</div>
			{/each}
		</div>

		{#if headerBreakdown}
			<div class="flex flex-col gap-1.5 rounded-lg border p-4">
				<p class="label mb-1">The header chunk, byte by byte</p>
				{#each headerBreakdown as part (part.label)}
					<div class="flex flex-wrap items-baseline gap-3 text-xs">
						<code class="w-28 shrink-0 font-mono text-msg-sysex">{hexBytes(part.bytes)}</code>
						<span class="w-28 shrink-0 font-medium">{part.label}</span>
						<span class="text-muted-foreground">{part.note}</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex flex-col gap-2">
			{#each file.tracks as track, t (t)}
				{@const notes = track.events.filter(
					(e) => !isMeta(e.event) && e.event.type === 'noteOn'
				).length}
				<details class="rounded-lg border">
					<summary
						class="flex cursor-pointer items-baseline gap-3 px-4 py-2.5 text-sm hover:bg-accent/40"
					>
						<span class="font-mono text-xs text-muted-foreground">{t}</span>
						<span class="font-medium">{track.name ?? `Track ${t}`}</span>
						<span class="ml-auto font-mono text-xs text-muted-foreground">
							{track.events.length} events · {notes} notes
						</span>
					</summary>
					<div class="max-h-72 scrollbar-thin overflow-y-auto border-t">
						<table class="w-full font-mono text-xs">
							<tbody>
								{#each track.events.slice(0, 400) as e, i (i)}
									<tr class="border-b border-border/40">
										<td class="w-16 py-1 pr-2 pl-3 text-right text-muted-foreground">+{e.delta}</td>
										<td class="w-16 py-1 pr-2 text-right text-muted-foreground">{e.tick}</td>
										<td class="py-1 pr-3">
											{#if isMeta(e.event)}
												<span class="text-msg-program">{e.event.name}</span>
												<span class="text-muted-foreground">
													{e.event.text ??
														(e.event.tempo
															? `${e.event.tempo.toFixed(1)} BPM`
															: e.event.timeSignature
																? `${e.event.timeSignature.numerator}/${e.event.timeSignature.denominator}`
																: hexBytes(e.event.data))}
												</span>
											{:else}
												{shortLabel(e.event, { octaveConvention: settings.octaveConvention })}
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</details>
			{/each}
		</div>
	{/if}
</div>
