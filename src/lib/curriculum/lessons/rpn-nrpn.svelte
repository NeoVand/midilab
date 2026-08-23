<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import RpnLab from '$lib/components/midi/RpnLab.svelte';
	import Drone from '$lib/components/midi/Drone.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { RPN_TABLE } from '$lib/midi/constants';

	const meta = lessonById('rpn-nrpn')!;
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-[15px] leading-relaxed">
			Control Change gives you 128 knobs with 128 positions each. A modern synthesiser has rather
			more than 128 parameters, many of which need more than 128 positions. MIDI's answer was not to
			add a new message — it was to build a small protocol out of the messages it already had.
		</p>
		<p class="text-[15px] leading-relaxed">
			The mechanism is: <strong>say which parameter, then say what value</strong>. Both halves
			travel as ordinary Control Changes, which is why an RPN edit looks like five unrelated CCs in
			a monitor until you know what you are looking at.
		</p>
	</Section>

	<div class="grid gap-4 lg:grid-cols-2">
		<div class="flex flex-col gap-2 rounded-xl border border-msg-note/40 p-4">
			<p class="text-[11px] font-semibold tracking-wide text-msg-note uppercase">
				RPN · registered
			</p>
			<p class="text-sm leading-relaxed">
				Numbers assigned by the MIDI Association. They mean the same thing on every device that
				implements them, and there are only a handful. Selected with <strong>CC 101</strong>
				(coarse) and <strong>CC 100</strong> (fine).
			</p>
		</div>
		<div class="flex flex-col gap-2 rounded-xl border border-msg-sysex/40 p-4">
			<p class="text-[11px] font-semibold tracking-wide text-msg-sysex uppercase">
				NRPN · non-registered
			</p>
			<p class="text-sm leading-relaxed">
				16,384 numbers that mean whatever a manufacturer decided. This is where deep synth editing
				lives on Yamaha, Korg, Novation and many others. Selected with <strong>CC 99</strong>
				(coarse) and <strong>CC 98</strong> (fine).
			</p>
		</div>
	</div>

	<Section title="Every registered parameter there is">
		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50 text-[10px] tracking-wide text-muted-foreground uppercase">
					<tr>
						<th class="w-20 px-3 py-2 text-left font-medium">MSB,LSB</th>
						<th class="px-3 py-2 text-left font-medium">Parameter</th>
						<th class="px-3 py-2 text-left font-medium">What it does</th>
					</tr>
				</thead>
				<tbody>
					{#each RPN_TABLE as r (r.name)}
						<tr class="border-t">
							<td class="px-3 py-2 font-mono text-xs text-msg-note">{r.msb},{r.lsb}</td>
							<td class="px-3 py-2">{r.name}</td>
							<td class="px-3 py-2 text-xs leading-snug text-muted-foreground">{r.description}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-sm leading-relaxed text-muted-foreground">
			That is the complete list. RPN 0,0 — bend sensitivity — is the one you will use; RPN 0,6 is
			how an MPE zone is declared, which is Act V.
		</p>
	</Section>

	<TryThis title="Build one and watch it come apart">
		<p class="text-sm leading-relaxed">
			Set a parameter and a value, then send. The panel shows the individual Control Changes that
			leave, and underneath, the same stream reassembled by a receiver-side parser — the exact job
			your synth is doing.
		</p>
		<Drone notes={[52, 55, 59]} label="Hold a chord (try RPN 0,0)" />
		<RpnLab />
	</TryThis>

	<Callout variant="key" title="Always send the Null">
		<p>
			After a Data Entry, the selected parameter <em>stays selected</em>. If anything later sends CC
			6 — another track, a second app, a controller with a knob mapped to Data Entry — it will land
			on that parameter. Selecting RPN 127,127 (the "Null") deselects, and costs two messages.
		</p>
		<p class="mt-2">
			Turn the Null switch off in the panel above and you can watch the trap: send a bend-range
			edit, then send any Data Entry, and the second one silently changes the bend range too.
		</p>
	</Callout>

	<Section title="Reading an NRPN table">
		<p class="text-[15px] leading-relaxed">
			A manufacturer's NRPN documentation typically looks like this:
		</p>
		<div class="overflow-hidden rounded-xl border">
			<table class="w-full text-sm">
				<thead class="bg-muted/50 text-[10px] tracking-wide text-muted-foreground uppercase">
					<tr>
						<th class="px-3 py-2 text-left font-medium">Parameter</th>
						<th class="px-3 py-2 text-left font-medium">NRPN MSB</th>
						<th class="px-3 py-2 text-left font-medium">NRPN LSB</th>
						<th class="px-3 py-2 text-left font-medium">Range</th>
					</tr>
				</thead>
				<tbody class="font-mono text-xs">
					<tr class="border-t"
						><td class="px-3 py-2 font-sans">Osc 1 Wave</td><td class="px-3 py-2">0</td><td
							class="px-3 py-2">8</td
						><td class="px-3 py-2">0–63</td></tr
					>
					<tr class="border-t"
						><td class="px-3 py-2 font-sans">Filter Cutoff</td><td class="px-3 py-2">0</td><td
							class="px-3 py-2">44</td
						><td class="px-3 py-2">0–127</td></tr
					>
					<tr class="border-t"
						><td class="px-3 py-2 font-sans">LFO 1 Rate</td><td class="px-3 py-2">0</td><td
							class="px-3 py-2">72</td
						><td class="px-3 py-2">0–255</td></tr
					>
				</tbody>
			</table>
		</div>
		<p class="text-sm leading-relaxed text-muted-foreground">
			Illustrative numbers, not a real device. Note the third row: a range of 0–255 needs more than
			seven bits, so that parameter requires a 14-bit Data Entry — CC 6 <em>and</em> CC 38. Ranges above
			127 in a table are your signal to switch on 14-bit mode.
		</p>
		<Callout variant="gotcha" title="Why NRPN feels flaky in DAWs">
			<p>
				Because it is stateful, and DAWs are not. If you record an NRPN edit and then loop playback
				from the middle, the selector CCs may never be sent — so the Data Entry arrives with the
				wrong parameter selected, or none, and something unexpected moves. This is a real and common
				problem. The defence is to re-send the selector with every value change, which is what the
				panel above does by default.
			</p>
		</Callout>
	</Section>

	<Quiz
		question="You want a device's filter cutoff to sweep smoothly over its full 0–1023 range. Which mechanism fits?"
		options={[
			'A single 7-bit CC',
			'An NRPN with 14-bit Data Entry (CC 6 and CC 38)',
			'Program Change',
			'Pitch bend'
		]}
		answer={1}
		explanation="A range beyond 127 rules out a plain 7-bit CC. NRPN with both Data Entry halves gives 14 bits — 16,384 steps — which comfortably covers 1024 positions. This is exactly why deep editing on hardware synths uses NRPN rather than CC."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="select"
			label="Select a parameter — send CC 101 or CC 99"
			test={(e) =>
				e.message.type === 'controlChange' &&
				(e.message.controller === 101 || e.message.controller === 99)}
		/>
		<Checkpoint
			lesson={meta.id}
			id="rpn00"
			label="Complete an RPN 0,0 edit — change the pitch bend sensitivity"
			hint="Set kind to RPN, MSB 0, LSB 0, pick a value, send."
			test={(() => {
				// The receiver's job, in miniature: only a Data Entry that follows a
				// complete RPN 0,0 selection counts as a bend-sensitivity edit.
				let stage = 0;
				return (e) => {
					const m = e.message;
					if (m.type !== 'controlChange') return false;
					if (m.controller === 101) {
						stage = m.value === 0 ? 1 : 0;
						return false;
					}
					if (m.controller === 100) {
						stage = stage === 1 && m.value === 0 ? 2 : 0;
						return false;
					}
					if (m.controller === 6 && stage === 2) {
						stage = 0;
						return true;
					}
					return false;
				};
			})()}
		/>
		<Checkpoint
			lesson={meta.id}
			id="nrpn"
			label="Send an NRPN edit"
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 98}
		/>
		<Checkpoint
			lesson={meta.id}
			id="fine"
			label="Send a 14-bit value — both Data Entry halves"
			hint="Switch on 14-bit in the panel."
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 38}
		/>
		<Checkpoint
			lesson={meta.id}
			id="null"
			label="Deselect afterwards with the RPN Null"
			test={(e) =>
				e.message.type === 'controlChange' &&
				e.message.controller === 101 &&
				e.message.value === 127}
		/>
	</Checkpoints>
</LessonShell>
