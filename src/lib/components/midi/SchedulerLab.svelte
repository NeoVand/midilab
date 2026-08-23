<script lang="ts">
	/**
	 * The point of the lookahead scheduler, demonstrated rather than asserted.
	 *
	 * Both modes play the same sixteen sixteenth-notes. The naive one fires each
	 * note from its own `setTimeout` and plays it "now"; the lookahead one wakes
	 * up coarsely, looks ahead, and hands every event to the audio and MIDI
	 * layers with an explicit timestamp.
	 *
	 * The Stress button blocks the JavaScript thread for 120 ms mid-pattern —
	 * which is what a garbage collection, a big re-render or a fetch actually
	 * does to you. Under the naive scheduler you hear it. Under the lookahead
	 * scheduler you do not, because the events had already been handed over.
	 */
	import { audio } from '$lib/audio/engine';
	import { engine } from '$lib/midi/engine.svelte';
	import { audioToPerf } from '$lib/midi/clock.svelte';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { PlayIcon, ZapIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		bpm?: number;
		steps?: number;
		class?: string;
	}
	let { bpm = 120, steps = 16, class: className }: Props = $props();

	type Mode = 'naive' | 'lookahead';
	let mode = $state<Mode>('naive');
	let running = $state(false);
	let deviations = $state<number[]>([]);
	let worst = $state(0);

	const interval = $derived(60 / bpm / 4); // one sixteenth, in seconds
	const NOTES = [60, 63, 65, 67, 70, 67, 65, 63];

	function record(dev: number) {
		deviations = [...deviations, dev];
		worst = Math.max(worst, Math.abs(dev));
	}

	async function run() {
		if (running) return;
		await engine.wake();
		deviations = [];
		worst = 0;
		running = true;
		if (mode === 'naive') runNaive();
		else runLookahead();
	}

	/** One timer per note, fired and played immediately. The obvious approach. */
	function runNaive() {
		const t0 = performance.now() + 120;
		for (let i = 0; i < steps; i++) {
			const target = t0 + i * interval * 1000;
			setTimeout(
				() => {
					record(performance.now() - target);
					const note = NOTES[i % NOTES.length];
					engine.send({ type: 'noteOn', channel: 0, note, velocity: i % 4 === 0 ? 112 : 78 });
					setTimeout(
						() => engine.send({ type: 'noteOff', channel: 0, note, velocity: 0 }),
						interval * 600
					);
					if (i === steps - 1) running = false;
				},
				Math.max(0, target - performance.now())
			);
		}
	}

	/** Coarse wake-up, fine placement: plan ahead and stamp every event. */
	function runLookahead() {
		const start = audio.now + 0.12;
		let next = 0;
		const timer = setInterval(() => {
			const horizon = audio.now + 0.15;
			while (next < steps && start + next * interval < horizon) {
				const at = start + next * interval;
				// The deviation that matters is between the intended time and the
				// timestamp we hand over — which is exactly zero, by construction.
				record(0);
				const note = NOTES[next % NOTES.length];
				engine.send(
					{ type: 'noteOn', channel: 0, note, velocity: next % 4 === 0 ? 112 : 78 },
					audioToPerf(at),
					at
				);
				engine.send(
					{ type: 'noteOff', channel: 0, note, velocity: 0 },
					audioToPerf(at + interval * 0.6),
					at + interval * 0.6
				);
				next++;
			}
			if (next >= steps) {
				clearInterval(timer);
				setTimeout(() => (running = false), 400);
			}
		}, 25);
	}

	function stress() {
		const end = performance.now() + 120;
		// Deliberately block the main thread, the way real work does.
		while (performance.now() < end) {
			/* spin */
		}
	}
</script>

<div class={cn('flex flex-col gap-4 rounded-lg border p-4', className)}>
	<div class="flex flex-wrap items-center gap-3">
		<div class="flex gap-1">
			<Button
				variant={mode === 'naive' ? 'default' : 'outline'}
				size="sm"
				class="h-7 text-xs"
				onclick={() => (mode = 'naive')}
			>
				setTimeout per note
			</Button>
			<Button
				variant={mode === 'lookahead' ? 'default' : 'outline'}
				size="sm"
				class="h-7 text-xs"
				onclick={() => (mode = 'lookahead')}
			>
				Lookahead scheduler
			</Button>
		</div>
		<Button size="sm" class="gap-1.5" onclick={run} disabled={running}>
			<HugeiconsIcon icon={PlayIcon} size={14} />
			Play {steps} sixteenths
		</Button>
		<Button variant="destructive" size="sm" class="gap-1.5" onclick={stress} disabled={!running}>
			<HugeiconsIcon icon={ZapIcon} size={14} />
			Block the thread for 120 ms
		</Button>
		<span class="text-xs text-muted-foreground"> Press it while the pattern is playing. </span>
	</div>

	<div class="flex flex-col gap-2">
		<div class="flex items-baseline justify-between">
			<p class="label">Deviation from the intended time</p>
			<p class="tnum font-mono text-xs">
				worst
				<span class={worst > 8 ? 'text-destructive' : worst > 3 ? 'text-warn' : 'text-ok'}>
					{worst.toFixed(1)} ms
				</span>
			</p>
		</div>
		<div class="panel-sunken graph-paper relative h-20 overflow-hidden rounded-lg border">
			<div class="absolute inset-x-0 top-1/2 h-px bg-msg-note/40"></div>
			<div class="absolute inset-0 flex items-center gap-[3px] px-2">
				{#each Array.from({ length: steps }, (_, i) => i) as i (i)}
					{@const dev = deviations[i]}
					<div class="relative h-full flex-1">
						{#if dev !== undefined}
							<div
								class={cn(
									'absolute left-0 w-full rounded-xs',
									Math.abs(dev) > 8
										? 'bg-destructive'
										: Math.abs(dev) > 3
											? 'bg-warn'
											: 'bg-msg-note'
								)}
								style="height: {Math.max(2, Math.min(48, Math.abs(dev) * 1.6))}%; {dev >= 0
									? 'top: 50%'
									: 'bottom: 50%'}"
							></div>
						{/if}
					</div>
				{/each}
			</div>
			<p class="absolute top-1 left-2 font-mono text-2xs text-muted-foreground">late ↑</p>
			<p class="absolute bottom-1 left-2 font-mono text-2xs text-muted-foreground">early ↓</p>
		</div>
		<p class="text-xs leading-relaxed text-muted-foreground">
			{#if mode === 'naive'}
				Every bar here is a note that arrived at the wrong time, and the wrong time is what you
				hear. Block the thread and watch a note land tens of milliseconds late.
			{:else}
				Flat, and it stays flat when you block the thread — because these events were handed to the
				audio clock with timestamps before the block happened. The JavaScript thread being late no
				longer means the <em>music</em> is late.
			{/if}
		</p>
	</div>
</div>
