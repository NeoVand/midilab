<script lang="ts">
	/**
	 * A bank of controller knobs. Each one sends a real Control Change and the
	 * internal synth responds to it — which is exactly what a hardware synth
	 * would do, and exactly what it might not, since these meanings are
	 * conventions rather than guarantees.
	 */
	import Knob from './Knob.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { ccInfo } from '$lib/midi/constants';
	import { cn } from '$lib/utils';

	interface Props {
		controllers?: number[];
		channel?: number;
		size?: number;
		class?: string;
	}
	let {
		controllers = [74, 71, 73, 72, 1, 7, 10, 91],
		channel = 0,
		size = 50,
		class: className
	}: Props = $props();

	// The Sound Controllers are relative, so their rest position is the middle
	// of the range rather than the bottom of it — a knob for CC 73 that springs
	// back to 0 is a knob that springs back to "shortest attack there is".
	const DEFAULTS: Record<number, number> = {
		7: 100,
		10: 64,
		11: 127,
		71: 64,
		72: 64,
		73: 64,
		74: 64,
		75: 64,
		91: 12
	};

	// Local mirror so the knobs stay smooth, kept in step with whatever the
	// channel last received — including from your hardware.
	let values = $state<Record<number, number>>({});

	$effect(() => {
		for (const c of controllers) {
			const external = noteState.channel(channel).cc.get(c);
			const next = external ?? values[c] ?? DEFAULTS[c] ?? 0;
			if (next !== values[c]) values[c] = next;
		}
	});
</script>

<div class={cn('flex flex-wrap gap-x-5 gap-y-4', className)}>
	{#each controllers as cc (cc)}
		<Knob
			value={values[cc] ?? DEFAULTS[cc] ?? 0}
			min={0}
			max={127}
			default={DEFAULTS[cc] ?? 0}
			label={ccInfo(cc).short}
			sub="CC {cc} · {values[cc] ?? DEFAULTS[cc] ?? 0}"
			{size}
			colour="var(--msg-cc)"
			onChange={(v) => {
				values[cc] = v;
				engine.cc(cc, v, channel);
			}}
		/>
	{/each}
</div>
