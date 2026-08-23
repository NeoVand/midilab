<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Wheel from '$lib/components/midi/Wheel.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import Drone from '$lib/components/midi/Drone.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { setBendRange } from '$lib/midi/rpn';
	import { split14, bendToUnit } from '$lib/midi/messages';
	import { synth } from '$lib/audio/synth';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { Button } from '$lib/components/ui/button';

	const meta = lessonById('pitch-bend')!;

	let bend = $state(8192);
	let mod = $state(0);
	let range = $state(2);

	const parts = $derived(split14(bend));
	const semis = $derived(bendToUnit(bend) * range);

	function applyRange(r: number) {
		range = r;
		engine.sendAll(setBendRange(0, r));
	}
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Pitch bend gets its own status byte and its own rules, and it is the only channel voice
			message that is <strong>14-bit</strong>. It has 16,384 positions rather than 128, because
			seven bits of pitch resolution across a whole-tone bend would be audibly steppy in a way a pan
			knob never is.
		</p>
		<ByteInspector bytes={[0xe0, parts.lsb, parts.msb]} />
		<p class="prose-body">
			Two oddities to internalise. First, the <strong>LSB comes first</strong> — the fine byte is
			sent before the coarse one, which is backwards from how you would write the number down and
			catches everyone once. Second, the centre is not zero but
			<strong>8192</strong>, the midpoint of the range, so that bending down has as much room as
			bending up.
		</p>
	</Section>

	<TryThis title="Bend something">
		<div class="flex flex-wrap items-start gap-6">
			<Wheel
				bind:value={bend}
				min={0}
				max={16383}
				centre={8192}
				spring
				label="Pitch"
				height={150}
				format={(v) => (v === 8192 ? 'centre' : `${v > 8192 ? '+' : ''}${v - 8192}`)}
				onChange={(v) => engine.pitchBend(v, 0)}
			/>
			<Wheel
				bind:value={mod}
				min={0}
				max={127}
				label="Mod"
				height={150}
				colour="var(--msg-cc)"
				onChange={(v) => engine.cc(1, v, 0)}
			/>
			<div class="flex min-w-56 flex-1 flex-col gap-3">
				<Drone notes={[52, 55, 59]} label="Hold a chord" />
				<div class="rounded-lg border bg-surface-sunken p-3">
					<p class="label">Raw value</p>
					<p class="tnum font-mono text-2xl leading-none text-msg-expr">{bend}</p>
					<p class="mt-1 font-mono text-xs text-muted-foreground">
						MSB {parts.msb} · LSB {parts.lsb} · centre 8192
					</p>
					<p class="mt-2 text-sm">
						{semis === 0 ? 'At pitch' : `${semis > 0 ? '+' : ''}${semis.toFixed(2)} semitones`}
						<span class="text-xs text-muted-foreground">at a range of ±{range}</span>
					</p>
				</div>
				<p class="text-xs leading-relaxed text-muted-foreground">
					The wheel springs back to centre when you let go, exactly like the real thing. The mod
					wheel beside it does not — that difference is the entire distinction between them.
				</p>
			</div>
		</div>
		<Keyboard low={40} octaves={3} height={110} typing={false} />
	</TryThis>

	<Section title="How far is a full bend?">
		<p class="prose-body">
			The message says "bend as far as you can" — it does not say how far that is. The
			<strong>bend range</strong> is a setting on the receiving instrument, and the default is usually
			±2 semitones. It can be changed over MIDI, using the first mechanism in this course that is not
			a single message but a small conversation:
		</p>
		<div class="flex flex-col gap-2 rounded-lg border bg-surface-sunken p-4 font-mono text-xs">
			{#each [['CC 101 = 0', 'select registered parameter, coarse half'], ['CC 100 = 0', 'select registered parameter, fine half → RPN 0,0 is bend sensitivity'], ['CC 6 = 12', 'data entry: 12 semitones'], ['CC 38 = 0', 'data entry fine: 0 cents'], ['CC 101 = 127', 'deselect'], ['CC 100 = 127', 'deselect']] as [msg, why] (msg)}
				<div class="flex flex-wrap items-baseline gap-3">
					<code class="w-24 shrink-0 text-msg-cc">{msg}</code>
					<span class="font-sans text-xs text-muted-foreground">{why}</span>
				</div>
			{/each}
		</div>
		<p class="prose-body">
			Six Control Changes to set one number. That is RPN, and Lesson 11 covers it properly — for now
			just note that <em>bend range is a negotiated setting, not a property of the message</em>.
		</p>

		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm text-muted-foreground">Set the range on the internal synth:</span>
			{#each [2, 5, 12, 24, 48] as r (r)}
				<Button
					variant={range === r ? 'default' : 'outline'}
					size="sm"
					class="h-7 text-xs"
					onclick={() => applyRange(r)}
				>
					±{r}
				</Button>
			{/each}
			<span class="text-xs text-muted-foreground">
				Now bend again — same message, very different result.
			</span>
		</div>

		<Callout variant="gotcha" title="Both ends must agree">
			<p>
				If your controller thinks a full bend is two semitones and the synth thinks it is twelve,
				every bend you play will overshoot by a factor of six. Nothing is broken and neither device
				is wrong. This is a recurring theme, and it becomes critical for MPE, where mismatched bend
				ranges make an expensive controller feel unplayable.
			</p>
		</Callout>
	</Section>

	<Section title="Bend is channel-wide">
		<p class="prose-body">
			There is one pitch bend value per channel. Hold a three-note chord and bend, and all three
			notes move together — you cannot bend one note of a chord while the others stay put. For a
			keyboard that is fine; for anyone trying to emulate a guitar or a fretless instrument it is a
			hard wall.
		</p>
		<p class="prose-body">
			The wall is real enough that an entire extension exists to get around it, by the elegantly
			brutal method of giving every note its own channel. That is MPE, in Act V. Play the chord
			above and bend it — feeling why per-note bend matters is the best preparation for that lesson.
		</p>
	</Section>

	<Quiz
		question="A monitor shows E0 00 40. What is it?"
		options={[
			'Bend fully down on channel 1',
			'Bend at centre on channel 1',
			'Bend fully up on channel 1',
			'Not a valid pitch bend message'
		]}
		answer={1}
		explanation="LSB first: 0x00 = 0. Then MSB: 0x40 = 64. Combined, (64 << 7) | 0 = 8192 — dead centre. This is the message a controller sends when the wheel returns to rest, and you will see a great many of them."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="up"
			label="Bend up"
			test={(e) => e.message.type === 'pitchBend' && e.message.value > 10000}
		/>
		<Checkpoint
			lesson={meta.id}
			id="down"
			label="Bend down"
			test={(e) => e.message.type === 'pitchBend' && e.message.value < 6000}
		/>
		<Checkpoint
			lesson={meta.id}
			id="centre"
			label="Return the wheel exactly to centre — 8192"
			hint="Let go of it; the spring does this for you."
			test={(e) => e.message.type === 'pitchBend' && e.message.value === 8192}
		/>
		<Checkpoint
			lesson={meta.id}
			id="range"
			label="Change the bend range with an RPN"
			hint="Use the ± buttons above."
			test={(e) =>
				e.message.type === 'controlChange' &&
				e.message.controller === 6 &&
				synth.channels[0].bendRange > 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="chord-bend"
			label="Bend a chord and hear all of it move together"
			test={(e) =>
				e.message.type === 'pitchBend' && e.message.value !== 8192 && noteState.heldCount >= 3}
		/>
	</Checkpoints>
</LessonShell>
