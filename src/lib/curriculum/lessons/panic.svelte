<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { ccInfo } from '$lib/midi/constants';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { DangerIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	const meta = lessonById('panic')!;

	const MODE_CCS = [120, 121, 122, 123, 124, 125, 126, 127];

	function makeMess() {
		engine.wake();
		engine.cc(64, 127, 0); // sustain down
		for (const n of [48, 52, 55, 59, 62, 67]) engine.noteOn(n, 80, 0);
		setTimeout(() => {
			for (const n of [48, 52, 55, 59, 62, 67]) engine.noteOff(n, 0);
		}, 100);
	}

	const held = $derived(noteState.heldCount);
	const sustainDown = $derived(noteState.cc(0, 64, 0) >= 64);
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Controller numbers 120 to 127 are not controllers at all. They occupy Control Change's address
			space, but instead of moving a parameter they change how the channel behaves. They are called
			<strong>Channel Mode messages</strong>, and two of them are the reason every MIDI application
			has a big red button.
		</p>
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<thead class="label bg-muted/50">
					<tr>
						<th class="w-14 px-3 py-2 text-left font-medium">CC</th>
						<th class="px-3 py-2 text-left font-medium">Name</th>
						<th class="px-3 py-2 text-left font-medium">Effect</th>
					</tr>
				</thead>
				<tbody>
					{#each MODE_CCS as cc (cc)}
						<tr class="border-t">
							<td class="px-3 py-2 font-mono text-msg-common">{cc}</td>
							<td class="px-3 py-2">{ccInfo(cc).short}</td>
							<td class="px-3 py-2 text-xs leading-snug text-muted-foreground">
								{ccInfo(cc).description ?? '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Section>

	<Section title="All Notes Off is not All Sound Off">
		<p class="prose-body">
			They sound like synonyms and behave very differently, and knowing which is which is the
			difference between a panic button that works and one that only usually works.
		</p>
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="flex flex-col gap-2 rounded-lg border p-4">
				<p class="text-sm font-semibold">CC 123 · All Notes Off</p>
				<p class="text-sm leading-relaxed">
					The polite one. It is equivalent to lifting your hands off the keys: notes enter their
					<Xref to="envelope" label="release phase" /> and fade naturally.
					<strong>The sustain pedal still applies</strong> — if CC 64 is down, everything keeps ringing.
				</p>
			</div>
			<div class="flex flex-col gap-2 rounded-lg border p-4">
				<p class="text-sm font-semibold">CC 120 · All Sound Off</p>
				<p class="text-sm leading-relaxed">
					The blunt one. Every voice is cut immediately, ignoring release tails, ignoring the
					sustain pedal. Nothing survives it. It can produce an audible click, which is why it is
					the second thing you send, not the first.
				</p>
			</div>
		</div>

		<TryThis title="Make a mess, then clean it up two ways">
			<p class="text-sm leading-relaxed">
				The button below holds the sustain pedal down, plays a six-note chord, and immediately
				releases the keys. Because the pedal is down, everything keeps sounding — a perfectly
				correct outcome that looks exactly like a bug.
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<Button variant="outline" onclick={makeMess}>Create the mess</Button>
				<span class={cn('tnum font-mono text-xs', held > 0 && 'text-destructive')}>
					{held} sounding
				</span>
				<span
					class={cn('font-mono text-xs', sustainDown ? 'text-msg-cc' : 'text-muted-foreground')}
				>
					sustain {sustainDown ? 'DOWN' : 'up'}
				</span>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button variant="secondary" size="sm" onclick={() => engine.cc(123, 0, 0)}>
					CC 123 — All Notes Off
				</Button>
				<Button variant="secondary" size="sm" onclick={() => engine.cc(120, 0, 0)}>
					CC 120 — All Sound Off
				</Button>
				<Button variant="secondary" size="sm" onclick={() => engine.cc(64, 0, 0)}>
					CC 64 = 0 — lift the pedal
				</Button>
				<Button variant="destructive" size="sm" class="gap-1.5" onclick={() => engine.panic()}>
					<HugeiconsIcon icon={DangerIcon} size={14} /> Full panic
				</Button>
			</div>
			<p class="text-xs leading-relaxed text-muted-foreground">
				Try CC 123 first, on its own. On a device that honours the pedal properly, nothing stops.
				Now lift the pedal, or use CC 120.
			</p>
		</TryThis>
	</Section>

	<Section title="Writing a panic that actually works">
		<p class="prose-body">
			Real hardware is inconsistent about all of this. Some devices ignore CC 123. Some honour CC
			120 but not 123. Some very old ones honour neither. A panic routine that works everywhere
			therefore escalates:
		</p>
		<ol class="prose-body flex flex-col gap-2.5">
			<li class="flex gap-3">
				<span class="mt-0.5 font-mono text-sm text-msg-common">1</span>
				<span
					><strong>Lift the pedals.</strong> CC 64 = 0, and CC 66/67 if you use them. Otherwise everything
					after this is filtered out by a held sustain.</span
				>
			</li>
			<li class="flex gap-3">
				<span class="mt-0.5 font-mono text-sm text-msg-common">2</span>
				<span
					><strong>All Notes Off.</strong> CC 123 on every channel. Clean release for anything that listens.</span
				>
			</li>
			<li class="flex gap-3">
				<span class="mt-0.5 font-mono text-sm text-msg-common">3</span>
				<span
					><strong>All Sound Off.</strong> CC 120 on every channel, for anything still ringing.</span
				>
			</li>
			<li class="flex gap-3">
				<span class="mt-0.5 font-mono text-sm text-msg-common">4</span>
				<span
					><strong>Reset All Controllers.</strong> CC 121, so a stuck mod wheel or a bend left off-centre
					does not haunt the next thing you play.</span
				>
			</li>
			<li class="flex gap-3">
				<span class="mt-0.5 font-mono text-sm text-msg-common">5</span>
				<span>
					<strong>If it is still ringing: brute force.</strong> An explicit Note Off for all 128 notes
					on all 16 channels — 2,048 messages. On a DIN cable that takes about two seconds and you will
					hear it working. It is the last resort, and it always works.
				</span>
			</li>
		</ol>
		<p class="text-sm leading-relaxed text-muted-foreground">
			The dock's Panic button does steps 1–4 on a single click and adds step 5 on a double-click.
			That is the routine you should copy into anything you build.
		</p>
	</Section>

	<Section title="Local Control, and the doubled-note mystery">
		<p class="prose-body">
			Here is a problem that sounds like a broken synth and is not. You connect a keyboard to a
			computer, the computer echoes MIDI back to the keyboard so you can hear the software
			instrument, and suddenly every note plays twice — once from the keyboard's own engine and once
			from the echo. Slightly out of phase, slightly flanged, thoroughly wrong.
		</p>
		<div class="rounded-lg border bg-surface-sunken p-5">
			<svg
				viewBox="0 0 520 150"
				class="w-full max-w-xl"
				role="img"
				aria-label="Local control signal path"
			>
				<defs>
					<marker id="lc-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
						<path d="M0,0 L7,3.5 L0,7 z" fill="var(--muted-foreground)" />
					</marker>
				</defs>
				<rect x="8" y="20" width="150" height="46" rx="6" class="fill-card stroke-border" />
				<text x="83" y="42" text-anchor="middle" class="fill-foreground" font-size="11">Keys</text>
				<text x="83" y="56" text-anchor="middle" class="fill-muted-foreground" font-size="9"
					>what you press</text
				>

				<rect x="8" y="90" width="150" height="46" rx="6" class="fill-card stroke-border" />
				<text x="83" y="112" text-anchor="middle" class="fill-foreground" font-size="11"
					>Sound engine</text
				>
				<text x="83" y="126" text-anchor="middle" class="fill-muted-foreground" font-size="9"
					>same box</text
				>

				<rect x="330" y="55" width="150" height="46" rx="6" class="fill-card stroke-border" />
				<text x="405" y="77" text-anchor="middle" class="fill-foreground" font-size="11"
					>Computer</text
				>
				<text x="405" y="91" text-anchor="middle" class="fill-muted-foreground" font-size="9"
					>echoes MIDI back</text
				>

				<path
					d="M83,66 L83,90"
					stroke="var(--destructive)"
					stroke-width="2"
					marker-end="url(#lc-arrow)"
					stroke-dasharray="4 3"
				/>
				<text x="95" y="82" class="fill-destructive" font-size="9">local control</text>

				<path
					d="M158,36 L330,66"
					stroke="var(--msg-note)"
					stroke-width="2"
					fill="none"
					marker-end="url(#lc-arrow)"
				/>
				<text x="230" y="42" class="fill-msg-note" font-size="9">MIDI Out</text>

				<path
					d="M330,92 L158,116"
					stroke="var(--msg-cc)"
					stroke-width="2"
					fill="none"
					marker-end="url(#lc-arrow)"
				/>
				<text x="215" y="118" class="fill-msg-cc" font-size="9">MIDI In — the echo</text>
			</svg>
			<p class="mt-3 text-sm leading-relaxed text-muted-foreground">
				Two paths reach the sound engine: the internal one (dashed) and the round trip through the
				computer. <strong>CC 122 = 0</strong> cuts the dashed one. The keyboard becomes a pure controller;
				the computer decides what it plays.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={() => engine.cc(122, 0, 0)}>
				Local Control OFF (CC 122 = 0)
			</Button>
			<Button variant="outline" size="sm" onclick={() => engine.cc(122, 127, 0)}>
				Local Control ON (CC 122 = 127)
			</Button>
			<span class="self-center text-xs text-muted-foreground">
				Most hardware also has this in its global menu — often the more reliable route.
			</span>
		</div>
		<Callout variant="gotcha" title="Local Control off is sticky">
			<p>
				Turn it off, unplug the computer, and your keyboard now appears to be dead. It is not: it is
				faithfully sending MIDI to nobody. If a synth suddenly makes no sound but its MIDI out is
				alive, check Local Control before you check anything else.
			</p>
		</Callout>
	</Section>

	<Section title="The remaining four">
		<p class="prose-body">
			CC 124–127 set Omni and Mono/Poly modes, and are largely historical. Omni On means "ignore
			channel addresses and play everything" — occasionally useful for a quick test, always a
			liability in a multi-device rig. Mono Mode restricts a channel to one note at a time and is
			the ancestor of how <Xref to="mpe" label="MPE" /> allocates voices. You will rarely send any of
			them deliberately, but you should recognise them when a device behaves strangely after receiving
			one.
		</p>
		<Keyboard low={48} octaves={3} height={110} />
	</Section>

	<Quiz
		question="A note is stuck. You send All Notes Off and nothing happens. What is the most likely cause?"
		options={[
			'The device does not support MIDI',
			'The sustain pedal (CC 64) is still down',
			'You sent it on the wrong port',
			'All Notes Off only works while the transport is stopped'
		]}
		answer={1}
		explanation="All Notes Off releases the keys; it does not lift the pedal. A held CC 64 will keep everything sounding, exactly as a real piano would. Lift the pedal first, then send All Notes Off — which is why a correct panic routine does them in that order."
	/>

	<Further
		refs={['spec-cc', 'spec-summary', 'somascape-spec']}
		lead="Controllers 120 to 127 are the Channel Mode messages, and the difference between two of them is the whole of this lesson."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="notes-off"
			label="Send All Notes Off (CC 123)"
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 123}
		/>
		<Checkpoint
			lesson={meta.id}
			id="sound-off"
			label="Send All Sound Off (CC 120)"
			test={(e) => e.message.type === 'controlChange' && e.message.controller === 120}
		/>
		<Checkpoint
			lesson={meta.id}
			id="pedal-trap"
			label="Fall into the sustain-pedal trap, then get out of it"
			hint="Create the mess, try CC 123 alone, then lift the pedal."
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 64 && e.message.value < 64}
		/>
		<Checkpoint
			lesson={meta.id}
			id="local"
			label="Turn Local Control off"
			test={(e) =>
				e.message.type === 'controlChange' && e.message.controller === 122 && e.message.value < 64}
		/>
		<Checkpoint
			lesson={meta.id}
			id="silence"
			label="End with nothing sounding at all"
			hint="Whatever it takes."
			test={(e) =>
				e.message.type === 'controlChange' &&
				e.message.controller >= 120 &&
				noteState.heldCount === 0}
		/>
	</Checkpoints>
</LessonShell>
