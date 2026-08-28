<script module lang="ts">
	export interface Play {
		/** What the button says. */
		label: string;
		/** Notes, low to high. */
		notes: number[];
		/**
		 * `sequence` plays them one at a time and then together, which is how you
		 * learn to recognise a distance. `chord` plays them together only, which
		 * is the only way a triad means anything.
		 */
		mode?: 'sequence' | 'chord';
	}
</script>

<script lang="ts">
	/**
	 * A definition you can press.
	 *
	 * This lesson defined a semitone, an interval and a triad in three boxes of
	 * prose and then gave you one button, at the bottom, that played a major
	 * chord and a minor one. So the page said "+7 is a perfect fifth" to a
	 * reader who had no way to find out what a perfect fifth sounds like, and
	 * "twelve of them make an octave" with nothing to count.
	 *
	 * Every card now carries the sound of the thing it defines, and a strip of
	 * keys underneath that lights the notes as they go — because half of what
	 * makes an interval an interval is the *shape* it makes on a keyboard, and a
	 * reader who has just met the word does not yet have that shape in their
	 * head to be reminded of.
	 *
	 * The keys are drawn as equal cells rather than as a real keybed. At this
	 * size a proper keyboard is five slivers and seven slabs and you cannot see
	 * which is lit; equal cells make "these two are adjacent" and "these are
	 * four apart" directly countable, which is the only claim being made.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		title: string;
		/** The lowest key the strip should show. */
		low: number;
		/** How many keys. Thirteen is an octave with both ends. */
		keys?: number;
		plays: Play[];
		/** GM program, so a section can sound like one instrument. */
		program?: number;
		children: import('svelte').Snippet;
		class?: string;
	}
	let { title, low, keys = 13, plays, program = 48, children, class: className }: Props = $props();

	const BLACK = new Set([1, 3, 6, 8, 10]);
	const cells = $derived(
		Array.from({ length: keys }, (_, i) => {
			const n = low + i;
			return { n, black: BLACK.has(((n % 12) + 12) % 12) };
		})
	);

	/** Which keys are lit right now — driven by the schedule, not by the engine. */
	let lit = $state<number[]>([]);
	let running: number[] = [];
	let timers: number[] = [];

	function stop() {
		for (const t of timers) clearTimeout(t);
		timers = [];
		for (const n of running) engine.noteOff(n, 0);
		running = [];
		lit = [];
	}

	function hold(notes: number[], at: number, ms: number) {
		timers.push(
			window.setTimeout(() => {
				for (const n of notes) {
					engine.noteOn(n, 92, 0);
					running.push(n);
				}
				lit = notes;
			}, at)
		);
		timers.push(
			window.setTimeout(() => {
				for (const n of notes) {
					engine.noteOff(n, 0);
					running = running.filter((r) => r !== n);
				}
				lit = lit.filter((l) => !notes.includes(l));
			}, at + ms)
		);
	}

	async function play(p: Play) {
		stop();
		await engine.wake();
		engine.programChange(program, 0);

		if (p.mode === 'chord') {
			hold(p.notes, 0, 1500);
			return;
		}
		// One at a time, then the pair together — the second half is what turns
		// "seven semitones" into a sound you would recognise again.
		const step = 520;
		p.notes.forEach((n, i) => hold([n], i * step, step - 60));
		hold(p.notes, p.notes.length * step + 120, 1400);
	}

	onDestroy(stop);
</script>

<div class={cn('flex flex-col gap-3 rounded-lg border p-4', className)}>
	<div>
		<p class="text-xs font-semibold tracking-wide text-msg-note uppercase">{title}</p>
		<p class="mt-1.5 text-sm leading-relaxed">{@render children()}</p>
	</div>

	<div class="mt-auto flex flex-col gap-2">
		<div class="flex h-7 overflow-hidden rounded-md border">
			{#each cells as cell (cell.n)}
				{@const on = lit.includes(cell.n)}
				<div
					class={cn(
						'min-w-0 flex-1 border-r transition-colors last:border-r-0',
						on ? 'bg-msg-note' : cell.black ? 'bg-key-black' : 'bg-key-white'
					)}
					title={noteName(cell.n, { convention: settings.octaveConvention })}
				></div>
			{/each}
		</div>
		<div class="flex flex-wrap gap-1.5">
			{#each plays as p (p.label)}
				<button
					type="button"
					class="rounded-md border bg-surface-sunken px-2 py-1 text-2xs transition-colors hover:border-foreground/40 hover:bg-accent/40"
					onclick={() => play(p)}
				>
					{p.label}
				</button>
			{/each}
		</div>
	</div>
</div>
