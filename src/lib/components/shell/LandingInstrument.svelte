<script lang="ts">
	import { onMount } from 'svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import Staff from '$lib/components/midi/Staff.svelte';
	import { chordName, spellNotes, spellingName } from '$lib/midi/harmony';
	import { noteToFrequency } from '$lib/midi/notes';
	import Scope from '$lib/components/midi/Scope.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { engine } from '$lib/midi/engine.svelte';
	import { monitor } from '$lib/midi/monitor.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { gm } from '$lib/audio/gm.svelte';
	import { hex, shortLabel, family, familyColor } from '$lib/midi/messages';
	import { settings } from '$lib/stores/settings.svelte';
	import { device } from '$lib/stores/device.svelte';

	let sounding = $state(false);
	let pane = $state('notation');
	const held = $derived.by(() => {
		void noteState.version;
		return Array.from({ length: 128 }, (_, note) => note).filter((note) => noteState.isHeld(note));
	});
	const chord = $derived(chordName(held));
	const noteNames = $derived(
		spellNotes(held).map((note) => spellingName(note, settings.octaveConvention))
	);
	const program = $derived(noteState.channel(engine.channel).program);
	const latest = $derived.by(() => {
		void monitor.version;
		for (let i = monitor.events.length - 1; i >= 0; i--) {
			const event = monitor.events[i];
			if (event.message.type !== 'clock' && event.message.type !== 'activeSensing') return event;
		}
		return null;
	});
	const latestName = $derived(
		latest ? shortLabel(latest.message, { octaveConvention: settings.octaveConvention }) : ''
	);
	const latestNote = $derived(
		latest && (latest.message.type === 'noteOn' || latest.message.type === 'noteOff')
			? latest.message.note
			: null
	);

	onMount(() => gm.load(program));

	// VexFlow renders at engraving size. Give its SVG a viewBox so the hero can
	// scale that engraving into its available width without clipping either clef.
	function fitStaff(node: HTMLElement) {
		const fit = () => {
			const svg = node.querySelector('svg');
			if (!svg || svg.hasAttribute('viewBox')) return;
			const width = Number(svg.getAttribute('width'));
			const height = Number(svg.getAttribute('height'));
			if (width && height) svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		};
		fit();
		const observer = new MutationObserver(fit);
		observer.observe(node, { childList: true, subtree: true });
		return () => observer.disconnect();
	}
</script>

{#snippet notation()}
	<div class="staff" {@attach fitStaff}><Staff notes={held} /></div>
	<div class="note-caption">
		<span class="chord-name"
			>{held.length > 1
				? (chord?.name ?? `${held.length} notes`)
				: (noteNames[0] ?? 'Play a note or a chord.')}</span
		>
		<span class="chord-detail"
			>{held.length === 1
				? `Note ${held[0]} · ${noteToFrequency(held[0]).toFixed(0)} Hz`
				: held.length > 1
					? noteNames.join(' + ')
					: 'The staff follows your playing.'}</span
		>
	</div>
{/snippet}

<section class="instrument-material instrument-deck instrument" aria-label="Live instrument">
	<div class="instrument-heading">
		<span class="instrument-title">Try the keyboard</span><span class="live-status"
			><span class:lit={sounding}></span>Live instrument</span
		>
	</div>
	{#if device.narrow}
		<Tabs.Root bind:value={pane} class="gap-0">
			<Tabs.List variant="line" class="w-full rounded-none px-3">
				<Tabs.Trigger value="notation">Notation</Tabs.Trigger><Tabs.Trigger value="output"
					>Output</Tabs.Trigger
				>
			</Tabs.List>
			<Tabs.Content value="notation" class="m-0"
				><div class="notation-screen">{@render notation()}</div></Tabs.Content
			>
			<Tabs.Content value="output" class="m-0"
				><div class="output-screen"><Scope bare class="flex-1" bind:sounding /></div></Tabs.Content
			>
		</Tabs.Root>
	{:else}
		<div class="screen">
			<div class="notation-screen">{@render notation()}</div>
			<div class="output-screen">
				<div class="screen-heading">
					<span>Sound spectrum</span><span>{sounding ? 'Sounding' : 'Ready'}</span>
				</div>
				<Scope bare class="flex-1" bind:sounding />
			</div>
		</div>
	{/if}
	<div class="keybed">
		<Keyboard integrated low={48} octaves={3} height={device.narrow ? 96 : 128} labels="c" />
	</div>
	<div
		class="message-readout"
		style:--message-ink={latest ? familyColor(family(latest.message)) : 'var(--msg-note)'}
	>
		<div class="message-name">
			{#if latest}<span>{latestName}</span>{#if latestNote !== null}<span class="note-number"
						>Note {latestNote}</span
					>{/if}
			{:else}<span class="waiting-message">Play a key. Its music and MIDI appear here.</span>{/if}
		</div>
		{#if latest}<span
				class="message-bytes"
				aria-label={latest.bytes.length > 3
					? `First three of ${latest.bytes.length} MIDI bytes in hexadecimal`
					: 'MIDI bytes in hexadecimal'}
				>{#each latest.bytes.slice(0, 3) as byte, index (index)}<span
						class:status-byte={index === 0}>{hex(byte)}</span
					>{/each}{#if latest.bytes.length > 3}<span aria-hidden="true">…</span>{/if}</span
			>{/if}
	</div>
</section>

<style>
	.instrument {
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
	}
	.instrument-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1.1rem;
		border-bottom: 1px solid var(--border);
	}
	.instrument-title {
		font-size: 0.9375rem;
		font-weight: 550;
		letter-spacing: -0.025em;
	}
	.live-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
	}
	.live-status > span {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 50%;
		background: var(--msg-note);
		opacity: 0.4;
	}
	.live-status > .lit {
		opacity: 1;
	}
	.screen {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
		border-bottom: 1px solid var(--border);
		background: var(--surface-sunken);
		box-shadow: var(--instrument-recess-shadow);
	}
	.notation-screen,
	.output-screen {
		height: 11rem;
		min-width: 0;
		overflow: hidden;
		padding: 0.625rem 0.75rem;
	}
	.staff {
		max-width: 20rem;
	}
	.staff :global([role='img']) {
		width: 100% !important;
		height: auto !important;
	}
	.staff :global(svg) {
		width: 100%;
		height: auto;
	}
	.note-caption {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.5rem;
	}
	.chord-name {
		font-size: 0.875rem;
		font-weight: 520;
		letter-spacing: -0.02em;
		line-height: 1.25;
	}
	.chord-detail {
		font-size: 0.625rem;
		color: var(--muted-foreground);
		line-height: 1.45;
	}
	.notation-screen {
		border-right: 1px solid var(--border);
	}
	.output-screen {
		display: flex;
		flex-direction: column;
	}
	.screen-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0.15rem 0 0.75rem;
		color: var(--muted-foreground);
		font-size: 0.625rem;
		line-height: 1.5;
	}
	.keybed {
		padding: 0.875rem;
	}
	.message-readout {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-height: 3rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
		background: var(--surface-sunken);
		font-size: 0.625rem;
		line-height: 1.55;
	}
	.message-name {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.65rem;
		min-width: 0;
	}
	.waiting-message,
	.note-number {
		color: var(--muted-foreground);
	}
	.message-bytes {
		display: flex;
		flex-shrink: 0;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
	}
	.status-byte {
		color: var(--message-ink);
	}
	@media (max-width: 767px) {
		.instrument {
			border-radius: 0.75rem;
		}
		.staff {
			max-width: 18rem;
			margin: 0 auto;
		}
		.chord-detail {
			display: none;
		}
		.instrument-heading {
			padding: 0.85rem 1rem;
		}
		.notation-screen,
		.output-screen {
			height: 8.5rem;
			padding: 0.45rem 0.75rem;
			border-right: 0;
			border-bottom: 1px solid var(--border);
			background: var(--surface-sunken);
		}
		.output-screen {
			padding-top: 0.75rem;
		}
		.keybed {
			padding: 0.7rem;
		}
		.message-readout {
			min-height: 2.65rem;
			gap: 0.5rem;
			padding: 0.65rem 0.85rem;
		}
	}
</style>
