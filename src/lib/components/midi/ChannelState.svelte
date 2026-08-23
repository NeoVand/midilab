<script lang="ts">
	/**
	 * The state view: not what happened, but where you are.
	 *
	 * A scrolling log answers "did that message arrive". It is much worse at
	 * answering "why is this channel quiet" or "what is the mod wheel sitting
	 * at", because the answer scrolled away four hundred messages ago. This
	 * shows the standing state of every channel that has been used — notes
	 * held, bend, pressure, program, and every controller that has been touched
	 * — and it shows nothing at all for the channels that are not in play, so
	 * the display is always the shape of your actual rig.
	 */
	import { noteState } from '$lib/midi/notestate.svelte';
	import { channelColour } from '$lib/midi/channelcolour';
	import { ccName, gmProgramName } from '$lib/midi/constants';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import EmptyState from '$lib/components/shell/EmptyState.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Grid3X3Icon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	const used = $derived(noteState.usedChannels);

	function snapshot(c: number) {
		const s = noteState.channel(c);
		return {
			notes: [...s.notes.entries()].sort((a, b) => a[0] - b[0]),
			cc: [...s.cc.entries()].sort((a, b) => a[0] - b[0]),
			bend: s.bend,
			pressure: s.pressure,
			program: s.program
		};
	}
</script>

{#if used.length === 0}
	<EmptyState
		icon={Grid3X3Icon}
		title="No channel has been used yet"
		body="Play something. A channel appears here the moment it carries a message and then stays, showing what it is currently holding — notes, bend, pressure, program and every controller that has been moved."
		class={className}
	/>
{:else}
	<div class={cn('flex flex-col gap-3', className)}>
		{#each used as c (c)}
			{@const s = snapshot(c)}
			{@const colour = channelColour(c)}
			<section class="overflow-hidden rounded-lg border bg-card">
				<header class="flex items-baseline gap-2.5 border-b px-3 py-2" style:border-color={colour}>
					<span class="tnum font-mono text-sm" style:color={colour}>
						{String(c + 1).padStart(2, '0')}
					</span>
					<span class="min-w-0 flex-1 truncate text-sm">
						{c === 9 ? 'General MIDI drum kit' : gmProgramName(s.program)}
					</span>
					<span class="tnum shrink-0 font-mono text-2xs text-muted-foreground">
						{s.notes.length ? `${s.notes.length} held` : 'idle'}
					</span>
				</header>

				<dl class="flex flex-col">
					{#if s.notes.length}
						<div class="grid grid-cols-[3.25rem_1fr] gap-3 px-3 py-2">
							<dt class="label pt-0.5">Notes</dt>
							<dd class="flex flex-wrap gap-1.5">
								{#each s.notes as [note, velocity] (note)}
									<span
										class="flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5"
										style:border-color={colour}
									>
										<span class="font-mono text-2xs">
											{noteName(note, { convention: settings.octaveConvention })}
										</span>
										<span class="h-2.5 w-8 overflow-hidden rounded-full bg-muted">
											<span
												class="block h-full rounded-full"
												style:width="{(velocity / 127) * 100}%"
												style:background={colour}
											></span>
										</span>
										<span class="tnum font-mono text-2xs text-muted-foreground">{velocity}</span>
									</span>
								{/each}
							</dd>
						</div>
					{/if}

					{#if s.bend !== 8192}
						<div class="grid grid-cols-[3.25rem_1fr] items-center gap-3 border-t px-3 py-2">
							<dt class="label">Bend</dt>
							<dd class="flex items-center gap-3">
								<!-- Centre-out, because that is what a bend wheel does. -->
								<span class="relative h-1.5 w-full max-w-80 rounded-full bg-muted">
									<span class="absolute inset-y-0 left-1/2 w-px bg-border"></span>
									<span
										class="absolute inset-y-0 rounded-full"
										style:background={colour}
										style:left="{Math.min(50, (s.bend / 16383) * 100)}%"
										style:right="{Math.min(50, 100 - (s.bend / 16383) * 100)}%"
									></span>
								</span>
								<span
									class="tnum w-14 shrink-0 text-right font-mono text-2xs text-muted-foreground"
								>
									{s.bend > 8192 ? '+' : ''}{s.bend - 8192}
								</span>
							</dd>
						</div>
					{/if}

					{#if s.pressure > 0}
						<div class="grid grid-cols-[3.25rem_1fr] items-center gap-3 border-t px-3 py-2">
							<dt class="label">Pressure</dt>
							<dd class="flex items-center gap-3">
								<span class="h-1.5 w-full max-w-80 overflow-hidden rounded-full bg-muted">
									<span
										class="block h-full rounded-full"
										style:width="{(s.pressure / 127) * 100}%"
										style:background={colour}
									></span>
								</span>
								<span
									class="tnum w-14 shrink-0 text-right font-mono text-2xs text-muted-foreground"
								>
									{s.pressure}
								</span>
							</dd>
						</div>
					{/if}

					{#if s.cc.length}
						<div class="grid grid-cols-[3.25rem_1fr] gap-3 border-t px-3 py-2">
							<dt class="label pt-0.5">Control</dt>
							<dd class="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
								{#each s.cc as [controller, value] (controller)}
									<span class="flex items-center gap-2">
										<span
											class="tnum w-5 shrink-0 text-right font-mono text-2xs text-muted-foreground"
										>
											{controller}
										</span>
										<span class="min-w-0 flex-1 truncate text-2xs">{ccName(controller)}</span>
										<span class="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
											<span
												class="block h-full rounded-full bg-msg-cc"
												style:width="{(value / 127) * 100}%"
											></span>
										</span>
										<span
											class="tnum w-6 shrink-0 text-right font-mono text-2xs text-muted-foreground"
										>
											{value}
										</span>
									</span>
								{/each}
							</dd>
						</div>
					{/if}
				</dl>
			</section>
		{/each}
	</div>
{/if}
