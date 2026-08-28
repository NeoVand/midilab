<script lang="ts">
	/**
	 * A bank of instruments, laid out like a bank of instruments.
	 *
	 * The row this replaces was nine text pills of ragged width carrying nine
	 * full General MIDI names — "Acoustic Grand Piano", "Lead 1 (square)" — and
	 * it read as a paragraph of labels rather than as a control. You had to read
	 * every word to find the one you wanted.
	 *
	 * Each tile carries a drawing of the instrument and the program number that
	 * selects it. The drawing is what the eye lands on; the number is what
	 * actually travels down the cable when you press the tile, and the lesson
	 * beside this one says "use sound number n" in those words. See
	 * `InstrumentGlyph` for why those drawings are hand-made rather than taken
	 * from the icon set the rest of the app uses.
	 */
	import { gmProgramName } from '$lib/midi/constants';
	import InstrumentGlyph from './InstrumentGlyph.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/** GM programs to offer. */
		voices: number[];
		value: number;
		onValue?: (program: number) => void;
		class?: string;
	}
	let { voices, value = $bindable(), onValue, class: className }: Props = $props();

	/**
	 * The name, minus the bookkeeping.
	 *
	 * General MIDI numbers its variants — "String Ensemble 1", "Lead 1
	 * (square)" — and that index means nothing without the ones you are not
	 * being shown. The parenthetical is the part that actually distinguishes
	 * one, so that stays.
	 */
	function label(program: number): string {
		return gmProgramName(program)
			.replace(/\s\d+(?=\s|$)/g, '')
			.trim();
	}

	function pick(program: number) {
		value = program;
		onValue?.(program);
	}
</script>

<div class={cn('grid grid-cols-2 gap-1.5 sm:grid-cols-3', className)}>
	{#each voices as program (program)}
		{@const on = value === program}
		<button
			type="button"
			class={cn(
				'flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
				on ? 'border-msg-program bg-msg-program-bg' : 'bg-surface-sunken hover:border-foreground/30'
			)}
			aria-pressed={on}
			aria-label="{gmProgramName(program)}, program {program}"
			onclick={() => pick(program)}
		>
			<InstrumentGlyph
				{program}
				size={18}
				class={cn('shrink-0', on ? 'text-msg-program' : 'text-muted-foreground')}
			/>
			<span class="flex min-w-0 flex-1 flex-col leading-tight">
				<span
					class={cn('truncate text-xs', on ? 'font-medium text-msg-program' : 'text-foreground/85')}
				>
					{label(program)}
				</span>
				<span
					class={cn(
						'tnum font-mono text-3xs',
						on ? 'text-msg-program/80' : 'text-muted-foreground/70'
					)}
				>
					program {program}
				</span>
			</span>
		</button>
	{/each}
</div>
