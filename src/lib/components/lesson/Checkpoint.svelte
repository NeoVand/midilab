<script lang="ts">
	/**
	 * A live assertion about the MIDI stream.
	 *
	 * Give it a predicate over bus events; it watches, and ticks itself off the
	 * moment the thing actually happens — on the internal synth or on your OP-XY,
	 * it makes no difference, because both go through the same bus.
	 */
	import { onMount } from 'svelte';
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
		/** Require this many satisfying events (distinct by `key`, if given). */
		count?: number;
		key?: (event: MidiEvent) => string;
		class?: string;
	}

	let { lesson, id, label, hint, test, count = 1, key, class: className }: Props = $props();

	const done = $derived(progress.isDone(lesson, id));
	let seen = $state(new Set<string>());
	let flash = $state(false);

	const progressText = $derived(count > 1 && !done ? `${seen.size} of ${count}` : '');

	onMount(() => {
		progress.register(lesson, id);
		let unsub: (() => void) | undefined;
		if (test) {
			unsub = bus.subscribe((event) => {
				if (progress.isDone(lesson, id)) return;
				let ok: boolean;
				try {
					ok = test(event);
				} catch {
					// A predicate that throws is a lesson bug, not a failed checkpoint.
					ok = false;
				}
				if (!ok) return;
				if (count > 1) {
					const k = key ? key(event) : String(seen.size);
					if (seen.has(k)) return;
					seen = new Set(seen).add(k);
					if (seen.size < count) return;
				}
				progress.complete(lesson, id);
				flash = true;
				setTimeout(() => (flash = false), 1200);
			});
		}
		return () => {
			unsub?.();
			progress.unregister(lesson, id);
		};
	});
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
		onclick={() => progress.toggle(lesson, id)}
		aria-label={done ? 'Mark as not done' : 'Mark as done manually'}
		title={done ? 'Completed' : 'Tick manually if your hardware will not cooperate'}
	>
		<HugeiconsIcon icon={done ? Tick02Icon : Target02Icon} size={12} strokeWidth={2.4} />
	</button>
	<div class="min-w-0 flex-1">
		<p class={cn('text-sm leading-snug', done && 'text-muted-foreground')}>
			{label}
			{#if progressText}
				<span class="ml-1.5 font-mono text-xs text-msg-cc">{progressText}</span>
			{/if}
		</p>
		{#if hint && !done}
			<p class="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
		{/if}
	</div>
</div>
