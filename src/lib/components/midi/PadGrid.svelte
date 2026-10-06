<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { engine } from '$lib/midi/engine.svelte';
	import { musicalInput } from '$lib/midi/input.svelte';
	import { noteState } from '$lib/midi/notestate.svelte';
	import { GM_DRUMS } from '$lib/midi/constants';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { rovingGrid } from '$lib/a11y/roving';
	import { momentary } from '$lib/a11y/momentary';
	import { markPerformanceInput } from '$lib/a11y/focus-mode';
	import { capturePointer, cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { NativeSelect, NativeSelectOption } from '$lib/components/ui/native-select';
	import * as Field from '$lib/components/ui/field';
	import VoicePicker from './VoicePicker.svelte';

	interface Props {
		notes?: number[];
		columns?: number;
		channel?: number;
		velocity?: number | null;
		typing?: boolean;
		controls?: boolean;
		colour?: string;
		onTrigger?: (note: number, velocity: number) => void;
		class?: string;
	}

	const DEFAULT_NOTES = [48, 49, 50, 51, 44, 45, 46, 47, 40, 41, 42, 43, 36, 37, 38, 39];
	const CODES = [
		'Digit1',
		'Digit2',
		'Digit3',
		'Digit4',
		'KeyQ',
		'KeyW',
		'KeyE',
		'KeyR',
		'KeyA',
		'KeyS',
		'KeyD',
		'KeyF',
		'KeyZ',
		'KeyX',
		'KeyC',
		'KeyV'
	];
	const CAPS = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V'];

	let {
		notes = DEFAULT_NOTES,
		columns = 4,
		channel = 9,
		velocity = null,
		typing = true,
		controls = true,
		colour = 'var(--msg-note)',
		onTrigger,
		class: className
	}: Props = $props();

	const inputId = Symbol('pads');
	const controlId = $props.id();
	const ownsTyping = $derived(typing && musicalInput.active === inputId);
	let selectedVelocity = $state<number | null>(null);
	const strikeVelocity = $derived(velocity ?? selectedVelocity);
	const program = $derived(noteState.channel(channel).program);
	const held = new SvelteMap<number, { note: number; channel: number }>();
	const typed = new SvelteMap<string, { note: number; channel: number }>();
	const keyHeld = new SvelteMap<number, number>();

	function activateTyping() {
		if (typing) musicalInput.activate(inputId);
	}

	function useComputerKeys(event: MouseEvent) {
		activateTyping();
		(event.currentTarget as HTMLElement).blur();
	}

	function label(note: number): string {
		return channel === 9
			? (GM_DRUMS[note] ?? noteName(note, { convention: settings.octaveConvention }))
			: noteName(note, { convention: settings.octaveConvention });
	}

	function trigger(note: number, v: number) {
		engine.noteOn(note, v, channel);
		onTrigger?.(note, v);
	}

	function hit(note: number, e: PointerEvent) {
		markPerformanceInput();
		activateTyping();
		const el = e.currentTarget as HTMLElement;
		capturePointer(el, e.pointerId);
		const r = el.getBoundingClientRect();
		const v =
			strikeVelocity ??
			Math.max(1, Math.min(127, Math.round(30 + ((e.clientY - r.top) / r.height) * 97)));
		held.set(e.pointerId, { note, channel });
		trigger(note, v);
	}

	function lift(e: PointerEvent) {
		const started = held.get(e.pointerId);
		if (!started) return;
		engine.noteOff(started.note, started.channel);
		held.delete(e.pointerId);
	}

	function typeDown(e: KeyboardEvent) {
		const index = CODES.indexOf(e.code);
		const note = notes[index];
		if (index < 0 || note === undefined || typed.has(e.code)) return;
		e.preventDefault();
		typed.set(e.code, { note, channel });
		trigger(note, strikeVelocity ?? 100);
	}

	function typeUp(e: KeyboardEvent) {
		const started = typed.get(e.code);
		if (!started) return;
		typed.delete(e.code);
		engine.noteOff(started.note, started.channel);
	}

	function keyDown(e: KeyboardEvent, note: number) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		if (e.repeat || keyHeld.has(note)) return;
		keyHeld.set(note, channel);
		trigger(note, strikeVelocity ?? 100);
	}

	function keyRelease(note: number) {
		const sendingChannel = keyHeld.get(note);
		if (sendingChannel === undefined) return;
		keyHeld.delete(note);
		engine.noteOff(note, sendingChannel);
	}

	function releaseAll() {
		for (const started of held.values()) engine.noteOff(started.note, started.channel);
		for (const started of typed.values()) engine.noteOff(started.note, started.channel);
		for (const [note, sendingChannel] of keyHeld) engine.noteOff(note, sendingChannel);
		held.clear();
		typed.clear();
		keyHeld.clear();
	}

	onMount(() =>
		musicalInput.register(inputId, {
			enabled: () => typing,
			keydown: typeDown,
			keyup: typeUp,
			release: releaseAll
		})
	);

	$effect(() => {
		void channel;
		void notes;
		void typing;
		return releaseAll;
	});
</script>

<svelte:window onpointerup={lift} onpointercancel={lift} />

<div
	class={cn('instrument-material instrument-deck flex flex-col gap-2', className)}
	role="group"
	aria-label="Drum pads"
	tabindex="-1"
	onpointerdown={activateTyping}
	onfocusin={activateTyping}
>
	{#if controls}
		<Field.FieldGroup class="instrument-toolbar flex-row flex-wrap items-center gap-2">
			<span class="text-xs text-muted-foreground">Channel {channel + 1}</span>
			<VoicePicker
				value={program}
				{channel}
				audition={false}
				class="shrink-0"
				title={channel === 9 ? 'Choose a drum kit' : "Choose the pads' instrument"}
			/>
			<Field.Field
				orientation="horizontal"
				class="w-auto shrink-0 gap-1.5"
				data-disabled={velocity !== null}
			>
				<Field.FieldLabel for={controlId + '-velocity'}>Velocity</Field.FieldLabel>
				<NativeSelect
					id={controlId + '-velocity'}
					class="w-36 shrink-0"
					value={String(strikeVelocity ?? 'touch')}
					disabled={velocity !== null}
					onchange={(e) =>
						(selectedVelocity =
							e.currentTarget.value === 'touch' ? null : Number(e.currentTarget.value))}
				>
					{#if velocity !== null}<NativeSelectOption value={String(velocity)}
							>{velocity} · fixed</NativeSelectOption
						>{:else}
						<NativeSelectOption value="touch">Touch dynamics</NativeSelectOption>
						<NativeSelectOption value="48">Soft · 48</NativeSelectOption>
						<NativeSelectOption value="100">Medium · 100</NativeSelectOption>
						<NativeSelectOption value="127">Hard · 127</NativeSelectOption>
					{/if}
				</NativeSelect>
			</Field.Field>
		</Field.FieldGroup>
	{/if}
	<div
		class="instrument-recess grid gap-1.5 rounded-lg"
		style="grid-template-columns: repeat({columns}, minmax(0, 1fr))"
		use:rovingGrid={{ columns }}
	>
		{#each notes as note, i (note)}
			{@const active = noteState.isHeld(note, channel)}
			{@const vel = noteState.velocityOf(note, channel)}
			<button
				use:momentary
				class="instrument-pad focus-inset relative flex aspect-square touch-none flex-col items-start justify-end gap-0.5 overflow-hidden rounded-lg border p-2 text-left transition-[background,transform] select-none active:translate-y-px"
				style:background={active
					? `color-mix(in oklch, ${colour} ${18 + (vel / 127) * 22}%, var(--instrument-pad-face))`
					: ''}
				style:border-color={active ? colour : ''}
				style:--muted-foreground={active ? 'var(--instrument-ink)' : undefined}
				onpointerdown={(e) => hit(note, e)}
				onpointerup={lift}
				onpointercancel={lift}
				onkeydown={(e) => keyDown(e, note)}
				onkeyup={(e) => {
					if (e.key === 'Enter' || e.key === ' ') keyRelease(note);
				}}
				onblur={() => keyRelease(note)}
				aria-label="{label(note)}, note {note}{typing && CAPS[i]
					? ', computer key ' + CAPS[i]
					: ''}"
				aria-pressed={active}
			>
				{#if typing && CAPS[i]}<kbd
						class="absolute top-1.5 left-2 rounded-sm bg-muted px-1 font-mono text-xs"
						class:text-foreground={ownsTyping}
						class:text-muted-foreground={!ownsTyping}>{CAPS[i]}</kbd
					>{/if}
				<span class="absolute top-1.5 right-2 font-mono text-2xs text-muted-foreground">{note}</span
				>
				<span class="line-clamp-2 text-2xs leading-tight font-medium">{label(note)}</span>
			</button>
		{/each}
	</div>
	{#if typing}
		<div class="flex flex-wrap items-center gap-2">
			<Button
				size="sm"
				variant={ownsTyping ? 'secondary' : 'outline'}
				style="--secondary: var(--msg-note-bg); --secondary-foreground: var(--msg-note)"
				aria-label="Use computer keys"
				aria-pressed={ownsTyping}
				title="Play the letters and numbers shown on the pads"
				onclick={useComputerKeys}>Keys</Button
			>
		</div>
	{/if}
</div>
