<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import CodeSandbox from '$lib/components/midi/CodeSandbox.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
	import { lessonById } from '$lib/curriculum/registry';

	const meta = lessonById('web-midi')!;

	const EXAMPLES = [
		{
			name: 'List the ports',
			code: `// Everything the operating system reports, as this page sees it.
for (const out of midi.outputs) log('OUT', out.name, '·', out.kind);
for (const inp of midi.inputs) log('IN ', inp.name, inp.listening ? '(listening)' : '');`
		},
		{
			name: 'Send raw bytes',
			code: `// The three bytes you have been reading since Act I.
midi.send([0x90, 60, 100]);              // Note On, middle C, velocity 100
setTimeout(() => midi.send([0x80, 60, 0]), 500);   // and its Note Off

log('sent 90 3C 64');`
		},
		{
			name: 'Watch what arrives',
			code: `// Every message on the bus, in and out.
midi.onMessage((e) => {
	if (e.direction !== 'in') return;
	log(e.time.toFixed(0), e.portName, e.message.type, JSON.stringify(e.message));
});

log('listening — play your controller');`
		},
		{
			name: 'The raw Web MIDI API',
			code: `// No helpers. This is exactly what the platform gives you.
const access = midi.raw;
if (!access) { log('Connect MIDI in the dock first.'); }
else {
	for (const input of access.inputs.values()) log('IN ', input.id, input.name, input.state);
	for (const output of access.outputs.values()) log('OUT', output.id, output.name, output.state);

	// Hot-plug: fires whenever a device appears or disappears.
	access.onstatechange = (e) => log('state change:', e.port?.name, e.port?.state);
	log('hot-plug watcher installed — unplug something');
}`
		},
		{
			name: 'A chord, scheduled',
			code: `// Timestamps in the performance.now() domain. The MIDI subsystem
// delivers them, not your JavaScript.
const t = midi.perf() + 200;
for (const [i, note] of [60, 64, 67, 71].entries()) {
	midi.send({ type: 'noteOn',  channel: 0, note, velocity: 90 }, t + i * 120);
	midi.send({ type: 'noteOff', channel: 0, note, velocity: 0  }, t + i * 120 + 400);
}
log('four notes scheduled ahead of time');`
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="text-base leading-relaxed">
			Everything this app does, it does with one browser API. It is small — about six things worth
			knowing — and you already understand the hard part, which is what the bytes mean.
		</p>
		<pre
			class="scrollbar-thin overflow-x-auto rounded-lg border bg-surface-sunken p-4 font-mono text-sm leading-relaxed"><code
				>{`// Secure context required: https, or localhost.
const access = await navigator.requestMIDIAccess({ sysex: false });

for (const input of access.inputs.values())   console.log('IN ', input.name);
for (const output of access.outputs.values()) console.log('OUT', output.name);

const out = [...access.outputs.values()][0];
out.send([0x90, 60, 100]);                     // now
out.send([0x80, 60, 0], performance.now() + 500);  // in half a second

const inp = [...access.inputs.values()][0];
inp.onmidimessage = (e) => console.log(e.data); // a Uint8Array

access.onstatechange = (e) => console.log(e.port.name, e.port.state);`}</code
			></pre>
	</Section>

	<Section title="The four things that will catch you out">
		<div class="grid gap-3 sm:grid-cols-2">
			{#each [['Safari has none', 'Web MIDI does not exist in Safari on macOS or iOS. Not partially, not behind a flag. Chromium browsers and Firefox only — and no iPhone or iPad at all.'], ['Secure context', 'HTTPS or localhost. A page served over plain http on another machine gets nothing, which is a surprisingly common way to lose an afternoon.'], ['Permission for everything', 'Chrome 124 and later prompt for all MIDI access, not just SysEx. Request it from a user gesture and handle the rejection.'], ['SysEx is a second gate', 'requestMIDIAccess({ sysex: true }) triggers its own prompt, because SysEx can reach firmware. Ask for it only when you need it.']] as [title, body] (title)}
				<div class="rounded-lg border p-4">
					<p class="text-sm font-semibold">{title}</p>
					<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
				</div>
			{/each}
		</div>
		<Callout variant="key" title="Web MIDI gives you complete messages">
			<p>
				Unlike a raw serial stream, <code class="rounded-sm bg-muted px-1">onmidimessage</code>
				hands you one whole message per event, with the status byte restored even if running status
				was used on the wire. You never have to implement a streaming parser to <em>receive</em> — only
				to read MIDI files.
			</p>
			<p class="mt-2">
				The same applies going out: <code class="rounded-sm bg-muted px-1">send()</code> wants a complete
				message. Do not try to be clever with running status; it will be rejected.
			</p>
		</Callout>
	</Section>

	<TryThis title="Write some">
		<p class="text-sm leading-relaxed">
			This runs in the page, against the engine you have been using all course — so it reaches the
			internal synth and any hardware you have enabled in the dock, and everything it sends appears
			in the monitor. Stop cancels every timer and subscription your code created.
		</p>
		<CodeSandbox initial={EXAMPLES[1].code} examples={EXAMPLES} rows={12} />
	</TryThis>

	<Section title="The API you have here">
		<div class="overflow-hidden rounded-lg border">
			<table class="w-full text-sm">
				<tbody>
					{#each [['midi.outputs / midi.inputs', 'The port lists, as plain objects.'], ['midi.raw', 'The actual MIDIAccess object, for doing it the platform way.'], ['midi.send(bytes | message, at?)', 'Raw byte array or a decoded message. `at` is a performance.now() timestamp.'], ['midi.note(n, vel, ms, ch)', 'Note On plus a scheduled Note Off — the lifecycle handled for you.'], ['midi.cc / .program / .bend / .panic', 'The obvious shorthands.'], ['midi.onMessage(fn) / midi.onNote(fn)', 'Subscribe to the bus. Returns an unsubscribe function.'], ['midi.now() / midi.perf() / midi.toPerf(t)', 'The audio clock, the page clock, and the map between them.'], ['midi.transport', 'start, stop, bpm, onTick — the app’s own scheduler.'], ['sleep(ms)', 'Awaitable pause that Stop can interrupt.']] as [sig, what] (sig)}
						<tr class="border-t first:border-t-0">
							<td class="w-72 px-3 py-2 align-top font-mono text-xs text-msg-cc">{sig}</td>
							<td class="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{what}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-sm text-muted-foreground">
			These are conveniences over the same platform API — nothing here is unavailable to you in your
			own project.
		</p>
	</Section>

	<Section title="Your ports">
		<DevicePanel />
	</Section>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="list"
			label="List your ports from code"
			hint="Run the first example."
		/>
		<Checkpoint
			lesson={meta.id}
			id="raw"
			label="Send a note as raw bytes"
			hint="midi.send([0x90, 60, 100])"
			test={(e) => e.direction === 'out' && e.message.type === 'noteOn'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="receive"
			label="Receive and log an incoming message"
			hint="Needs hardware. Run the watcher example and play something."
			test={(e) => e.direction === 'in' && e.message.type !== 'clock'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="scheduled"
			label="Send something with a future timestamp"
			hint="The scheduled-chord example."
			count={4}
			key={(e) => String(e.id)}
			test={(e) => e.direction === 'out' && e.message.type === 'noteOn'}
		/>
	</Checkpoints>
</LessonShell>
