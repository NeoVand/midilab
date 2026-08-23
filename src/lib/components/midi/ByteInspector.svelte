<script lang="ts" module>
	function b0Caption(index: number, isStatus: boolean): string {
		if (index !== 0) return isStatus ? '' : 'Top bit 0 — data. ';
		return isStatus ? 'Top bit 1 — status. ' : '';
	}
</script>

<script lang="ts">
	/**
	 * The byte inspector: one MIDI message, taken apart.
	 *
	 * Hex → bits → the one bit that decides everything → nibbles → a sentence in
	 * English. Every other explanation of MIDI's binary layout is a picture in a
	 * book; this one is fed by whatever actually just went down the wire.
	 */
	import {
		binary,
		describe,
		family,
		familyColor,
		hex,
		parse,
		type MidiMessage
	} from '$lib/midi/messages';
	import { ccInfo } from '$lib/midi/constants';
	import { settings } from '$lib/stores/settings.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		/**
		 * The message to take apart, or null for the readout waiting for one.
		 * Both states live here so they cannot drift apart in size — the whole
		 * point of the waiting state is that nothing moves when it fills in.
		 */
		bytes: number[] | null;
		/** Pass a message to skip re-parsing; otherwise it is derived from bytes. */
		message?: MidiMessage;
		/** Hide the nibble breakdown and the sentence, for compact contexts. */
		compact?: boolean;
		class?: string;
	}

	let { bytes, message, compact = false, class: className }: Props = $props();

	/**
	 * The bytes to reason about. Null means the readout is waiting for a
	 * message; an empty array lets every derivation below stay a one-liner
	 * instead of carrying a guard, because it parses and renders to nothing.
	 */
	const data = $derived(bytes ?? []);
	const msg = $derived(message ?? parse(data));

	/** The three cards a note makes, which is what a readout is usually waiting for. */
	const WAITING = [
		{ title: 'Status byte', note: 'What kind of message, and on which channel' },
		{ title: 'Note number', note: '0–127, middle C is 60' },
		{ title: 'Velocity', note: 'How hard it was struck' }
	];
	const BITS = [0, 1, 2, 3, 4, 5, 6, 7];
	const fam = $derived(family(msg));
	const colour = $derived(familyColor(fam));
	const sentence = $derived(describe(msg, { octaveConvention: settings.octaveConvention }));

	/** What each byte is for, in the order they appear. */
	const roles = $derived.by(() => {
		const status = data[0] ?? 0;
		if (status === 0xf0) {
			return data.map((_, i) =>
				i === 0
					? { title: 'Start of SysEx', note: 'Everything until 0xF7 belongs to this message' }
					: i === data.length - 1 && data[i] === 0xf7
						? { title: 'End of SysEx', note: 'The only status byte allowed to terminate it' }
						: { title: `Byte ${i}`, note: 'Manufacturer-defined payload' }
			);
		}
		const out = [{ title: 'Status byte', note: 'What kind of message, and on which channel' }];
		switch (msg.type) {
			case 'noteOn':
			case 'noteOff':
				out.push(
					{ title: 'Note number', note: '0–127, middle C is 60' },
					{ title: 'Velocity', note: 'How hard it was struck' }
				);
				break;
			case 'controlChange':
				out.push(
					{ title: 'Controller number', note: `Which knob — ${ccInfo(data[1] ?? 0).short}` },
					{ title: 'Value', note: '0–127' }
				);
				break;
			case 'programChange':
				out.push({ title: 'Program number', note: 'Which sound to switch to' });
				break;
			case 'channelAftertouch':
				out.push({ title: 'Pressure', note: 'Applies to every note on the channel' });
				break;
			case 'polyAftertouch':
				out.push(
					{ title: 'Note number', note: 'Which note is being pressed' },
					{ title: 'Pressure', note: 'This note only' }
				);
				break;
			case 'pitchBend':
				out.push(
					{ title: 'Bend LSB', note: 'The fine seven bits — sent first' },
					{ title: 'Bend MSB', note: 'The coarse seven bits' }
				);
				break;
			case 'songPosition':
				out.push({ title: 'Position LSB', note: '' }, { title: 'Position MSB', note: '' });
				break;
			default:
				for (let i = 1; i < data.length; i++) out.push({ title: `Data ${i}`, note: '' });
		}
		return out;
	});

	const isChannelMsg = $derived((data[0] ?? 0) >= 0x80 && (data[0] ?? 0) < 0xf0);

	const TYPE_NIBBLES: Record<number, string> = {
		0x8: 'Note Off',
		0x9: 'Note On',
		0xa: 'Poly Aftertouch',
		0xb: 'Control Change',
		0xc: 'Program Change',
		0xd: 'Channel Aftertouch',
		0xe: 'Pitch Bend',
		0xf: 'System'
	};
</script>

{#if bytes === null}
	<!--
		Not an apology for having no data — the readout itself, waiting. The same
		cards in the same places at the same size, drawn dashed and blank, with
		the one bit the whole course turns on already marked. So nothing moves
		when the first message lands: the blanks simply fill in.
	-->
	<div class={cn('flex flex-col gap-4', className)}>
		<div class="flex flex-wrap gap-2.5">
			{#each WAITING as card, i (card.title)}
				<div class="min-w-[8.5rem] flex-1 rounded-lg border border-dashed p-3">
					<div class="label mb-1 flex items-baseline justify-between">
						<span>{card.title}</span>
						<span class="tnum">{i}</span>
					</div>
					<!-- A blank readout, in the shape the real one takes: 0x__ and a decimal. -->
					<div class="mb-2 flex items-baseline gap-2">
						<span class="font-mono text-2xl leading-none font-medium text-muted-foreground/45">
							0x--
						</span>
						<span class="tnum font-mono text-xs text-muted-foreground/45">---</span>
					</div>
					<div class="flex gap-[3px]" aria-hidden="true">
						{#each BITS as b (b)}
							<!--
								An empty cell has no text to make it visible, so it cannot
								borrow `bg-muted` from the real card — on a light card that
								leaves one green square floating in nothing.
							-->
							<span
								class={cn(
									'h-6 w-[15px] rounded-xs',
									b !== 0
										? 'bg-foreground/10'
										: i === 0
											? 'bg-msg-note/70'
											: 'bg-muted-foreground/45'
								)}
							></span>
						{/each}
					</div>
					<p class="mt-2 min-h-8 text-xs leading-snug text-muted-foreground">{card.note}</p>
				</div>
			{/each}
		</div>
		{#if !compact}
			<p class="text-base leading-relaxed text-muted-foreground">
				Play a key, or send something from a device. This reads the message back to you in hex, in
				bits, and in English.
			</p>
		{/if}
	</div>
{:else}
	<div class={cn('flex flex-col gap-4', className)} style="--fam: {colour}">
		<div class="flex flex-wrap gap-2.5">
			{#each data as byte, i (i)}
				{@const bits = binary(byte)}
				{@const isStatus = byte >= 0x80}
				<!--
				No coloured outline on the status byte. The card is headed "Status
				byte", its top bit is already drawn in the family colour, and a
				third marker saying the same thing is chrome, not information.
			-->
				<div class="min-w-[8.5rem] flex-1 rounded-lg border bg-card p-3">
					<div class="label mb-1 flex items-baseline justify-between">
						<span>{roles[i]?.title ?? `Byte ${i}`}</span>
						<span class="tnum">{i}</span>
					</div>

					<div class="mb-2 flex items-baseline gap-2">
						<span class="font-mono text-2xl leading-none font-medium" style="color: var(--fam)">
							{hex(byte)}
						</span>
						<span class="tnum font-mono text-xs text-muted-foreground">{byte}</span>
					</div>

					<!-- The bits. The leftmost one is the entire trick. -->
					<div class="flex gap-[3px]" aria-label="binary {bits}">
						{#each bits.split('') as bit, b (b)}
							<span
								class={cn(
									'grid h-6 w-[15px] place-items-center rounded-xs font-mono text-xs leading-none',
									b === 0
										? 'font-semibold text-background'
										: bit === '1'
											? 'bg-foreground/12 text-foreground'
											: 'bg-muted text-muted-foreground'
								)}
								style={b === 0
									? `background:${isStatus ? 'var(--fam)' : 'var(--muted-foreground)'}`
									: ''}
							>
								{bit}
							</span>
						{/each}
					</div>

					<!-- Two lines of room, so cards in a row stay the same height. -->
					<p class="mt-2 min-h-8 text-xs leading-snug text-muted-foreground">
						{#if b0Caption(i, isStatus)}
							<span class="font-medium text-foreground">{b0Caption(i, isStatus)}</span>
						{/if}
						{roles[i]?.note ?? ''}
					</p>
				</div>
			{/each}
		</div>

		{#if !compact && isChannelMsg}
			{@const status = data[0]}
			{@const hi = (status >> 4) & 0xf}
			{@const lo = status & 0xf}
			<div
				class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-surface-sunken p-3 text-sm"
			>
				<span class="label">Status byte, split</span>
				<div class="flex items-center gap-2">
					<code class="rounded-md border bg-background px-1.5 py-0.5 font-mono text-xs">
						{binary(status).slice(0, 4)}
					</code>
					<span class="text-muted-foreground">→</span>
					<span class="font-medium" style="color: var(--fam)">{TYPE_NIBBLES[hi] ?? 'System'}</span>
				</div>
				<div class="flex items-center gap-2">
					<code class="rounded-md border bg-background px-1.5 py-0.5 font-mono text-xs">
						{binary(status).slice(4)}
					</code>
					<span class="text-muted-foreground">→</span>
					<span class="font-medium">channel {lo + 1}</span>
					<span class="text-xs text-muted-foreground"
						>(wire value {lo} — MIDI counts from zero, humans from one)</span
					>
				</div>
			</div>
		{/if}

		{#if !compact}
			<!--
			This is a status line, not prose, so it does not take the 52-character
			measure the rest of the app reads at — and at full width the sentences
			that alternate fastest ("Start playing C3…" and the Note Off right
			behind it) both fit on one line, which is what stops the panel jumping.
			Reserving a second line instead just left a hole under every short one.
		-->
			<p class="text-base leading-relaxed">
				<span
					class="mr-2 inline-block size-2 translate-y-[-1px] rounded-full align-middle"
					style="background: var(--fam)"
				></span>{sentence}
			</p>
		{/if}
	</div>
{/if}
