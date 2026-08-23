<script lang="ts">
	/**
	 * A JavaScript console that drives your actual hardware.
	 *
	 * The editor is a textarea with a highlighted overlay — deliberately not a
	 * full code editor, because the point is the MIDI, not the IDE. Tab inserts
	 * a tab, Cmd/Ctrl+Enter runs, and Stop cancels every timer, interval and
	 * subscription the script created.
	 */
	import { onDestroy, untrack } from 'svelte';
	import { run, type SandboxLog, type SandboxSession } from '$lib/sandbox/api';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		PlayIcon,
		StopIcon,
		Delete02Icon,
		DangerIcon,
		HelpCircleIcon
	} from '@hugeicons/core-free-icons';
	import { engine } from '$lib/midi/engine.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		initial?: string;
		/** Named snippets shown as buttons above the editor. */
		examples?: Array<{ name: string; code: string }>;
		rows?: number;
		class?: string;
	}
	let { initial = '', examples = [], rows = 14, class: className }: Props = $props();

	// Seeded once; after that the editor owns it.
	let code = $state(untrack(() => initial));
	let logs = $state<SandboxLog[]>([]);
	let session = $state<SandboxSession | null>(null);
	let running = $state(false);
	let editor = $state<HTMLTextAreaElement | null>(null);

	async function start() {
		stop();
		logs = [];
		running = true;
		session = await run(code, (l) => (logs = [...logs, l].slice(-200)));
		// Scripts that only register callbacks finish immediately but keep
		// working, so "running" means "has live subscriptions", not "executing".
		running = true;
	}

	function stop() {
		session?.dispose();
		session = null;
		running = false;
	}

	function onKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			start();
			return;
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			const el = e.currentTarget as HTMLTextAreaElement;
			const { selectionStart: s, selectionEnd: t } = el;
			code = code.slice(0, s) + '\t' + code.slice(t);
			queueMicrotask(() => el.setSelectionRange(s + 1, s + 1));
		}
	}

	onDestroy(stop);

	/*
	 * What is in scope.
	 *
	 * A console whose whole promise is "write code that drives your hardware"
	 * has to say what you are allowed to call, or the only usable thing on the
	 * page is the example buttons. Grouped the way you reach for them: send
	 * something, listen for something, keep time, work out a number.
	 */
	const API: Array<{ group: string; entries: Array<[string, string]> }> = [
		{
			group: 'Send',
			entries: [
				['midi.note(note, vel?, ms?, ch?)', 'Play and release. `note` takes 60 or "c3".'],
				['midi.cc(controller, value, ch?)', 'One Control Change.'],
				['midi.program(program, ch?)', 'Program Change. Silent on its own.'],
				['midi.bend(value, ch?)', '14-bit, 0–16383, centre 8192.'],
				['midi.send(bytesOrMessage, at?)', 'Raw bytes or a decoded message, optionally scheduled.'],
				['midi.panic()', 'All Notes Off, All Sound Off, reset — every channel.']
			]
		},
		{
			group: 'Listen',
			entries: [
				['midi.onMessage(fn)', 'Everything on the bus. Returns an unsubscribe.'],
				['midi.onNote(fn)', 'Incoming Note On only — the common case.'],
				['midi.inputs / midi.outputs', 'What is connected right now.'],
				['midi.raw', 'The real MIDIAccess object, if you want it the hard way.']
			]
		},
		{
			group: 'Time',
			entries: [
				['midi.now() / midi.perf()', 'Audio clock and page clock, in seconds and milliseconds.'],
				['midi.toPerf(audioTime)', 'Convert one to the other — Lesson 17 in a function.'],
				['midi.transport.start() / .stop()', 'The same transport as the dock.'],
				['midi.transport.bpm', 'Read or set it.'],
				['midi.transport.onTick(fn)', 'Every 24th of a quarter note, with timestamps.'],
				['sleep(ms)', 'Await it. Cancelled by Stop.']
			]
		},
		{
			group: 'Work it out',
			entries: [
				['midi.freq(n)', 'Equal-tempered hertz for a note number.'],
				['midi.name(n) / midi.parse("c3")', 'Between numbers and names.'],
				['audio.context / audio.now', 'The AudioContext itself, if you want to build with it.'],
				['log(...) / console.log(...)', 'Into the output panel below.']
			]
		}
	];

	/** A deliberately small tokenizer — enough to make the code readable. */
	function highlight(src: string): string {
		const escaped = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return escaped.replace(
			/(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(const|let|var|function|return|if|else|for|while|of|in|await|async|new|class|try|catch|throw|=>)\b|\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b|\b(midi|audio|transport|console|log|sleep)\b/g,
			(m, comment, str, kw, num, api) => {
				if (comment) return `<span class="text-muted-foreground">${comment}</span>`;
				if (str) return `<span class="text-msg-note">${str}</span>`;
				if (kw) return `<span class="text-msg-expr">${kw}</span>`;
				if (num) return `<span class="text-msg-program">${num}</span>`;
				if (api) return `<span class="text-msg-cc">${api}</span>`;
				return m;
			}
		);
	}
</script>

<div class={cn('flex flex-col gap-3', className)}>
	{#if examples.length}
		<div class="flex flex-wrap items-center gap-1.5">
			{#each examples as ex (ex.name)}
				<button
					class="rounded-md border px-2 py-1 text-xs transition-colors hover:border-foreground/40"
					onclick={() => (code = ex.code)}
				>
					{ex.name}
				</button>
			{/each}
			<Popover.Root>
				<Popover.Trigger
					class="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<HugeiconsIcon icon={HelpCircleIcon} size={13} /> What's in scope
				</Popover.Trigger>
				<Popover.Content
					class="flex max-h-[28rem] w-[30rem] scrollbar-thin flex-col gap-3 overflow-y-auto"
					align="end"
				>
					<p class="text-xs leading-relaxed text-muted-foreground">
						Your code runs with these in scope. Timers, intervals and subscriptions you create are
						tracked, so <span class="text-foreground">Stop</span> genuinely stops everything — including
						notes it left holding.
					</p>
					{#each API as section (section.group)}
						<div class="flex flex-col gap-1">
							<p class="label">{section.group}</p>
							{#each section.entries as [sig, meaning] (sig)}
								<div class="grid grid-cols-[13rem_1fr] items-baseline gap-3 py-0.5">
									<code class="font-mono text-2xs text-msg-cc">{sig}</code>
									<span class="text-2xs leading-snug text-muted-foreground">{meaning}</span>
								</div>
							{/each}
						</div>
					{/each}
				</Popover.Content>
			</Popover.Root>
		</div>
	{/if}

	<div class="panel-sunken relative overflow-hidden rounded-lg border">
		<pre
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 overflow-hidden p-3 font-mono text-sm leading-[1.55] break-words whitespace-pre-wrap">{@html highlight(
				code
			) + '\n'}</pre>
		<textarea
			bind:this={editor}
			bind:value={code}
			{rows}
			spellcheck="false"
			onkeydown={onKeyDown}
			class="relative w-full resize-y bg-transparent p-3 font-mono text-sm leading-[1.55] break-words whitespace-pre-wrap text-transparent caret-foreground outline-none"
			aria-label="JavaScript editor"></textarea>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<Button size="sm" class="gap-1.5" onclick={start}>
			<HugeiconsIcon icon={PlayIcon} size={14} /> Run
			<kbd class="ml-1 text-2xs opacity-60">⌘⏎</kbd>
		</Button>
		<Button variant="outline" size="sm" class="gap-1.5" onclick={stop} disabled={!running}>
			<HugeiconsIcon icon={StopIcon} size={14} /> Stop
		</Button>
		<Button variant="ghost" size="sm" class="gap-1.5" onclick={() => (logs = [])}>
			<HugeiconsIcon icon={Delete02Icon} size={14} /> Clear
		</Button>
		<Button
			variant="ghost"
			size="sm"
			class="gap-1.5 text-destructive"
			onclick={() => {
				stop();
				engine.panic();
			}}
		>
			<HugeiconsIcon icon={DangerIcon} size={14} /> Stop &amp; panic
		</Button>
		<span class="text-xs text-muted-foreground">
			{running ? 'Running — timers and subscriptions are live.' : 'Idle.'}
		</span>
	</div>

	<div class="panel-sunken max-h-56 min-h-16 scrollbar-thin overflow-y-auto rounded-lg border p-3">
		{#if logs.length === 0}
			<p class="text-xs text-muted-foreground">
				Output appears here. Use <code class="rounded-sm bg-muted px-1 font-mono">log(...)</code> or
				<code class="rounded-sm bg-muted px-1 font-mono">console.log(...)</code>.
			</p>
		{:else}
			{#each logs as l, i (i)}
				<pre
					class={cn(
						'font-mono text-xs leading-relaxed whitespace-pre-wrap',
						l.level === 'error' && 'text-destructive',
						l.level === 'warn' && 'text-warn'
					)}>{l.text}</pre>
			{/each}
		{/if}
	</div>
</div>
