<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import StepSequencer from '$lib/components/midi/StepSequencer.svelte';
	import Patchbay from '$lib/components/midi/Patchbay.svelte';
	import ChannelGrid from '$lib/components/midi/ChannelGrid.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import { lessonById, ALL_LESSONS } from '$lib/curriculum/registry';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { transport } from '$lib/midi/clock.svelte';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { Textarea } from '$lib/components/ui/textarea';
	import { load, save } from '$lib/stores/persist';

	const meta = lessonById('capstone')!;

	let notes = $state<string>(
		load(
			'capstone-notes',
			`RIG FOR THIS SESSION

clock leader   →
ch __  →
ch __  →
ch 10  →  drums

local control OFF on →
what went wrong, and what fixed it:`
		)
	);
	$effect(() => save('capstone-notes', notes));

	const done = $derived(
		ALL_LESSONS.filter((l) => l.id !== 'capstone' && progress.isLessonComplete(l.id)).length
	);
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			No new concepts. This is the whole course, at once, on your own hardware — and it is the point
			at which "I have read about MIDI" becomes "I can run a rig".
		</p>
		<p class="text-[15px] leading-relaxed">
			If you have no external hardware to hand, everything below still works against the internal
			synth on separate channels. That is a genuinely useful rehearsal; it just will not teach you
			what your own cables do.
		</p>
		<div class="flex items-center gap-4 rounded-xl border bg-surface-sunken p-4">
			<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full bg-msg-note"
					style="width: {(done / (ALL_LESSONS.length - 1)) * 100}%"
				></div>
			</div>
			<span class="tnum font-mono text-xs text-muted-foreground">
				{done} of {ALL_LESSONS.length - 1} lessons complete
			</span>
		</div>
	</Section>

	<Section title="The brief">
		<ol class="flex flex-col gap-3 text-[15px] leading-relaxed">
			{#each [['Wire it up', 'At least two destinations on separate channels — two hardware instruments, or one instrument plus the internal synth. Set receive channels deliberately and turn Local Control off on anything being sequenced.'], ['Choose a clock leader on purpose', 'One device generates clock; everything else follows. Write down which, before you start, and check it against reality afterwards.'], ['Recall a patch', 'Send a full Bank Select MSB → LSB → Program Change to at least one instrument, in the right order, and confirm on its screen that the right sound loaded. Note the off-by-one if there is one.'], ['Sequence it', 'A pattern that plays both destinations. Not necessarily good music — but in time, and repeatable.'], ['Automate something', 'A controller moving under the notes. A filter sweep is traditional and audible.'], ['Break it deliberately', 'Pull a cable mid-note, or stop the sequencer while notes are held. Get a stuck note on purpose.'], ['Recover cleanly', 'Panic, reconnect, and bring everything back to silence with nothing hanging and no controllers left in a strange state.'], ['Write it down', 'The channel map, the clock leader, and anything that surprised you. This is the artefact you keep.']] as [title, body], i (title)}
				<li class="flex gap-4">
					<span class="mt-0.5 shrink-0 font-mono text-sm text-msg-note">{i + 1}</span>
					<span>
						<strong>{title}.</strong>
						<span class="text-muted-foreground">{body}</span>
					</span>
				</li>
			{/each}
		</ol>
	</Section>

	<Section title="Route">
		<Patchbay />
	</Section>

	<Section title="Sequence">
		<StepSequencer />
		<ChannelGrid />
	</Section>

	<Section title="Watch">
		<p class="text-[15px] leading-relaxed">
			Keep this open while you work. Every claim you might make about what is happening can be
			checked here in a second.
		</p>
		<div class="h-72 overflow-hidden rounded-xl border">
			<MidiMonitor class="h-full" />
		</div>
	</Section>

	<Section title="Write it down">
		<Textarea bind:value={notes} rows={10} class="font-mono text-xs" spellcheck={false} />
		<p class="text-sm leading-relaxed text-muted-foreground">
			Saved in this browser. The value is not the document — it is that writing it forces you to
			notice what you assumed.
		</p>
	</Section>

	<Callout variant="key" title="What you can do now">
		<p>
			You can read raw MIDI bytes at a glance and say what they mean. You can route several
			instruments deliberately, choose a clock master, recall patches by bank and program, automate
			parameters, and recover from a stuck note without guessing. You can measure your own rig's
			latency and jitter instead of arguing about it. You can read an implementation chart as an API
			specification, and map an instrument that has none.
		</p>
		<p class="mt-2">
			And you can write code that drives all of it — with a scheduler that stays in time, note
			lifecycles that never hang, and a device abstraction that will not need rewriting when the
			hardware changes.
		</p>
		<p class="mt-2">
			The Lab stays. Everything in it was built for these lessons and none of it stops being useful
			now that they are over.
		</p>
	</Callout>

	<Checkpoints lesson={meta.id} title="The capstone">
		<Checkpoint
			lesson={meta.id}
			id="connected"
			label="Hardware connected and a port open"
			hint="Tick by hand if you are doing this entirely on the internal synth."
			test={() => midiAccess.status === 'granted' && midiAccess.listening.length > 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="two-destinations"
			label="Send notes to two different channels in the same session"
			count={2}
			key={(e) => (e.message.type === 'noteOn' ? String(e.message.channel) : '')}
			test={(e) => e.message.type === 'noteOn' && e.direction === 'out'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="clock"
			label="Be the clock leader — send clock for at least a bar"
			hint="Switch on Send MIDI Clock in the dock and start the transport."
			count={96}
			key={(e) => String(e.id)}
			test={(e) => e.message.type === 'clock' && e.direction === 'out'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="patch"
			label="Recall a patch with a complete Bank Select and Program Change"
			test={(() => {
				let stage = 0;
				return (e) => {
					const m = e.message;
					if (m.type === 'controlChange' && m.controller === 0) {
						stage = 1;
						return false;
					}
					if (m.type === 'controlChange' && m.controller === 32) {
						stage = stage === 1 ? 2 : 0;
						return false;
					}
					if (m.type === 'programChange') {
						const ok = stage === 2;
						stage = 0;
						return ok;
					}
					return false;
				};
			})()}
		/>
		<Checkpoint
			lesson={meta.id}
			id="automate"
			label="Automate a controller under the notes"
			hint="At least twenty distinct values of one controller while something is playing."
			count={20}
			key={(e) =>
				e.message.type === 'controlChange' ? `${e.message.controller}:${e.message.value}` : ''}
			test={(e) => e.message.type === 'controlChange' && e.message.controller < 120}
		/>
		<Checkpoint
			lesson={meta.id}
			id="break"
			label="Create a stuck note on purpose"
			test={() => noteState.heldCount > 0 && !transport.playing}
		/>
		<Checkpoint
			lesson={meta.id}
			id="recover"
			label="Recover: silence, with controllers reset"
			test={(e) =>
				e.message.type === 'controlChange' &&
				e.message.controller === 121 &&
				noteState.heldCount === 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="document"
			label="Write down the channel map and clock leader"
			hint="Fill in the notes above. Tick when it describes what you actually built."
		/>
	</Checkpoints>
</LessonShell>
