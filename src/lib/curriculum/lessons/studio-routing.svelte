<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Patchbay from '$lib/components/midi/Patchbay.svelte';
	import ChannelGrid from '$lib/components/midi/ChannelGrid.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { router } from '$lib/midi/router.svelte';
	import { Textarea } from '$lib/components/ui/textarea';
	import { load, save } from '$lib/stores/persist';

	const meta = lessonById('studio-routing')!;

	let plan = $state<string>(
		load(
			'routing-plan',
			`PORT / CHANNEL MAP

ch 1   →
ch 2   →
ch 3   →
ch 10  →  drums
ch 11+ →  spare / MPE member channels

CLOCK LEADER  →
LOCAL CONTROL OFF ON  →
NOTES:`
		)
	);
	$effect(() => save('routing-plan', plan));
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			You now know what every message does and what every socket is for. The remaining skill is
			organisational: deciding, once, who talks to whom on which address, and writing it down so
			that future-you can check reality against intention.
		</p>
		<p class="text-[15px] leading-relaxed">
			The real address in a studio is not the channel. It is <strong>port plus channel</strong>. A
			channel number only has to be unique per cable, so a four-port interface gives you 64
			addresses, not 16. Thinking in port-plus-channel is what stops you running out.
		</p>
	</Section>

	<Section title="Roles, not devices">
		<p class="text-[15px] leading-relaxed">
			Sort your gear by what it is <em>doing this session</em>, not by what it is. The same
			groovebox is a brain in one setup and a sound module in another.
		</p>
		<div class="grid gap-3 sm:grid-cols-3">
			{#each [['Brains', 'Sequencers and hubs. They generate notes, send clock, and decide the arrangement. Usually one, occasionally two with one clearly subordinate.'], ['Controllers', 'Keyboards, pads, expressive surfaces. They generate performance data and consume nothing. Their MIDI Out goes to a brain, not to a synth.'], ['Voices', 'Anything that makes sound when told to. Set a receive channel, turn Local Control off if a brain is driving it, and forget about it.']] as [role, body] (role)}
				<div class="rounded-xl border p-4">
					<p class="text-[11px] font-semibold tracking-wide uppercase">{role}</p>
					<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
				</div>
			{/each}
		</div>
		<Callout variant="key" title="One brain, one clock, one direction">
			<p>
				Almost every stable rig follows the same shape: controllers feed one brain, the brain feeds
				the voices, and the brain is the clock leader. Complexity is fine — <em>ambiguity</em> is not.
				Every time you cannot immediately answer "where does this message go next?", that is where the
				problems will come from.
			</p>
		</Callout>
	</Section>

	<TryThis title="Route your actual hardware">
		<p class="text-sm leading-relaxed">
			This is a working patchbay, not an illustration. Anything arriving on an input can be sent to
			any output, remapped to a different channel, transposed, velocity-scaled, split by note range
			and filtered by message type. The curves light up when messages pass.
		</p>
		<Patchbay />
	</TryThis>

	<Section title="Things worth setting up here">
		<div class="grid gap-3 sm:grid-cols-2">
			{#each [['Keyboard split', 'Two routes from one keyboard: notes 0–59 to one output, 60–127 to another. Bass in the left hand, lead in the right, from a single controller.'], ['Layer', 'Two routes from one input to two outputs on different channels. Both play; you have doubled the sound without touching either instrument.'], ['Channel translation', 'Your controller transmits on channel 1 and your synth listens on 3. Rather than reconfiguring either, remap in the middle.'], ['Clock isolation', 'Turn the Clock filter off on routes to devices that should not follow — an easy way to stop an arpeggiator syncing when you did not want it to.']] as [title, body] (title)}
				<div class="rounded-xl border p-4">
					<p class="text-[11px] font-semibold tracking-wide uppercase">{title}</p>
					<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
				</div>
			{/each}
		</div>
	</Section>

	<Section title="Write the plan down">
		<p class="text-[15px] leading-relaxed">
			The document below is the single highest-value thing in this lesson. Fill it in for your own
			rig. When something misbehaves in six months, the first question is always "is it wired the
			way I think it is?" — and without a written plan there is no way to answer that except by
			re-deriving everything.
		</p>
		<TryThis title="Your rig">
			<Textarea bind:value={plan} rows={12} class="font-mono text-xs" spellcheck={false} />
			<p class="text-xs leading-relaxed text-muted-foreground">
				Saved in this browser. Keep a copy somewhere durable too — the back of the studio door works
				better than you would think.
			</p>
		</TryThis>
		<ChannelGrid />
		<p class="text-sm text-muted-foreground">
			The grid shows which channels are actually seeing traffic right now, so you can confirm your
			plan against reality by playing something.
		</p>
	</Section>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="route"
			label="Create a working route"
			hint="Add one in the patchbay and play something into it."
			test={() => router.routes.some((r) => r.enabled && r.fromPortId !== '')}
		/>
		<Checkpoint
			lesson={meta.id}
			id="remap"
			label="Remap an input onto a different channel"
			test={() => router.routes.some((r) => r.remapTo !== null)}
		/>
		<Checkpoint
			lesson={meta.id}
			id="split"
			label="Build a keyboard split — two routes from one input with different note ranges"
			test={() =>
				router.routes.filter((r) => r.noteRange[0] > 0 || r.noteRange[1] < 127).length >= 2}
		/>
		<Checkpoint
			lesson={meta.id}
			id="plan"
			label="Write down your channel map and clock leader"
			hint="Fill in the plan above, then tick this."
		/>
	</Checkpoints>
</LessonShell>
