<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import PatternLab from '$lib/components/midi/PatternLab.svelte';
	import CodeSandbox from '$lib/components/midi/CodeSandbox.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { euclidString } from '$lib/patterns';
	import { transport } from '$lib/midi/clock.svelte';
	import { Slider } from '$lib/components/ui/slider';

	const meta = lessonById('patterns')!;

	let pulses = $state(3);
	let steps = $state(8);
	let rotation = $state(0);

	const FAMOUS: Array<[string, number, number]> = [
		['Cuban tresillo', 3, 8],
		['Cuban cinquillo', 5, 8],
		['Ruchenitza (Bulgaria)', 4, 7],
		['Agsag-Samai (Turkey)', 5, 9],
		['Venda (South Africa)', 5, 12],
		['Bossa nova', 5, 16],
		['Khafif-e-ramal (Persia)', 2, 5],
		['Bendir (North Africa)', 7, 8]
	];

	const EXAMPLES = [
		{
			name: 'Euclidean by hand',
			code: `// Bjorklund's algorithm, in about ten lines.
function euclid(pulses, steps) {
	let a = Array.from({ length: pulses }, () => [1]);
	let b = Array.from({ length: steps - pulses }, () => [0]);
	while (b.length > 1) {
		const n = Math.min(a.length, b.length);
		const merged = [];
		for (let i = 0; i < n; i++) merged.push([...a[i], ...b[i]]);
		const rest = a.length > b.length ? a.slice(n) : b.slice(n);
		a = merged; b = rest;
	}
	return [...a, ...b].flat();
}

for (const [p, s] of [[3,8],[5,8],[7,16],[5,12]]) {
	log(\`E(\${p},\${s})\`, euclid(p, s).map(v => v ? 'x' : '.').join(''));
}`
		},
		{
			name: 'Generative bassline',
			code: `// A line that never repeats but always fits.
const SCALE = [0, 3, 5, 7, 10];   // minor pentatonic
const ROOT = 36;
let step = 0;

midi.transport.onTick((t) => {
	if (t.tick % 24) return;                       // every sixteenth
	step++;
	if (Math.random() > 0.62) return;              // leave gaps
	const degree = Math.floor(Math.random() * 5) + (step % 8 < 4 ? 0 : 5);
	const note = ROOT + Math.floor(degree / 5) * 12 + SCALE[degree % 5];
	const at = t.audioTime;
	midi.send({ type: 'noteOn',  channel: 0, note, velocity: 70 + Math.random() * 40 | 0 }, midi.toPerf(at), at);
	midi.send({ type: 'noteOff', channel: 0, note, velocity: 0 }, midi.toPerf(at + 0.12), at + 0.12);
});

midi.transport.start();
log('running — Stop cancels it');`
		},
		{
			name: 'Two Euclideans against each other',
			code: `// Polyrhythm for free: different pulse counts over the same span.
const patterns = [
	{ note: 36, pulses: 3, steps: 8,  channel: 9 },
	{ note: 42, pulses: 7, steps: 16, channel: 9 },
	{ note: 39, pulses: 5, steps: 12, channel: 9 },
];

function euclid(p, s) {
	let a = Array.from({length: p}, () => [1]), b = Array.from({length: s - p}, () => [0]);
	while (b.length > 1) {
		const n = Math.min(a.length, b.length), m = [];
		for (let i = 0; i < n; i++) m.push([...a[i], ...b[i]]);
		const r = a.length > b.length ? a.slice(n) : b.slice(n);
		a = m; b = r;
	}
	return [...a, ...b].flat();
}

const grids = patterns.map(p => euclid(p.pulses, p.steps));

midi.transport.onTick((t) => {
	if (t.tick % 24) return;
	const sixteenth = Math.floor(t.tick / 24);
	patterns.forEach((p, i) => {
		if (!grids[i][sixteenth % p.steps]) return;
		midi.send({ type: 'noteOn', channel: p.channel, note: p.note, velocity: 100 }, midi.toPerf(t.audioTime), t.audioTime);
		midi.send({ type: 'noteOff', channel: p.channel, note: p.note, velocity: 0 }, midi.toPerf(t.audioTime + 0.08), t.audioTime + 0.08);
	});
});

midi.transport.start();
log('3-over-8, 7-over-16 and 5-over-12 — they realign every 48 bars');`
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			A step sequencer stores a list of events. A pattern stores a <em>rule</em>, and produces the
			events on demand. That difference sounds academic until you want something that changes every
			cycle, or that is infinitely long, or that combines with another pattern without either of
			them being flattened first.
		</p>
		<p class="prose-body">
			The key idea, borrowed from TidalCycles and Strudel: a pattern is a
			<strong>function from a cycle number to the events in that cycle</strong>. Ask it for cycle 0
			and get one answer; ask for cycle 1 and get another.
		</p>
	</Section>

	<Section title="Euclidean rhythms">
		<p class="prose-body">
			In 2004 Godfried Toussaint noticed that an algorithm for spacing timing pulses in neutron
			accelerators produces, almost exactly, the traditional rhythms of a large part of the world.
			Distribute <em>p</em> hits as evenly as possible over <em>s</em> steps and you get music.
		</p>

		<div class="flex flex-col gap-4 rounded-lg border p-4">
			<div class="flex flex-wrap items-center gap-5">
				<label class="flex min-w-40 flex-1 items-center gap-3">
					<span class="w-14 text-xs text-muted-foreground">Pulses</span>
					<Slider
						type="single"
						bind:value={pulses}
						min={0}
						max={steps}
						step={1}
						aria-label="Pulses"
					/>
					<span class="tnum w-6 text-right font-mono text-xs">{pulses}</span>
				</label>
				<label class="flex min-w-40 flex-1 items-center gap-3">
					<span class="w-14 text-xs text-muted-foreground">Steps</span>
					<Slider type="single" bind:value={steps} min={1} max={16} step={1} aria-label="Steps" />
					<span class="tnum w-6 text-right font-mono text-xs">{steps}</span>
				</label>
				<label class="flex min-w-40 flex-1 items-center gap-3">
					<span class="w-14 text-xs text-muted-foreground">Rotate</span>
					<Slider type="single" bind:value={rotation} min={0} max={15} step={1} />
					<span class="tnum w-6 text-right font-mono text-xs">{rotation}</span>
				</label>
			</div>
			<div class="flex gap-1">
				{#each euclidString(pulses, steps, rotation).split('') as c, i (i)}
					<div
						class="h-9 flex-1 rounded-xs border"
						style:background={c === 'x' ? 'var(--msg-note)' : 'var(--surface-sunken)'}
						style:border-color={c === 'x' ? 'var(--msg-note)' : ''}
					></div>
				{/each}
			</div>
			<code class="font-mono text-sm text-msg-note">
				E({pulses},{steps}{rotation ? `,${rotation}` : ''}) = {euclidString(
					pulses,
					steps,
					rotation
				)}
			</code>
		</div>

		<div class="grid gap-1.5 sm:grid-cols-2">
			{#each FAMOUS as [name, p, s] (name)}
				<button
					class="flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:border-foreground/40"
					onclick={() => {
						steps = s;
						pulses = p;
						rotation = 0;
					}}
				>
					<code class="w-32 shrink-0 font-mono text-xs text-msg-note">
						{euclidString(p, s)}
					</code>
					<span class="text-xs">{name}</span>
					<span class="ml-auto font-mono text-2xs text-muted-foreground">E({p},{s})</span>
				</button>
			{/each}
		</div>
		<Callout variant="key" title="Why they sound good">
			<p>
				Maximal evenness. A rhythm where the hits are as far apart as they can be, given that they
				have to land on a grid, is a rhythm with no clumping and no long empty stretches — and it is
				almost always asymmetrical, which is what stops it sounding mechanical. That one property
				produces the tresillo, the bossa nova clave and a large fraction of West African bell
				patterns.
			</p>
		</Callout>
	</Section>

	<Section title="Mini-notation">
		<p class="prose-body">
			Writing rhythms as arrays of ones and zeros gets old quickly. A compact notation lets you say
			what you mean:
		</p>
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<tbody>
					{#each [['bd sd hh sd', 'Four events, one per quarter of the cycle.'], ['bd ~ sd ~', '~ is a rest.'], ['bd [sd sd]', 'Brackets subdivide one slot.'], ['bd*4', 'Four of them inside one slot.'], ['<bd sd>', 'Alternates between cycles — this is the part a step grid cannot do.'], ['bd(3,8)', 'Euclidean: three hits over eight steps.'], ['bd(3,8,2)', 'The same, rotated by two.'], ['bd*2,hh*8', 'A comma stacks: both at once.']] as [syntax, what] (syntax)}
						<tr class="border-t first:border-t-0">
							<td class="w-40 px-3 py-2 align-top font-mono text-xs text-msg-note">{syntax}</td>
							<td class="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{what}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Section>

	<TryThis title="Play some patterns">
		<p class="text-sm leading-relaxed">
			Drum lanes accept the GM shorthand — <code class="rounded-sm bg-muted px-1 font-mono">bd</code
			>,
			<code class="rounded-sm bg-muted px-1 font-mono">sd</code>,
			<code class="rounded-sm bg-muted px-1 font-mono">hh</code>,
			<code class="rounded-sm bg-muted px-1 font-mono">oh</code>,
			<code class="rounded-sm bg-muted px-1 font-mono">cp</code>. Melodic lanes accept note names (<code
				class="rounded-sm bg-muted px-1 font-mono">C3</code
			>) or scale degrees (<code class="rounded-sm bg-muted px-1 font-mono">0 3 5 7</code>), and the
			scale selector decides what a degree means.
		</p>
		<PatternLab />
		<p class="text-xs leading-relaxed text-muted-foreground">
			Everything you hear is being sent to whichever outputs are enabled in the dock — so this
			drives your hardware, not just the internal synth.
		</p>
	</TryThis>

	<TryThis title="Write your own generator">
		<CodeSandbox initial={EXAMPLES[2].code} examples={EXAMPLES} rows={16} />
	</TryThis>

	<Callout variant="note" title="Constrain, then randomise">
		<p>
			Pure randomness is not interesting, because everything is equally likely and nothing is
			surprising. Useful generative music picks a small set of constraints — a scale, a rhythmic
			grid, a register, a density — and randomises only inside them. The bassline example above
			randomises which degree, but never which scale; the result stays in key no matter what it
			does.
		</p>
	</Callout>

	<Quiz
		question="What can a pattern do that a fixed sixteen-step grid cannot?"
		options={[
			'Play faster',
			'Produce different events on different cycles — alternation, probability, evolving sequences',
			'Send on multiple channels',
			'Use velocity'
		]}
		answer={1}
		explanation="A grid is a stored list, so every cycle is identical by construction. A pattern is a function of the cycle number, so <bd sd> can give you one thing this bar and another the next — and the same mechanism gives you probability, evolution and infinitely long sequences."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="euclid"
			label="Find the Cuban tresillo — three pulses over eight steps"
			hint="Set pulses to 3 and steps to 8."
		/>
		<Checkpoint
			lesson={meta.id}
			id="play"
			label="Play a pattern"
			test={(e) => e.message.type === 'noteOn' && transport.playing}
		/>
		<Checkpoint
			lesson={meta.id}
			id="alternate"
			label="Write a lane that alternates between cycles"
			hint="Use <a b> — watch the timeline change every bar."
		/>
		<Checkpoint
			lesson={meta.id}
			id="polyrhythm"
			label="Run two Euclidean patterns with different step counts at once"
			hint="hh(7,16) against bd(3,8), for instance."
			count={2}
			key={(e) => (e.message.type === 'noteOn' ? String(e.message.note) : '')}
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 9 && transport.playing}
		/>
	</Checkpoints>
</LessonShell>
