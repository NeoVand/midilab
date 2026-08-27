<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import CableFigure from '$lib/components/midi/CableFigure.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { Button } from '$lib/components/ui/button';

	const meta = lessonById('in-out-thru')!;

	const PORTS = [
		{
			name: 'MIDI In',
			what: 'Messages arriving from somewhere else.',
			detail:
				'Behind it sits the opto-isolator. Whatever arrives here is what this device will act on — if its receive channel matches, and if it is not in Local Control confusion.'
		},
		{
			name: 'MIDI Out',
			what: 'Messages this device generates itself.',
			detail:
				'Its own keys, knobs, sequencer and clock. Crucially, it does NOT include anything that arrived at MIDI In — that is what Thru is for.'
		},
		{
			name: 'MIDI Thru',
			what: 'An exact copy of MIDI In.',
			detail:
				'Electrically regenerated, byte for byte, with nothing added and nothing removed. This device’s own playing does not appear here.'
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Three sockets, and the third one is not what most people assume. Getting this distinction
			right resolves an enormous number of routing puzzles.
		</p>
		<div class="grid gap-3 lg:grid-cols-3">
			{#each PORTS as p (p.name)}
				<div class="flex flex-col gap-2 rounded-lg border p-4">
					<p class="text-sm font-semibold">{p.name}</p>
					<p class="text-sm leading-relaxed">{p.what}</p>
					<p class="text-xs leading-relaxed text-muted-foreground">{p.detail}</p>
				</div>
			{/each}
		</div>
		<Callout variant="key" title="Out is yours; Thru is theirs">
			<p>
				MIDI Out carries what <em>this</em> device played. MIDI Thru carries what
				<em>somebody else</em> played, passed along untouched. They are never the same, and a device that
				merges the two is doing something extra that it will call "Out/Thru" or "Soft Thru" in its menu.
			</p>
		</Callout>
	</Section>

	<Section title="Two ways to reach several instruments">
		<CableFigure kind="topology" />
		<p class="prose-body">
			The chain works, and for two or three devices it is completely fine. What accumulates is not
			an error but a smearing: each opto-isolator adds a small delay and rounds the edges of the
			signal slightly, and eventually a device at the end of a long chain starts missing bytes. A
			missed byte in the middle of a Note Off is a <Xref to="note-on-off" label="stuck note" />,
			which is why the symptom of an over-long chain is intermittent hanging notes rather than clean
			failure.
		</p>
	</Section>

	<Section title="Loops, and how to recognise one">
		<p class="prose-body">
			If a device's output can reach its own input — directly, or the long way round through a
			computer or a Thru chain — messages will circulate. The symptoms are distinctive:
		</p>
		<ul class="prose-body flex flex-col gap-2.5">
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-destructive/70"></span>
				<span>Every note plays twice, slightly apart — a flanged, doubled sound.</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-destructive/70"></span>
				<span>Notes hang, because a Note Off gets swallowed by the traffic.</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-destructive/70"></span>
				<span>
					One key press produces an escalating storm — the monitor shows hundreds of messages from a
					single note.
				</span>
			</li>
		</ul>
		<p class="prose-body">
			The monitor in the dock is the diagnostic. Play one note and count the rows. One note should
			be one Note On. If it is forty, you have a loop.
		</p>
		<Callout variant="gotcha" title="The three usual causes">
			<p>
				<strong>MIDI Thru left enabled</strong> on a device in a chain that also has a return path.
				<strong>Soft Thru / MIDI echo</strong> switched on in a DAW while the hardware also has
				<Xref to="panic" label="Local Control" /> on. And
				<strong>a Thru box wired into a ring</strong> rather than a star. All three are configuration,
				not hardware — nothing needs replacing.
			</p>
		</Callout>
	</Section>

	<Section title="Local Control, one more time">
		<p class="prose-body">
			The special case of a loop that involves only one device is the Local Control problem from
			Lesson 12. A keyboard plays its own engine <em>and</em> sends to the computer, which echoes back
			to the same engine. Turning Local Control off breaks the internal path and leaves the computer in
			charge.
		</p>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={() => engine.cc(122, 0, 0)}>
				Local Control OFF
			</Button>
			<Button variant="outline" size="sm" onclick={() => engine.cc(122, 127, 0)}>
				Local Control ON
			</Button>
		</div>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Send this to hardware and watch its screen. Many devices show a message; some silently obey.
			The setting normally survives a power cycle, which is why a "dead" synth is so often just a
			synth someone left in controller mode.
		</p>
	</Section>

	<Section title="A routing rule of thumb">
		<p class="prose-body">
			Draw the arrows before you plug anything in. For each connection, ask: what generates the
			messages, what consumes them, and is there any path by which a message can come back to where
			it started? If the answer to the last question is yes, break it deliberately — with Local
			Control off, with Thru disabled, or by not making the connection at all.
		</p>
		<p class="prose-body">
			<Xref to="studio-routing" label="The next lesson" /> makes you draw exactly that diagram for your
			own rig, in a patchbay that then actually does the routing.
		</p>
	</Section>

	<Quiz
		question="Your keyboard is connected to a computer, and every note you play sounds twice with a slight flange. What is the fix?"
		options={[
			'Replace the MIDI cable',
			'Turn Local Control off on the keyboard, or turn MIDI echo off in the software',
			'Change the MIDI channel',
			'Reduce the buffer size'
		]}
		answer={1}
		explanation="Two paths are reaching the keyboard's sound engine: the internal one and the echo from the computer. Break either. Local Control off is usually the right choice, because it leaves the software in charge of what is actually heard."
	/>

	<Further
		refs={['spec-midi1', 'somascape-spec', 'wikipedia-midi']}
		lead="What Thru is required to do, and the hardware description that explains why a chain of them degrades."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="thru"
			label="Explain the difference between Out and Thru without looking"
			hint="Out is what this device played; Thru is a copy of what arrived at In."
		/>
		<Checkpoint
			lesson={meta.id}
			id="count"
			label="Play one note and confirm the monitor shows exactly one Note On"
			hint="Open the Monitor tab in the dock. If it shows more than one, you have a loop."
			test={(e) => e.message.type === 'noteOn'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="local"
			label="Send Local Control off to a real instrument, and watch what it does"
			hint="Enable a hardware output first. Tick by hand if you have none connected."
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 122}
		/>
	</Checkpoints>
</LessonShell>
