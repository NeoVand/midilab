<script lang="ts">
	/**
	 * The instrument a demonstration speaks through, changeable in place.
	 *
	 * Two problems, one control.
	 *
	 * The first is a bug this fixes rather than papers over: widgets share the
	 * engine's channel, so a demonstration that never sends a Program Change
	 * plays through whatever the previous one left behind. A lesson about
	 * consonance played through a woodblock is not a lesson about consonance —
	 * a percussive one-shot has no sustain, so two notes never overlap long
	 * enough to beat against each other, and the entire point is inaudible. So
	 * every demo now names its own voice and sends it at play time.
	 *
	 * The second is that the *right* voice is a matter of taste as well as of
	 * physics. Somebody who finds the default piano dull should be able to hear
	 * the same interval on strings, and hearing it on four instruments is
	 * genuinely better teaching than hearing it on one — it separates the thing
	 * being demonstrated from the timbre demonstrating it.
	 *
	 * So the control is deliberately quiet: the instrument's name in small grey
	 * type, and nothing else until you press it. It is furniture until you want
	 * it, and then it is a full General MIDI browser.
	 */
	import * as Popover from '$lib/components/ui/popover';
	import { engine } from '$lib/midi/engine.svelte';
	import { GM_FAMILIES, GM_PROGRAMS } from '$lib/midi/constants';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowUpDownIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		/** The chosen program. Bind it; the caller sends it when it plays. */
		value: number;
		/** Channel to audition on, and to apply the change to immediately. */
		channel?: number;
		/**
		 * Play a short note on picking, so choosing is a decision you can hear
		 * rather than one you have to commit to and then re-run the demo for.
		 */
		audition?: boolean;
		/**
		 * Told about a pick, for callers whose own state is not a plain number —
		 * `MelodyPlayer` holds `null` to mean "whatever this melody suggests",
		 * which cannot be the target of a two-way binding.
		 */
		onValue?: (program: number) => void;
		class?: string;
	}
	let {
		value = $bindable(0),
		channel = 0,
		audition = true,
		onValue,
		class: className
	}: Props = $props();

	let open = $state(false);
	let offTimer = 0;

	async function pick(p: number) {
		value = p;
		onValue?.(p);
		await engine.wake();
		engine.programChange(p, channel);
		if (!audition) return;
		// One audition at a time: moving quickly down the list should replace the
		// previous note, not pile up a chord of every instrument you passed.
		clearTimeout(offTimer);
		const note = channel === 9 ? 38 : 64;
		engine.noteOn(note, 90, channel);
		offTimer = window.setTimeout(() => engine.noteOff(note, channel), 600);
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class={cn(
			'flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
			className
		)}
		title="Change the instrument this demonstration plays through"
	>
		<span class="max-w-[9rem] truncate">{GM_PROGRAMS[value]}</span>
		<HugeiconsIcon icon={ArrowUpDownIcon} size={11} class="shrink-0 opacity-70" />
	</Popover.Trigger>
	<Popover.Content class="w-[min(28rem,calc(100vw-2rem))] p-0" sideOffset={6} align="end">
		<div class="border-b px-3 py-2">
			<p class="text-xs font-medium">Instrument</p>
			<p class="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
				One Program Change on channel {channel + 1}. The notes do not change.
			</p>
		</div>
		<div class="max-h-72 overflow-y-auto p-2">
			{#each GM_FAMILIES as family, f (family)}
				<p class="label px-1 pt-2 pb-1 first:pt-0">{family}</p>
				<div class="grid grid-cols-2 gap-1">
					{#each Array.from({ length: 8 }, (_, i) => f * 8 + i) as p (p)}
						<button
							class={cn(
								'flex items-baseline gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors',
								value === p ? 'bg-msg-program-bg text-msg-program' : 'hover:bg-accent/60'
							)}
							aria-pressed={value === p}
							onclick={() => pick(p)}
						>
							<span class="tnum w-5 shrink-0 font-mono text-2xs text-muted-foreground">{p}</span>
							<span class="truncate">{GM_PROGRAMS[p]}</span>
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
