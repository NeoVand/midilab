<script lang="ts">
	/**
	 * A live assertion about the MIDI stream.
	 *
	 * Give it a predicate over bus events; it watches, and ticks itself off the
	 * moment the thing actually happens — on the internal synth or on your OP-XY,
	 * it makes no difference, because both go through the same bus.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { bus, type MidiEvent } from '$lib/midi/bus';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Tick02Icon, Target02Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		lesson: string;
		id: string;
		label: string;
		hint?: string;
		/** Return true when this event satisfies the checkpoint. */
		test?: (event: MidiEvent) => boolean;
		/** Musical performance tasks accept direct playing, never sequenced notes. */
		learnerOnly?: boolean;
		/** Require this many satisfying events (distinct by `key`, if given). */
		count?: number;
		key?: (event: MidiEvent) => string;
		class?: string;
	}

	let {
		lesson,
		id,
		label,
		hint,
		test,
		learnerOnly = false,
		count = 1,
		key,
		class: className
	}: Props = $props();

	const done = $derived(progress.isDone(lesson, id));
	const verified = $derived(progress.isVerified(lesson, id));
	let seen = $state<string[]>([]);
	let flash = $state(false);
	let flashTimer = 0;

	const progressText = $derived(count > 1 && !done ? `${seen.length} of ${count}` : '');

	onMount(() => {
		let unsub: (() => void) | undefined;
		if (test) {
			unsub = bus.subscribe((event) => {
				if (event.origin === 'demo' || (learnerOnly && event.origin !== 'performer')) return;
				if (progress.isVerified(lesson, id)) return;
				let ok: boolean;
				try {
					ok = test(event);
				} catch {
					// A predicate that throws is a lesson bug, not a failed checkpoint.
					ok = false;
				}
				if (!ok) return;
				if (count > 1) {
					const k = key ? key(event) : String(seen.length);
					if (seen.includes(k)) return;
					seen = [...seen, k];
					if (seen.length < count) return;
				}
				progress.complete(lesson, id);
				flash = true;
				clearTimeout(flashTimer);
				flashTimer = window.setTimeout(() => (flash = false), 1200);
			});
		}
		return () => {
			unsub?.();
		};
	});

	onDestroy(() => clearTimeout(flashTimer));
</script>

<div
	class={cn(
		'flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors duration-300',
		done ? 'border-ok/45 bg-ok/8' : 'bg-card',
		flash && 'ring-2 ring-ok/50',
		className
	)}
>
	<button
		class={cn(
			'mt-px grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
			done
				? 'border-ok bg-ok text-background'
				: 'border-muted-foreground/40 text-transparent hover:border-foreground'
		)}
		onclick={() => {
			seen = [];
			progress.toggle(lesson, id);
		}}
		aria-pressed={done}
		aria-label="Mark done: {label}"
		title={done ? 'Completed' : 'Tick manually if your hardware will not cooperate'}
	>
		<HugeiconsIcon icon={done ? Tick02Icon : Target02Icon} size={11} strokeWidth={2.4} />
	</button>
	<div class="min-w-0 flex-1">
		<p class={cn('text-sm leading-snug', done && 'text-muted-foreground')}>
			{label}
			{#if done}
				<span class="ml-1.5 text-xs text-muted-foreground"
					>{verified ? 'Verified' : 'Self-checked'}</span
				>
			{/if}
			{#if progressText}
				<span class="ml-1.5 font-mono text-xs text-msg-cc">{progressText}</span>
			{/if}
		</p>
		{#if hint && !done}
			<p class="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
		{/if}
	</div>
</div>
