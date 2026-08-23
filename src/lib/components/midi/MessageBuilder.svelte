<script lang="ts">
	/**
	 * Build a MIDI message by hand and send it.
	 *
	 * Every control here edits a *field*; the bytes underneath update as you
	 * drag. That direction matters pedagogically — you are not decoding
	 * somebody else's bytes, you are watching your own intent become them.
	 */
	import { engine } from '$lib/midi/engine.svelte';
	import { encode, type MessageType, type MidiMessage } from '$lib/midi/messages';
	import { ccInfo, ESSENTIAL_CCS, gmProgramName } from '$lib/midi/constants';
	import { noteName } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import ByteInspector from './ByteInspector.svelte';
	import Knob from './Knob.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { SentIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		/** Which message types to offer. */
		types?: MessageType[];
		type?: MessageType;
		channel?: number;
		note?: number;
		velocity?: number;
		controller?: number;
		value?: number;
		program?: number;
		bend?: number;
		pressure?: number;
		/** Hide the type picker when a lesson wants to pin one message. */
		lockType?: boolean;
		autoSend?: boolean;
		class?: string;
	}

	let {
		types = [
			'noteOn',
			'noteOff',
			'controlChange',
			'programChange',
			'pitchBend',
			'channelAftertouch'
		],
		type = $bindable('noteOn'),
		channel = $bindable(0),
		note = $bindable(60),
		velocity = $bindable(100),
		controller = $bindable(74),
		value = $bindable(64),
		program = $bindable(0),
		bend = $bindable(8192),
		pressure = $bindable(64),
		lockType = false,
		autoSend = false,
		class: className
	}: Props = $props();

	const TYPE_LABELS: Partial<Record<MessageType, string>> = {
		noteOn: 'Note On',
		noteOff: 'Note Off',
		controlChange: 'Control Change',
		programChange: 'Program Change',
		pitchBend: 'Pitch Bend',
		channelAftertouch: 'Channel Aftertouch',
		polyAftertouch: 'Poly Aftertouch'
	};

	const message = $derived.by((): MidiMessage => {
		switch (type) {
			case 'noteOff':
				return { type: 'noteOff', channel, note, velocity: 0 };
			case 'controlChange':
				return { type: 'controlChange', channel, controller, value };
			case 'programChange':
				return { type: 'programChange', channel, program };
			case 'pitchBend':
				return { type: 'pitchBend', channel, value: bend };
			case 'channelAftertouch':
				return { type: 'channelAftertouch', channel, pressure };
			case 'polyAftertouch':
				return { type: 'polyAftertouch', channel, note, pressure };
			default:
				return { type: 'noteOn', channel, note, velocity };
		}
	});

	const bytes = $derived(encode(message));

	function send() {
		engine.wake();
		engine.send(message);
		// A Note On you can never turn off is how the app teaches stuck notes,
		// but not by accident: this one releases itself after a beat.
		if (type === 'noteOn') {
			setTimeout(() => engine.send({ type: 'noteOff', channel, note, velocity: 0 }), 700);
		}
	}

	$effect(() => {
		if (!autoSend) return;
		void bytes;
		engine.send(message);
	});
</script>

<div class={cn('flex flex-col gap-5 rounded-xl border p-4', className)}>
	<div class="flex flex-wrap items-end gap-4">
		{#if !lockType}
			<label class="flex flex-col gap-1">
				<span class="text-[10px] tracking-wide text-muted-foreground uppercase">Message</span>
				<Select.Root type="single" bind:value={type as string}>
					<Select.Trigger class="h-8 w-48 text-xs">
						{TYPE_LABELS[type] ?? type}
					</Select.Trigger>
					<Select.Content>
						{#each types as t (t)}
							<Select.Item value={t}>{TYPE_LABELS[t] ?? t}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</label>
		{/if}

		<Knob
			bind:value={channel}
			min={0}
			max={15}
			default={0}
			label="Channel"
			sub={String(channel + 1)}
			colour="var(--msg-common)"
			size={46}
		/>

		{#if type === 'noteOn' || type === 'noteOff' || type === 'polyAftertouch'}
			<Knob
				bind:value={note}
				min={0}
				max={127}
				default={60}
				label="Note"
				sub="{noteName(note, { convention: settings.octaveConvention })} · {note}"
				colour="var(--msg-note)"
				size={46}
			/>
		{/if}
		{#if type === 'noteOn'}
			<Knob
				bind:value={velocity}
				min={1}
				max={127}
				default={100}
				label="Velocity"
				colour="var(--msg-note)"
				size={46}
			/>
		{/if}
		{#if type === 'controlChange'}
			<Knob
				bind:value={controller}
				min={0}
				max={127}
				default={74}
				label="Controller"
				sub="CC {controller}"
				colour="var(--msg-cc)"
				size={46}
			/>
			<Knob
				bind:value
				min={0}
				max={127}
				default={64}
				label="Value"
				colour="var(--msg-cc)"
				size={46}
			/>
			<p class="max-w-40 text-[11px] leading-snug text-muted-foreground">
				{ccInfo(controller).name}
			</p>
		{/if}
		{#if type === 'programChange'}
			<Knob
				bind:value={program}
				min={0}
				max={127}
				default={0}
				label="Program"
				colour="var(--msg-program)"
				size={46}
			/>
			<p class="max-w-40 text-[11px] leading-snug text-muted-foreground">
				GM: {gmProgramName(program)}
			</p>
		{/if}
		{#if type === 'pitchBend'}
			<Knob
				bind:value={bend}
				min={0}
				max={16383}
				default={8192}
				label="Bend"
				bipolar
				colour="var(--msg-expr)"
				size={46}
			/>
		{/if}
		{#if type === 'channelAftertouch' || type === 'polyAftertouch'}
			<Knob
				bind:value={pressure}
				min={0}
				max={127}
				default={0}
				label="Pressure"
				colour="var(--msg-expr)"
				size={46}
			/>
		{/if}

		<div class="flex-1"></div>
		{#if !autoSend}
			<Button size="sm" onclick={send} class="gap-1.5">
				<HugeiconsIcon icon={SentIcon} size={14} />
				Send
			</Button>
		{/if}
	</div>

	{#if type === 'controlChange'}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="mr-1 text-[10px] tracking-wide text-muted-foreground uppercase">Jump to</span>
			{#each ESSENTIAL_CCS as n (n)}
				<button
					class={cn(
						'rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:border-msg-cc',
						controller === n && 'border-msg-cc bg-msg-cc-bg text-msg-cc'
					)}
					onclick={() => (controller = n)}
				>
					{n}
					{ccInfo(n).short}
				</button>
			{/each}
		</div>
	{/if}

	<ByteInspector {bytes} {message} />
</div>
