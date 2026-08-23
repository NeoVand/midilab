<script lang="ts">
	/** All 128 General MIDI programs, grouped by family. Click to switch and hear. */
	import { onDestroy } from 'svelte';
	import { rovingGrid } from '$lib/a11y/roving';
	import { engine } from '$lib/midi/engine.svelte';
	import { synth } from '$lib/audio/synth';
	import { GM_FAMILIES, GM_PROGRAMS } from '$lib/midi/constants';
	import { cn } from '$lib/utils';

	interface Props {
		channel?: number;
		/** Play a short chord when a program is chosen. */
		audition?: boolean;
		class?: string;
	}
	let { channel = 0, audition = true, class: className }: Props = $props();

	let offTimer = 0;

	const current = $derived(synth.channels[channel].program);

	async function pick(p: number) {
		await engine.wake();
		engine.programChange(p, channel);
		if (!audition) return;
		const chord = channel === 9 ? [36, 38, 42] : [60, 64, 67];
		// One audition at a time: clicking through the list quickly should replace
		// the previous chord, not have its release cut the new one short.
		clearTimeout(offTimer);
		for (const n of chord) engine.noteOn(n, 92, channel);
		offTimer = window.setTimeout(() => {
			for (const n of chord) engine.noteOff(n, channel);
		}, 700);
	}

	onDestroy(() => clearTimeout(offTimer));
</script>

<div class={cn('flex flex-col gap-4', className)}>
	{#each GM_FAMILIES as family, f (family)}
		<div class="flex flex-col gap-1.5">
			<p class="label">
				{family}
				<span class="ml-1 font-mono text-muted-foreground">{f * 8}–{f * 8 + 7}</span>
			</p>
			<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4" use:rovingGrid>
				{#each Array.from({ length: 8 }, (_, i) => f * 8 + i) as p (p)}
					<button
						class={cn(
							'flex items-baseline gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
							current === p
								? 'border-msg-program bg-msg-program-bg text-msg-program'
								: 'hover:border-foreground/30 hover:bg-accent/40'
						)}
						aria-pressed={current === p}
						onclick={() => pick(p)}
					>
						<span class="tnum w-6 shrink-0 font-mono text-2xs text-muted-foreground">{p}</span>
						<span class="truncate">{GM_PROGRAMS[p]}</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
