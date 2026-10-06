<script lang="ts">
	import { path } from '$lib/nav';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowRight01Icon, PlugSocketIcon, SquareTerminalIcon } from '@hugeicons/core-free-icons';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { router } from '$lib/midi/router.svelte';
	import { devices } from '$lib/midi/devices/store.svelte';
	import { MELODIES } from '$lib/music/melodies';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import ToolFigure from '$lib/components/shell/ToolFigure.svelte';
	import { cn } from '$lib/utils';

	const featured = [
		{
			href: '/lab/studio',
			figure: 'studio' as const,
			name: 'First Track Studio',
			desc: 'Turn a small idea into a complete piece. Build with drums, bass, chords, and your own melody.',
			contents: 'Original starters, live recording, and MIDI export.',
			action: 'Make your first track'
		},
		{
			href: '/lab/mpe',
			figure: 'mpe' as const,
			name: 'MPE Playground',
			desc: 'Bend one note. Let another bloom. Discover how pitch, pressure, and color become musical gestures.',
			contents: 'Play on screen or connect your expressive controller.',
			action: 'Explore expression'
		}
	];
	const tools = $derived([
		{
			href: '/lab/monitor',
			figure: 'monitor' as const,
			name: 'Monitor',
			desc: 'See every message your instrument sends, down to the last byte.',
			contents: 'Message filters · Byte inspector · Export',
			badge: null as string | null
		},
		{
			href: '/lab/patchbay',
			figure: 'patchbay' as const,
			name: 'Patchbay',
			desc: 'Connect instruments, reshape channels, and put every note where it belongs.',
			contents: 'Route · Transpose · Filter · Split',
			badge: router.routes.length
				? `${router.routes.length} route${router.routes.length === 1 ? '' : 's'}`
				: null
		},
		{
			href: '/lab/programmer',
			figure: 'programmer' as const,
			name: 'Programmer',
			desc: 'Find a rhythm, build a sequence, and send it to your synth or a MIDI file.',
			contents: 'Step sequencer · Patterns · MIDI export',
			badge: null
		},
		{
			href: '/lab/devices',
			figure: 'devices' as const,
			name: 'Device Lab',
			desc: 'Get to know your instrument. Move a control and learn what it does.',
			contents: 'Identify · Learn controls · Save profiles',
			badge: devices.user.length ? `${devices.user.length} saved` : null
		},
		{
			href: '/lab/jukebox',
			figure: 'jukebox' as const,
			name: 'Jukebox',
			desc: 'Hear familiar music through a new instrument. Change the tempo, key, or voice.',
			contents: `${MELODIES.length} pieces · Transpose · Rounds`,
			badge: null
		},
		{
			href: '/lab/diagnostics',
			figure: 'diagnostics' as const,
			name: 'Diagnostics',
			desc: 'Check the timing of your setup and find the source of lag or jitter.',
			contents: 'Round trip · Clock jitter · Loopback',
			badge: null
		}
	]);
	const ports = $derived(midiAccess.inputs.length + midiAccess.outputs.length);
</script>

<svelte:head>
	<title>The Lab — MIDI Lab</title>
	<meta
		name="description"
		content="Make music in First Track Studio, explore per-note expression, and understand your instruments with MIDI Lab's creative tools."
	/>
</svelte:head>

<div class="lab-landing">
	<header class="lab-header">
		<div class="introduction">
			<h1>The Lab</h1>
			<p>
				A place to make music, understand your instruments, and follow an idea wherever it leads.
			</p>
		</div>
		<div class="header-actions">
			{#if midiAccess.status === 'granted'}
				<p class="port-status">
					<span class={cn('status-dot', ports ? 'bg-ok' : 'bg-muted-foreground/40')}></span>
					{#if ports}
						{midiAccess.inputs.length} in · {midiAccess.outputs.length} out detected
					{:else}
						No ports found
					{/if}
				</p>
			{:else if midiAccess.status !== 'unsupported'}
				<Button variant="outline" size="lg" onclick={() => midiAccess.request(false)}>
					<HugeiconsIcon icon={PlugSocketIcon} data-icon="inline-start" />
					Connect MIDI
				</Button>
			{/if}
			<a href={path('/learn')} class="lesson-link"
				>Find a lesson <HugeiconsIcon icon={ArrowRight01Icon} size={14} /></a
			>
		</div>
	</header>

	<section aria-label="Creative tools" class="featured-grid">
		{#each featured as tool (tool.href)}
			<a href={path(tool.href)} class="featured-tool">
				<div class="feature-preview"><ToolFigure tool={tool.figure} /></div>
				<div class="feature-body">
					<h2>{tool.name}</h2>
					<p>{tool.desc}</p>
					<p class="feature-contents">{tool.contents}</p>
					<span class="feature-action"
						>{tool.action}<HugeiconsIcon icon={ArrowRight01Icon} size={18} /></span
					>
				</div>
			</a>
		{/each}
	</section>

	<section aria-labelledby="tool-heading" class="tools-section">
		<div class="section-heading">
			<h2 id="tool-heading">Your MIDI workbench</h2>
			<p>Focused tools for the moments when you want to look a little closer.</p>
		</div>
		<div class="tool-grid">
			{#each tools as tool (tool.href)}
				<a href={path(tool.href)} class="tool-card">
					<div class="tool-preview"><ToolFigure tool={tool.figure} /></div>
					<div class="tool-body">
						<div class="tool-title">
							<h3>{tool.name}</h3>
							{#if tool.badge}<Badge variant="outline">{tool.badge}</Badge>{/if}<HugeiconsIcon
								icon={ArrowRight01Icon}
								size={14}
							/>
						</div>
						<p>{tool.desc}</p>
						<p class="tool-contents">{tool.contents}</p>
					</div>
				</a>
			{/each}
		</div>
		<a href={path('/lab/console')} class="console-link">
			<span class="console-icon"
				><HugeiconsIcon icon={SquareTerminalIcon} size={22} strokeWidth={1.6} /></span
			>
			<div>
				<h3>Console</h3>
				<p>
					Write a little JavaScript. Play notes, build patterns, or drive your hardware directly.
				</p>
			</div>
			<HugeiconsIcon icon={ArrowRight01Icon} size={18} />
		</a>
	</section>
	<p class="workspace-note">
		Play a note, watch it in the Monitor, then shape its journey in the Patchbay. Your tools work
		together.
	</p>
</div>

<style>
	.lab-landing {
		width: min(100%, 76rem);
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem) 4rem;
	}
	.lab-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 2rem;
		margin-bottom: 2.5rem;
	}
	.introduction {
		max-width: 39rem;
	}
	.introduction h1 {
		font-size: clamp(2.35rem, 4.5vw, 3.6rem);
		font-weight: 560;
		letter-spacing: -0.055em;
		line-height: 1.05;
		margin-bottom: 1.1rem;
	}
	.introduction p {
		font-size: 1rem;
		line-height: 1.7;
		color: var(--muted-foreground);
		max-width: 34rem;
	}
	.header-actions {
		display: flex;
		align-items: flex-end;
		flex-direction: column;
		gap: 0.8rem;
		flex-shrink: 0;
		padding-bottom: 0.2rem;
	}
	.port-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}
	.status-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 50%;
	}
	.lesson-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
	}
	.lesson-link:hover {
		color: var(--foreground);
	}
	.featured-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
	}
	.featured-tool,
	.tool-card {
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--landing-line, var(--border));
		border-radius: 1rem;
		background: var(--landing-panel, var(--card));
		box-shadow: 0 1px 0 color-mix(in oklch, var(--foreground) 3%, transparent);
		transition:
			border-color 160ms ease,
			box-shadow 160ms ease;
	}
	.featured-tool:hover,
	.tool-card:hover {
		border-color: color-mix(in oklch, var(--landing-accent, var(--foreground)) 42%, var(--border));
		box-shadow: 0 8px 24px color-mix(in oklch, var(--foreground) 4%, transparent);
	}
	.feature-preview {
		margin: 1rem 1rem 0;
		border: 1px solid var(--border);
		border-radius: 0.55rem;
		overflow: hidden;
	}
	.feature-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		padding: 1.35rem 1.5rem 1.4rem;
	}
	.feature-body h2 {
		font-size: 1.25rem;
		letter-spacing: -0.025em;
		font-weight: 560;
		line-height: 1.3;
		margin-bottom: 0.55rem;
	}
	.feature-body p {
		font-size: 0.875rem;
		line-height: 1.65;
		color: var(--muted-foreground);
	}
	.feature-body .feature-contents {
		font-size: 0.75rem;
		margin-top: 0.7rem;
	}
	.feature-action {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 1.25rem;
		margin-top: auto;
		font-size: 0.8125rem;
		font-weight: 530;
		color: var(--landing-accent, var(--foreground));
	}
	.tools-section {
		margin-top: 3.5rem;
	}
	.section-heading {
		margin-bottom: 1.5rem;
	}
	.section-heading h2 {
		font-size: 1.5rem;
		letter-spacing: -0.035em;
		font-weight: 550;
		line-height: 1.3;
	}
	.section-heading p {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.65;
		color: var(--muted-foreground);
	}
	.tool-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.15rem;
	}
	.tool-preview {
		margin: 0.75rem 0.75rem 0;
		border: 1px solid var(--border);
		border-radius: 0.45rem;
		overflow: hidden;
	}
	.tool-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		padding: 1.15rem 1.25rem 1.25rem;
	}
	.tool-title {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
	}
	.tool-title h3 {
		font-weight: 550;
		font-size: 1rem;
		letter-spacing: -0.025em;
		line-height: 1.3;
	}
	.tool-title :global(svg) {
		margin-left: auto;
		color: var(--muted-foreground);
	}
	.tool-body p {
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--muted-foreground);
	}
	.tool-body .tool-contents {
		margin-top: auto;
		padding-top: 1.2rem;
		font-size: 0.6875rem;
		line-height: 1.55;
	}
	.console-link {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.8rem;
		padding: 1.5rem;
		margin-top: 1.2rem;
		background: var(--landing-panel, var(--card));
		transition: border-color 160ms ease;
	}
	.console-link:hover {
		border-color: var(--landing-accent, var(--foreground));
	}
	.console-icon {
		color: var(--muted-foreground);
	}
	.console-link h3 {
		font-weight: 550;
		font-size: 0.9375rem;
		line-height: 1.4;
		margin-bottom: 0.25rem;
	}
	.console-link p {
		color: var(--muted-foreground);
		font-size: 0.8125rem;
		line-height: 1.6;
	}
	.console-link > :global(svg) {
		margin-left: auto;
		flex-shrink: 0;
		color: var(--muted-foreground);
	}
	.workspace-note {
		padding-top: 1.5rem;
		font-size: 0.8125rem;
		line-height: 1.7;
		color: var(--muted-foreground);
		max-width: 44rem;
	}
	:global(html[data-focus-navigation='true']) a:focus-visible {
		outline: 2px solid var(--landing-accent, var(--ring));
		outline-offset: 4px;
	}
	@media (max-width: 1000px) {
		.tool-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.lab-header {
			align-items: flex-start;
		}
	}
	@media (max-width: 640px) {
		.lab-header {
			flex-direction: column;
			gap: 1.4rem;
			margin-bottom: 1.8rem;
		}
		.header-actions {
			flex-direction: row;
			align-items: center;
			gap: 1.25rem;
			flex-wrap: wrap;
		}
		.featured-grid,
		.tool-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.feature-body {
			padding: 1.2rem;
		}
		.tools-section {
			margin-top: 2.5rem;
		}
		.console-link {
			align-items: flex-start;
			padding: 1.2rem;
			gap: 0.8rem;
		}
		.console-link > :global(svg) {
			margin-top: 0.1rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.featured-tool,
		.tool-card,
		.console-link {
			transition: none;
		}
	}
</style>
