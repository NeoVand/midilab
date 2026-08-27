<script lang="ts">
	/**
	 * The same chord, tuned two ways, so the compromise becomes audible.
	 *
	 * Equal temperament is the thing every keyboard does and almost nobody has
	 * ever heard the alternative to, which makes it very hard to argue about in
	 * prose: "the major third is fourteen cents sharp" is a number, not an
	 * experience. Played back to back against a pure 5:4, it is not subtle —
	 * the equal-tempered version beats audibly and the just one locks.
	 *
	 * The mechanism is the lesson too. There is no "tune this note" message in
	 * MIDI 1.0, so each note goes on its own channel and is bent into place by
	 * the exact number of cents it is out. That is not a trick invented here: it
	 * is how essentially every microtonal setup works, and it is the same
	 * one-note-per-channel idea that MPE formalises.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { unitToBend } from '$lib/midi/messages';
	import { setBendRange } from '$lib/midi/rpn';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import VoicePicker from './VoicePicker.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, StopIcon } from '@hugeicons/core-free-icons';
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		root?: number;
		class?: string;
	}
	let { root = 60, class: className }: Props = $props();

	/**
	 * A major triad, both ways.
	 *
	 * `ratio` is the interval as a whole-number frequency ratio, which is what
	 * the harmonic series actually contains. `cents` is how far equal
	 * temperament puts that interval from the pure one — derived rather than
	 * typed, because a table of hand-written constants is a table that can
	 * disagree with its own arithmetic.
	 */
	const TRIAD = [
		{ semitones: 0, ratio: [1, 1], name: 'Root' },
		{ semitones: 4, ratio: [5, 4], name: 'Major third' },
		{ semitones: 7, ratio: [3, 2], name: 'Perfect fifth' }
	].map((v) => ({
		...v,
		// 1200·log2(ratio) is the pure interval in cents; the tempered one is
		// exactly 100 per semitone. The difference is the compromise.
		cents: 1200 * Math.log2(v.ratio[0] / v.ratio[1]) - v.semitones * 100
	}));

	/**
	 * The bend range this demonstration assumes, declared rather than hoped for.
	 *
	 * Detuning by bend only works if both ends agree how far a full bend goes:
	 * every offset below is a fraction of ±2 semitones, so on a receiver set to
	 * ±12 the whole chord comes out six times as far out of tune as intended.
	 * Two semitones happens to be the default here — but this lesson also hands
	 * the reader an RPN lab pointed at the same channels, so "happens to be" is
	 * not good enough. It is sent every time, which is exactly what a real
	 * microtonal rig has to do, and it shows up in the monitor while it does.
	 */
	const BEND_SEMITONES = 2;
	const BEND_RANGE_CENTS = BEND_SEMITONES * 100;

	/*
	 * A reed organ: a flat, sustained tone with strong harmonics and no decay.
	 * Beating between two slightly mistuned notes is the entire demonstration,
	 * and it is only audible while both notes are still sounding at full level
	 * — which rules out anything that decays, and certainly anything percussive.
	 */
	let program = $state(20);
	let mode = $state<'equal' | 'just' | null>(null);
	let timer = 0;

	function stop() {
		clearTimeout(timer);
		for (let i = 0; i < TRIAD.length; i++) {
			engine.noteOff(root + TRIAD[i].semitones, i);
			engine.pitchBend(8192, i);
		}
		mode = null;
	}

	async function play(which: 'equal' | 'just') {
		stop();
		await engine.wake();
		mode = which;
		TRIAD.forEach((v, i) => {
			// One note per channel is the whole point: bend is channel-wide, so
			// three notes on one channel could only ever share one detune.
			engine.programChange(program, i);
			engine.sendAll(setBendRange(i, BEND_SEMITONES));
			engine.pitchBend(which === 'just' ? unitToBend(v.cents / BEND_RANGE_CENTS) : 8192, i);
			engine.noteOn(root + v.semitones, 88, i);
		});
		timer = window.setTimeout(stop, 3200);
	}

	onDestroy(stop);
</script>

<div class={cn('flex flex-col gap-4', className)}>
	<div class="flex flex-wrap gap-2">
		<Button
			variant={mode === 'equal' ? 'default' : 'outline'}
			size="sm"
			class="gap-1.5"
			onclick={() => (mode === 'equal' ? stop() : play('equal'))}
		>
			<HugeiconsIcon icon={mode === 'equal' ? StopIcon : PlayIcon} size={13} />
			Equal temperament
		</Button>
		<Button
			variant={mode === 'just' ? 'default' : 'outline'}
			size="sm"
			class="gap-1.5"
			onclick={() => (mode === 'just' ? stop() : play('just'))}
		>
			<HugeiconsIcon icon={mode === 'just' ? StopIcon : PlayIcon} size={13} />
			Pure ratios
		</Button>
		<div class="flex-1"></div>
		<VoicePicker bind:value={program} audition={false} />
	</div>

	<div class="overflow-x-auto rounded-lg border">
		<table class="w-full min-w-[26rem] border-collapse text-sm">
			<thead>
				<tr class="border-b bg-surface-sunken text-left">
					<th class="px-3 py-2 font-medium">Note</th>
					<th class="px-3 py-2 font-medium">Pure ratio</th>
					<th class="px-3 py-2 font-medium">Pure, against the keyboard</th>
				</tr>
			</thead>
			<tbody>
				{#each TRIAD as v (v.semitones)}
					<tr class="border-b border-border/50 last:border-0">
						<td class="px-3 py-2">
							<span class="font-medium">
								{noteName(root + v.semitones, { convention: settings.octaveConvention })}
							</span>
							<span class="ml-1.5 text-xs text-muted-foreground">{v.name}</span>
						</td>
						<td class="tnum px-3 py-2 font-mono text-muted-foreground">
							{v.ratio[0]}:{v.ratio[1]}
						</td>
						<td class="tnum px-3 py-2 font-mono">
							{#if Math.abs(v.cents) < 0.5}
								<span class="text-muted-foreground">exact</span>
							{:else}
								<span class={Math.abs(v.cents) > 10 ? 'text-warn' : 'text-muted-foreground'}>
									{v.cents > 0 ? '+' : ''}{v.cents.toFixed(1)} cents
								</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="text-sm leading-relaxed text-muted-foreground">
		The octave and the fifth are nearly exact; the major third is almost fourteen cents sharp, which
		is why an equal-tempered triad has a faint beating in it that a pure one does not. Every
		keyboard you have ever played was making that trade.
	</p>
</div>
