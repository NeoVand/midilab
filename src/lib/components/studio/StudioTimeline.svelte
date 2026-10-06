<script lang="ts">
	import type { StudioSession } from '$lib/studio/session.svelte';
	import type { StudioTrack } from '$lib/studio/model';
	import { channelColour } from '$lib/midi/channelcolour';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { VolumeOffIcon, VolumeHighIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';
	let { session }: { session: StudioSession } = $props();
	const bars = Array.from({ length: 8 }, (_, index) => index);
	function pitchPosition(track: StudioTrack, pitch: number) {
		const pitches = track.notes.map((note) => note.note);
		const low = Math.min(...pitches, pitch);
		const high = Math.max(...pitches, pitch);
		return 76 - ((pitch - low) / Math.max(1, high - low)) * 54;
	}
	function selectBar(track: StudioTrack, bar: number) {
		session.selectTrack(track.id);
		session.selectedBar = bar;
	}
</script>

<div class="timeline-scroll scrollbar-thin" aria-label="Eight-bar arrangement">
	<div class="timeline">
		<div class="section-row">
			<span class="track-heading">Your arrangement</span>
			<div class="section-label"><strong>A</strong> Establish the idea</div>
			<div class="section-label second"><strong>B</strong> Give it a little lift</div>
		</div>
		<div class="bar-ruler">
			<span class="track-heading">Choose a part and a bar</span>
			{#each bars as bar (bar)}
				<span class:current={session.playing && Math.floor(session.position / 4) === bar}
					>{bar + 1}</span
				>
			{/each}
		</div>
		{#each session.project.tracks as track (track.id)}
			<div
				class={cn('track-row', session.selectedTrack === track.id && 'selected')}
				style:--track-color={channelColour(track.channel)}
			>
				<div class="track-head">
					<button
						class="track-select"
						aria-pressed={session.selectedTrack === track.id}
						onclick={(event) => {
							session.selectTrack(track.id);
							event.currentTarget.blur();
						}}
					>
						<span class="track-dot"></span>
						<span><strong>{track.name}</strong><small>Channel {track.channel + 1}</small></span>
					</button>
					<div class="track-actions">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="{track.muted ? 'Unmute' : 'Mute'} {track.name}"
							aria-pressed={track.muted}
							onclick={() => session.toggleMute(track.id)}
						>
							<HugeiconsIcon
								icon={track.muted ? VolumeOffIcon : VolumeHighIcon}
								data-icon="inline-start"
							/>
						</Button>
						<Button
							variant={session.solo === track.id ? 'secondary' : 'ghost'}
							size="sm"
							aria-label="Solo {track.name}"
							aria-pressed={session.solo === track.id}
							onclick={() => session.toggleSolo(track.id)}>S</Button
						>
					</div>
				</div>
				{#each bars as bar (bar)}
					{@const notes = track.notes.filter(
						(note) => note.start >= bar * 4 && note.start < (bar + 1) * 4
					)}
					<button
						class={cn(
							'clip',
							session.selectedTrack === track.id && session.selectedBar === bar && 'chosen',
							(track.muted || (session.solo && session.solo !== track.id)) && 'muted'
						)}
						aria-label="Edit {track.name}, bar {bar + 1}, {notes.length} notes"
						aria-pressed={session.selectedTrack === track.id && session.selectedBar === bar}
						onclick={(event) => {
							selectBar(track, bar);
							event.currentTarget.blur();
						}}
					>
						{#each notes as note (note.id)}
							<span
								class="mini-note"
								style:left="{((note.start - bar * 4) / 4) * 100}%"
								style:top="{pitchPosition(track, note.note)}%"
								style:width="{Math.max(
									4,
									(Math.min(note.duration, (bar + 1) * 4 - note.start) / 4) * 100
								)}%"
								style:opacity={0.45 + note.velocity / 230}
							></span>
						{/each}
						{#if !notes.length}<span class="empty-clip">+</span>{/if}
					</button>
				{/each}
			</div>
		{/each}
		{#if session.playing && !session.counting}
			<div class="playhead" style:left="calc(148px + (100% - 148px) * {session.position / 32})">
				<span></span>
			</div>
		{/if}
	</div>
</div>

<style>
	.timeline-scroll {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card);
	}
	.timeline {
		position: relative;
		min-width: 720px;
	}
	.section-row {
		display: grid;
		grid-template-columns: 148px 1fr 1fr;
		background: var(--surface-sunken);
	}
	.track-heading {
		display: flex;
		align-items: center;
		padding: 10px 12px;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
	.section-label {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-left: 1px solid var(--border);
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
	.section-label strong {
		color: var(--foreground);
	}
	.second {
		background: color-mix(in oklch, var(--msg-program-bg) 50%, var(--surface-sunken));
	}
	.bar-ruler,
	.track-row {
		display: grid;
		grid-template-columns: 148px repeat(8, minmax(0, 1fr));
	}
	.bar-ruler {
		border-top: 1px solid var(--border);
	}
	.bar-ruler > span:not(.track-heading) {
		display: flex;
		align-items: center;
		padding-left: 9px;
		border-left: 1px solid var(--border);
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.bar-ruler .current {
		color: var(--msg-note);
		font-weight: 600;
		background: var(--msg-note-bg);
	}
	.track-row {
		border-top: 1px solid var(--border);
	}
	.track-row.selected {
		background: color-mix(in oklch, var(--track-color) 5%, var(--card));
	}
	.track-head {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		padding: 9px 10px;
	}
	.track-select {
		display: flex;
		align-items: center;
		gap: 8px;
		text-align: left;
		border-radius: var(--radius-sm);
	}
	.track-select strong {
		display: block;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.track-select small {
		display: block;
		color: var(--muted-foreground);
		font-size: var(--text-2xs);
	}
	.track-dot {
		height: 7px;
		width: 7px;
		border-radius: 50%;
		background: var(--track-color);
		flex-shrink: 0;
	}
	.track-actions {
		display: flex;
		gap: 2px;
		padding-left: 12px;
	}
	.clip {
		position: relative;
		min-width: 0;
		height: 78px;
		border-left: 1px solid var(--border);
		background-image: repeating-linear-gradient(
			to right,
			transparent 0,
			transparent calc(25% - 1px),
			var(--grid-line) calc(25% - 1px),
			var(--grid-line) 25%
		);
	}
	.clip:nth-child(6) {
		border-left: 2px solid var(--grid-line-strong);
	}
	.clip.chosen {
		box-shadow: inset 0 0 0 2px var(--track-color);
		background-color: color-mix(in oklch, var(--track-color) 8%, transparent);
	}
	.clip:hover {
		background-color: color-mix(in oklch, var(--track-color) 10%, transparent);
	}
	.clip.muted .mini-note {
		opacity: 0.2 !important;
	}
	.mini-note {
		position: absolute;
		display: block;
		min-width: 3px;
		height: 5px;
		border-radius: 1px;
		background: var(--track-color);
		max-width: calc(100% - 2px);
		pointer-events: none;
	}
	.empty-clip {
		color: var(--muted-foreground);
		opacity: 0.5;
	}
	.playhead {
		position: absolute;
		top: 36px;
		bottom: 0;
		width: 1px;
		background: var(--foreground);
		opacity: 0.6;
		pointer-events: none;
	}
	.playhead span {
		display: block;
		width: 7px;
		height: 7px;
		border-radius: 1px;
		background: var(--foreground);
		transform: translateX(-3px);
	}
</style>
