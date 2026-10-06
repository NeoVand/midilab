<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { StudioSession } from '$lib/studio/session.svelte';
	import { STUDIO_EXAMPLES, createProject } from '$lib/studio/examples';
	import { makeNote, projectToMidiFile, serializeProject, type TrackId } from '$lib/studio/model';
	import { bus } from '$lib/midi/bus';
	import { noteName } from '$lib/midi/notes';
	import { channelColour } from '$lib/midi/channelcolour';
	import { GM_PROGRAMS } from '$lib/midi/constants';
	import { drumKit } from '$lib/audio/drum-machines';
	import { settings } from '$lib/stores/settings.svelte';
	import { metronome } from '$lib/audio/metronome.svelte';
	import { path } from '$lib/nav';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import PadGrid from '$lib/components/midi/PadGrid.svelte';
	import VoicePicker from '$lib/components/midi/VoicePicker.svelte';
	import StudioTimeline from './StudioTimeline.svelte';
	import StudioNoteEditor from './StudioNoteEditor.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Field from '$lib/components/ui/field';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import * as Alert from '$lib/components/ui/alert';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlayIcon,
		StopIcon,
		RecordIcon,
		RepeatIcon,
		UndoIcon,
		RedoIcon,
		SaveIcon,
		CloudDownloadIcon,
		Upload01Icon
	} from '@hugeicons/core-free-icons';
	import { downloadFile } from '$lib/utils';

	const session = new StudioSession();
	const example = $derived(
		STUDIO_EXAMPLES.find((example) => example.id === session.project.exampleId) ??
			STUDIO_EXAMPLES[0]
	);
	let velocity = $state(96);
	let octave = $state(0);
	let fileInput: HTMLInputElement | undefined;
	let importError = $state('');
	let latest = $state<{ bytes: string; note: string; channel: number } | null>(null);
	const prompts: Record<TrackId, { title: string; action: string; result: string }> = {
		drums: {
			title: 'Make a pocket, then make some space.',
			action: 'Quiet the hats in B',
			result: 'The second-half hats are softer. Listen to the backbeat come forward.'
		},
		bass: {
			title: 'Give the chords somewhere to stand.',
			action: 'Shorten the bass in B',
			result: 'The second-half bass notes are shorter. Listen for the space between them.'
		},
		chords: {
			title: 'Let a small change lift the second half.',
			action: 'Lift the chords in B',
			result: 'The second-half chords have a little more energy. The pitches stay the same.'
		},
		melody: {
			title: 'Say something small. Leave room for an answer.',
			action: 'Answer the opening higher',
			result:
				'The opening idea returns an octave higher in bar 5. A familiar rhythm can make a new phrase.'
		}
	};
	const inputProjectId = $derived(session.project.id);
	const homeLow = $derived.by(() => {
		void inputProjectId;
		const partId = session.selectedTrack;
		const empty = untrack(() => session.track.notes.length === 0);
		const fallback = partId === 'bass' ? 24 : 48;
		if (empty) return fallback;
		const authored = createProject(example.id).tracks.find((track) => track.id === partId);
		const pitch = authored?.notes[0]?.note ?? fallback + 12;
		return Math.max(0, Math.floor(pitch / 12) * 12 - 12);
	});
	const low = $derived(homeLow + octave * 12);
	const totalNotes = $derived(
		session.project.tracks.reduce((total, track) => total + track.notes.length, 0)
	);
	const positionLabel = $derived(
		`${Math.floor(session.position / 4) + 1}.${Math.floor(session.position % 4) + 1}`
	);

	onMount(() => {
		const detach = session.attach();
		const unsubscribe = bus.subscribe((event) => {
			if (event.message.type !== 'noteOn' || !event.message.velocity) return;
			latest = {
				bytes: event.bytes
					.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
					.join(' '),
				note: noteName(event.message.note, { convention: settings.octaveConvention }),
				channel: event.message.channel
			};
		});
		return () => {
			unsubscribe();
			detach();
		};
	});

	afterNavigate(() => {
		session.openLinkedExample(page.url.searchParams.get('example'));
	});

	function variation() {
		const id = session.selectedTrack;
		session.edit((project) => {
			const track = project.tracks.find((track) => track.id === id)!;
			if (id === 'drums')
				track.notes = track.notes.map((note) =>
					note.start >= 16 && [42, 46].includes(note.note)
						? { ...note, velocity: Math.max(20, note.velocity - 20) }
						: note
				);
			if (id === 'bass')
				track.notes = track.notes.map((note) =>
					note.start >= 16 ? { ...note, duration: Math.max(0.125, note.duration * 0.65) } : note
				);
			if (id === 'chords')
				track.notes = track.notes.map((note) =>
					note.start >= 16 ? { ...note, velocity: Math.min(127, note.velocity + 12) } : note
				);
			if (id === 'melody') {
				const opening = track.notes.filter((note) => note.start < 4);
				track.notes = [
					...track.notes.filter((note) => note.start < 16 || note.start >= 20),
					...opening.map((note) =>
						makeNote(Math.min(127, note.note + 12), note.start + 16, note.duration, note.velocity)
					)
				];
			}
		});
		session.selectedBar = 4;
		session.selectedNote = null;
		session.status = prompts[id].result;
	}

	function filename(extension: string) {
		return `${session.project.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'My first track'}.${extension}`;
	}
	function exportMidi() {
		const bytes = projectToMidiFile(session.project);
		downloadFile(new Uint8Array(bytes).buffer, filename('mid'), 'audio/midi');
		session.status = 'MIDI exported with tempo, instruments, and four named parts.';
	}
	function backup() {
		downloadFile(serializeProject(session.project), filename('json'), 'application/json');
		session.status = 'Project backup downloaded. Import it here to keep editing.';
	}
	async function importFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			if (file.size > 2_000_000) throw new Error('Choose a project backup smaller than 2 MB.');
			session.importProject(await file.text());
			void goto(path('/lab/studio'), { replaceState: true, noScroll: true });
			importError = '';
		} catch (error) {
			importError = error instanceof Error ? error.message : 'This project could not be imported.';
		}
		input.value = '';
	}
	function record() {
		if (session.counting) session.stop();
		else if (session.recording) session.finishTake();
		else void session.play(true);
	}
	function releaseControlFocus() {
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	}
</script>

<svelte:window
	onblur={() => {
		if (session.armed) session.stop();
	}}
/>

<div class="studio">
	<div class="studio-intro">
		<div>
			<h1>Your first eight bars.</h1>
			<p>
				A beat, a bassline, a few chords, and an idea worth humming. Hear an original example,
				change one thing, then play your own part.
			</p>
		</div>
		<a href={path('/learn/just-enough-music')} class="learn-link">Build your music foundations</a>
	</div>

	<section class="arrangement" aria-label="First Track Studio">
		<div class="starter-bar">
			<div>
				<span class="text-xs text-muted-foreground">Start with a feeling</span><ToggleGroup.Root
					type="single"
					variant="outline"
					value={session.project.exampleId}
					onValueChange={(value) => {
						if (value) {
							void goto(path(`/lab/studio?example=${value}`), {
								replaceState: true,
								noScroll: true
							});
							releaseControlFocus();
						}
					}}
					class="mt-2 flex-wrap"
					aria-label="Original starter tracks"
				>
					{#each STUDIO_EXAMPLES as starter (starter.id)}<ToggleGroup.Item value={starter.id}
							>{starter.title}</ToggleGroup.Item
						>{/each}
				</ToggleGroup.Root>
			</div>
			<div class="starter-description">
				<strong>{example.feel}</strong>
				<p>{example.description}</p>
			</div>
		</div>
		<div class="transport-row">
			<div class="transport-main">
				<Button
					size="xl"
					onclick={() => {
						if (session.playing) session.stop();
						else void session.play();
						releaseControlFocus();
					}}
					><HugeiconsIcon
						icon={session.playing ? StopIcon : PlayIcon}
						data-icon="inline-start"
					/>{session.playing ? 'Stop' : 'Hear your track'}</Button
				>
				<Button
					variant={session.armed ? 'destructive' : 'outline'}
					size="lg"
					onclick={() => {
						record();
						releaseControlFocus();
					}}
					><HugeiconsIcon
						icon={session.armed ? StopIcon : RecordIcon}
						data-icon="inline-start"
					/>{session.counting
						? 'Cancel count-in'
						: session.recording
							? 'Keep this take'
							: `Record ${session.track.name.toLowerCase()}`}</Button
				>
				<Button
					variant={session.loop ? 'secondary' : 'ghost'}
					size="icon-lg"
					aria-label="Loop eight bars"
					aria-pressed={session.loop}
					onclick={() => {
						session.loop = !session.loop;
					}}><HugeiconsIcon icon={RepeatIcon} data-icon="inline-start" /></Button
				>
				<span class="position" aria-label="Playback position"
					>{session.counting ? `In ${session.counting}` : positionLabel}</span
				>
			</div>
			<div class="tempo-actions">
				<Field.Field orientation="horizontal" class="w-auto gap-2"
					><Field.FieldLabel for="studio-tempo">BPM</Field.FieldLabel><Input
						id="studio-tempo"
						type="number"
						min={40}
						max={220}
						value={session.project.bpm}
						disabled={session.armed}
						onchange={(event) => session.setTempo(Number(event.currentTarget.value))}
						class="w-16"
					/></Field.Field
				>
				<Button
					variant="ghost"
					size="icon"
					disabled={!session.canUndo || session.armed}
					aria-label="Undo"
					onclick={() => session.undo()}
					><HugeiconsIcon icon={UndoIcon} data-icon="inline-start" /></Button
				>
				<Button
					variant="ghost"
					size="icon"
					disabled={!session.canRedo || session.armed}
					aria-label="Redo"
					onclick={() => session.redo()}
					><HugeiconsIcon icon={RedoIcon} data-icon="inline-start" /></Button
				>
			</div>
		</div>
		<div class="harmony-strip" aria-label="Chord progression">
			<span>{session.project.key}</span>{#each example.chords as chord, bar (bar)}<span
					class:current={session.playing && Math.floor(session.position / 4) === bar}>{chord}</span
				>{/each}
		</div>
		<StudioTimeline {session} />
		<div class="playback-status" role="status">
			<span class:recording={session.armed} class:playing={session.playing} class="status-light"
			></span><span>{session.status}</span><span class="note-count">{totalNotes} notes</span>
		</div>
	</section>

	<div class="creation-area">
		<section
			class="perform-panel"
			aria-label="Play your selected part"
			style:--track-color={channelColour(session.track.channel)}
		>
			<div class="guided-step">
				<span class="part-number"
					>{session.project.tracks.findIndex((track) => track.id === session.selectedTrack) +
						1}</span
				>
				<div>
					<h2>{prompts[session.selectedTrack].title}</h2>
					<p>{example.tips[session.selectedTrack]}</p>
				</div>
			</div>
			<div class="instrument-strip">
				<strong>{session.track.name}</strong><span>Channel {session.track.channel + 1}</span
				>{#if session.armed}<span
						>{session.selectedTrack === 'drums'
							? drumKit(session.track.program).name
							: GM_PROGRAMS[session.track.program]}</span
					>{:else}<VoicePicker
						value={session.track.program}
						channel={session.track.channel}
						audition={!session.playing}
						title={session.selectedTrack === 'drums' ? 'Choose a drum kit' : 'Choose an instrument'}
						onValue={(program) => session.setProgram(program)}
					/>{/if}
			</div>
			<Field.FieldGroup class="flex-row flex-wrap gap-3 px-4 py-3">
				<Field.Field class="w-24"
					><Field.FieldLabel for="studio-velocity">Velocity</Field.FieldLabel><Input
						id="studio-velocity"
						type="number"
						min={1}
						max={127}
						value={velocity}
						onchange={(event) => {
							velocity = Math.max(1, Math.min(127, Number(event.currentTarget.value) || 96));
						}}
					/></Field.Field
				>
				{#if session.selectedTrack !== 'drums'}<Field.Field class="w-24"
						><Field.FieldLabel for="studio-octave">Octave</Field.FieldLabel><NativeSelect
							id="studio-octave"
							value={String(octave)}
							onchange={(event) => {
								octave = Number(event.currentTarget.value);
							}}
							><NativeSelectOption value="-1">Down one</NativeSelectOption><NativeSelectOption
								value="0">Home</NativeSelectOption
							><NativeSelectOption value="1">Up one</NativeSelectOption></NativeSelect
						></Field.Field
					>{/if}
				<Field.Field class="w-24"
					><Field.FieldLabel for="studio-latency">Input delay, ms</Field.FieldLabel><Input
						id="studio-latency"
						type="number"
						min={0}
						max={250}
						disabled={session.armed}
						value={session.latencyMs}
						onchange={(event) => {
							session.latencyMs = Math.max(
								0,
								Math.min(250, Number(event.currentTarget.value) || 0)
							);
						}}
					/></Field.Field
				>
			</Field.FieldGroup>
			{#key session.selectedTrack}
				{#if session.selectedTrack === 'drums'}<div class="studio-pads">
						<PadGrid
							notes={[42, 46, 48, 49, 36, 38, 39, 45]}
							columns={4}
							channel={9}
							{velocity}
							controls={false}
							typing={true}
						/>
					</div>
				{:else}<Keyboard
						{low}
						octaves={3}
						channel={session.track.channel}
						{velocity}
						height={130}
						labels="all"
						typing={true}
						controls={false}
					/>{/if}
			{/key}
			<div class="record-options">
				<Field.FieldSet
					><Field.FieldLegend class="sr-only">Recording options</Field.FieldLegend><Field.FieldGroup
						class="flex-row flex-wrap gap-4"
						><Field.Field orientation="horizontal" class="w-auto gap-2"
							><Checkbox
								id="studio-count-in"
								bind:checked={session.countIn}
								disabled={session.armed}
							/><Field.FieldLabel for="studio-count-in">Four-beat count-in</Field.FieldLabel
							></Field.Field
						><Field.Field orientation="horizontal" class="w-auto gap-2"
							><Checkbox id="studio-metronome" bind:checked={metronome.enabled} /><Field.FieldLabel
								for="studio-metronome">Click while playing</Field.FieldLabel
							></Field.Field
						><Field.Field orientation="horizontal" class="w-auto gap-2"
							><Checkbox
								id="studio-replace"
								bind:checked={session.replaceTake}
								disabled={session.armed}
							/><Field.FieldLabel for="studio-replace">Replace this part</Field.FieldLabel
							></Field.Field
						></Field.FieldGroup
					></Field.FieldSet
				>
				<p>
					A take runs for eight bars. Keep “replace” off to layer notes over the example. A
					connected MIDI controller works too.
				</p>
			</div>
			<div class="variation">
				<span>One change you can hear</span><Button
					variant="outline"
					disabled={session.armed}
					onclick={variation}>{prompts[session.selectedTrack].action}</Button
				><span>Undo is always here.</span>
			</div>
		</section>
		<StudioNoteEditor {session} />
	</div>

	<section class="project-shelf" aria-label="Save and export your track">
		<div class="shelf-heading">
			<h2>Keep something worth coming back to.</h2>
			<p>Music takes a few tries. Your current project saves automatically in this browser.</p>
		</div>
		<Field.FieldGroup class="project-fields flex-row flex-wrap items-end gap-3"
			><Field.Field class="min-w-48 flex-1"
				><Field.FieldLabel for="studio-title">Project name</Field.FieldLabel><Input
					id="studio-title"
					maxlength={120}
					value={session.project.title}
					onchange={(event) =>
						session.edit((project) => {
							project.title = event.currentTarget.value.trim() || 'My first track';
						})}
				/></Field.Field
			><Button onclick={() => session.saveProject()}
				><HugeiconsIcon icon={SaveIcon} data-icon="inline-start" />Save project</Button
			><Button variant="outline" onclick={exportMidi}
				><HugeiconsIcon icon={CloudDownloadIcon} data-icon="inline-start" />Export MIDI</Button
			></Field.FieldGroup
		>
		<div class="backup-actions">
			<Button
				variant="outline"
				size="sm"
				disabled={session.armed}
				onclick={() => session.startEmpty()}>Start an empty track</Button
			>
			<Field.Field orientation="horizontal" class="w-auto gap-2"
				><Field.FieldLabel for="studio-library">Your saved tracks</Field.FieldLabel><NativeSelect
					id="studio-library"
					value=""
					onchange={(event) => {
						const project = session.library.find(
							(project) => project.id === event.currentTarget.value
						);
						if (project) {
							session.loadProject(project);
							void goto(path('/lab/studio'), { replaceState: true, noScroll: true });
						}
					}}
					><NativeSelectOption value="">Choose a project…</NativeSelectOption
					>{#each session.library as project (project.id)}<NativeSelectOption value={project.id}
							>{project.title}</NativeSelectOption
						>{/each}</NativeSelect
				></Field.Field
			><Button variant="ghost" size="sm" onclick={backup}>Download project backup</Button><Button
				variant="ghost"
				size="sm"
				onclick={() => fileInput?.click()}
				><HugeiconsIcon icon={Upload01Icon} data-icon="inline-start" />Import project</Button
			><input
				{@attach (element) => {
					fileInput = element;
					return () => {
						fileInput = undefined;
					};
				}}
				type="file"
				accept=".json,application/json"
				class="sr-only"
				tabindex="-1"
				aria-label="Import MIDI Lab Studio project"
				onchange={importFile}
			/>
		</div>
		{#if session.storageError || importError}<Alert.Root variant="destructive"
				><Alert.Title>Keep a backup</Alert.Title><Alert.Description
					>{importError || session.storageError}</Alert.Description
				></Alert.Root
			>{/if}
	</section>

	<div class="wire-strip">
		<div>
			<span
				class="wire-light"
				style:background={latest ? channelColour(latest.channel) : 'var(--muted-foreground)'}
			></span><span>The music is still MIDI.</span>{#if latest}<code>{latest.bytes}</code><span
					>{latest.note} on channel {latest.channel + 1}</span
				>{:else}<span>Play a note to see its bytes.</span>{/if}
		</div>
		<a href={path('/lab/monitor')}>Open the live monitor</a>
	</div>
</div>

<style>
	.studio {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.studio-intro {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 16px;
	}
	.studio-intro h1 {
		font-size: var(--text-3xl);
		font-weight: 600;
	}
	.studio-intro p {
		max-width: 40rem;
		margin-top: 9px;
		color: var(--muted-foreground);
		font-size: var(--text-base);
	}
	.learn-link {
		font-size: var(--text-xs);
		color: var(--muted-foreground);
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.arrangement {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.starter-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 18px 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card);
	}
	.starter-description {
		max-width: 30rem;
	}
	.starter-description strong {
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.starter-description p {
		margin-top: 4px;
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
	.transport-row,
	.transport-main,
	.tempo-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.transport-row {
		justify-content: space-between;
	}
	.position {
		padding-inline: 8px;
		font-variant-numeric: tabular-nums;
		font-size: var(--text-lg);
		color: var(--readout);
		min-width: 3rem;
	}
	.harmony-strip {
		display: grid;
		grid-template-columns: 148px repeat(8, minmax(0, 1fr));
		min-height: 24px;
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
	.harmony-strip span {
		padding: 3px 9px;
		white-space: nowrap;
	}
	.harmony-strip span:first-child {
		padding-left: 12px;
		color: var(--foreground);
	}
	.harmony-strip .current {
		color: var(--msg-program);
		background: var(--msg-program-bg);
		border-radius: var(--radius-sm);
	}
	.playback-status {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 24px;
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
	.status-light,
	.wire-light {
		height: 6px;
		width: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--muted-foreground);
	}
	.status-light.playing {
		background: var(--msg-note);
	}
	.status-light.recording {
		background: var(--destructive);
	}
	.note-count {
		margin-left: auto;
		white-space: nowrap;
	}
	.creation-area {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 16px;
		align-items: start;
	}
	.perform-panel {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card);
		overflow: hidden;
	}
	.guided-step {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 18px;
	}
	.part-number {
		display: grid;
		place-items: center;
		height: 27px;
		width: 27px;
		flex-shrink: 0;
		background: color-mix(in oklch, var(--track-color) 12%, var(--card));
		color: var(--track-color);
		border-radius: 50%;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.guided-step h2 {
		font-size: var(--text-base);
		font-weight: 600;
	}
	.guided-step p {
		margin-top: 6px;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
	.instrument-strip {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		padding: 8px 16px;
		border-block: 1px solid var(--border);
		background: var(--surface-sunken);
	}
	.instrument-strip strong {
		color: var(--track-color);
		font-size: var(--text-xs);
	}
	.instrument-strip > span {
		font-size: var(--text-2xs);
		color: var(--muted-foreground);
	}
	.studio-pads {
		max-width: 400px;
		margin: 0 auto;
		padding: 0 16px 12px;
	}
	.record-options {
		padding: 15px 16px;
	}
	.record-options p {
		margin-top: 10px;
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
	.variation {
		border-top: 1px solid var(--border);
		padding: 12px 16px;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.variation > span {
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
	.variation > span:last-child {
		font-size: var(--text-2xs);
	}
	.project-shelf {
		display: flex;
		flex-direction: column;
		gap: 14px;
		border-top: 1px solid var(--border);
		padding-top: 20px;
	}
	.shelf-heading h2 {
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.shelf-heading p {
		margin-top: 5px;
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
	.backup-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.wire-strip,
	.wire-strip > div {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
	}
	.wire-strip {
		justify-content: space-between;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
	.wire-strip code {
		font-family: var(--font-mono);
		color: var(--foreground);
	}
	.wire-strip a {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	@media (max-width: 1100px) {
		.creation-area {
			grid-template-columns: minmax(0, 1fr);
		}
		.studio-pads {
			max-width: 370px;
		}
	}
	@media (max-width: 640px) {
		.studio {
			gap: 20px;
		}
		.starter-bar {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
			padding: 14px;
		}
		.harmony-strip {
			grid-template-columns: repeat(8, minmax(0, 1fr));
			font-size: var(--text-2xs);
		}
		.harmony-strip span:first-child {
			grid-column: 1 / -1;
			padding-left: 0;
		}
		.harmony-strip span {
			padding-inline: 3px;
		}
		.note-count {
			display: none;
		}
		.tempo-actions {
			margin-top: 2px;
		}
	}
</style>
