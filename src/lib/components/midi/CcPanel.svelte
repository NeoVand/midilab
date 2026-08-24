<script lang="ts">
	/**
	 * A bank of controller knobs. Each one sends a real Control Change and the
	 * internal instrument responds to it — which is exactly what a hardware
	 * synth would do, and exactly what it might not, since these meanings are
	 * conventions rather than guarantees.
	 *
	 * The panel also says which of them the receiver in use can actually act
	 * on. Turning a knob and hearing nothing is the single most confusing
	 * thing in MIDI, and it usually means something true: the message went out
	 * correctly and the thing at the other end had nowhere to put it. A knob
	 * that quietly does nothing teaches that badly; a knob that says so, and
	 * says why, teaches it well.
	 */
	import Knob from './Knob.svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { gm, sampledCannot } from '$lib/audio/gm.svelte';
	import { device } from '$lib/stores/device.svelte';
	import { ccInfo } from '$lib/midi/constants';
	import { cn } from '$lib/utils';

	interface Props {
		controllers?: number[];
		channel?: number;
		size?: number;
		/** Hide the note about what this receiver ignores. */
		quiet?: boolean;
		class?: string;
	}
	let {
		controllers = [74, 71, 73, 72, 1, 7, 10, 91],
		channel = 0,
		size = 50,
		quiet = false,
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

	/** null when this receiver can act on the controller. */
	const reasons = $derived(
		Object.fromEntries(
			controllers.map((cc) => [cc, gm.enabled ? sampledCannot(cc) : null])
		) as Record<number, string | null>
	);
	const ignored = $derived(controllers.filter((cc) => reasons[cc]));
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<!--
		A grid on a phone so the bank lines up in columns; a wrapping row on a
		desk, where the knobs pack in as they fit and the count varies per page.
	-->
	<div class="grid grid-cols-3 gap-x-2 gap-y-3 sm:flex sm:flex-wrap">
		{#each controllers as cc (cc)}
			{@const why = reasons[cc]}
			<div class={cn('min-w-0 transition-opacity', why && 'opacity-45')} title={why ?? undefined}>
				<Knob
					fill={device.narrow}
					value={values[cc] ?? DEFAULTS[cc] ?? 0}
					min={0}
					max={127}
					default={DEFAULTS[cc] ?? 0}
					label={ccInfo(cc).short}
					sub="CC {cc} · {values[cc] ?? DEFAULTS[cc] ?? 0}"
					hint={why ?? undefined}
					{size}
					colour="var(--msg-cc)"
					onChange={(v) => {
						values[cc] = v;
						engine.cc(cc, v, channel);
					}}
				/>
			</div>
		{/each}
	</div>

	{#if !quiet && ignored.length}
		<!--
			Sized to the longest thing it can say, so that switching receiver
			does not move the page. The message it replaces when nothing is
			ignored is one line; this is at most two.
		-->
		<p class="text-xs leading-relaxed text-muted-foreground">
			The sampled instruments still receive
			<span class="font-mono">{ignored.map((cc) => `CC ${cc}`).join(', ')}</span> — they simply have
			nowhere to put {ignored.length === 1 ? 'it' : 'them'}. Hover a dimmed knob for the reason, or
			switch to the synth.
		</p>
	{/if}
</div>
