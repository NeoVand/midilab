<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Fader from '$lib/components/midi/Fader.svelte';
	import Drone from '$lib/components/midi/Drone.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import ByteInspector from '$lib/components/midi/ByteInspector.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';

	const meta = lessonById('aftertouch')!;

	let channelPressure = $state(0);
	const CHORD = [52, 55, 59, 64];
	let polyPressures = $state<Record<number, number>>(Object.fromEntries(CHORD.map((n) => [n, 0])));

	function setPoly(note: number, value: number) {
		polyPressures[note] = value;
		engine.send({ type: 'polyAftertouch', channel: 0, note, pressure: value });
	}
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			Velocity captures the moment a note begins and never speaks again. <strong>Aftertouch</strong>
			is what a keyboard sends when you lean into a key that is already down — a continuous stream of
			pressure readings for as long as you keep pushing.
		</p>
		<p class="text-[15px] leading-relaxed">
			It comes in two flavours, and the difference between them is a good deal larger than the names
			suggest.
		</p>
	</Section>

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="flex flex-col gap-3 rounded-xl border p-4">
			<p class="text-[11px] font-semibold tracking-wide text-msg-expr uppercase">
				Channel aftertouch · 0xDn
			</p>
			<p class="text-sm leading-relaxed">
				One pressure value for the whole channel. Two bytes: status and pressure. Nearly every
				keyboard with aftertouch sends this, because it needs only one sensor strip under the whole
				keybed.
			</p>
			<ByteInspector bytes={[0xd0, channelPressure]} compact />
		</div>
		<div class="flex flex-col gap-3 rounded-xl border p-4">
			<p class="text-[11px] font-semibold tracking-wide text-msg-expr uppercase">
				Polyphonic aftertouch · 0xAn
			</p>
			<p class="text-sm leading-relaxed">
				A pressure value <em>per note</em>. Three bytes: status, which note, how hard. Rare and
				expensive, because it needs a sensor under every single key.
			</p>
			<ByteInspector bytes={[0xa0, 60, polyPressures[64] ?? 0]} compact />
		</div>
	</div>

	<TryThis title="Channel pressure">
		<p class="text-sm leading-relaxed">
			Hold the chord, then push the fader. Everything moves together — that is the whole story of
			channel aftertouch.
		</p>
		<div class="flex flex-wrap items-end gap-6">
			<Fader
				bind:value={channelPressure}
				label="Pressure"
				height={130}
				colour="var(--msg-expr)"
				onChange={(v) => engine.send({ type: 'channelAftertouch', channel: 0, pressure: v })}
			/>
			<div class="flex flex-col gap-3">
				<Drone notes={CHORD} label="Hold the chord" />
				<p class="max-w-md text-xs leading-relaxed text-muted-foreground">
					This synth routes pressure to filter cutoff, which is the most common mapping. On your own
					instrument it might go to vibrato depth, volume, or nothing at all — the receiver decides,
					as ever.
				</p>
			</div>
		</div>
	</TryThis>

	<TryThis title="Polyphonic pressure">
		<p class="text-sm leading-relaxed">
			Now a fader per note. Push one and only that note changes. If you have never played an
			instrument that can do this, the effect is startling: you can swell one voice inside a held
			chord.
		</p>
		<div class="flex flex-wrap items-end gap-6">
			<Drone notes={CHORD} label="Hold the chord" />
			<div class="flex gap-5">
				{#each CHORD as note (note)}
					<Fader
						value={polyPressures[note]}
						label={noteName(note, { convention: settings.octaveConvention })}
						sub={String(polyPressures[note])}
						height={110}
						colour="var(--msg-expr)"
						onChange={(v) => setPoly(note, v)}
					/>
				{/each}
			</div>
		</div>
	</TryThis>

	<Section title="Why poly aftertouch never caught on">
		<p class="text-[15px] leading-relaxed">Two reasons, one physical and one about bandwidth.</p>
		<ul class="flex flex-col gap-2.5 text-[15px] leading-relaxed">
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-msg-expr/60"></span>
				<span>
					<strong>Sensors cost money.</strong> One strip under the keybed is cheap. Sixty-one independent
					pressure sensors is a different instrument at a different price.
				</span>
			</li>
			<li class="flex gap-3">
				<span class="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-msg-expr/60"></span>
				<span>
					<strong>It floods the wire.</strong> Five held notes, each sending pressure updates at any reasonable
					rate, is a torrent of three-byte messages on a 31,250-baud cable. Enough of it and notes start
					arriving late.
				</span>
			</li>
		</ul>
		<Callout variant="key" title="But the idea did not die">
			<p>
				Per-note expression turned out to matter enormously — it is what makes a controller feel
				like an instrument rather than a switch panel. MPE achieves it a different way, by giving
				each note its own channel so that ordinary <em>channel</em> pressure and bend become
				<em>per-note</em> pressure and bend. Same goal, reached by exploiting what MIDI already had. MIDI
				2.0 goes further and makes per-note controllers a first-class part of the protocol.
			</p>
		</Callout>
	</Section>

	<Section title="Living with aftertouch">
		<p class="text-[15px] leading-relaxed">
			Two practical notes. First, aftertouch is easy to send by accident — resting your hand on a
			sensitive keybed can produce a continuous stream you never intended, which shows up as
			mysterious wobble and eats bandwidth. Many sequencers offer an "ignore aftertouch" filter for
			exactly this reason, and the patchbay in the Lab has one.
		</p>
		<p class="text-[15px] leading-relaxed">
			Second, when you release, send zero. A synth left at pressure 90 with no notes playing will
			sound wrong the next time you play, and it is not obvious why. Reset All Controllers (CC 121)
			clears it.
		</p>
		<div class="flex flex-wrap gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={() => {
					channelPressure = 0;
					engine.send({ type: 'channelAftertouch', channel: 0, pressure: 0 });
				}}
			>
				Send pressure 0
			</Button>
			<Button variant="outline" size="sm" onclick={() => engine.cc(121, 0, 0)}>
				Reset All Controllers (CC 121)
			</Button>
		</div>
		<Keyboard low={40} octaves={3} height={110} typing={false} />
	</Section>

	<Quiz
		question="Which message would let you add vibrato to just the top note of a held chord, on one MIDI channel?"
		options={[
			'Channel aftertouch (0xDn)',
			'Polyphonic aftertouch (0xAn)',
			'Modulation wheel (CC 1)',
			'Pitch bend (0xEn)'
		]}
		answer={1}
		explanation="Only polyphonic aftertouch carries a note number, so only it can address one note within a chord. Channel aftertouch, the mod wheel and pitch bend are all channel-wide by definition — which is exactly the limitation MPE was invented to route around."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="channel-at"
			label="Send channel aftertouch"
			test={(e) => e.message.type === 'channelAftertouch' && e.message.pressure > 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="poly-at"
			label="Send polyphonic aftertouch on a single note"
			test={(e) => e.message.type === 'polyAftertouch' && e.message.pressure > 0}
		/>
		<Checkpoint
			lesson={meta.id}
			id="poly-two"
			label="Apply different pressures to two different notes at once"
			count={2}
			key={(e) => (e.message.type === 'polyAftertouch' ? String(e.message.note) : '')}
			test={(e) =>
				e.message.type === 'polyAftertouch' && e.message.pressure > 20 && noteState.heldCount >= 2}
		/>
		<Checkpoint
			lesson={meta.id}
			id="reset"
			label="Clean up after yourself — send pressure 0 or Reset All Controllers"
			test={(e) =>
				(e.message.type === 'channelAftertouch' && e.message.pressure === 0) ||
				(e.message.type === 'controlChange' && e.message.controller === 121)}
		/>
	</Checkpoints>
</LessonShell>
