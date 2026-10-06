<script lang="ts">
	import type { StudioSession } from '$lib/studio/session.svelte';
	import { noteName } from '$lib/midi/notes';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { channelColour } from '$lib/midi/channelcolour';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Field from '$lib/components/ui/field';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Add01Icon, Delete01Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';
	let { session }: { session: StudioSession } = $props();
	const notes = $derived(
		session.track.notes.filter(
			(note) =>
				note.start < session.selectedBar * 4 + 4 &&
				note.start + note.duration > session.selectedBar * 4
		)
	);
	const rows = $derived.by(() => {
		const pitches = notes.map((note) => note.note);
		if (session.selectedTrack === 'drums')
			return [...new Set([36, 38, 39, 42, 46, 48, ...pitches])].sort((a, b) => b - a);
		const defaultLow = session.selectedTrack === 'bass' ? 36 : 60;
		const low = Math.max(0, Math.min(...pitches, defaultLow) - 1);
		const high = Math.min(127, Math.max(...pitches, defaultLow + 7) + 1);
		if (high - low > 24) return [...new Set(pitches)].sort((a, b) => b - a);
		return Array.from({ length: high - low + 1 }, (_, index) => high - index);
	});
	function label(pitch: number) {
		return session.selectedTrack === 'drums'
			? (GM_DRUMS[pitch] ?? `Note ${pitch}`)
			: noteName(pitch, { convention: settings.octaveConvention });
	}
	function addAt(event: MouseEvent, pitch: number) {
		const rect =
			event.currentTarget instanceof HTMLElement
				? event.currentTarget.getBoundingClientRect()
				: null;
		const fraction =
			rect && event.detail
				? Math.max(0, Math.min(0.99, (event.clientX - rect.left) / rect.width))
				: 0;
		const grid = session.grid || 0.25;
		session.addNote(session.selectedBar * 4 + Math.floor((fraction * 4) / grid) * grid, pitch);
	}
</script>

<section
	class="note-editor"
	style:--track-color={channelColour(session.track.channel)}
	aria-label="Note editor"
>
	<div class="editor-heading">
		<div>
			<h3>{session.track.name}, bar {session.selectedBar + 1}</h3>
			<p>Tap a row to add a note. Select a note to shape it.</p>
		</div>
		<div class="flex items-center gap-1">
			<Button
				variant="outline"
				size="sm"
				disabled={session.selectedBar === 0}
				aria-label="Previous bar"
				onclick={() => {
					session.selectedBar--;
					session.selectedNote = null;
				}}>Previous</Button
			>
			<Button
				variant="outline"
				size="sm"
				disabled={session.selectedBar === 7}
				aria-label="Next bar"
				onclick={() => {
					session.selectedBar++;
					session.selectedNote = null;
				}}>Next</Button
			>
		</div>
	</div>
	<div class="note-grid scrollbar-thin">
		<div class="grid-content">
			<div class="beat-ruler">
				<span></span>{#each [1, 2, 3, 4] as beat (beat)}<span>{beat}</span>{/each}
			</div>
			{#each rows as pitch (pitch)}
				<div class="pitch-row">
					<span class="pitch-label" title="{label(pitch)}, MIDI note {pitch}">{label(pitch)}</span>
					<div class="pitch-lane">
						<button
							class="add-row"
							disabled={session.armed}
							aria-label="Add {label(pitch)} in bar {session.selectedBar + 1}"
							onclick={(event) => addAt(event, pitch)}
						></button>
						{#each notes.filter((note) => note.note === pitch) as note (note.id)}
							{@const start = Math.max(0, note.start - session.selectedBar * 4)}
							{@const duration =
								Math.min(4, note.start + note.duration - session.selectedBar * 4) - start}
							<button
								class={cn('editable-note', session.selectedNote === note.id && 'chosen')}
								style:left="{(start / 4) * 100}%"
								style:width="{(duration / 4) * 100}%"
								style:--velocity={0.5 + note.velocity / 254}
								aria-label="Select {label(note.note)}, start beat {Math.round(
									(note.start + 1) * 100
								) / 100}, duration {Math.round(note.duration * 100) /
									100}, velocity {note.velocity}"
								aria-pressed={session.selectedNote === note.id}
								onclick={() => {
									session.selectedNote = note.id;
								}}
							>
								<span>{session.selectedTrack === 'drums' ? '' : label(note.note)}</span>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
	<div class="note-properties">
		{#if session.note}
			{@const note = session.note}
			<Field.FieldGroup class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Field.Field
					><Field.FieldLabel for="studio-note-pitch">Pitch · {label(note.note)}</Field.FieldLabel
					><Input
						id="studio-note-pitch"
						disabled={session.armed}
						type="number"
						min={0}
						max={127}
						value={note.note}
						onchange={(event) =>
							session.updateNote(note.id, { note: Number(event.currentTarget.value) })}
					/></Field.Field
				>
				<Field.Field
					><Field.FieldLabel for="studio-note-start">Start beat</Field.FieldLabel><Input
						id="studio-note-start"
						disabled={session.armed}
						type="number"
						min={1}
						max={32.99}
						step={0.25}
						value={Math.round((note.start + 1) * 1000) / 1000}
						onchange={(event) =>
							session.updateNote(note.id, { start: Number(event.currentTarget.value) - 1 })}
					/></Field.Field
				>
				<Field.Field
					><Field.FieldLabel for="studio-note-length">Length in beats</Field.FieldLabel><Input
						id="studio-note-length"
						disabled={session.armed}
						type="number"
						min={0.011}
						max={32}
						step={0.25}
						value={Math.round(note.duration * 1000) / 1000}
						onchange={(event) =>
							session.updateNote(note.id, { duration: Number(event.currentTarget.value) })}
					/></Field.Field
				>
				<Field.Field
					><Field.FieldLabel for="studio-note-velocity">Velocity</Field.FieldLabel><Input
						id="studio-note-velocity"
						disabled={session.armed}
						type="number"
						min={1}
						max={127}
						value={note.velocity}
						onchange={(event) =>
							session.updateNote(note.id, { velocity: Number(event.currentTarget.value) })}
					/></Field.Field
				>
			</Field.FieldGroup>
			<div class="property-actions">
				<span>Beat 1 is the start of the whole track.</span><Button
					variant="destructive"
					size="sm"
					disabled={session.armed}
					onclick={() => session.deleteNote()}
					><HugeiconsIcon icon={Delete01Icon} data-icon="inline-start" />Delete note</Button
				>
			</div>
		{:else}
			<div class="empty-selection">
				<span
					>{notes.length
						? 'Select a note above, or add one to try a new idea.'
						: 'A little space is musical too. Add a note or record your own part.'}</span
				><Button
					variant="outline"
					size="sm"
					disabled={session.armed}
					onclick={() => session.addNote()}
					><HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />Add note</Button
				>
			</div>
		{/if}
		<Field.FieldGroup class="mt-3 flex-row flex-wrap items-end gap-3">
			<Field.Field class="w-28"
				><Field.FieldLabel for="studio-snap">Timing grid</Field.FieldLabel><NativeSelect
					id="studio-snap"
					disabled={session.armed}
					value={String(session.grid)}
					onchange={(event) => {
						session.grid = Number(event.currentTarget.value);
					}}
					><NativeSelectOption value="0">Free</NativeSelectOption><NativeSelectOption value="0.25"
						>1/16 note</NativeSelectOption
					><NativeSelectOption value="0.5">1/8 note</NativeSelectOption><NativeSelectOption
						value="1">1/4 note</NativeSelectOption
					></NativeSelect
				></Field.Field
			>
			<Field.Field class="w-28"
				><Field.FieldLabel for="studio-strength">Tighten by</Field.FieldLabel><NativeSelect
					id="studio-strength"
					value={String(session.strength)}
					onchange={(event) => {
						session.strength = Number(event.currentTarget.value);
					}}
					><NativeSelectOption value="0.5">50% · keep feel</NativeSelectOption><NativeSelectOption
						value="1">100% · on grid</NativeSelectOption
					></NativeSelect
				></Field.Field
			>
			<Button
				variant="outline"
				disabled={!session.grid || session.armed}
				onclick={() => session.quantize()}>Tighten this part</Button
			>
		</Field.FieldGroup>
	</div>
</section>

<style>
	.note-editor {
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card);
	}
	.editor-heading {
		padding: 14px 16px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.editor-heading h3 {
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.editor-heading p {
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		margin-top: 3px;
	}
	.note-grid {
		overflow-x: auto;
		max-height: 310px;
		overflow-y: auto;
		background: var(--surface-sunken);
		border-block: 1px solid var(--border);
	}
	.grid-content {
		min-width: 440px;
	}
	.beat-ruler {
		display: grid;
		grid-template-columns: 85px repeat(4, 1fr);
		height: 25px;
	}
	.beat-ruler span {
		padding-left: 6px;
		display: flex;
		align-items: center;
		border-left: 1px solid var(--grid-line);
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
	.pitch-row {
		display: grid;
		grid-template-columns: 85px minmax(0, 1fr);
		height: 24px;
		border-top: 1px solid var(--grid-line);
	}
	.pitch-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: block;
		padding: 5px 8px;
		font-size: var(--text-2xs);
		color: var(--muted-foreground);
	}
	.pitch-lane {
		position: relative;
		background-image: repeating-linear-gradient(
			to right,
			var(--grid-line) 0,
			var(--grid-line) 1px,
			transparent 1px,
			transparent 6.25%
		);
	}
	.add-row {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		text-align: left;
	}
	.add-row:hover {
		background: color-mix(in oklch, var(--track-color) 7%, transparent);
	}
	.editable-note {
		position: absolute;
		top: 3px;
		height: 17px;
		min-width: 8px;
		max-width: 100%;
		border-radius: 2px;
		border: 1px solid var(--track-color);
		background: color-mix(in oklch, var(--track-color) calc(var(--velocity) * 100%), var(--card));
		text-align: left;
		overflow: hidden;
	}
	.editable-note span {
		padding: 0 4px;
		font-size: var(--text-2xs);
		color: var(--background);
		white-space: nowrap;
	}
	.editable-note.chosen {
		box-shadow: 0 0 0 2px var(--foreground);
	}
	.note-properties {
		padding: 14px 16px;
	}
	.property-actions,
	.empty-selection {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.property-actions {
		margin-top: 10px;
	}
	.property-actions > span,
	.empty-selection > span {
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
</style>
