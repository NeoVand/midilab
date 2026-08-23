<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
	import { engine } from '$lib/midi/engine.svelte';
	import { CC_TABLE, GM_DRUMS, GM_FAMILIES, GM_PROGRAMS, RPN_TABLE } from '$lib/midi/constants';
	import { knownManufacturers } from '$lib/midi/sysex';
	import { noteName, noteToFrequency } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { GLOSSARY } from '$lib/curriculum/glossary';
	import { cn } from '$lib/utils';

	let q = $state('');
	const query = $derived(q.trim().toLowerCase());
	const match = (...fields: Array<string | number>) =>
		!query || fields.some((f) => String(f).toLowerCase().includes(query));

	const STATUS_BYTES: Array<[string, string, string, string]> = [
		['8n', 'Note Off', 'note, velocity', 'Stop a note. Release velocity is usually ignored.'],
		['9n', 'Note On', 'note, velocity', 'Start a note. Velocity 0 means Note Off.'],
		['An', 'Poly Aftertouch', 'note, pressure', 'Pressure on one note. Rare.'],
		[
			'Bn',
			'Control Change',
			'controller, value',
			'Move a controller — or, at 120–127, a channel mode message.'
		],
		['Cn', 'Program Change', 'program', 'Switch sound. One data byte only.'],
		['Dn', 'Channel Aftertouch', 'pressure', 'Pressure for the whole channel.'],
		['En', 'Pitch Bend', 'LSB, MSB', '14-bit, centred at 8192. LSB first.'],
		['F0', 'System Exclusive', '…, F7', 'Manufacturer-private data of any length.'],
		['F1', 'MTC Quarter Frame', 'nibble', 'One eighth of a timecode position.'],
		['F2', 'Song Position', 'LSB, MSB', 'Sixteenth notes from the start.'],
		['F3', 'Song Select', 'song', ''],
		['F6', 'Tune Request', '—', 'Asks analogue oscillators to retune.'],
		['F7', 'End of SysEx', '—', ''],
		['F8', 'Timing Clock', '—', '24 per quarter note.'],
		['FA', 'Start', '—', 'Play from the beginning.'],
		['FB', 'Continue', '—', 'Play from the song position.'],
		['FC', 'Stop', '—', ''],
		['FE', 'Active Sensing', '—', 'Heartbeat. Silence notes if it stops.'],
		['FF', 'System Reset', '—', 'Power-on state.']
	];

	const drums = Object.entries(GM_DRUMS).map(([n, name]) => [Number(n), name] as const);
	const makers = knownManufacturers();
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8">
	<PageHeader
		title="Reference"
		lead="The tables you keep coming back to. Everything here is the same data the rest of the app runs on."
	>
		{#snippet actions()}
			<Input bind:value={q} placeholder="Filter…" class="h-8 w-56 text-xs" />
		{/snippet}
	</PageHeader>

	<Tabs.Root value="messages" class="gap-4">
		<Tabs.List class="w-fit flex-wrap">
			<Tabs.Trigger value="messages">Messages</Tabs.Trigger>
			<Tabs.Trigger value="cc">Controllers</Tabs.Trigger>
			<Tabs.Trigger value="rpn">RPN</Tabs.Trigger>
			<Tabs.Trigger value="programs">GM programs</Tabs.Trigger>
			<Tabs.Trigger value="drums">GM drums</Tabs.Trigger>
			<Tabs.Trigger value="notes">Notes</Tabs.Trigger>
			<Tabs.Trigger value="makers">Manufacturers</Tabs.Trigger>
			<Tabs.Trigger value="glossary">Glossary</Tabs.Trigger>
		</Tabs.List>

		<!-- Messages -->
		<Tabs.Content value="messages">
			<div class="overflow-hidden rounded-lg border">
				<table class="w-full text-sm">
					<thead class="label bg-muted/50">
						<tr>
							<th class="w-16 px-3 py-2 text-left font-medium">Status</th>
							<th class="px-3 py-2 text-left font-medium">Message</th>
							<th class="px-3 py-2 text-left font-medium">Data bytes</th>
							<th class="hidden px-3 py-2 text-left font-medium sm:table-cell">Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each STATUS_BYTES.filter( ([s, n, d, x]) => match(s, n, d, x) ) as [status, name, data, note] (status)}
							<tr class="border-t">
								<td class="px-3 py-2 font-mono text-msg-note">{status}</td>
								<td class="px-3 py-2">{name}</td>
								<td class="px-3 py-2 font-mono text-xs text-muted-foreground">{data}</td>
								<td class="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{note}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-3 text-xs text-muted-foreground">
				<code class="rounded bg-muted px-1 font-mono">n</code> is the channel nibble, 0–15 on the wire
				and 1–16 on the panel.
			</p>
		</Tabs.Content>

		<!-- Controllers -->
		<Tabs.Content value="cc">
			<div class="overflow-hidden rounded-lg border">
				<table class="w-full text-sm">
					<thead class="label bg-muted/50">
						<tr>
							<th class="w-14 px-3 py-2 text-right font-medium">CC</th>
							<th class="px-3 py-2 text-left font-medium">Name</th>
							<th class="w-24 px-3 py-2 text-left font-medium">Kind</th>
							<th class="hidden px-3 py-2 text-left font-medium lg:table-cell">Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each CC_TABLE.filter( (c) => match(c.number, c.name, c.short, c.description ?? '') ) as c (c.number)}
							<tr class={cn('border-t', c.category === 'undefined' && 'text-muted-foreground/50')}>
								<td class="px-3 py-1.5 text-right font-mono text-msg-cc">{c.number}</td>
								<td class="px-3 py-1.5">{c.name}</td>
								<td class="px-3 py-1.5 text-xs text-muted-foreground">{c.category}</td>
								<td
									class="hidden px-3 py-1.5 text-xs leading-snug text-muted-foreground lg:table-cell"
								>
									{c.description ?? ''}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Tabs.Content>

		<!-- RPN -->
		<Tabs.Content value="rpn">
			<div class="overflow-hidden rounded-lg border">
				<table class="w-full text-sm">
					<thead class="label bg-muted/50">
						<tr>
							<th class="w-24 px-3 py-2 text-left font-medium">MSB,LSB</th>
							<th class="px-3 py-2 text-left font-medium">Parameter</th>
							<th class="px-3 py-2 text-left font-medium">Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each RPN_TABLE.filter((r) => match(r.name, r.description)) as r (r.name)}
							<tr class="border-t">
								<td class="px-3 py-2 font-mono text-xs text-msg-note">{r.msb},{r.lsb}</td>
								<td class="px-3 py-2">{r.name}</td>
								<td class="px-3 py-2 text-xs leading-snug text-muted-foreground">{r.description}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-3 text-xs leading-relaxed text-muted-foreground">
				Select with CC 101 (MSB) and CC 100 (LSB), set with CC 6 and optionally CC 38, then deselect
				with RPN 127,127. NRPNs use CC 99 and CC 98 instead and mean whatever the manufacturer says.
			</p>
		</Tabs.Content>

		<!-- GM programs -->
		<Tabs.Content value="programs" class="flex flex-col gap-4">
			{#each GM_FAMILIES as family, f (family)}
				{@const items = Array.from({ length: 8 }, (_, i) => f * 8 + i).filter((p) =>
					match(p, GM_PROGRAMS[p], family)
				)}
				{#if items.length}
					<div class="flex flex-col gap-1.5">
						<p class="label">
							{family}
							<span class="ml-1 font-mono text-muted-foreground/50">{f * 8}–{f * 8 + 7}</span>
						</p>
						<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
							{#each items as p (p)}
								<button
									class="flex items-baseline gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors hover:border-msg-program"
									onclick={() => {
										engine.wake();
										engine.programChange(p, 0);
									}}
								>
									<span class="tnum w-6 shrink-0 font-mono text-2xs text-muted-foreground">{p}</span
									>
									<span class="truncate">{GM_PROGRAMS[p]}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
			<p class="text-xs text-muted-foreground">
				Click to send a Program Change on channel 1. Program numbers here are byte values 0–127;
				front panels usually show 1–128.
			</p>
		</Tabs.Content>

		<!-- Drums -->
		<Tabs.Content value="drums">
			<div class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
				{#each drums.filter(([n, name]) => match(n, name)) as [n, name] (n)}
					<button
						class="flex items-baseline gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors hover:border-msg-note"
						onclick={() => {
							engine.wake();
							engine.noteOn(n, 110, 9);
							setTimeout(() => engine.noteOff(n, 9), 200);
						}}
					>
						<span class="tnum w-6 shrink-0 font-mono text-2xs text-muted-foreground">{n}</span>
						<span class="truncate">{name}</span>
					</button>
				{/each}
			</div>
			<p class="mt-3 text-xs text-muted-foreground">
				Click to trigger on channel 10. These note numbers are percussion only by General MIDI
				convention — on any other channel they are pitches.
			</p>
		</Tabs.Content>

		<!-- Notes -->
		<Tabs.Content value="notes">
			<div class="flex flex-wrap items-center gap-3 pb-3">
				<span class="text-xs text-muted-foreground">Octave convention</span>
				{#each [['c3', 'Middle C = C3'], ['c4', 'Middle C = C4']] as [v, l] (v)}
					<button
						class={cn(
							'rounded border px-2 py-1 text-xs',
							settings.octaveConvention === v
								? 'border-msg-note text-msg-note'
								: 'text-muted-foreground'
						)}
						onclick={() => (settings.octaveConvention = v as 'c3' | 'c4')}
					>
						{l}
					</button>
				{/each}
			</div>
			<div class="grid gap-1 sm:grid-cols-3 lg:grid-cols-4">
				{#each Array.from({ length: 128 }, (_, n) => n).filter( (n) => match(n, noteName( n, { convention: settings.octaveConvention } ), GM_DRUMS[n] ?? '') ) as n (n)}
					<button
						class="flex items-baseline gap-2 rounded border px-2 py-1 text-left font-mono text-xs transition-colors hover:border-msg-note"
						onclick={() => {
							engine.wake();
							engine.noteOn(n, 100, 0);
							setTimeout(() => engine.noteOff(n, 0), 350);
						}}
					>
						<span class="tnum w-7 shrink-0 text-muted-foreground">{n}</span>
						<span class="w-10 shrink-0"
							>{noteName(n, { convention: settings.octaveConvention })}</span
						>
						<span class="tnum text-muted-foreground/70">{noteToFrequency(n).toFixed(1)}</span>
					</button>
				{/each}
			</div>
		</Tabs.Content>

		<!-- Manufacturers -->
		<Tabs.Content value="makers">
			<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
				{#each makers.filter((m) => match(m.id, m.name)) as m (m.id + m.name)}
					<div class="flex items-baseline gap-2 rounded border px-2.5 py-1.5 text-xs">
						<code class="w-20 shrink-0 font-mono text-2xs text-msg-sysex">{m.id}</code>
						<span class="truncate">{m.name}</span>
					</div>
				{/each}
			</div>
			<p class="mt-3 text-xs leading-relaxed text-muted-foreground">
				The first byte after F0. <code class="rounded bg-muted px-1 font-mono">7E</code> is
				Universal Non-Real Time and <code class="rounded bg-muted px-1 font-mono">7F</code> is
				Universal Real Time — messages any device should understand. IDs beginning
				<code class="rounded bg-muted px-1 font-mono">00</code> are three bytes long.
			</p>
		</Tabs.Content>

		<!-- Glossary -->
		<Tabs.Content value="glossary">
			<div class="flex flex-col gap-2">
				{#each GLOSSARY.filter((g) => match(g.term, g.definition)) as g (g.term)}
					<div class="rounded-lg border p-3.5">
						<p class="text-sm font-medium">{g.term}</p>
						<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{g.definition}</p>
					</div>
				{/each}
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>
