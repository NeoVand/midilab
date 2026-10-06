<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import VoicePicker from '$lib/components/midi/VoicePicker.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { SequencePlayer, notesToEvents, type NoteSpec } from '$lib/midi/player.svelte';
	import { CIRCLE_KEYS, majorKey, cadence, type DiatonicChord } from '$lib/music/harmony';
	import { cn } from '$lib/utils';

	let { minors = true, class: className }: { minors?: boolean; class?: string } = $props();
	const uid = $props.id();
	let selected = $state(0);
	let program = $state(0);
	let comparison = $state<'home' | 'surprise'>('home');
	let frames = $state.raw<{ chord: DiatonicChord; start: number; duration: number }[]>([]);
	let playLabel = $state('');
	let requestVersion = 0;
	const player = new SequencePlayer();
	const BPM = 92;
	const key = $derived(majorKey(selected));
	const parallelChord = $derived<DiatonicChord>({
		degree: 1,
		roman: 'i',
		label: key.parallelMinor,
		quality: 'minor',
		rootPc: key.tonicPc,
		notes: [60 + key.tonicPc, 63 + key.tonicPc, 67 + key.tonicPc]
	});
	const previous = $derived((selected + 11) % 12);
	const next = $derived((selected + 1) % 12);
	const comparedChords = $derived(cadence(selected, comparison));
	const activeFrame = $derived(
		player.playing
			? frames.findLast((frame) => frame.start <= (player.position * BPM) / 60)
			: undefined
	);

	const CENTER = 230;
	const STEP = Math.PI / 6;
	function shortSignature(accidentals: string[]) {
		return accidentals.length
			? `${accidentals.length}${accidentals[0].includes('♭') ? '♭' : '♯'}`
			: '0';
	}
	function polar(radius: number, index: number) {
		const angle = index * STEP - Math.PI / 2;
		return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
	}
	function wedge(index: number, inside: number, outside: number) {
		const begin = (index - 0.5) * STEP - Math.PI / 2 + 0.014;
		const end = (index + 0.5) * STEP - Math.PI / 2 - 0.014;
		const point = (r: number, a: number) =>
			`${CENTER + r * Math.cos(a)} ${CENTER + r * Math.sin(a)}`;
		return `M ${point(inside, begin)} L ${point(outside, begin)} A ${outside} ${outside} 0 0 1 ${point(outside, end)} L ${point(inside, end)} A ${inside} ${inside} 0 0 0 ${point(inside, begin)} Z`;
	}
	function role(index: number): 'home' | 'away' | 'pull' | undefined {
		return index === selected
			? 'home'
			: index === previous
				? 'away'
				: index === next
					? 'pull'
					: undefined;
	}
	function degreeRole(degree: number) {
		return degree === 1 ? 'home' : degree === 4 ? 'away' : degree === 5 ? 'pull' : 'other';
	}
	function stop() {
		requestVersion++;
		player.stop();
		frames = [];
	}
	async function listen(chords: DiatonicChord[], label: string) {
		stop();
		const version = requestVersion;
		await engine.wake();
		if (version !== requestVersion) return;
		engine.send(
			{ type: 'controlChange', channel: 0, controller: 64, value: 0 },
			undefined,
			undefined,
			'demo'
		);
		engine.send({ type: 'programChange', channel: 0, program }, undefined, undefined, 'demo');
		frames = chords.map((chord, i) => ({
			chord,
			start: i * 2,
			duration: i === chords.length - 1 ? 2.7 : 1.8
		}));
		playLabel = label;
		const notes: NoteSpec[] = frames.flatMap((frame) =>
			frame.chord.notes.map((note) => ({
				note,
				start: frame.start,
				duration: frame.duration,
				velocity: 82,
				channel: 0
			}))
		);
		await player.play(notesToEvents(notes, BPM));
	}
	function select(index: number) {
		selected = index;
		void listen([majorKey(index).chords[0]], `${majorKey(index).tonic} major`);
	}
	function navigate(event: KeyboardEvent, index: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			select(index);
			return;
		}
		const offset =
			event.key === 'ArrowRight' || event.key === 'ArrowDown'
				? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
					? -1
					: 0;
		if (!offset && event.key !== 'Home') return;
		event.preventDefault();
		const target = event.key === 'Home' ? 0 : (index + offset + 12) % 12;
		const svg =
			event.currentTarget instanceof SVGElement ? event.currentTarget.ownerSVGElement : null;
		svg?.querySelector<SVGPathElement>(`[data-key="${target}"]`)?.focus();
		select(target);
	}
	function hearCadence(ending: 'home' | 'surprise') {
		comparison = ending;
		void listen(
			cadence(selected, ending),
			ending === 'home' ? 'ii–V–I: arrive home' : 'ii–V–vi: take a detour'
		);
	}
	onDestroy(stop);
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) stop();
	}}
/>

<section class={cn('harmonic-compass', className)} aria-labelledby={`${uid}-heading`}>
	<div class="compass-heading">
		<div>
			<h3 id={`${uid}-heading`}>A map of musical neighbours</h3>
			<p>Select a key. Hear its chords, then compare two endings.</p>
		</div>
		<VoicePicker bind:value={program} audition={false} onValue={stop} />
	</div>
	<div class="compass-main">
		<div class="wheel-column">
			<svg
				viewBox="0 0 460 460"
				role="group"
				aria-label={`Circle of fifths. ${key.tonic} major selected. Arrow keys move around the circle.`}
			>
				{#each CIRCLE_KEYS as circleKey, index (circleKey.tonic)}
					{@const keyRole = role(index)}
					{@const label = polar(minors ? 174 : 160, index)}
					{@const signature = polar(199, index)}
					{@const degree = polar(minors ? 150 : 115, index)}
					{@const minorLabel = polar(115, index)}
					<g>
						<path
							d={wedge(index, minors ? 142 : 98, 213)}
							class={cn('key-wedge focus-shape', keyRole)}
							role="button"
							tabindex="0"
							data-key={index}
							aria-label={`${circleKey.tonic} major, ${circleKey.signatureText}`}
							aria-pressed={selected === index}
							onclick={() => select(index)}
							onkeydown={(event) => navigate(event, index)}
						/>
						<text
							x={label.x}
							y={label.y + 8}
							text-anchor="middle"
							class={cn('key-name', keyRole)}
							aria-hidden="true">{circleKey.tonic}</text
						>
						<text
							x={signature.x}
							y={signature.y + 4}
							text-anchor="middle"
							class="signature-label"
							aria-hidden="true">{shortSignature(circleKey.accidentals)}</text
						>
						{#if keyRole}
							<text
								x={degree.x}
								y={degree.y + 4}
								text-anchor="middle"
								class={cn('degree-label', keyRole)}
								aria-hidden="true"
								>{keyRole === 'home' ? 'I' : keyRole === 'away' ? 'IV' : 'V'}</text
							>
						{/if}
						{#if minors}
							<path
								d={wedge(index, 93, 139)}
								class={cn('minor-wedge', selected === index && 'selected')}
								aria-hidden="true"
							/>
							<text
								x={minorLabel.x}
								y={minorLabel.y + 5}
								text-anchor="middle"
								class="minor-name"
								aria-hidden="true">{circleKey.relativeMinor.replace(' minor', 'm')}</text
							>
						{/if}
					</g>
				{/each}
				<circle cx={CENTER} cy={CENTER} r="85" class="hub" aria-hidden="true" />
				<text x={CENTER} y={CENTER - 27} text-anchor="middle" class="hub-caption" aria-hidden="true"
					>Tonal centre</text
				>
				<text x={CENTER} y={CENTER + 16} text-anchor="middle" class="hub-key" aria-hidden="true"
					>{key.tonic}</text
				>
				<text x={CENTER} y={CENTER + 40} text-anchor="middle" class="hub-caption" aria-hidden="true"
					>major</text
				>
			</svg>
			<div class="wheel-directions">
				<span>Counterclockwise: down a fifth</span><span>Clockwise: up a fifth</span>
			</div>
			<p class="wheel-caption">
				Outer ring: major keys.{#if minors}
					Inner ring: their relative minors.{/if}
			</p>
		</div>
		<div class="key-detail">
			<div class="key-summary" aria-live="polite" aria-atomic="true">
				<h4>{key.tonic} major</h4>
				<p>{key.signatureText}</p>
				{#if key.enharmonic}
					<p class="enharmonic-note">
						The same keyboard tonic is also named {key.enharmonic}. This scale uses {key.tonic}’s
						spelling.
					</p>
				{/if}
				<div class="scale-notes" aria-label={`${key.tonic} major scale`}>
					{#each key.scale as note (note)}<span>{note}</span>{/each}
				</div>
			</div>
			<div class="function-row">
				{#each [{ degree: 4, name: 'Step away', tone: 'away' }, { degree: 1, name: 'Home', tone: 'home' }, { degree: 5, name: 'Pull home', tone: 'pull' }] as functionChord (functionChord.degree)}
					{@const chord = key.chords[functionChord.degree - 1]}
					<button
						type="button"
						class={cn(
							'function-chord',
							functionChord.tone,
							activeFrame?.chord.degree === chord.degree && 'sounding'
						)}
						aria-label={`Hear ${chord.label}, ${chord.roman}, ${functionChord.name}`}
						onclick={() => listen([chord], chord.label)}
					>
						<span class="chord-degree">{chord.roman}</span><strong>{chord.label}</strong><span
							>{functionChord.name}</span
						>
					</button>
				{/each}
			</div>
			<p>
				The keys either side share six of seven scale pitches with {key.tonic} major. As chords inside
				this key, <strong>IV moves away</strong>, <strong>V often creates expectation</strong>, and
				<strong>I can feel like an arrival</strong>.
			</p>
			<div class="minor-comparison">
				<p>
					<strong>{key.relativeMinor}</strong> is the relative minor: the same key signature, a
					different home. <strong>{key.parallelMinor}</strong> is the parallel minor: the same tonic,
					a different scale.
				</p>
				<Button
					variant="outline"
					size="sm"
					onclick={() => listen([key.chords[5]], `${key.relativeMinor} chord`)}
					>Hear the relative-minor chord</Button
				>
				<Button
					variant="outline"
					size="sm"
					onclick={() => listen([parallelChord], `${key.parallelMinor} chord`)}
					>Hear the parallel-minor chord</Button
				>
			</div>
		</div>
	</div>

	<div class="chord-palette">
		<div class="palette-heading">
			<h4>Seven chords from one scale</h4>
			<span>Tap any chord to hear it</span>
		</div>
		<div class="diatonic-row">
			{#each key.chords as chord (chord.degree)}
				<button
					type="button"
					class={cn(
						'diatonic-chord',
						degreeRole(chord.degree),
						activeFrame?.chord.degree === chord.degree && 'sounding'
					)}
					aria-label={`Hear ${chord.label}, degree ${chord.roman}`}
					onclick={() => listen([chord], chord.label)}
					><span class="chord-degree">{chord.roman}</span><strong>{chord.label}</strong></button
				>
			{/each}
		</div>
		<p>
			Roman numerals describe each chord’s place in the key. Uppercase means major; lowercase means
			minor; ° means diminished. Transpose the key and the relationship stays the same.
		</p>
	</div>

	<div class="cadence-comparison">
		<div class="cadence-heading">
			<h4>Expectation, then a choice</h4>
			{#if player.playing}<Button variant="outline" size="sm" onclick={stop}>Stop</Button>{/if}
		</div>
		<div class="cadence-path" aria-label={comparison === 'home' ? 'ii to V to I' : 'ii to V to vi'}>
			{#each comparedChords as chord, index (chord.degree)}
				{#if index}<span class="cadence-arrow" aria-hidden="true">→</span>{/if}
				<div
					class={cn(
						'cadence-step',
						degreeRole(chord.degree),
						activeFrame?.chord.degree === chord.degree && 'sounding'
					)}
				>
					<span class="chord-degree">{chord.roman}</span><strong>{chord.label}</strong><span
						>{index === 0
							? 'Prepare'
							: index === 1
								? 'Expect'
								: comparison === 'home'
									? 'Arrive'
									: 'Detour'}</span
					>
				</div>
			{/each}
		</div>
		<div class="cadence-actions">
			<Button
				variant={comparison === 'home' ? 'default' : 'outline'}
				onclick={() => hearCadence('home')}>Hear ii–V–I</Button
			><Button
				variant={comparison === 'surprise' ? 'default' : 'outline'}
				onclick={() => hearCadence('surprise')}>Hear ii–V–vi</Button
			>
		</div>
		<p class="listening-status" aria-live="polite">
			{player.playing
				? `Listening: ${playLabel}`
				: 'Listen twice. The opening stays the same; only the destination changes.'}
		</p>
		<p>
			A V chord followed by I is a familiar resolution in tonal music. Moving to vi can defer that
			arrival: a <strong>deceptive cadence</strong>. The harmony offers expectation; your melody,
			rhythm, register and phrasing decide how strongly we feel it.
		</p>
	</div>
	<p class="compass-footnote">
		The circle maps relationships; it does not prescribe the order of a song’s chords. Clockwise
		fifths are seven semitones in this app’s equal temperament. A pure acoustic fifth has a 3:2
		frequency ratio; these keyboard fifths are slightly narrower.
	</p>
</section>

<style>
	.harmonic-compass {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
		--home: var(--msg-program);
		--away: var(--msg-cc);
		--pull: var(--msg-expr);
	}
	.compass-heading,
	.palette-heading,
	.cadence-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
	.compass-heading h3 {
		font-size: var(--text-lg);
		font-weight: 600;
	}
	.compass-heading p,
	.wheel-caption,
	.palette-heading span {
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
	.compass-heading p {
		margin-top: 0.25rem;
	}
	.compass-main {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: center;
	}
	.wheel-column {
		min-width: 0;
	}
	.wheel-column svg {
		display: block;
		width: 100%;
		max-width: 32rem;
		margin-inline: auto;
	}
	.key-wedge {
		fill: var(--surface-sunken);
		stroke: var(--border);
		stroke-width: 1;
		cursor: pointer;
		transition: fill 0.15s ease;
	}
	.key-wedge:hover {
		fill: var(--accent);
		stroke: var(--foreground);
	}
	.key-wedge.home {
		fill: var(--msg-program-bg);
		stroke: var(--home);
		stroke-width: 2;
	}
	.key-wedge.away {
		fill: var(--msg-cc-bg);
		stroke: var(--away);
	}
	.key-wedge.pull {
		fill: var(--msg-expr-bg);
		stroke: var(--pull);
	}
	.key-wedge:focus-visible {
		stroke: var(--foreground);
		stroke-width: 4;
	}
	.key-name {
		fill: var(--foreground);
		font-size: 27px;
		font-weight: 550;
		pointer-events: none;
	}
	.key-name.home,
	.degree-label.home {
		fill: var(--home);
	}
	.key-name.away,
	.degree-label.away {
		fill: var(--away);
	}
	.key-name.pull,
	.degree-label.pull {
		fill: var(--pull);
	}
	.signature-label {
		fill: var(--muted-foreground);
		font-size: 12px;
		pointer-events: none;
	}
	.degree-label {
		font-size: 12px;
		font-family: var(--font-mono);
		font-weight: 650;
		pointer-events: none;
	}
	.minor-wedge {
		fill: var(--muted);
		stroke: var(--border);
	}
	.minor-wedge.selected {
		fill: var(--msg-program-bg);
		stroke: var(--home);
	}
	.minor-name {
		fill: var(--muted-foreground);
		font-size: 18px;
		pointer-events: none;
	}
	.hub {
		fill: var(--background);
		stroke: var(--border);
	}
	.hub-caption {
		fill: var(--muted-foreground);
		font-size: 13px;
	}
	.hub-key {
		fill: var(--home);
		font-size: 46px;
		font-weight: 650;
	}
	.wheel-directions {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
	.wheel-directions span {
		max-width: 45%;
	}
	.wheel-directions span:last-child {
		text-align: right;
	}
	.wheel-caption {
		text-align: center;
		margin-top: 0.75rem;
	}
	.key-detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	.key-summary h4 {
		font-size: var(--text-2xl);
		font-weight: 600;
		color: var(--home);
	}
	.key-summary p {
		color: var(--muted-foreground);
		margin-top: 0.25rem;
	}
	.key-summary .enharmonic-note {
		font-size: var(--text-xs);
		margin-top: 0.6rem;
	}
	.scale-notes {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}
	.scale-notes span {
		font-size: var(--text-sm);
		font-weight: 550;
	}
	.function-row {
		display: flex;
		gap: 0.5rem;
	}
	.function-chord,
	.diatonic-chord {
		border: 1px solid var(--border);
		background: var(--surface-sunken);
		border-radius: var(--radius);
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.function-chord {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		min-width: 0;
		padding: 0.65rem 0.25rem;
	}
	.function-chord strong {
		font-size: var(--text-lg);
	}
	.function-chord > span:last-child,
	.cadence-step > span:last-child {
		font-size: var(--text-xs);
		color: var(--muted-foreground);
	}
	.home {
		--tone: var(--home);
		--tone-bg: var(--msg-program-bg);
	}
	.away {
		--tone: var(--away);
		--tone-bg: var(--msg-cc-bg);
	}
	.pull {
		--tone: var(--pull);
		--tone-bg: var(--msg-expr-bg);
	}
	.other {
		--tone: var(--foreground);
		--tone-bg: var(--accent);
	}
	.function-chord {
		border-color: var(--tone);
	}
	.chord-degree {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--tone, var(--muted-foreground));
	}
	.function-chord:hover,
	.diatonic-chord:hover,
	.sounding {
		background: var(--tone-bg);
		border-color: var(--tone);
	}
	.sounding {
		box-shadow: inset 0 0 0 1px var(--tone);
	}
	.key-detail p,
	.chord-palette p,
	.cadence-comparison p {
		font-size: var(--text-sm);
		line-height: 1.6;
	}
	.minor-comparison {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		align-items: flex-start;
		padding-top: 0.85rem;
		border-top: 1px solid var(--border);
	}
	.chord-palette,
	.cadence-comparison {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding-top: 1.2rem;
		border-top: 1px solid var(--border);
	}
	.palette-heading h4,
	.cadence-heading h4 {
		font-size: var(--text-base);
		font-weight: 600;
	}
	.diatonic-row {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.45rem;
	}
	.diatonic-chord {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.3rem;
		min-height: 4.1rem;
		padding: 0.4rem 0.2rem;
	}
	.diatonic-chord strong {
		font-weight: 550;
		font-size: var(--text-base);
	}
	.cadence-path {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 0.7rem;
		max-width: 32rem;
	}
	.cadence-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.85rem 0.4rem;
		background: var(--surface-sunken);
	}
	.cadence-step strong {
		font-size: var(--text-xl);
	}
	.cadence-arrow {
		color: var(--muted-foreground);
	}
	.cadence-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.listening-status {
		color: var(--muted-foreground);
		min-height: 1.3em;
	}
	.compass-footnote {
		font-size: var(--text-xs);
		line-height: 1.6;
		color: var(--muted-foreground);
	}
	@media (max-width: 680px) {
		.compass-main {
			grid-template-columns: minmax(0, 1fr);
			gap: 1.25rem;
		}
		.wheel-column svg {
			max-width: 27rem;
		}
		.diatonic-row {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.cadence-path {
			gap: 0.4rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.key-wedge,
		.function-chord,
		.diatonic-chord {
			transition: none;
		}
	}
</style>
