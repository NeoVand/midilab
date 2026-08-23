<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import ProgramBrowser from '$lib/components/midi/ProgramBrowser.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import Knob from '$lib/components/midi/Knob.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { gmProgramName } from '$lib/midi/constants';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SentIcon } from '@hugeicons/core-free-icons';

	const meta = lessonById('programs-and-banks')!;

	let bankMsb = $state(0);
	let bankLsb = $state(0);
	let program = $state(0);

	function sendFull() {
		engine.wake();
		engine.selectProgram(bankMsb, bankLsb, program, 0);
	}
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			<strong>Program Change</strong> is the smallest useful message in MIDI: a status byte and one data
			byte. "Switch to sound number 12." That is the entire message.
		</p>
		<ByteInspector bytes={[0xc0, program]} />
		<p class="prose-body">
			One data byte means 128 sounds. In 1983 that was luxurious. Today a single instrument might
			ship with two thousand presets, which creates the problem the rest of this lesson is about.
		</p>
	</Section>

	<TryThis title="128 sounds, one byte">
		<p class="text-sm leading-relaxed">
			These are the General MIDI programs — a standard list agreed in 1991 so that a file made on
			one machine would at least be recognisable on another. Click one to send a Program Change and
			hear a chord.
		</p>
		<ProgramBrowser class="max-h-[26rem] scrollbar-thin overflow-y-auto pr-1" />
	</TryThis>

	<Callout variant="gotcha" title="The off-by-one that will get you">
		<p>
			The message carries 0–127. Front panels, manuals and preset lists almost always show 1–128. So
			"program 5" in a manual is very often the byte value <strong>4</strong>.
		</p>
		<p class="mt-2">
			There is no way to tell which convention a device uses except by trying it. The practical
			habit: send a program, look at what the instrument's screen says, and write down the offset
			for that device. Once per device, forever.
		</p>
	</Callout>

	<Section title="Bank Select: 128 becomes 2,097,152">
		<p class="prose-body">
			MIDI never widened the Program Change message. Instead it added a <em>prefix</em>: two
			ordinary Control Changes that say which bank of 128 you mean. CC 0 is the coarse half, CC 32
			the fine half. Together they select one of 16,384 banks, each holding 128 programs.
		</p>
		<Callout variant="key" title="Order matters, and so does the pairing">
			<p>
				Bank Select does nothing on its own. It sits in the receiver as a pending value, and the
				<strong>next Program Change</strong> is what actually loads a sound. Always send bank first,
				program second. Send them the other way round and you will load a sound from whatever bank
				was previously selected — which is a maddening bug because it works correctly on the
				<em>second</em> attempt.
			</p>
		</Callout>

		<div class="flex flex-col gap-4 rounded-lg border p-4">
			<div class="flex flex-wrap items-end gap-6">
				<Knob
					bind:value={bankMsb}
					min={0}
					max={127}
					default={0}
					label="Bank MSB"
					sub="CC 0 · {bankMsb}"
					colour="var(--msg-program)"
				/>
				<Knob
					bind:value={bankLsb}
					min={0}
					max={127}
					default={0}
					label="Bank LSB"
					sub="CC 32 · {bankLsb}"
					colour="var(--msg-program)"
				/>
				<Knob
					bind:value={program}
					min={0}
					max={127}
					default={0}
					label="Program"
					sub="{program} · {gmProgramName(program)}"
					width={190}
					colour="var(--msg-program)"
				/>
				<div class="flex-1"></div>
				<Button onclick={sendFull} class="gap-1.5">
					<HugeiconsIcon icon={SentIcon} size={14} />
					Send all three
				</Button>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border bg-surface-sunken p-3 font-mono text-xs">
				<div class="flex gap-3">
					<code class="w-24 text-msg-cc"
						>B0 00 {bankMsb.toString(16).toUpperCase().padStart(2, '0')}</code
					>
					<span class="font-sans text-muted-foreground">Bank Select MSB = {bankMsb}</span>
				</div>
				<div class="flex gap-3">
					<code class="w-24 text-msg-cc"
						>B0 20 {bankLsb.toString(16).toUpperCase().padStart(2, '0')}</code
					>
					<span class="font-sans text-muted-foreground">Bank Select LSB = {bankLsb}</span>
				</div>
				<div class="flex gap-3">
					<code class="w-24 text-msg-program"
						>C0 {program.toString(16).toUpperCase().padStart(2, '0')}</code
					>
					<span class="font-sans text-muted-foreground">
						Program Change → loads program {program} from bank {bankMsb}:{bankLsb}
					</span>
				</div>
			</div>
			<p class="text-xs leading-relaxed text-muted-foreground">
				The internal synth ignores the bank bytes — it only has one bank. Your hardware almost
				certainly does not, and watching its screen while you send these is the fastest way to learn
				its bank map.
			</p>
		</div>
	</Section>

	<Section title="How manufacturers actually use the two halves">
		<p class="prose-body">
			The specification does not say what MSB and LSB mean, only that there are two of them. So
			everyone chose differently:
		</p>
		<div class="grid gap-3 sm:grid-cols-3">
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Roland-style</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					MSB selects a broad category or map, LSB selects a variation within it. GS uses MSB 0 with
					varying LSB.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Yamaha XG</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					MSB carries the meaning — 0 for melodic, 64 for SFX, 126/127 for drum kits — and LSB picks
					the variation.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Everyone else</p>
				<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
					Whatever the manual says. Some devices ignore LSB entirely; some ignore MSB; some want
					both and will not switch without them.
				</p>
			</div>
		</div>
		<Callout variant="convention" title="Where to find the answer">
			<p>
				In your instrument's documentation, look for a section called <em>Bank Map</em>,
				<em>Voice List</em>, <em>Program List</em> or <em>Data List</em> — often a separate PDF from
				the main manual. It will be a table of MSB, LSB and program numbers against preset names.
				That table <em>is</em> the API of the instrument. Lesson 22 covers reading implementation charts
				properly.
			</p>
		</Callout>
	</Section>

	<Section title="General MIDI, and what it is not">
		<p class="prose-body">
			General MIDI is an agreement layered on top of MIDI, not part of it. It fixes the 128-program
			list you clicked through above, reserves channel 10 for drums with a fixed note map, and
			requires at least 24-voice polyphony. Its purpose was interchange: a file that sounds
			<em>approximately</em> right anywhere.
		</p>
		<p class="prose-body">
			Your Korg or Yamaha in its own native mode is very probably not in GM mode, and program 40
			will not be a violin. That is not a fault. GM is a costume MIDI devices can put on, not their
			natural state.
		</p>
	</Section>

	<Quiz
		question="You send Program Change 40 to your synth and get a completely different sound from the violin you expected. What is the first thing to check?"
		options={[
			'Whether the synth is in General MIDI mode at all',
			'Whether the MIDI cable is faulty',
			'Whether you sent it on channel 1',
			'Whether the synth supports Program Change'
		]}
		answer={0}
		explanation="Program 40 is a violin only under General MIDI. A synth playing its own preset banks will have something entirely different at slot 40 — and that is correct behaviour. Check GM mode first, then the bank, then the off-by-one."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="pc"
			label="Send a Program Change"
			test={(e) => e.message.type === 'programChange'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="high-program"
			label="Select a program above 63 — proving one data byte reaches all 128"
			test={(e) => e.message.type === 'programChange' && e.message.program > 63}
		/>
		<Checkpoint
			lesson={meta.id}
			id="bank-sequence"
			label="Send a complete Bank MSB → Bank LSB → Program Change sequence in the right order"
			hint="The Send all three button does exactly this."
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
			id="explore"
			label="Audition six different programs"
			count={6}
			key={(e) => (e.message.type === 'programChange' ? String(e.message.program) : '')}
			test={(e) => e.message.type === 'programChange'}
		/>
	</Checkpoints>
</LessonShell>
