<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import VelocityMeter from '$lib/components/midi/VelocityMeter.svelte';
	import VelocityTimbre from '$lib/components/midi/VelocityTimbre.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import PhrasePlayer from '$lib/components/midi/PhrasePlayer.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { Button } from '$lib/components/ui/button';
	import type { NoteSpec } from '$lib/midi/player.svelte';

	const meta = lessonById('velocity')!;

	type CurveName = 'linear' | 'soft' | 'hard' | 'fixed' | 'compressed';
	const CURVES: Record<CurveName, { fn: (v: number) => number; label: string; note: string }> = {
		linear: { fn: (v) => v, label: 'Linear', note: 'What you played is what is sent.' },
		soft: {
			fn: (v) => 127 * Math.pow(v / 127, 0.6),
			label: 'Soft',
			note: 'Light touches send higher values — easier to play loud on a weak keybed.'
		},
		hard: {
			fn: (v) => 127 * Math.pow(v / 127, 1.7),
			label: 'Hard',
			note: 'You have to really mean it. More dynamic range at the quiet end.'
		},
		compressed: {
			fn: (v) => 64 + (v - 64) * 0.4,
			label: 'Compressed',
			note: 'Everything crowds towards the middle. Even, but lifeless.'
		},
		fixed: {
			fn: () => 100,
			label: 'Fixed 100',
			note: 'Velocity thrown away entirely — an organ, essentially.'
		}
	};
	let curve = $state<CurveName>('linear');

	const DYNAMICS: NoteSpec[] = [20, 45, 70, 95, 120].map((velocity, i) => ({
		note: 60,
		start: i * 0.6,
		duration: 0.5,
		velocity
	}));

	const PHRASE: NoteSpec[] = [
		{ note: 67, start: 0, duration: 0.24, velocity: 112 },
		{ note: 64, start: 0.25, duration: 0.24, velocity: 58 },
		{ note: 60, start: 0.5, duration: 0.24, velocity: 46 },
		{ note: 64, start: 0.75, duration: 0.24, velocity: 52 },
		{ note: 67, start: 1, duration: 0.24, velocity: 108 },
		{ note: 64, start: 1.25, duration: 0.24, velocity: 55 },
		{ note: 72, start: 1.5, duration: 0.9, velocity: 124 }
	];
	const FLAT: NoteSpec[] = PHRASE.map((n) => ({ ...n, velocity: 96 }));

	function curvePath(fn: (v: number) => number): string {
		const pts: string[] = [];
		for (let i = 0; i <= 32; i++) {
			const v = (i / 32) * 127;
			const out = Math.max(0, Math.min(127, fn(v)));
			pts.push(`${(v / 127) * 100},${100 - (out / 127) * 100}`);
		}
		return 'M ' + pts.join(' L ');
	}
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Every Note On carries a second number alongside the pitch: <strong>velocity</strong>, from 1
			to 127. On a weighted keyboard it is literally a measurement — the instrument times how long
			the key took to travel from top to bottom, and a fast key means a hard hit.
		</p>
		<p class="prose-body">
			What the receiver does with that number is, as always, entirely up to the receiver. Most
			instruments make it louder. Good ones also make it <em>brighter</em>, because a real piano
			string struck harder does not just get louder, it gets harsher. That combination is what makes
			velocity feel like dynamics rather than a volume knob.
		</p>
	</Section>

	<TryThis title="The same note, five ways">
		<PhrasePlayer notes={DYNAMICS} bpm={100} label="Play note 60 at velocity 20, 45, 70, 95, 120" />
		<p class="text-sm leading-relaxed text-muted-foreground">
			One pitch, five velocities. Listen for the tone change, not just the level.
		</p>
	</TryThis>

	<TryThis title="The same number, two receivers">
		<p class="text-sm leading-relaxed">
			This page can play through either of two instruments, and they disagree about what velocity
			means. Play a few strengths on one, switch, and play the same ones again — the message is
			byte-for-byte identical both times.
		</p>
		<VelocityTimbre />
	</TryThis>

	<Section title="Why it is not a volume control">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="flex flex-col gap-3 rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">Velocity</p>
				<p class="text-sm leading-relaxed">
					Per note. Set once, at the instant the note starts, and never changes again for that note.
					It describes <em>how it was played</em>.
				</p>
				<PhrasePlayer notes={PHRASE} bpm={112} label="Phrase, played dynamically" />
			</div>
			<div class="flex flex-col gap-3 rounded-lg border p-4">
				<p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					The same phrase, flat
				</p>
				<p class="text-sm leading-relaxed">
					Every note at velocity 96. Identical pitches, identical rhythm. This is what people mean
					when they say a MIDI part sounds "programmed".
				</p>
				<PhrasePlayer notes={FLAT} bpm={112} label="Phrase, all at 96" />
			</div>
		</div>
		<Callout variant="key" title="Volume is a different message">
			<p>
				Channel Volume (CC 7) and Expression (CC 11) are how you change loudness over time; they
				affect everything on a channel and can move while notes are held. Velocity cannot — it is
				stamped on the note at birth. Confusing the two is the most common early mistake in MIDI
				mixing.
			</p>
		</Callout>
	</Section>

	<TryThis title="Velocity curves">
		<p class="text-sm leading-relaxed">
			A curve sits between what you played and what gets sent. Controllers, DAWs and hardware all
			offer them, and they are the fix for a keybed that feels wrong. Pick one, then play the
			keyboard below — press near the top of a key for gentle, near the front for hard.
		</p>
		<div class="flex flex-wrap gap-1.5">
			{#each Object.entries(CURVES) as [name, c] (name)}
				<Button
					variant={curve === name ? 'default' : 'outline'}
					size="sm"
					class="h-7 text-xs"
					onclick={() => (curve = name as CurveName)}
				>
					{c.label}
				</Button>
			{/each}
		</div>

		<div class="grid items-start gap-4 sm:grid-cols-[13rem_1fr]">
			<div class="panel-sunken graph-paper rounded-lg border p-2">
				<svg viewBox="0 0 100 100" class="aspect-square w-full overflow-visible">
					<line
						x1="0"
						y1="100"
						x2="100"
						y2="0"
						stroke="var(--grid-line-strong)"
						stroke-width="1"
						stroke-dasharray="3 3"
					/>
					<path
						d={curvePath(CURVES[curve].fn)}
						fill="none"
						stroke="var(--msg-note)"
						stroke-width="2.5"
						stroke-linecap="round"
						vector-effect="non-scaling-stroke"
					/>
				</svg>
				<p class="mt-1 text-center font-mono text-2xs text-muted-foreground">played → sent</p>
			</div>
			<div class="flex flex-col gap-3">
				<p class="text-sm text-muted-foreground">{CURVES[curve].note}</p>
				<VelocityMeter />
			</div>
		</div>

		<Keyboard low={48} octaves={3} height={130} curve={CURVES[curve].fn} />
	</TryThis>

	<Callout variant="gotcha" title="Velocity 0 is not silence">
		<p>
			A Note On with velocity 0 is defined to mean <strong>Note Off</strong>. It is not "play this
			note infinitely quietly" — it stops the note. This was a bandwidth trick from 1983 that lets a
			stream of notes share one status byte, and every device still honours it. You will meet it
			properly in <Xref to="note-on-off" />.
		</p>
	</Callout>

	<Section title="Release velocity">
		<p class="prose-body">
			Note Off carries a velocity too — how fast you <em>lifted</em> the key. Almost nothing transmits
			it and almost nothing responds to it, so in practice it is 0 or 64 and safely ignored. Worth knowing
			exists; not worth planning around.
		</p>
		<p class="prose-body">
			Both of these numbers are handed to the same machinery: the instrument's envelope, which is
			what turns two instants into a sound that lasts. That is
			<Xref to="envelope" />, and it is where "louder and brighter" stops being a description and
			becomes a mechanism.
		</p>
	</Section>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="soft"
			label="Play a note softer than velocity 40"
			hint="Press near the top edge of a key."
			test={(e) => e.message.type === 'noteOn' && e.message.velocity < 40}
		/>
		<Checkpoint
			lesson={meta.id}
			id="hard"
			label="Play a note harder than velocity 110"
			hint="Press near the front edge of a key — or try the Soft curve."
			test={(e) => e.message.type === 'noteOn' && e.message.velocity > 110}
		/>
		<Checkpoint
			lesson={meta.id}
			id="range"
			label="Cover four different velocity bands in one session"
			hint="Quiet, medium-quiet, medium-loud and loud."
			count={4}
			key={(e) => (e.message.type === 'noteOn' ? String(Math.floor(e.message.velocity / 32)) : '')}
			test={(e) => e.message.type === 'noteOn'}
		/>
	</Checkpoints>
</LessonShell>
