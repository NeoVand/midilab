<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { engine } from '$lib/midi/engine.svelte';
	import { midiAccess } from '$lib/midi/access.svelte';
	import { bus, type MidiEvent, type MidiOrigin } from '$lib/midi/bus';
	import { MpeInputState, type MpeVoiceSnapshot } from '$lib/midi/mpe-state';
	import { MpeMonitor } from '$lib/audio/mpe-monitor';
	import {
		makeZone,
		configureZone,
		noteOnMessages,
		ZoneAllocator,
		type MpeNote,
		type ZoneSide
	} from '$lib/midi/mpe';
	import { noteName } from '$lib/midi/notes';
	import { unitToBend, bendToUnit, type MidiMessage } from '$lib/midi/messages';
	import { settings } from '$lib/stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Field from '$lib/components/ui/field';
	import * as NativeSelect from '$lib/components/ui/native-select';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { capturePointer, cn } from '$lib/utils';
	import { markPerformanceInput } from '$lib/a11y/focus-mode';

	type Achievement = 'configure' | 'member' | 'per-note-bend' | 'pressure' | 'slide';
	type Gesture = 'lean' | 'bloom' | 'color';
	interface Props {
		lowNote?: number;
		noteCount?: number;
		onAchievement?: (id: Achievement) => void;
		class?: string;
	}
	let { lowNote = 48, noteCount = 25, onAchievement, class: className }: Props = $props();
	const uid = $props.id();
	const live = new MpeInputState();
	const demo = new MpeInputState();
	const allocator = new ZoneAllocator(makeZone('lower', 15, 48));
	const owned = new SvelteMap<string, MpeNote>();
	const pointerStarts = new SvelteMap<number, number>();
	const rpnStages = new SvelteMap<number, number>();
	const achievementSet = new SvelteSet<Achievement>();
	const KEYS = [0, 4, 7, 11, 12, 16, 19, 24];
	const GESTURES: {
		id: Gesture;
		label: string;
		title: string;
		description: string;
		try: string;
	}[] = [
		{
			id: 'lean',
			label: 'Lean into home',
			title: 'Move one voice; keep a place to return to',
			description:
				'A quiet C stays still while G leans below its pitch, settles into the fifth, then adds a small vibrato. The motion has an arrival.',
			try: 'Hold C and G. Bend G a little flat, return to its centre, and leave C alone.'
		},
		{
			id: 'bloom',
			label: 'Let one voice bloom',
			title: 'A chord can breathe from the inside',
			description:
				'A chord begins quietly. Only the top voice grows in pressure, then recedes before the chord releases. More expression can also mean knowing when to stop.',
			try: 'Hold C and E. Grow the pressure of E, ease it back, and listen to the C remain steady.'
		},
		{
			id: 'color',
			label: 'Color an answer',
			title: 'Let a change in color answer the first gesture',
			description:
				'C anchors two short upper-note gestures. The second opens its filter and softens again before the ending. CC74 has a shape instead of staying at its maximum.',
			try: 'Hold a dyad. Open one note’s CC74, then close it partway. Keep the other voice unchanged.'
		}
	];
	let source = $state('surface');
	let side = $state<ZoneSide>('lower');
	let memberCount = $state(15);
	let memberRange = $state(48);
	let selectedChannel = $state<number | null>(null);
	let liveVoices = $state.raw<MpeVoiceSnapshot[]>([]);
	let demoVoices = $state.raw<MpeVoiceSnapshot[]>([]);
	let stats = $state.raw(live.stats);
	let zone = $state.raw(live.zone);
	let master = $state.raw(live.master);
	let ranges = $state<number[]>(
		Array.from({ length: 16 }, (_, channel) => live.getBendRange(channel))
	);
	let achievements = $state<Achievement[]>([]);
	let masterNotes = $state(0);
	let outsideNotes = $state(0);
	let lastMessage = $state('Waiting for a note');
	let localHeld = $state<number[]>([]);
	let error = $state('');
	let soundEnabled = $state(false);
	let enabling = $state(false);
	let soundVoices = $state(0);
	let gesture = $state<Gesture>('lean');
	let demoPending = $state(false);
	let demoRunning = $state(false);
	let displayDemo = $state(false);
	let demoProgress = $state(0);
	let monitor: MpeMonitor | undefined;
	let demoTimer = 0;
	let demoSession = 0;
	let soundSession = 0;
	let disposed = false;
	let updatingSound = false;
	const active = $derived(liveVoices.filter((voice) => voice.held || voice.sustained));
	const visualVoices = $derived((displayDemo ? demoVoices : liveVoices).slice(-10));
	const selected = $derived(
		active.find((voice) => voice.channel === selectedChannel) ?? active.at(-1)
	);
	const choice = $derived(GESTURES.find((item) => item.id === gesture)!);
	const input = $derived(midiAccess.inputs.find((port) => port.id === source));
	const isSurface = $derived(source === 'surface');
	const axisNotes = $derived([
		lowNote,
		lowNote + Math.floor((noteCount - 1) / 2),
		lowNote + noteCount - 1
	]);
	const selectedBend = $derived(
		selected ? bendToUnit(selected.bend) * ranges[selected.channel] : 0
	);
	const bendLimit = $derived(Math.max(2, Math.ceil(Math.abs(selectedBend))));
	const signed = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
	const name = (note: number) => noteName(note, { convention: settings.octaveConvention });
	const plotX = (note: number, bend = 0) =>
		Math.max(38, Math.min(926, 64 + ((note + bend - lowNote) / Math.max(1, noteCount - 1)) * 832));
	const plotY = (pressure: number) => 250 - (pressure / 127) * 190;
	const voiceColor = (value: number) =>
		`color-mix(in oklch, var(--msg-clock) ${100 - (value / 127) * 100}%, var(--msg-program))`;
	function trace(voice: MpeVoiceSnapshot) {
		return voice.history
			.map(
				(point, index) =>
					`${index ? 'L' : 'M'}${plotX(voice.note, point.pitchSemitones)},${plotY(point.pressure)}`
			)
			.join(' ');
	}

	function achievement(id: Achievement) {
		if (achievementSet.has(id)) return;
		achievementSet.add(id);
		achievements = [...achievementSet];
		onAchievement?.(id);
	}
	function refreshLive() {
		liveVoices = live.voices;
		stats = live.stats;
		if (
			zone.side !== live.zone.side ||
			zone.members.length !== live.zone.members.length ||
			zone.memberBendRange !== live.zone.memberBendRange
		) {
			side = live.zone.side;
			memberCount = live.zone.members.length;
			memberRange = live.zone.memberBendRange;
		}
		zone = live.zone;
		master = live.master;
		ranges = Array.from({ length: 16 }, (_, channel) => live.getBendRange(channel));
		if (active.length && !active.some((voice) => voice.channel === selectedChannel))
			selectedChannel = active.at(-1)?.channel ?? null;
	}
	function assess() {
		if (live.active.some((voice) => voice.held && live.zone.members.includes(voice.channel)))
			achievement('member');
		if (live.stats.independentBend) achievement('per-note-bend');
		if (live.stats.independentPressure) achievement('pressure');
		if (live.stats.independentTimbre) achievement('slide');
	}
	function updateSound(state: MpeInputState, origin: MidiOrigin) {
		updatingSound = true;
		monitor?.update(state.active, origin);
		updatingSound = false;
	}
	function messageLabel(message: MidiMessage) {
		if (!('channel' in message)) return message.type;
		const ch = `ch ${message.channel + 1}`;
		if (message.type === 'pitchBend') return `${ch} · Pitch Bend ${message.value}`;
		if (message.type === 'channelAftertouch') return `${ch} · Channel Pressure ${message.pressure}`;
		if (message.type === 'controlChange') return `${ch} · CC${message.controller} ${message.value}`;
		if (message.type === 'noteOn' || message.type === 'noteOff')
			return `${ch} · ${message.type === 'noteOn' ? 'Note On' : 'Note Off'} ${name(message.note)} · ${message.velocity}`;
		return `${ch} · ${message.type}`;
	}
	function receive(message: MidiMessage, time: number, origin: MidiOrigin) {
		if (origin !== 'performer') return;
		if (message.type === 'noteOn' && message.velocity > 0) {
			if (displayDemo || demoPending) stopDemo();
			if (message.channel === live.zone.master) masterNotes++;
			else if (!live.zone.members.includes(message.channel)) outsideNotes++;
		}
		if (message.type === 'controlChange') {
			let stage = rpnStages.get(message.channel) ?? 0;
			if (message.controller === 101) stage = message.value === 0 ? 1 : 0;
			else if (message.controller === 100) stage = stage === 1 && message.value === 6 ? 2 : 0;
			else if (message.controller === 6 && stage === 2) {
				if (message.channel === live.zone.master && message.value > 0) achievement('configure');
				stage = 0;
			} else if (message.controller === 98 || message.controller === 99) stage = 0;
			rpnStages.set(message.channel, stage);
		}
		lastMessage = messageLabel(message);
		if (!live.push(message, time)) return;
		refreshLive();
		monitor?.setInput(isSurface ? null : source, zone, true);
		assess();
		updateSound(live, 'performer');
	}
	function sendLocal(message: MidiMessage, origin: MidiOrigin = 'performer') {
		engine.sendInternal(message, origin, false);
		if (origin === 'demo') {
			demo.push(message, performance.now());
			demoVoices = demo.voices;
		} else if (isSurface) receive(message, performance.now(), origin);
	}
	async function enableSound() {
		if (!monitor || enabling) return;
		stopDemo();
		const token = ++soundSession;
		enabling = true;
		error = '';
		const started = await monitor.enable();
		if (disposed || token !== soundSession) return;
		enabling = false;
		soundEnabled = started;
		if (!started) {
			error = 'Browser sound could not start. Try Enable browser sound again.';
			return;
		}
		updateSound(displayDemo ? demo : live, displayDemo ? 'demo' : 'performer');
	}
	function muteSound() {
		stopDemo();
		soundSession++;
		enabling = false;
		monitor?.disable();
		soundEnabled = false;
	}
	function releaseLocal(key: string) {
		const voice = owned.get(key);
		if (!voice) return;
		owned.delete(key);
		allocator.release(voice.channel);
		sendLocal({ type: 'noteOff', channel: voice.channel, note: voice.note, velocity: 64 });
		sendLocal({ type: 'pitchBend', channel: voice.channel, value: 8192 });
		sendLocal({ type: 'channelAftertouch', channel: voice.channel, pressure: 0 });
		localHeld = [...owned.values()].map((item) => item.note);
	}
	function beginLocal(key: string, note: number, pressure = 38, timbre = 58) {
		stopDemo();
		error = '';
		const voice = allocator.allocate(note, 84);
		if (!voice) return;
		for (const [oldKey, old] of owned)
			if (old.channel === voice.channel) {
				owned.delete(oldKey);
				if (oldKey.startsWith('pointer-')) pointerStarts.delete(Number(oldKey.slice(8)));
				sendLocal({ type: 'noteOff', channel: old.channel, note: old.note, velocity: 0 });
			}
		voice.pressure = pressure;
		voice.slide = timbre;
		owned.set(key, voice);
		for (const message of noteOnMessages(voice)) sendLocal(message);
		selectedChannel = voice.channel;
		localHeld = [...owned.values()].map((item) => item.note);
		if (!soundEnabled) void enableSound();
	}
	function toggleKey(note: number) {
		const key = `key-${note}`;
		if (owned.has(key)) releaseLocal(key);
		else beginLocal(key, note);
	}
	function expression(kind: 'bend' | 'pressure' | 'timbre', value: number) {
		if (!selected || !isSurface) return;
		const channel = selected.channel;
		if (kind === 'bend') {
			if (Math.abs(value - selectedBend) < 0.005) return;
			const bend = unitToBend(value / Math.max(1, ranges[channel]));
			if (bend !== selected.bend) sendLocal({ type: 'pitchBend', channel, value: bend });
		}
		if (kind === 'pressure' && Math.round(value) !== selected.pressure)
			sendLocal({ type: 'channelAftertouch', channel, pressure: Math.round(value) });
		if (kind === 'timbre' && Math.round(value) !== selected.timbre)
			sendLocal({ type: 'controlChange', channel, controller: 74, value: Math.round(value) });
	}

	function down(event: PointerEvent) {
		if (!isSurface || event.button !== 0) return;
		markPerformanceInput();
		const element = event.currentTarget as HTMLDivElement;
		capturePointer(element, event.pointerId);
		const bounds = element.getBoundingClientRect();
		const x = Math.max(0, Math.min(0.9999, (event.clientX - bounds.left) / bounds.width));
		const y = Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height));
		pointerStarts.set(event.pointerId, event.clientX);
		beginLocal(
			`pointer-${event.pointerId}`,
			lowNote + Math.floor(x * noteCount),
			event.pointerType === 'pen' ? Math.round(event.pressure * 127) : Math.round(20 + y * 70),
			Math.round(y * 127)
		);
	}
	function move(event: PointerEvent) {
		const voice = owned.get(`pointer-${event.pointerId}`);
		const start = pointerStarts.get(event.pointerId);
		if (!voice || start === undefined) return;
		const bounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
		const y = Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height));
		const semitones = ((event.clientX - start) / bounds.width) * noteCount;
		sendLocal({
			type: 'pitchBend',
			channel: voice.channel,
			value: unitToBend(Math.max(-1, Math.min(1, semitones / ranges[voice.channel])))
		});
		sendLocal({
			type: 'controlChange',
			channel: voice.channel,
			controller: 74,
			value: Math.round(y * 127)
		});
		sendLocal({
			type: 'channelAftertouch',
			channel: voice.channel,
			pressure:
				event.pointerType === 'pen' ? Math.round(event.pressure * 127) : Math.round(20 + y * 70)
		});
	}
	function up(event: PointerEvent) {
		releaseLocal(`pointer-${event.pointerId}`);
		pointerStarts.delete(event.pointerId);
	}
	function stopDemo(returnToLive = true) {
		const wasDemo = demoPending || demoRunning || displayDemo;
		demoSession++;
		demoPending = false;
		clearInterval(demoTimer);
		demoTimer = 0;
		demoRunning = false;
		for (const voice of demo.active)
			sendLocal(
				{ type: 'noteOff', channel: voice.channel, note: voice.note, velocity: 64 },
				'demo'
			);
		if (returnToLive) displayDemo = false;
		if (wasDemo) monitor?.stop();
	}
	function allOff(clear = false) {
		stopDemo();
		soundSession++;
		enabling = false;
		for (const key of [...owned.keys()]) releaseLocal(key);
		for (const voice of live.active)
			if (voice.held)
				engine.sendInternal(
					{ type: 'noteOff', channel: voice.channel, note: voice.note, velocity: 0 },
					'performer',
					false
				);
		owned.clear();
		allocator.clear();
		pointerStarts.clear();
		localHeld = [];
		live.clear();
		refreshLive();
		monitor?.stop();
		if (clear) {
			masterNotes = 0;
			outsideNotes = 0;
			lastMessage = 'Waiting for a note';
			rpnStages.clear();
		}
	}
	function chooseSource(value: string) {
		allOff(true);
		source = value;
		selectedChannel = null;
		live.setZone(makeZone(side, memberCount, memberRange));
		refreshLive();
		allocator.zone = zone;
		monitor?.setInput(value === 'surface' ? null : value, zone, true);
		if (value !== 'surface') midiAccess.listen(value);
	}
	function applyZone() {
		allOff(true);
		const next = makeZone(side, memberCount, memberRange);
		live.setZone(next);
		demo.setZone(next);
		allocator.zone = next;
		refreshLive();
		monitor?.setInput(isSurface ? null : source, next, true);
		if (isSurface) for (const message of configureZone(next)) sendLocal(message);
		achievement('configure');
	}
	function connection() {
		if (
			source !== 'surface' &&
			midiAccess.status === 'granted' &&
			!midiAccess.connectedInputs.some((port) => port.id === source)
		) {
			chooseSource('surface');
			error =
				'The selected input disconnected. Its notes have been released; the on-screen instrument is ready.';
		}
	}

	async function hearGesture() {
		allOff();
		error = '';
		const token = ++demoSession;
		if (!monitor) return;
		demoPending = true;
		const started = await monitor.enable('demo');
		if (disposed || token !== demoSession) return;
		demoPending = false;
		if (!started) {
			error = 'Browser sound could not start. Try Hear gesture again.';
			return;
		}
		soundEnabled = true;
		demo.setZone(zone);
		displayDemo = true;
		demoRunning = true;
		demoProgress = 0;
		const channels = zone.members.slice(0, 3);
		if (channels.length < 2) {
			stopDemo();
			error = 'Choose at least two member channels to compare independent voices.';
			return;
		}
		const first = channels[0],
			second = channels[1],
			third = channels[2] ?? channels[1];
		const base = Math.max(0, Math.min(103, untrack(() => lowNote) + 12));
		for (const channel of channels) {
			sendLocal({ type: 'pitchBend', channel, value: 8192 }, 'demo');
			sendLocal({ type: 'channelAftertouch', channel, pressure: 30 }, 'demo');
			sendLocal({ type: 'controlChange', channel, controller: 74, value: 54 }, 'demo');
		}
		sendLocal({ type: 'noteOn', channel: first, note: base, velocity: 58 }, 'demo');
		if (gesture === 'bloom' && channels.length >= 3)
			sendLocal({ type: 'noteOn', channel: second, note: base + 4, velocity: 65 }, 'demo');
		const moving = gesture === 'bloom' ? third : second;
		let movingNote = base + 7;
		sendLocal({ type: 'noteOn', channel: moving, note: movingNote, velocity: 82 }, 'demo');
		const startedAt = performance.now();
		const duration = 5200;
		let changedAnswer = false;
		updateSound(demo, 'demo');
		demoTimer = window.setInterval(() => {
			if (token !== demoSession) return;
			const t = Math.min(1, (performance.now() - startedAt) / duration);
			demoProgress = t;
			if (gesture === 'lean') {
				const bend =
					t < 0.42
						? -0.65 * (1 - t / 0.42)
						: t < 0.78
							? Math.sin((t - 0.42) * Math.PI * 18) * 0.08
							: 0;
				sendLocal(
					{
						type: 'pitchBend',
						channel: moving,
						value: unitToBend(bend / Math.max(1, demo.getBendRange(moving)))
					},
					'demo'
				);
				sendLocal(
					{
						type: 'channelAftertouch',
						channel: moving,
						pressure: Math.round(30 + 38 * Math.sin(Math.PI * t))
					},
					'demo'
				);
			} else if (gesture === 'bloom') {
				sendLocal(
					{
						type: 'channelAftertouch',
						channel: moving,
						pressure: Math.round(28 + 78 * Math.sin(Math.PI * t) ** 2)
					},
					'demo'
				);
			} else {
				if (t > 0.48 && !changedAnswer) {
					changedAnswer = true;
					sendLocal({ type: 'noteOff', channel: moving, note: movingNote, velocity: 52 }, 'demo');
					movingNote = base + 4;
					sendLocal({ type: 'noteOn', channel: moving, note: movingNote, velocity: 74 }, 'demo');
				}
				const arc = changedAnswer
					? Math.sin(Math.PI * Math.min(1, (t - 0.48) / 0.52))
					: Math.sin((Math.PI * t) / 0.48);
				sendLocal(
					{
						type: 'controlChange',
						channel: moving,
						controller: 74,
						value: Math.round(45 + Math.max(0, arc) * (changedAnswer ? 65 : 18))
					},
					'demo'
				);
			}
			if (t >= 1) {
				clearInterval(demoTimer);
				demoTimer = 0;
				demoRunning = false;
				for (const voice of demo.active)
					sendLocal(
						{ type: 'noteOff', channel: voice.channel, note: voice.note, velocity: 64 },
						'demo'
					);
			}
			updateSound(demo, 'demo');
		}, 40);
	}
	onMount(() => {
		monitor = new MpeMonitor();
		monitor.attachInput(engine);
		monitor.setInput(null, zone, true);
		const unsubscribeDemo = monitor.onDemoInterrupted(() => stopDemo());
		const unsubscribeSound = monitor.onChange(() => {
			soundEnabled = monitor?.enabled ?? false;
			soundVoices = monitor?.voiceCount ?? 0;
			if (!updatingSound && demoRunning && !monitor?.playing && demo.active.length) stopDemo();
		});
		const unsubscribe = bus.subscribe((event: MidiEvent) => {
			const m = event.message;
			if (
				m.type === 'reset' ||
				(m.type === 'controlChange' &&
					m.controller === 120 &&
					(event.direction === 'out' || (event.portId === source && m.channel === zone.master)))
			) {
				allOff();
				return;
			}
			if (event.direction === 'in' && event.portId === source && event.origin === 'performer')
				receive(m, event.time, event.origin);
		});
		return () => {
			disposed = true;
			unsubscribe();
			allOff();
			unsubscribeSound();
			unsubscribeDemo();
			monitor?.dispose();
		};
	});
</script>

<svelte:window onblur={() => allOff()} />
<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) allOff();
	}}
/>

<section
	class={cn('mpe-playground', className)}
	aria-labelledby={`${uid}-title`}
	{@attach connection}
	data-mpe-source={isSurface ? 'surface' : 'hardware'}
>
	<header class="playground-heading">
		<div>
			<p class="eyebrow">MPE · an instrument inside every note</p>
			<h2 id={`${uid}-title`}>Expression Playground</h2>
			<p class="intro">Give one voice its own bend, breath and color. Keep another still.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button
				variant={soundEnabled ? 'outline' : 'default'}
				disabled={enabling}
				onclick={() => (soundEnabled ? muteSound() : void enableSound())}
				>{enabling
					? 'Starting sound…'
					: soundEnabled
						? 'Mute browser sound'
						: 'Enable browser sound'}</Button
			>
			<Button
				variant="outline"
				onclick={() => allOff()}
				disabled={!active.length && !demoRunning && !demoPending && !soundVoices}
				>All notes off</Button
			>
		</div>
	</header>
	<div class="connection-panel">
		<Field.Field class="min-w-0 flex-1"
			><Field.Label for={`${uid}-input`}>MPE input</Field.Label><NativeSelect.Root
				id={`${uid}-input`}
				value={source}
				onchange={(event) => chooseSource(String(event.currentTarget.value))}
				class="w-full"
				><NativeSelect.Option value="surface">On-screen instrument</NativeSelect.Option
				>{#each midiAccess.connectedInputs as port (port.id)}<NativeSelect.Option value={port.id}
						>{port.name}</NativeSelect.Option
					>{/each}</NativeSelect.Root
			></Field.Field
		>
		{#if midiAccess.status !== 'granted' && midiAccess.status !== 'unsupported'}<Button
				variant="outline"
				disabled={midiAccess.status === 'requesting'}
				onclick={() => midiAccess.request(false)}
				>{midiAccess.status === 'requesting' ? 'Connecting…' : 'Connect MIDI'}</Button
			>{/if}
		<div class="connection-status">
			<span class={cn('status-dot', (isSurface || input?.state === 'connected') && 'connected')}
			></span><span
				>{isSurface ? 'Ready without hardware' : (input?.name ?? 'Waiting for input')}<small
					>{soundEnabled
						? 'Browser expressive pad enabled'
						: 'Visuals are live · enable sound to listen'}</small
				></span
			>
		</div>
	</div>
	{#if midiAccess.status === 'unsupported'}<p class="help">
			Hardware MIDI is unavailable in this browser. The on-screen instrument, listening examples and
			challenges still work.
		</p>{/if}
	<p class="help">
		Osmose: use its <strong>Play / Port 1</strong> input in MPE mode. Pressure is Channel Pressure; deeper
		Aftertouch sends CC74. USB MIDI carries messages; this browser pad supplies the sound.
	</p>

	<figure class="expression-figure">
		<div class="figure-heading">
			<span
				>{displayDemo
					? 'Listening example'
					: isSurface
						? 'Your on-screen performance'
						: 'Your selected MIDI input'}</span
			><span
				>{displayDemo
					? choice.label
					: `${active.length} sounding ${active.length === 1 ? 'voice' : 'voices'}`}</span
			>
		</div>
		<div
			class="expression-field"
			role="group"
			aria-label="MPE touch surface"
			aria-describedby={`${uid}-surface-help`}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			<svg
				viewBox="0 0 960 310"
				role="img"
				aria-label="Expression trails. Pitch runs left to right. Higher positions and larger halos show more pressure; blue to gold color shows CC74. Each note has its own channel and trail."
			>
				<defs
					><linearGradient id={`${uid}-horizon`} x1="0" x2="0" y1="0" y2="1"
						><stop offset="0" stop-color="var(--msg-clock)" stop-opacity="0.035" /><stop
							offset="1"
							stop-color="var(--msg-program)"
							stop-opacity="0.07"
						/></linearGradient
					></defs
				>
				<rect width="960" height="310" fill={`url(#${uid}-horizon)`} />
				{#each [0, 32, 64, 96, 127] as pressure (pressure)}<line
						x1="64"
						x2="896"
						y1={plotY(pressure)}
						y2={plotY(pressure)}
						class="field-grid"
					/><text x="54" y={plotY(pressure) + 4} class="pressure-label">{pressure}</text>{/each}
				{#each Array.from({ length: noteCount }, (_, i) => lowNote + i) as note (note)}<line
						x1={plotX(note)}
						x2={plotX(note)}
						y1="46"
						y2="258"
						class={note % 12 === 0 ? 'octave-line' : 'note-grid'}
					/>{/each}
				{#each axisNotes as note (note)}<text x={plotX(note)} y="280" class="pitch-label"
						>{name(note)}</text
					>{/each}
				<text x="64" y="25" class="axis-label">PRESSURE · force after the note begins</text><text
					x="896"
					y="299"
					class="axis-label"
					text-anchor="end">PITCH · the note + its bend</text
				>
				{#each visualVoices as voice (voice.id)}{@const color = voiceColor(
						voice.effectiveTimbre
					)}{@const x = plotX(voice.note, voice.pitchSemitones)}{@const y = plotY(
						voice.effectivePressure
					)}{@const sounding = voice.held || voice.sustained}<g
						class:released={!sounding}
						data-voice-channel={voice.channel + 1}
					>
						<path
							d={trace(voice)}
							fill="none"
							stroke={color}
							stroke-width="3"
							stroke-opacity="0.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<circle
							cx={x}
							cy={y}
							r={18 + (voice.effectivePressure / 127) * 23}
							fill={color}
							fill-opacity="0.13"
						/>
						<circle
							cx={x}
							cy={y}
							r="13"
							fill="var(--card)"
							stroke={color}
							stroke-width="3"
							stroke-dasharray={voice.sustained && !voice.held ? '3 3' : undefined}
						/>
						<circle cx={x} cy={y} r="5" fill={color} /><text
							{x}
							y={y - 23}
							class="voice-label"
							text-anchor={x < 160 ? 'start' : x > 800 ? 'end' : 'middle'}
							>{name(voice.note)} · ch {voice.channel + 1}</text
						>
					</g>{/each}
				{#if !visualVoices.length}<text x="480" y="146" text-anchor="middle" class="empty-title"
						>Every note gets its own trail</text
					><text x="480" y="174" text-anchor="middle" class="empty-detail"
						>{isSurface
							? 'Hold a couple of notes below, or press and drag here.'
							: 'Play your controller to see its individual voices.'}</text
					>{/if}
			</svg>
		</div>
		<p class="sr-only" id={`${uid}-surface-help`}>
			Press and drag on the screen to play. For keyboard access, use the hold-note buttons and
			selected-note sliders below.
		</p>
		<figcaption>
			<span>Pitch = position · pressure = height & halo · CC74 = blue → gold</span><span
				>{displayDemo ? 'Example only · does not verify practice' : 'Real performer input'}</span
			>
		</figcaption>
	</figure>

	{#if isSurface}
		<div class="local-instrument">
			<Field.Field
				><Field.Label>Hold a note · click again to release</Field.Label>
				<div class="hold-keys" role="group" aria-label="Latching notes">
					{#each KEYS as offset (offset)}{@const note = Math.max(
							0,
							Math.min(127, lowNote + offset)
						)}<Button
							variant={localHeld.includes(note) ? 'default' : 'outline'}
							aria-pressed={localHeld.includes(note)}
							aria-label={`Hold ${name(note)}`}
							onclick={() => toggleKey(note)}>{name(note)}</Button
						>{/each}
				</div>
				<Field.Description
					>The buttons work with Tab, Enter and Space. Hold two notes, then select which voice to
					shape.</Field.Description
				></Field.Field
			>
			<Field.Field
				><Field.Label>Shape this held voice</Field.Label><ToggleGroup.Root
					type="single"
					variant="outline"
					value={selected ? String(selected.channel) : ''}
					spacing={2}
					class="flex-wrap"
					aria-label="Selected note"
					onValueChange={(value) => {
						if (value) selectedChannel = Number(value);
					}}
					>{#each active as voice (voice.id)}<ToggleGroup.Item value={String(voice.channel)}
							>{name(voice.note)} · ch {voice.channel + 1}</ToggleGroup.Item
						>{/each}</ToggleGroup.Root
				>{#if !active.length}<Field.Description
						>Hold a note to unlock its expression controls.</Field.Description
					>{/if}</Field.Field
			>
			<div class="expression-sliders">
				<Field.Field
					><Field.Label>Bend <span>{signed(selectedBend)} st</span></Field.Label><Slider
						type="single"
						min={-bendLimit}
						max={bendLimit}
						step={0.01}
						value={selectedBend}
						disabled={!selected}
						aria-label="Selected note bend in semitones"
						onValueChange={(value) => expression('bend', value)}
					/><Field.Description
						>Begin with a small ±2 st gesture. The surface can explore more of the ±{ranges[
							selected?.channel ?? 1
						]} st receiver range.</Field.Description
					></Field.Field
				>
				<Field.Field
					><Field.Label>Pressure <span>{selected?.pressure ?? 0}</span></Field.Label><Slider
						type="single"
						min={0}
						max={127}
						step={1}
						value={selected?.pressure ?? 0}
						disabled={!selected}
						aria-label="Selected note pressure"
						onValueChange={(value) => expression('pressure', value)}
					/><Field.Description
						>Grow a note after its attack; let it relax before the ending.</Field.Description
					></Field.Field
				>
				<Field.Field
					><Field.Label>Color · CC74 <span>{selected?.timbre ?? 64}</span></Field.Label><Slider
						type="single"
						min={0}
						max={127}
						step={1}
						value={selected?.timbre ?? 64}
						disabled={!selected}
						aria-label="Selected note CC74"
						onValueChange={(value) => expression('timbre', value)}
					/><Field.Description
						>Open just this voice’s filter. It can answer the others.</Field.Description
					></Field.Field
				>
			</div>
			<p class="help">
				On the touch surface, drag sideways to bend from your starting pitch; move vertically to
				change CC74. Pen pressure is used when available. Otherwise vertical position also supplies
				pressure; the sliders let you separate the two.
			</p>
		</div>
	{/if}

	<div class="listening-studio">
		<Field.Field
			><Field.Label>Three original gestures</Field.Label><ToggleGroup.Root
				type="single"
				variant="outline"
				value={gesture}
				spacing={2}
				class="flex-wrap"
				aria-label="Listening gesture"
				onValueChange={(value) => {
					if (value) {
						stopDemo();
						gesture = value as Gesture;
					}
				}}
				>{#each GESTURES as item (item.id)}<ToggleGroup.Item value={item.id}
						>{item.label}</ToggleGroup.Item
					>{/each}</ToggleGroup.Root
			></Field.Field
		>
		<div class="listening-heading">
			<div>
				<h3>{choice.title}</h3>
				<p>{choice.description}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button onclick={() => void hearGesture()} disabled={demoPending}
					>{demoPending
						? 'Starting example…'
						: demoRunning
							? 'Hear gesture again'
							: 'Hear gesture'}</Button
				><Button
					variant="outline"
					onclick={() => stopDemo()}
					disabled={!demoRunning && !demoPending}>Stop example</Button
				>
			</div>
		</div>
		{#if demoRunning}<div
				class="demo-progress"
				role="progressbar"
				aria-label="Listening example progress"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={Math.round(demoProgress * 100)}
			>
				<div style:width={`${demoProgress * 100}%`}></div>
			</div>{/if}
		<p class="try-gesture"><strong>Your turn.</strong> {choice.try}</p>
	</div>

	<section class="voice-ledger" aria-labelledby={`${uid}-ledger`}>
		<div class="ledger-heading">
			<h3 id={`${uid}-ledger`}>Inside the voices</h3>
			<span class="last-message" aria-live="off"
				>{displayDemo ? 'Listening example · separate from your performance' : lastMessage}</span
			>
		</div>
		<div class="master-strip">
			<strong>Master · ch {zone.master + 1}</strong><span
				>Bend {signed(bendToUnit(master.bend) * zone.masterBendRange)} st</span
			><span>Pressure {master.pressure}</span><span>CC74 {master.timbre}</span><span
				>Sustain {master.sustain ? 'on' : 'off'}</span
			>
		</div>
		<div class="voice-cards">
			{#each (displayDemo ? demoVoices : liveVoices)
				.slice(-8)
				.toReversed() as voice (voice.id)}<article
					class:voice-released={!voice.held && !voice.sustained}
					class="voice-card"
					data-member-channel={voice.channel + 1}
					data-mpe-note={`${voice.channel}:${voice.note}`}
				>
					<div class="voice-card-heading">
						<strong>{name(voice.note)}</strong><span
							>ch {voice.channel + 1} · {voice.held
								? 'held'
								: voice.sustained
									? 'pedal held'
									: 'released'}</span
						>
					</div>
					<p class="voice-pitch">{signed(voice.pitchSemitones)} <small>semitones</small></p>
					<dl>
						<div>
							<dt>Strike</dt>
							<dd>{voice.velocity}</dd>
						</div>
						<div>
							<dt>Pitch Bend</dt>
							<dd>{voice.bend} <small>±{ranges[voice.channel]} st</small></dd>
						</div>
						<div>
							<dt>Pressure</dt>
							<dd>{voice.pressure} <small>effective {voice.effectivePressure}</small></dd>
						</div>
						<div>
							<dt>CC74</dt>
							<dd>{voice.timbre} <small>effective {voice.effectiveTimbre}</small></dd>
						</div>
						{#if !voice.held}<div>
								<dt>Lift</dt>
								<dd>{voice.releaseVelocity}</dd>
							</div>{/if}
					</dl>
					<div class="voice-meter" aria-hidden="true">
						<div
							style:width={`${(voice.effectivePressure / 127) * 100}%`}
							style:background={voiceColor(voice.effectiveTimbre)}
						></div>
					</div>
				</article>{/each}
		</div>
		{#if !liveVoices.length && !displayDemo}<p class="help">
				No notes yet. A member channel will appear here with its raw MIDI values and interpreted
				bend.
			</p>{/if}
	</section>

	<section class="gesture-challenges" aria-labelledby={`${uid}-challenges`}>
		<div>
			<h3 id={`${uid}-challenges`}>Small gestures, real independence</h3>
			<p class="help">
				Hold two member notes. Move one dimension of one note while keeping the other voice steady.
				Listening examples never tick these off.
			</p>
		</div>
		<div class="challenge-grid">
			{#each [{ id: 'per-note-bend' as const, label: 'One voice bends', detail: 'A bend of at least 8 cents with another note held.' }, { id: 'pressure' as const, label: 'One voice breathes', detail: 'A pressure change of at least 8 steps with another note held.' }, { id: 'slide' as const, label: 'One voice changes color', detail: 'A CC74 change of at least 8 steps with another note held.' }] as task (task.id)}<div
					class={cn('challenge', achievements.includes(task.id) && 'achieved')}
					data-challenge={task.id}
				>
					<span class="challenge-mark" aria-hidden="true"
						>{achievements.includes(task.id) ? '✓' : '○'}</span
					>
					<div>
						<strong>{task.label}</strong>
						<p>{task.detail}</p>
						<span class="challenge-status"
							>{achievements.includes(task.id) ? 'Performed' : 'Try it with your own gesture'}</span
						>
					</div>
				</div>{/each}
		</div>
	</section>

	<details class="receiver-settings">
		<summary>Zone & range diagnostics</summary>
		<div class="settings-content">
			<p class="help">
				This changes this lab’s receiver interpretation. It sends no configuration to your hardware.
				Received RPN messages can declare a zone or change its shared member bend range or its
				master bend range.
			</p>
			<div class="zone-fields">
				<Field.Field
					><Field.Label>Zone</Field.Label><ToggleGroup.Root
						type="single"
						variant="outline"
						value={side}
						aria-label="Receiver zone"
						onValueChange={(value) => {
							if (value) side = value as ZoneSide;
						}}
						><ToggleGroup.Item value="lower">Lower · master 1</ToggleGroup.Item><ToggleGroup.Item
							value="upper">Upper · master 16</ToggleGroup.Item
						></ToggleGroup.Root
					></Field.Field
				><Field.Field
					><Field.Label for={`${uid}-members`}>Member channels</Field.Label><NativeSelect.Root
						id={`${uid}-members`}
						bind:value={memberCount}
						>{#if memberCount === 0}<NativeSelect.Option value={0}
								>0 · zone disabled</NativeSelect.Option
							>{/if}{#each Array.from({ length: 15 }, (_, i) => i + 1) as count (count)}<NativeSelect.Option
								value={count}>{count}</NativeSelect.Option
							>{/each}</NativeSelect.Root
					></Field.Field
				><Field.Field
					><Field.Label for={`${uid}-range`}>Member bend range</Field.Label><NativeSelect.Root
						id={`${uid}-range`}
						bind:value={memberRange}
						>{#if ![2, 12, 24, 48, 96].includes(memberRange)}<NativeSelect.Option
								value={memberRange}>±{memberRange} semitones · received</NativeSelect.Option
							>{/if}{#each [2, 12, 24, 48, 96] as range (range)}<NativeSelect.Option value={range}
								>±{range} semitones</NativeSelect.Option
							>{/each}</NativeSelect.Root
					></Field.Field
				>
			</div>
			<Button variant="outline" onclick={applyZone}>Apply local zone</Button>
			<p class="zone-readout">
				Active {zone.side} zone · master {zone.master + 1} · members {zone.members
					.map((channel) => channel + 1)
					.join(', ')} · member bend ±{zone.memberBendRange} st · master bend ±{zone.masterBendRange}
				st
			</p>
			<div class="diagnostic-stats">
				<span>{stats.noteCount} notes received</span><span
					>Peak {stats.maxPolyphony} simultaneous voices</span
				><span
					>{stats.bendEvents} bends · {stats.pressureEvents} pressure · {stats.timbreEvents} CC74</span
				>
			</div>
			{#if masterNotes}<p class="diagnostic-warning">
					{masterNotes} Note On messages arrived on the master channel. Ordinary MIDI mode often puts
					every note on channel 1; select MPE mode or check the chosen zone.
				</p>{/if}{#if outsideNotes}<p class="diagnostic-warning">
					{outsideNotes} notes arrived outside this zone. Check the master channel and member count.
				</p>{/if}{#if stats.channelCollisions}<p class="diagnostic-warning">
					{stats.channelCollisions} instances of notes sharing a member channel: they share expression.
					This can be intentional in poly mode; independent gestures need separate members.
				</p>{/if}
			<p class="help">
				Only the chosen input is observed here, even if other ports are open in the dock. If notes
				double, keep the keyboard’s Play stream separate from its sound-engine or editor streams.
			</p>
		</div>
	</details>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.mpe-playground {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		min-width: 0;
	}
	.playground-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1.2rem;
	}
	.eyebrow {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted-foreground);
		margin-bottom: 0.5rem;
	}
	.playground-heading h2 {
		font-size: clamp(1.6rem, 4vw, 2.25rem);
		letter-spacing: -0.045em;
		font-weight: 650;
		line-height: 1.15;
	}
	.intro {
		color: var(--muted-foreground);
		font-size: 0.85rem;
		line-height: 1.7;
		margin-top: 0.5rem;
	}
	.connection-panel {
		display: flex;
		align-items: end;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.7rem;
		background: var(--card);
	}
	.connection-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		line-height: 1.7;
		min-width: 12rem;
	}
	.connection-status small {
		display: block;
		color: var(--muted-foreground);
		font-size: 0.65rem;
	}
	.status-dot {
		width: 0.45rem;
		height: 0.45rem;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--muted-foreground);
	}
	.status-dot.connected {
		background: var(--ok);
	}
	.help {
		font-size: 0.75rem;
		line-height: 1.75;
		color: var(--muted-foreground);
	}
	.help strong {
		color: var(--foreground);
		font-weight: 550;
	}
	.expression-figure {
		border: 1px solid var(--border);
		border-radius: 0.8rem;
		overflow: hidden;
		background: var(--card);
	}
	.figure-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 1rem;
		font-size: 0.7rem;
		color: var(--muted-foreground);
	}
	.figure-heading span:first-child {
		color: var(--foreground);
		font-weight: 550;
	}
	.expression-field {
		touch-action: none;
		user-select: none;
		position: relative;
		cursor: crosshair;
	}
	.expression-field svg {
		display: block;
		width: 100%;
		height: auto;
		min-height: 220px;
		pointer-events: none;
	}
	.field-grid {
		stroke: var(--border);
		stroke-width: 1;
		stroke-dasharray: 3 5;
	}
	.note-grid {
		stroke: var(--border);
		stroke-opacity: 0.45;
		stroke-width: 1;
	}
	.octave-line {
		stroke: var(--muted-foreground);
		stroke-opacity: 0.25;
		stroke-width: 1.5;
	}
	.pressure-label,
	.pitch-label {
		fill: var(--muted-foreground);
		font-size: 11px;
		text-anchor: middle;
		font-family: var(--font-mono);
	}
	.pressure-label {
		text-anchor: end;
	}
	.axis-label {
		fill: var(--muted-foreground);
		font-size: 10px;
		letter-spacing: 1px;
	}
	.voice-label {
		fill: var(--foreground);
		font-size: 12px;
		font-weight: 600;
		paint-order: stroke;
		stroke: var(--card);
		stroke-width: 3;
		stroke-linejoin: round;
	}
	.released {
		opacity: 0.3;
	}
	.empty-title {
		fill: var(--foreground);
		font-size: 22px;
		font-weight: 550;
		letter-spacing: -0.5px;
	}
	.empty-detail {
		fill: var(--muted-foreground);
		font-size: 13px;
	}
	.expression-figure figcaption {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
		font-size: 0.65rem;
		color: var(--muted-foreground);
	}
	.local-instrument {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.hold-keys {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 0.4rem;
	}
	.expression-sliders {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.3rem;
	}
	.listening-studio {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.8rem;
		background: var(--surface-sunken);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.listening-heading {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 1.3rem;
	}
	h3 {
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.45;
	}
	.listening-heading p {
		max-width: 62ch;
		color: var(--muted-foreground);
		font-size: 0.8rem;
		line-height: 1.75;
		margin-top: 0.4rem;
	}
	.try-gesture {
		font-size: 0.8rem;
		line-height: 1.75;
		max-width: 75ch;
	}
	.try-gesture strong {
		font-weight: 600;
	}
	.demo-progress {
		height: 3px;
		background: var(--border);
		overflow: hidden;
		border-radius: 2px;
	}
	.demo-progress div {
		height: 100%;
		background: var(--msg-clock);
	}
	.voice-ledger {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.ledger-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.last-message {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--muted-foreground);
	}
	.master-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 1.2rem;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--surface-sunken);
		font-size: 0.65rem;
		font-family: var(--font-mono);
		color: var(--muted-foreground);
	}
	.master-strip strong {
		color: var(--foreground);
		font-weight: 550;
	}
	.voice-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.6rem;
	}
	.voice-card {
		border: 1px solid var(--border);
		border-radius: 0.65rem;
		padding: 0.9rem;
		background: var(--card);
	}
	.voice-released {
		opacity: 0.55;
	}
	.voice-card-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.voice-card-heading strong {
		font-weight: 650;
	}
	.voice-card-heading span {
		font-size: 0.6rem;
		color: var(--muted-foreground);
		font-family: var(--font-mono);
	}
	.voice-pitch {
		font-size: 1.4rem;
		letter-spacing: -0.035em;
		margin: 0.55rem 0;
		font-variant-numeric: tabular-nums;
	}
	.voice-pitch small {
		font-size: 0.6rem;
		letter-spacing: 0;
		color: var(--muted-foreground);
	}
	dl {
		font-size: 0.65rem;
		font-family: var(--font-mono);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	dl div {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	dt {
		color: var(--muted-foreground);
	}
	dd {
		font-variant-numeric: tabular-nums;
	}
	dd small {
		font-size: 0.55rem;
		color: var(--muted-foreground);
	}
	.voice-meter {
		height: 3px;
		background: var(--muted);
		border-radius: 2px;
		margin-top: 0.85rem;
		overflow: hidden;
	}
	.voice-meter div {
		height: 100%;
	}
	.gesture-challenges {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.challenge-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
	}
	.challenge {
		display: flex;
		align-items: start;
		gap: 0.65rem;
		border: 1px solid var(--border);
		border-radius: 0.65rem;
		padding: 0.8rem;
	}
	.challenge.achieved {
		border-color: color-mix(in oklch, var(--ok) 40%, var(--border));
		background: color-mix(in oklch, var(--ok) 5%, var(--card));
	}
	.challenge-mark {
		color: var(--muted-foreground);
		font-size: 1rem;
		line-height: 1.2;
	}
	.achieved .challenge-mark {
		color: var(--ok);
	}
	.challenge strong {
		font-size: 0.75rem;
		font-weight: 550;
		line-height: 1.5;
	}
	.challenge p {
		font-size: 0.65rem;
		color: var(--muted-foreground);
		line-height: 1.65;
		margin-top: 0.35rem;
	}
	.challenge-status {
		display: block;
		font-size: 0.6rem;
		color: var(--muted-foreground);
		margin-top: 0.55rem;
	}
	.achieved .challenge-status {
		color: var(--ok);
	}
	.receiver-settings {
		border: 1px solid var(--border);
		border-radius: 0.65rem;
		overflow: hidden;
	}
	.receiver-settings summary {
		padding: 0.9rem 1rem;
		font-size: 0.8rem;
		font-weight: 550;
		cursor: pointer;
	}
	.settings-content {
		padding: 0 1rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.zone-fields {
		display: flex;
		align-items: end;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.zone-fields > * {
		flex: 1;
		min-width: 140px;
	}
	.zone-readout,
	.diagnostic-stats {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--muted-foreground);
		line-height: 1.8;
	}
	.diagnostic-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.2rem;
	}
	.diagnostic-warning {
		padding: 0.7rem 0.8rem;
		border-left: 2px solid var(--warn);
		font-size: 0.75rem;
		line-height: 1.7;
		color: var(--foreground);
		background: color-mix(in oklch, var(--warn) 6%, var(--card));
	}
	.error {
		font-size: 0.8rem;
		color: var(--destructive);
		line-height: 1.7;
	}
	@media (max-width: 640px) {
		.expression-sliders,
		.challenge-grid {
			grid-template-columns: 1fr;
		}
		.hold-keys {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.listening-heading {
			flex-direction: column;
		}
		.expression-field svg {
			min-height: 180px;
		}
		.empty-title {
			font-size: 29px;
		}
		.empty-detail {
			font-size: 21px;
		}
		.voice-label {
			font-size: 30px;
		}
		.axis-label {
			font-size: 28px;
		}
		.pitch-label,
		.pressure-label {
			font-size: 28px;
		}
		.connection-panel {
			align-items: start;
		}
		.connection-panel > div:first-child {
			min-width: 100%;
		}
	}
</style>
