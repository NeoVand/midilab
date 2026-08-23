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
		bytes: number[];
		/** Pass a message to skip re-parsing; otherwise it is derived from bytes. */
		message?: MidiMessage;
		/** Hide the nibble breakdown and the sentence, for compact contexts. */
		compact?: boolean;
		class?: string;
	}

	let { bytes, message, compact = false, class: className }: Props = $props();

	const msg = $derived(message ?? parse(bytes));
	const fam = $derived(family(msg));
	const colour = $derived(familyColor(fam));
	const sentence = $derived(describe(msg, { octaveConvention: settings.octaveConvention }));

	/** What each byte is for, in the order they appear. */
	const roles = $derived.by(() => {
		const status = bytes[0] ?? 0;
		if (status === 0xf0) {
			return bytes.map((_, i) =>
				i === 0
					? { title: 'Start of SysEx', note: 'Everything until 0xF7 belongs to this message' }
					: i === bytes.length - 1 && bytes[i] === 0xf7
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
					{ title: 'Controller number', note: `Which knob — ${ccInfo(bytes[1] ?? 0).short}` },
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
				for (let i = 1; i < bytes.length; i++) out.push({ title: `Data ${i}`, note: '' });
		}
		return out;
	});

	const isChannelMsg = $derived((bytes[0] ?? 0) >= 0x80 && (bytes[0] ?? 0) < 0xf0);

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

<div class={cn('flex flex-col gap-4', className)} style="--fam: {colour}">
	<div class="flex flex-wrap gap-2.5">
		{#each bytes as byte, i (i)}
			{@const bits = binary(byte)}
			{@const isStatus = byte >= 0x80}
			<div
				class="min-w-[8.5rem] flex-1 rounded-lg border bg-card p-3"
				class:border-[var(--fam)]={i === 0}
			>
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

				<p class="mt-2 text-xs leading-snug text-muted-foreground">
					{#if b0Caption(i, isStatus)}
						<span class="font-medium text-foreground">{b0Caption(i, isStatus)}</span>
					{/if}
					{roles[i]?.note ?? ''}
				</p>
			</div>
		{/each}
	</div>

	{#if !compact && isChannelMsg}
		{@const status = bytes[0]}
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
		<p class="prose-body">
			<span
				class="mr-2 inline-block size-2 translate-y-[-1px] rounded-full align-middle"
				style="background: var(--fam)"
			></span>{sentence}
		</p>
	{/if}
</div>
