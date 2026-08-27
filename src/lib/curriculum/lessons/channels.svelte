<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import Keyboard from '$lib/components/midi/Keyboard.svelte';
	import ChannelGrid from '$lib/components/midi/ChannelGrid.svelte';
	import PadGrid from '$lib/components/midi/PadGrid.svelte';
	import PhrasePlayer from '$lib/components/midi/PhrasePlayer.svelte';
	import MelodyPlayer from '$lib/components/midi/MelodyPlayer.svelte';
	import { lessonById } from '$lib/curriculum/registry';
	import { engine } from '$lib/midi/engine.svelte';
	import { synth } from '$lib/audio/synth';
	import { gmProgramName } from '$lib/midi/constants';
	import type { NoteSpec } from '$lib/midi/player.svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';

	const meta = lessonById('channels')!;

	// A four-part arrangement, one part per channel.
	const PARTS: Array<{ channel: number; program: number; name: string; notes: NoteSpec[] }> = [
		{
			channel: 0,
			program: 33,
			name: 'Bass',
			notes: [36, 36, 43, 41].map((note, i) => ({
				note,
				start: i,
				duration: 0.85,
				velocity: 104,
				channel: 0
			}))
		},
		{
			channel: 1,
			program: 48,
			name: 'Pad',
			notes: [
				{ note: 60, start: 0, duration: 4, velocity: 62, channel: 1 },
				{ note: 64, start: 0, duration: 4, velocity: 58, channel: 1 },
				{ note: 67, start: 0, duration: 4, velocity: 55, channel: 1 }
			]
		},
		{
			channel: 2,
			program: 11,
			name: 'Melody',
			notes: [72, 74, 76, 79, 76, 74].map((note, i) => ({
				note,
				start: i * 0.5 + 0.5,
				duration: 0.45,
				velocity: 88,
				channel: 2
			}))
		},
		{
			channel: 9,
			program: 0,
			name: 'Drums',
			notes: [
				...[0, 1, 2, 3].map((b) => ({
					note: 36,
					start: b,
					duration: 0.2,
					velocity: 110,
					channel: 9
				})),
				...[1, 3].map((b) => ({ note: 38, start: b, duration: 0.2, velocity: 96, channel: 9 })),
				...Array.from({ length: 8 }, (_, i) => ({
					note: 42,
					start: i * 0.5,
					duration: 0.15,
					velocity: 64,
					channel: 9
				}))
			]
		}
	];

	let muted = $state<number[]>([]);
	const audible = $derived(PARTS.filter((p) => !muted.includes(p.channel)).flatMap((p) => p.notes));

	onMount(() => {
		for (const p of PARTS) synth.channels[p.channel].program = p.program;
	});

	function toggleMute(ch: number) {
		muted = muted.includes(ch) ? muted.filter((c) => c !== ch) : [...muted, ch];
	}
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			Look again at a status byte: four bits for the command, four bits for a number 0–15. That
			second nibble is the <strong>channel</strong>, and it turns one cable into sixteen independent
			conversations happening at once.
		</p>
		<p class="prose-body">
			A channel is an address, nothing more. It does not imply an instrument, a track or a sound —
			it just says <em>this message is for whoever is listening on 3</em>. Who that is, and what
			they do about it, is a decision made at the other end.
		</p>
	</Section>

	<Callout variant="key" title="Every channel keeps its own state">
		<p>
			Program, volume, pan, <Xref to="pitch-bend" label="pitch bend" />, mod wheel, sustain pedal,
			every controller — all of it is per channel. Bend channel 1 and channel 2 does not move. This
			is why a single synth can play bass and strings simultaneously without them interfering, and
			it is also the constraint that
			<Xref to="mpe" label="MPE" /> later exploits.
		</p>
	</Callout>

	<TryThis title="Four parts, one cable">
		<p class="text-sm leading-relaxed">
			Four channels, four different sounds, one stream of messages. Mute any part — you are not
			muting an audio track, you are declining to send messages to an address.
		</p>
		<div class="flex flex-wrap gap-2">
			{#each PARTS as part (part.channel)}
				<Button
					variant={muted.includes(part.channel) ? 'outline' : 'default'}
					size="sm"
					class="h-auto flex-col items-start gap-0 px-3 py-1.5"
					onclick={() => toggleMute(part.channel)}
				>
					<span class="text-xs font-medium">{part.name}</span>
					<span class="text-2xs opacity-70">
						ch {part.channel + 1} · {part.channel === 9 ? 'GM kit' : gmProgramName(part.program)}
					</span>
				</Button>
			{/each}
		</div>
		<!-- `program={null}`: this arrangement has already given each of its four
		     channels its own instrument, and one Program Change here would quietly
		     overwrite the bass with whatever this widget preferred. -->
		<PhrasePlayer
			notes={audible}
			bpm={104}
			label="Play the arrangement"
			loop
			variant="default"
			program={null}
		/>
		<ChannelGrid />
		<p class="text-xs leading-relaxed text-muted-foreground">
			The grid above is live. Click a cell to change which channel the keyboard and pads transmit on
			— currently channel <strong>{engine.channel + 1}</strong>.
		</p>
	</TryThis>

	<TryThis title="One phrase, four addresses">
		<p class="text-sm leading-relaxed">
			The arrangement above is four different parts. This is something stranger and cheaper: the
			<em>same</em> eight bars, sent four times to four different channels, each entry two bars later
			than the last. That is all a round is — and it is the shortest possible proof that a channel is
			an address rather than a track.
		</p>
		<MelodyPlayer
			id="frere-jacques"
			credit={false}
			voicesInRound={[
				{ channel: 0, delay: 0, program: 73 },
				{ channel: 1, delay: 8, program: 11 },
				{ channel: 2, delay: 16, program: 42 },
				{ channel: 3, delay: 24, program: 33 }
			]}
		/>
		<p class="text-xs leading-relaxed text-muted-foreground">
			Flute, vibraphone, cello and bass. Watch the monitor in the dock: the note numbers repeat
			exactly, four times over, and the only thing that differs is the low nibble of the status
			byte. One cable, one melody, four voices.
		</p>
	</TryThis>

	<Section title="Multitimbral is the word for this">
		<p class="prose-body">
			An instrument that can play different sounds on different channels at the same time is called
			<strong>multitimbral</strong>. Most modern synths are, to some degree — your OP-XY, an MPC, a
			software instrument rack, a <Xref to="programs-and-banks" label="General MIDI" /> module. Some vintage
			synths are not, and will simply play everything they receive with one sound regardless of channel.
		</p>
		<p class="prose-body">
			Two settings govern what a receiver does with channels, and both live in its menus rather than
			in the protocol:
		</p>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Receive channel</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					"Only listen to messages addressed to 3." Everything else is discarded. This is what you
					set when you want a synth to play one part of an arrangement.
				</p>
			</div>
			<div class="rounded-lg border p-4">
				<p class="text-sm font-semibold">Omni mode</p>
				<p class="mt-1.5 text-sm leading-relaxed">
					"Listen to everything, ignore the address." Convenient for a single synth on a single
					cable; a disaster the moment there are two. If a synth is playing parts meant for
					something else, check this first.
				</p>
			</div>
		</div>
	</Section>

	<Section title="Channel 10 and the drums">
		<p class="prose-body">
			You will hear, constantly, that "channel 10 is drums". That is true in the same way that port
			80 is a web server: it is an extremely well-observed convention with no enforcement behind it.
			General MIDI reserves channel 10 for percussion and defines which note number is a kick, a
			snare, a hi-hat. Non-GM instruments are under no obligation.
		</p>
		<div class="grid gap-4 sm:grid-cols-[1fr_auto]">
			<PadGrid channel={9} class="max-w-sm" />
			<div class="flex flex-col justify-center gap-2 text-sm leading-relaxed">
				<p>
					On channel 10 these note numbers are drums. On any other channel the identical numbers are
					pitches — note 36 is the C two octaves below middle C.
				</p>
				<p class="text-muted-foreground">
					Same bytes. Different meaning. Decided entirely by the receiver, again.
				</p>
			</div>
		</div>
	</Section>

	<Callout variant="convention" title="Sixteen is not many">
		<p>
			Sixteen channels sounds generous until you have six instruments, an MPE controller consuming
			fifteen of them, and a drum machine. The escape hatch is not more channels — it is more
			<strong>ports</strong>. A USB interface with four MIDI outs gives you 64 addresses, because a
			channel number only has to be unique per cable. Port plus channel is the real address.
		</p>
	</Callout>

	<TryThis title="Play on a channel of your choosing">
		<ChannelGrid />
		<Keyboard low={48} octaves={3} height={130} />
	</TryThis>

	<Quiz
		question="Your Korg is set to receive on channel 3, and you play your controller which transmits on channel 1. Nothing happens. What is the cheapest fix to try first?"
		options={[
			'Replace the MIDI cable',
			'Set the controller to transmit on channel 3, or the Korg to receive on 1',
			'Turn Omni mode off on the Korg',
			'Send a Program Change first'
		]}
		answer={1}
		explanation="Mismatched channels are the single most common cause of 'MIDI is not working'. Note that turning Omni ON would also make it play — but that is a sticking plaster that will bite you when you add a second instrument. Match the channels deliberately."
	/>

	<Further
		refs={['spec-gm', 'wikipedia-gm', 'spec-summary']}
		lead="Channel 10 is a General MIDI convention rather than a rule of MIDI, which is why the first two of these are where it is written down."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="ch4"
			label="Play a note on channel 4"
			hint="Click cell 4 in the channel grid, then play."
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 3}
		/>
		<Checkpoint
			lesson={meta.id}
			id="drums"
			label="Trigger a drum on channel 10"
			hint="Use the pads."
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 9}
		/>
		<Checkpoint
			lesson={meta.id}
			id="three-channels"
			label="Send notes on three different channels"
			count={3}
			key={(e) => (e.message.type === 'noteOn' ? String(e.message.channel) : '')}
			test={(e) => e.message.type === 'noteOn'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="ch16"
			label="Play something on channel 16 — the highest address a nibble can hold"
			test={(e) => e.message.type === 'noteOn' && e.message.channel === 15}
		/>
	</Checkpoints>
</LessonShell>
