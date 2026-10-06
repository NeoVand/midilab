<script lang="ts">
	import LandingInstrument from '$lib/components/shell/LandingInstrument.svelte';
	import MidiLabBrand from '$lib/components/shell/MidiLabBrand.svelte';
	import ToolFigure from '$lib/components/shell/ToolFigure.svelte';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { ALL_LESSONS } from '$lib/curriculum/registry';
	import { lessonHref, path } from '$lib/nav';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowRight01Icon,
		PlugSocketIcon,
		LibraryIcon,
		MusicNote01Icon
	} from '@hugeicons/core-free-icons';

	const overall = $derived(progress.fractionOf(ALL_LESSONS.map((lesson) => lesson.id)));
	const nextLesson = $derived(
		ALL_LESSONS.find((lesson) => !progress.isLessonComplete(lesson.id)) ?? ALL_LESSONS[0]
	);
	const hardwareCount = $derived(midiAccess.connectedInputs.length);

	const tools = [
		{
			href: '/lab/monitor',
			figure: 'monitor',
			name: 'Monitor',
			desc: 'See every note, controller, and byte as it happens.'
		},
		{
			href: '/lab/patchbay',
			figure: 'patchbay',
			name: 'Patchbay',
			desc: 'Route, transpose, and remap MIDI between instruments.'
		},
		{
			href: '/lab/programmer',
			figure: 'programmer',
			name: 'Programmer',
			desc: 'Build a sequence, hear your changes, and take the MIDI with you.'
		},
		{
			href: '/lab/devices',
			figure: 'devices',
			name: 'Device Lab',
			desc: 'Try instrument voices and learn which controls your hardware supports.'
		},
		{
			href: '/lab/jukebox',
			figure: 'jukebox',
			name: 'Jukebox',
			desc: 'Listen closely to a MIDI file, then give it a different voice.'
		},
		{
			href: '/lab/mpe',
			figure: 'mpe',
			name: 'MPE Playground',
			desc: 'Bend, press, and color each note independently.'
		}
	] as const;

	const examples = [
		{ id: 'sunlit-pop', name: 'Sunlit Pop', detail: 'Guitar, melody, a little bounce' },
		{ id: 'pocket-soul', name: 'Pocket Soul', detail: 'Warm keys and a relaxed groove' },
		{ id: 'night-drive', name: 'Night Drive', detail: 'Synth bass and a rising hook' }
	];
</script>

<svelte:head>
	<title>MIDI Lab</title>
	<meta
		name="description"
		content="A place to play with MIDI and learn how it works. Try the instrument, make a track, explore MPE, or connect your own keyboard."
	/>
</svelte:head>

<div class="landing">
	<section class="hero" aria-labelledby="home-heading">
		<header class="hero-copy">
			<h1 id="home-heading"><MidiLabBrand size="hero" /></h1>
			<p class="hero-lead">
				Learn music and MIDI through interactive lessons. Play an instrument, build a track, or
				connect your keyboard and explore the messages it sends.
			</p>
			<div
				class="hero-actions"
				style:--primary="var(--landing-accent)"
				style:--primary-foreground="var(--background)"
			>
				<Button href={lessonHref(nextLesson)} size="xl">
					{overall > 0 ? 'Continue learning' : 'Start learning'}
					<HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
				</Button>
				<Button href={path('/lab/studio')} variant="outline" size="xl">
					<HugeiconsIcon icon={MusicNote01Icon} data-icon="inline-start" />Open studio
				</Button>
			</div>
			<div class="hero-details">
				<p class="hero-note">Play on screen, or connect a MIDI instrument.</p>
				<a class="contents-link" href={path('/learn')}
					>Course contents <HugeiconsIcon icon={ArrowRight01Icon} size={14} /></a
				>
			</div>
			{#if overall > 0}
				<a class="resume-link" href={lessonHref(nextLesson)}>
					<span
						><span class="resume-label">Your next lesson</span><span class="resume-title"
							>{nextLesson.title}</span
						></span
					>
					<span class="resume-progress tnum">{Math.round(overall * 100)}%</span>
				</a>
			{/if}
		</header>
		<div class="hero-instrument"><LandingInstrument /></div>
	</section>

	<section class="make-section" aria-labelledby="make-heading">
		<div class="section-heading">
			<div>
				<h2 id="make-heading">Try something musical</h2>
				<p>Start with a groove, or try bending the notes of a chord.</p>
			</div>
		</div>
		<div class="feature-grid">
			<article class="feature feature-studio">
				<a class="feature-preview" href={path('/lab/studio')} aria-label="Open the music studio"
					><ToolFigure tool="studio" /></a
				>
				<div class="feature-copy">
					<h3>First Track Studio</h3>
					<p>
						Pick a track below, swap an instrument, or edit its notes. Hear how drums, bass, chords,
						and melody fit together.
					</p>
					<a class="text-link" href={path('/lab/studio')}
						>Open studio <HugeiconsIcon icon={ArrowRight01Icon} size={14} /></a
					>
				</div>
				<div class="example-links" aria-label="Original studio examples">
					{#each examples as example (example.id)}
						<a href={path(`/lab/studio?example=${example.id}`)} title={example.detail}
							><span>{example.name}</span></a
						>
					{/each}
				</div>
			</article>
			<article class="feature feature-expression">
				<a class="feature-preview" href={path('/lab/mpe')} aria-label="Open the MPE Playground"
					><ToolFigure tool="mpe" /></a
				>
				<div class="feature-copy">
					<h3>MPE Playground</h3>
					<p>
						Hold a chord, then bend or press a single note. Try the on-screen instrument, or connect
						an expressive controller like Osmose.
					</p>
					<a class="text-link" href={path('/lab/mpe')}
						>Try MPE <HugeiconsIcon icon={ArrowRight01Icon} size={14} /></a
					>
				</div>
				<div class="expression-footnote">
					<span>Pitch, pressure, color.</span><a class="text-link" href={path('/learn/mpe')}
						>Learn MPE</a
					>
				</div>
			</article>
		</div>
	</section>

	<section class="lab-section" aria-labelledby="lab-heading">
		<div class="section-heading">
			<div>
				<h2 id="lab-heading">The tools</h2>
				<p>Watch MIDI messages, route instruments, build patterns, and explore your hardware.</p>
			</div>
			<a class="text-link" href={path('/lab')}
				>Open the lab <HugeiconsIcon icon={ArrowRight01Icon} size={14} /></a
			>
		</div>
		<div class="tool-grid">
			{#each tools as tool (tool.href)}
				<a class="tool" href={path(tool.href)}>
					<div class="tool-preview"><ToolFigure tool={tool.figure} /></div>
					<div class="tool-caption">
						<h3>{tool.name}</h3>
						<p>{tool.desc}</p>
						<HugeiconsIcon icon={ArrowRight01Icon} size={14} class="tool-arrow" />
					</div>
				</a>
			{/each}
		</div>
	</section>

	<section class="hardware-section" aria-labelledby="hardware-heading">
		<div class="hardware-icon" aria-hidden="true">
			<HugeiconsIcon icon={PlugSocketIcon} size={22} />
		</div>
		<div class="hardware-copy">
			<h2 id="hardware-heading">Connect your instrument</h2>
			<p>
				{#if midiAccess.status === 'granted'}
					{hardwareCount === 0
						? 'MIDI is connected. Plug in your instrument, then choose its input in the lab.'
						: `${hardwareCount} MIDI input${hardwareCount === 1 ? '' : 's'} available. Choose your connections in the Patchbay.`}
				{:else if midiAccess.status === 'unsupported'}
					The browser instrument works here. For USB MIDI hardware, open MIDI Lab in Chrome, Edge,
					or Firefox.
				{:else if midiAccess.status === 'denied'}
					Allow MIDI access in your browser to connect your keyboard or synth. You can also keep
					playing with the instruments on this page.
				{:else}
					Plug in a keyboard, synth, or expressive controller over USB. Choose its input, play a few
					notes, and see the MIDI arrive.
				{/if}
			</p>
		</div>
		<div class="hardware-action">
			{#if midiAccess.status === 'granted'}
				<Button href={path('/lab/patchbay')} variant="outline" size="xl">Open Patchbay</Button>
			{:else if midiAccess.status !== 'unsupported'}
				<Button
					variant="outline"
					size="xl"
					disabled={midiAccess.status === 'requesting'}
					onclick={() => midiAccess.request(false)}
					>{midiAccess.status === 'requesting' ? 'Connecting…' : 'Connect MIDI'}</Button
				>
			{:else}
				<Button href={lessonHref(ALL_LESSONS[0])} variant="outline" size="xl">Keep playing</Button>
			{/if}
		</div>
	</section>

	<footer class="landing-footer">
		<span>MIDI Lab</span><a href={path('/reference')}
			><HugeiconsIcon icon={LibraryIcon} size={14} /> MIDI reference tables</a
		>
	</footer>
</div>

<style>
	.landing {
		width: 100%;
		max-width: 82rem;
		margin: 0 auto;
		padding: clamp(1.25rem, 2.6vw, 2.75rem) clamp(1rem, 4vw, 3.75rem) 2rem;
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.3fr);
		align-items: center;
		gap: clamp(2rem, 4vw, 4.5rem);
		padding: 0 0 2.5rem;
	}
	.hero-copy,
	.hero-instrument {
		min-width: 0;
	}
	h1 {
		--brand-font-size: clamp(2.75rem, 4.4vw, 4rem);
		line-height: 1;
	}
	.hero-lead {
		max-width: 29rem;
		margin-top: 1.15rem;
		color: var(--muted-foreground);
		font-size: 1rem;
		line-height: 1.7;
		text-wrap: pretty;
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2rem;
	}
	.hero-details {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		margin-top: 1rem;
	}
	.contents-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--foreground);
	}
	.contents-link:hover {
		text-decoration: underline;
		text-underline-offset: 0.25em;
	}
	.hero-note {
		color: var(--muted-foreground);
		font-size: 0.75rem;
		line-height: 1.55;
	}
	.resume-link {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-top: 1.75rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}
	.resume-label,
	.resume-title {
		display: block;
	}
	.resume-label {
		margin-bottom: 0.3rem;
		color: var(--muted-foreground);
		font-size: 0.6875rem;
	}
	.resume-title {
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.resume-progress {
		margin-left: auto;
		color: var(--muted-foreground);
		font-size: 0.75rem;
	}
	.make-section,
	.lab-section {
		padding: 2.25rem 0;
		border-top: 1px solid var(--border);
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1.25rem;
	}
	h2 {
		font-size: clamp(1.5rem, 2.5vw, 1.875rem);
		font-weight: 580;
		line-height: 1.2;
		letter-spacing: -0.045em;
		text-wrap: balance;
	}
	.section-heading p {
		max-width: 37rem;
		margin-top: 0.6rem;
		color: var(--muted-foreground);
		font-size: 0.875rem;
		line-height: 1.65;
	}
	.text-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		width: fit-content;
		font-size: 0.8125rem;
		font-weight: 500;
		line-height: 1.5;
	}
	.text-link:hover {
		text-decoration: underline;
		text-underline-offset: 0.25em;
	}
	.feature-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}
	.feature {
		display: grid;
		grid-template-rows: auto 1fr 3.5rem;
		min-width: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.65rem;
		background: var(--card);
		box-shadow: inset 0 1px 0 color-mix(in oklch, var(--foreground) 4%, transparent);
	}
	.feature-copy {
		display: flex;
		flex-direction: column;
		align-items: start;
		padding: 1.25rem 1.5rem;
	}
	.feature h3 {
		font-size: 1.25rem;
		font-weight: 560;
		letter-spacing: -0.035em;
		line-height: 1.2;
	}
	.feature-copy p {
		max-width: 31rem;
		margin: 0.65rem 0 1rem;
		color: var(--muted-foreground);
		font-size: 0.8125rem;
		line-height: 1.65;
		text-wrap: pretty;
	}
	.feature-copy .text-link {
		margin-top: auto;
	}
	.feature-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 2.3;
		padding: 0.75rem 1.25rem;
		overflow: hidden;
		border-bottom: 1px solid var(--border);
		background: var(--landing-inset);
	}
	.feature-preview :global(svg) {
		display: block;
		width: 72%;
		height: auto;
	}
	.example-links,
	.expression-footnote {
		display: flex;
		height: 3.5rem;
		border-top: 1px solid var(--border);
		background: var(--card);
	}
	.example-links a {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		font-size: 0.75rem;
		font-weight: 520;
	}
	.example-links a:first-child {
		padding-left: 0.75rem;
	}
	.example-links a + a {
		border-left: 1px solid var(--border);
	}
	.example-links a:hover {
		background: var(--accent);
	}
	.expression-footnote {
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 0.75rem 1.5rem;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		line-height: 1.55;
	}
	.expression-footnote .text-link {
		color: var(--foreground);
		font-size: 0.75rem;
	}
	.tool-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.25rem;
	}
	.tool {
		min-width: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.8rem;
		background: var(--card);
		transition: border-color 150ms;
	}
	.tool:hover {
		border-color: color-mix(in oklch, var(--foreground) 25%, var(--border));
	}
	.tool-preview {
		padding: 1.125rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-sunken);
	}
	.tool-preview :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	.tool-caption {
		position: relative;
		min-height: 6.1rem;
		padding: 1.1rem 2.5rem 1.25rem 1.25rem;
	}
	.tool-caption h3 {
		font-size: 0.9375rem;
		font-weight: 550;
		letter-spacing: -0.025em;
	}
	.tool-caption p {
		margin-top: 0.45rem;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		line-height: 1.65;
		text-wrap: pretty;
	}
	.tool-caption :global(.tool-arrow) {
		position: absolute;
		top: 1.25rem;
		right: 1rem;
		color: var(--muted-foreground);
	}
	.hardware-section {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1.5rem;
		margin: 1rem 0 2rem;
		padding: 2rem;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: var(--card);
	}
	.hardware-icon {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border: 1px solid var(--border);
		border-radius: 0.8rem;
		background: var(--surface-sunken);
		color: var(--muted-foreground);
	}
	.hardware-copy h2 {
		font-size: 1.25rem;
	}
	.hardware-copy p {
		max-width: 39rem;
		margin-top: 0.65rem;
		color: var(--muted-foreground);
		font-size: 0.8125rem;
		line-height: 1.65;
		text-wrap: pretty;
	}
	.landing-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
		color: var(--muted-foreground);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.landing-footer a {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.landing-footer a:hover {
		color: var(--foreground);
	}
	:global(html[data-focus-navigation='true']) .landing a:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 5px;
		border-radius: 0.35rem;
	}
	@media (min-width: 1101px) {
		.hero-copy {
			container-type: inline-size;
		}
		h1 {
			--brand-font-size: clamp(3.5rem, 18cqw, 5rem);
			--brand-mark-size: clamp(4.7rem, 22.5cqw, 6.25rem);
			--brand-gap: 1.15rem;
		}
	}
	@media (max-width: 1100px) {
		.hero {
			grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
			gap: 2rem;
		}
		h1 {
			--brand-font-size: clamp(2.75rem, 4.4vw, 3.5rem);
		}
	}
	@media (max-width: 900px) {
		.hero {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
		.hero-copy {
			display: grid;
			grid-template-columns: 1.1fr 1fr;
			gap: 1rem 2rem;
			align-items: end;
		}
		h1 {
			grid-row: span 3;
			--brand-font-size: 3.5rem;
		}
		.hero-lead,
		.hero-actions,
		.hero-details {
			margin-top: 0;
		}
		.resume-link {
			grid-column: 1 / -1;
			margin-top: 0;
		}
		.feature-copy {
			padding: 1.25rem;
		}
		.feature-preview {
			padding: 0.65rem 1rem;
		}
		.example-links a:first-child {
			padding-left: 0.75rem;
		}
		.expression-footnote {
			gap: 0.75rem;
			padding: 1rem 1.25rem;
		}
		.tool-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.hardware-section {
			grid-template-columns: auto 1fr;
			padding: 1.5rem;
		}
		.hardware-action {
			grid-column: 2;
		}
	}
	@media (max-width: 640px) {
		.landing {
			padding: 1rem 1rem 1.5rem;
		}
		.hero {
			gap: 0.75rem;
			padding: 0 0 1.75rem;
		}
		.hero-copy {
			display: block;
		}
		h1 {
			--brand-font-size: clamp(2.375rem, 10vw, 2.75rem);
			--brand-mark-size: 2.5rem;
		}
		.hero-lead {
			margin-top: 0.85rem;
			font-size: 0.8125rem;
			line-height: 1.65;
		}
		.hero-actions {
			gap: 0.5rem;
			margin-top: 1rem;
		}
		.hero-actions :global([data-slot='button']) {
			flex: 1;
			min-height: 44px;
		}
		.hero-note {
			display: none;
		}
		.hero-details {
			margin-top: 0.75rem;
		}
		.resume-link {
			margin-top: 1rem;
			padding-top: 0.75rem;
		}
		.make-section,
		.lab-section {
			padding: 1.75rem 0;
		}
		.section-heading {
			align-items: start;
			flex-direction: column;
			gap: 0.9rem;
			margin-bottom: 1.25rem;
		}
		h2 {
			font-size: 1.5rem;
		}
		.section-heading p {
			font-size: 0.8125rem;
		}
		.feature-grid {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}
		.feature-copy p {
			min-height: 0;
		}
		.example-links,
		.expression-footnote {
			height: 3.5rem;
		}
		.tool-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		.tool {
			display: grid;
			grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
			align-items: center;
			border-radius: 0.65rem;
		}
		.tool-preview {
			display: flex;
			align-items: center;
			height: 100%;
			padding: 0.65rem;
			border-right: 1px solid var(--border);
			border-bottom: 0;
		}
		.tool-caption {
			min-height: 0;
			padding: 1rem 0.9rem;
		}
		.tool-caption h3 {
			font-size: 0.875rem;
		}
		.tool-caption p {
			font-size: 0.6875rem;
			line-height: 1.6;
		}
		.tool-caption :global(.tool-arrow) {
			display: none;
		}
		.hardware-section {
			gap: 1rem;
			margin: 0.25rem 0 1.5rem;
			padding: 1.25rem;
		}
		.hardware-icon {
			width: 2.75rem;
			height: 2.75rem;
			align-self: start;
		}
		.hardware-copy h2 {
			font-size: 1.125rem;
		}
		.hardware-copy p {
			font-size: 0.75rem;
		}
		.hardware-action {
			grid-column: 1 / -1;
		}
		.hardware-action :global([data-slot='button']) {
			width: 100%;
			min-height: 44px;
		}
		.landing-footer {
			align-items: start;
			flex-direction: column;
			gap: 0.75rem;
			font-size: 0.6875rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tool {
			transition: none;
		}
	}
</style>
