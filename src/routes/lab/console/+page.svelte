<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import CodeSandbox from '$lib/components/midi/CodeSandbox.svelte';
	import MidiMonitor from '$lib/components/midi/MidiMonitor.svelte';
	import Scope from '$lib/components/midi/Scope.svelte';

	const EXAMPLES = [
		{
			name: 'Scale run',
			code: `for (let i = 0; i < 8; i++) {
	midi.note(60 + [0,2,4,5,7,9,11,12][i], 90, 180, 0);
	await sleep(200);
}
log('done');`
		},
		{
			name: 'Arpeggiator from your controller',
			code: `// Hold a note; it arpeggiates upward until you stop the script.
let held = [];
midi.onMessage((e) => {
	if (e.direction !== 'in') return;
	if (e.message.type === 'noteOn')  held = [...held, e.message.note];
	if (e.message.type === 'noteOff') held = held.filter(n => n !== e.message.note);
});

let i = 0;
setInterval(() => {
	if (!held.length) return;
	const base = held[i % held.length];
	const octave = Math.floor(i / held.length) % 3;
	midi.note(base + octave * 12, 88, 110, 0);
	i++;
}, 130);

log('play and hold a chord on your controller');`
		},
		{
			name: 'CC sweep',
			code: `const drone = 45;
midi.send({ type: 'noteOn', channel: 0, note: drone, velocity: 96 });
for (let v = 0; v <= 127; v += 2) {
	midi.cc(74, v);
	await sleep(25);
}
for (let v = 127; v >= 0; v -= 2) {
	midi.cc(74, v);
	await sleep(25);
}
midi.send({ type: 'noteOff', channel: 0, note: drone, velocity: 0 });
log('swept CC 74 up and down');`
		},
		{
			name: 'Probe a device',
			code: `// Universal Identity Request. Needs SysEx enabled in the dock.
midi.send([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
midi.onMessage((e) => {
	if (e.direction === 'in' && e.message.type === 'sysex') {
		log('reply:', e.bytes.map(b => b.toString(16).padStart(2,'0')).join(' '));
	}
});
log('asked; listening for a reply');`
		},
		{
			name: 'Panic',
			code: `midi.panic();
log('all notes off, all sound off, controllers reset, on every channel');`
		}
	];
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8">
	<PageHeader
		title="Console"
		lead="JavaScript that drives your actual hardware. Everything it sends appears in the monitor below, and Stop cancels every timer and subscription it created."
		back={{ href: '/lab', label: 'Lab' }}
	/>

	<div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
		<CodeSandbox initial={EXAMPLES[0].code} examples={EXAMPLES} rows={20} />
		<div class="flex flex-col gap-4">
			<Scope height={80} />
			<div class="h-96 overflow-hidden rounded-lg border">
				<MidiMonitor class="h-full" />
			</div>
		</div>
	</div>
</div>
