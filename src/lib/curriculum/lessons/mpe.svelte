<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import MpeLab from '$lib/components/midi/MpeLab.svelte';
	import Drone from '$lib/components/midi/Drone.svelte';
	import Wheel from '$lib/components/midi/Wheel.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';

	const meta = lessonById('mpe')!;
	let bend = $state(8192);

	const DIMENSIONS = [
		['Strike', 'Note On velocity', 'How hard the note began — the same velocity you already know.'],
		[
			'Press',
			'Channel pressure on the member channel',
			'Continuous force after the note started. Per note, because the channel holds only that note.'
		],
		[
			'Glide',
			'Pitch bend on the member channel',
			'Sideways movement. Per note, for the same reason.'
		],
		['Slide', 'CC 74', 'Movement along the key’s length. Conventionally timbre or brightness.'],
		[
			'Lift',
			'Note Off velocity',
			'How fast you released. Rarely used, finally has somewhere to live.'
		]
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			Pitch bend, channel pressure and CC 74 are all channel-wide. That is a fact of MIDI 1.0 and
			cannot be changed. Play a chord on one channel and bend it, and every note bends together —
			you have already felt this in Lesson 8.
		</p>
		<TryThis title="Feel the limitation once more">
			<div class="flex flex-wrap items-end gap-6">
				<Wheel
					bind:value={bend}
					min={0}
					max={16383}
					centre={8192}
					spring
					label="Bend"
					height={110}
					onChange={(v) => engine.pitchBend(v, 0)}
				/>
				<div class="flex flex-col gap-3">
					<Drone notes={[52, 55, 59, 62]} label="Hold a four-note chord" />
					<p class="max-w-md text-xs leading-relaxed text-muted-foreground">
						Try to bend only the top note. You cannot. There is one bend value for the channel, and
						everything on it moves as a block.
					</p>
				</div>
			</div>
		</TryThis>
		<p class="text-[15px] leading-relaxed">
			MPE's solution is almost crude in its simplicity: if the problem is that a channel holds many
			notes, then <strong>put every note on its own channel</strong>. Channel-wide bend becomes
			per-note bend, for free, with no new message types and no changes to any existing device's
			parser.
		</p>
	</Section>

	<Section title="Zones, masters and members">
		<p class="text-[15px] leading-relaxed">
			A <strong>zone</strong> is a master channel plus a run of member channels. The master carries anything
			meant for the whole zone — sustain pedal, program changes, a global bend. Each member channel hosts
			one sounding note at a time and carries that note's expression.
		</p>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-xl border border-msg-expr/40 p-4">
				<p class="text-[11px] font-semibold tracking-wide text-msg-expr uppercase">Lower zone</p>
				<p class="text-sm leading-relaxed">
					Master is <strong>channel 1</strong>; members count upward from channel 2. The common
					case, and what almost every MPE controller uses by default.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-xl border p-4">
				<p class="text-[11px] font-semibold tracking-wide uppercase">Upper zone</p>
				<p class="text-sm leading-relaxed">
					Master is <strong>channel 16</strong>; members count downward. Exists so one instrument
					can host two independent MPE zones — a split, in effect.
				</p>
			</div>
		</div>
		<Callout variant="key" title="Round-robin, not lowest-free">
			<p>
				Voices are allocated round-robin rather than always reusing the lowest free channel. The
				reason is physical: a channel that just released a note still has that note's bend and
				pressure applied to it, and a synth's release tail is still sounding on it. Handing that
				channel straight to a new note applies the old expression to it. Cycling gives each channel
				time to settle.
			</p>
		</Callout>
	</Section>

	<Section title="The five dimensions of touch">
		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50 text-[10px] tracking-wide text-muted-foreground uppercase">
					<tr>
						<th class="w-20 px-3 py-2 text-left font-medium">Dimension</th>
						<th class="px-3 py-2 text-left font-medium">Carried as</th>
						<th class="hidden px-3 py-2 text-left font-medium sm:table-cell">What it is</th>
					</tr>
				</thead>
				<tbody>
					{#each DIMENSIONS as [name, carrier, what] (name)}
						<tr class="border-t">
							<td class="px-3 py-2 font-medium text-msg-expr">{name}</td>
							<td class="px-3 py-2 font-mono text-xs">{carrier}</td>
							<td class="hidden px-3 py-2 text-xs leading-snug text-muted-foreground sm:table-cell">
								{what}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Notice that not one of these is a new message type. Every dimension is something MIDI 1.0
			already had; MPE simply arranged for them to be addressable per note.
		</p>
	</Section>

	<Section title="Declaring a zone">
		<p class="text-[15px] leading-relaxed">
			A controller announces its zone with the <strong>MPE Configuration Message</strong> — RPN 0,6 on
			the master channel, with the number of member channels as the value. Sending zero tears the zone
			down. It is exactly the RPN mechanism from Lesson 11, used for one more thing.
		</p>
		<div class="flex flex-col gap-2 rounded-xl border bg-surface-sunken p-4 font-mono text-xs">
			{#each [['CC 101 = 0', 'select RPN, coarse'], ['CC 100 = 6', 'RPN 0,6 — MPE configuration'], ['CC 6 = 8', 'reserve 8 member channels'], ['CC 101 = 127 / CC 100 = 127', 'deselect']] as [msg, why] (msg)}
				<div class="flex flex-wrap items-baseline gap-3">
					<code class="w-52 shrink-0 text-msg-cc">{msg}</code>
					<span class="font-sans text-[11px] text-muted-foreground">{why}</span>
				</div>
			{/each}
		</div>
	</Section>

	<Callout variant="gotcha" title="Bend range must match, or nothing feels right">
		<p>
			MPE's conventional member bend range is <strong>±48 semitones</strong> — enormous, because a finger
			sliding across a surface needs to cover a lot of ground smoothly. If your controller assumes 48
			and your synth assumes the usual 2, every slide will overshoot by a factor of twenty-four and the
			instrument will feel broken.
		</p>
		<p class="mt-2">
			This single mismatch accounts for most "my expensive MPE controller feels wrong" reports. The
			configuration message should set it; verify it anyway, on both ends.
		</p>
	</Callout>

	<TryThis title="Play a zone">
		<MpeLab />
	</TryThis>

	<Section title="MPE versus polyphonic aftertouch">
		<p class="text-[15px] leading-relaxed">
			Both give per-note expression, and they are not competitors so much as different scopes. Poly
			aftertouch gives you one extra dimension — pressure — per note, on a single channel, and
			nothing else. MPE gives you pressure <em>and</em> pitch <em>and</em> timbre per note, at the cost
			of consuming most of your channel space.
		</p>
		<p class="text-[15px] leading-relaxed">
			That cost is real. An MPE controller using fifteen member channels leaves you nothing else on
			that port. In a rig with several instruments, MPE controllers want their own port — which is
			the port-plus-channel thinking from Lesson 21 arriving with a concrete consequence.
		</p>
	</Section>

	<Quiz
		question="An MPE controller is set to a lower zone with 8 member channels. You play a five-note chord. What is on channel 1?"
		options={[
			'The lowest note of the chord',
			'All five notes',
			'Nothing note-related — it is the master channel, carrying zone-wide messages only',
			'The chord’s average pitch bend'
		]}
		answer={2}
		explanation="The master channel does not host notes. The five notes take five member channels — 2 to 6 — each with its own bend, pressure and CC 74. Channel 1 carries things meant for the whole zone, such as the sustain pedal."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="configure"
			label="Declare an MPE zone with the configuration message"
			test={(() => {
				let stage = 0;
				return (e) => {
					const m = e.message;
					if (m.type !== 'controlChange') return false;
					if (m.controller === 101) {
						stage = m.value === 0 ? 1 : 0;
						return false;
					}
					if (m.controller === 100) {
						stage = stage === 1 && m.value === 6 ? 2 : 0;
						return false;
					}
					if (m.controller === 6 && stage === 2) {
						stage = 0;
						return m.value > 0;
					}
					return false;
				};
			})()}
		/>
		<Checkpoint
			lesson={meta.id}
			id="member"
			label="Play a note on a member channel"
			test={(e) => e.message.type === 'noteOn' && e.message.channel > 0 && e.message.channel < 15}
		/>
		<Checkpoint
			lesson={meta.id}
			id="per-note-bend"
			label="Bend one note while another is held"
			hint="Two fingers on a touchscreen, or hold the drone above and play the surface."
			test={(e) =>
				e.message.type === 'pitchBend' && e.message.value !== 8192 && noteState.heldCount >= 2}
		/>
		<Checkpoint
			lesson={meta.id}
			id="slide"
			label="Send per-note CC 74 on three different member channels"
			count={3}
			key={(e) => (e.message.type === 'controlChange' ? String(e.message.channel) : '')}
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 74 && e.message.channel > 0}
		/>
	</Checkpoints>
</LessonShell>
