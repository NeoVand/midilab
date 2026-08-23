<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import SearchField from '$lib/components/shell/SearchField.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
	import { onDestroy } from 'svelte';
	import { engine } from '$lib/midi/engine.svelte';
	import {
		CC_TABLE,
		GM_DRUMS,
		GM_FAMILIES,
		GM_PROGRAMS,
		RPN_TABLE,
		type CcCategory
	} from '$lib/midi/constants';
	import { knownManufacturers } from '$lib/midi/sysex';
	import { isBlackKey, noteName, noteOctave, noteToFrequency } from '$lib/midi/notes';
	import { settings } from '$lib/stores/settings.svelte';
	import { GLOSSARY } from '$lib/curriculum/glossary';
	import { rovingGrid } from '$lib/a11y/roving';
	import { cn } from '$lib/utils';

	let q = $state('');
	let tab = $state('messages');
	const query = $derived(q.trim().toLowerCase());
	const match = (...fields: Array<string | number | undefined>) =>
		!query ||
		fields.some((f) =>
			String(f ?? '')
				.toLowerCase()
				.includes(query)
		);

	/* ---------------------------------------------------------------- data */

	interface StatusRow {
		status: string;
		name: string;
		data: string;
		note: string;
		group: 'Channel voice' | 'System';
	}

	const STATUS_BYTES: StatusRow[] = [
		{
			status: '8n',
			name: 'Note Off',
			data: 'note, velocity',
			note: 'Stop a note. Release velocity is usually ignored.',
			group: 'Channel voice'
		},
		{
			status: '9n',
			name: 'Note On',
			data: 'note, velocity',
			note: 'Start a note. Velocity 0 means Note Off.',
			group: 'Channel voice'
		},
		{
			status: 'An',
			name: 'Poly Aftertouch',
			data: 'note, pressure',
			note: 'Pressure on one note. Rare.',
			group: 'Channel voice'
		},
		{
			status: 'Bn',
			name: 'Control Change',
			data: 'controller, value',
			note: 'Move a controller — or, at 120–127, a channel mode message.',
			group: 'Channel voice'
		},
		{
			status: 'Cn',
			name: 'Program Change',
			data: 'program',
			note: 'Switch sound. One data byte only.',
			group: 'Channel voice'
		},
		{
			status: 'Dn',
			name: 'Channel Aftertouch',
			data: 'pressure',
			note: 'Pressure for the whole channel.',
			group: 'Channel voice'
		},
		{
			status: 'En',
			name: 'Pitch Bend',
			data: 'LSB, MSB',
			note: '14-bit, centred at 8192. LSB first.',
			group: 'Channel voice'
		},
		{
			status: 'F0',
			name: 'System Exclusive',
			data: '…, F7',
			note: 'Manufacturer-private data of any length.',
			group: 'System'
		},
		{
			status: 'F1',
			name: 'MTC Quarter Frame',
			data: 'nibble',
			note: 'One eighth of a timecode position.',
			group: 'System'
		},
		{
			status: 'F2',
			name: 'Song Position',
			data: 'LSB, MSB',
			note: 'Sixteenth notes from the start.',
			group: 'System'
		},
		{
			status: 'F3',
			name: 'Song Select',
			data: 'song',
			note: 'Cue a song by number. Almost nothing implements it.',
			group: 'System'
		},
		{
			status: 'F6',
			name: 'Tune Request',
			data: '—',
			note: 'Asks analogue oscillators to retune.',
			group: 'System'
		},
		{
			status: 'F7',
			name: 'End of SysEx',
			data: '—',
			note: 'Closes an F0 block. Never appears on its own.',
			group: 'System'
		},
		{
			status: 'F8',
			name: 'Timing Clock',
			data: '—',
			note: '24 per quarter note.',
			group: 'System'
		},
		{ status: 'FA', name: 'Start', data: '—', note: 'Play from the beginning.', group: 'System' },
		{
			status: 'FB',
			name: 'Continue',
			data: '—',
			note: 'Play from the song position.',
			group: 'System'
		},
		{ status: 'FC', name: 'Stop', data: '—', note: 'Stop, holding position.', group: 'System' },
		{
			status: 'FE',
			name: 'Active Sensing',
			data: '—',
			note: 'Heartbeat. Silence notes if it stops.',
			group: 'System'
		},
		{ status: 'FF', name: 'System Reset', data: '—', note: 'Power-on state.', group: 'System' }
	];

	const CC_KIND: Record<CcCategory, string> = {
		continuous: 'Continuous',
		switch: 'Switch',
		lsb: 'Fine (LSB)',
		sound: 'Sound',
		effect: 'Effect',
		data: 'Data entry',
		mode: 'Channel mode',
		undefined: 'Undefined'
	};

	const drums = Object.entries(GM_DRUMS).map(([n, name]) => [Number(n), name] as const);
	const makers = knownManufacturers();
	const glossary = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));

	/* ------------------------------------------------------------- filtering */

	const messages = $derived(STATUS_BYTES.filter((r) => match(r.status, r.name, r.data, r.note)));
	const ccs = $derived(CC_TABLE.filter((c) => match(c.number, c.name, c.short, c.description)));
	const rpns = $derived(RPN_TABLE.filter((r) => match(r.name, r.description, `${r.msb},${r.lsb}`)));
	const programHits = $derived(
		Array.from({ length: 128 }, (_, p) => p).filter((p) =>
			match(p, GM_PROGRAMS[p], GM_FAMILIES[Math.floor(p / 8)])
		)
	);
	const programGroups = $derived(
		GM_FAMILIES.map((family, f) => ({
			family,
			f,
			items: programHits.filter((p) => Math.floor(p / 8) === f)
		})).filter((g) => g.items.length)
	);
	const drumHits = $derived(drums.filter(([n, name]) => match(n, name)));
	const noteHits = $derived(
		Array.from({ length: 128 }, (_, n) => n).filter((n) =>
			match(n, noteName(n, { convention: settings.octaveConvention }), GM_DRUMS[n])
		)
	);
	const noteRows = $derived.by(() => {
		const rows: Array<{ octave: number; notes: number[] }> = [];
		for (const n of noteHits) {
			const octave = noteOctave(n, settings.octaveConvention);
			const last = rows.at(-1);
			if (last && last.octave === octave) last.notes.push(n);
			else rows.push({ octave, notes: [n] });
		}
		return rows;
	});
	const makerHits = $derived(makers.filter((m) => match(m.id, m.name)));
	const glossaryHits = $derived(glossary.filter((g) => match(g.term, g.definition)));

	const TABS = $derived([
		{ value: 'messages', label: 'Messages', count: messages.length },
		{ value: 'cc', label: 'Controllers', count: ccs.length },
		{ value: 'rpn', label: 'RPN', count: rpns.length },
		{ value: 'programs', label: 'GM programs', count: programHits.length },
		{ value: 'drums', label: 'GM drums', count: drumHits.length },
		{ value: 'notes', label: 'Notes', count: noteHits.length },
		{ value: 'makers', label: 'Manufacturers', count: makerHits.length },
		{ value: 'glossary', label: 'Glossary', count: glossaryHits.length }
	]);
	const elsewhere = $derived(TABS.filter((t) => t.value !== tab && t.count > 0));

	/* ------------------------------------------------------------ auditioning */

	let sounding = $state<{ note: number; channel: number } | null>(null);
	let program = $state<number | null>(null);
	let release = 0;

	/**
	 * A Program Change makes no sound, which is the whole point of the message —
	 * and also why a table of 128 silent buttons is useless. Each one selects the
	 * program and then plays a note through it so you hear what you picked.
	 */
	function auditionProgram(p: number) {
		engine.wake();
		engine.programChange(p, 0);
		program = p;
		play(60, 96, 0, 700);
	}

	function play(note: number, velocity: number, channel: number, ms: number) {
		// Release the previous note on *its own* channel. Auditioning a drum on 10
		// and then a program on 1 used to send the release to the wrong channel
		// and leave the drum held for good.
		stop();
		engine.noteOn(note, velocity, channel);
		sounding = { note, channel };
		release = window.setTimeout(stop, ms);
	}

	function stop() {
		clearTimeout(release);
		if (sounding) engine.noteOff(sounding.note, sounding.channel);
		sounding = null;
	}

	onDestroy(stop);

	const CHIP =
		'flex items-baseline gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-xs transition-colors';
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8">
	<PageHeader
		title="Reference"
		lead="The tables you keep coming back to — the same data the rest of the app runs on."
	>
		{#snippet actions()}
			<SearchField
				bind:value={q}
				shortcut="/"
				placeholder="Search every table…"
				class="w-64 sm:w-72"
			/>
		{/snippet}
	</PageHeader>

	<Tabs.Root bind:value={tab} class="gap-4">
		<Tabs.List class="w-fit flex-wrap">
			{#each TABS as t (t.value)}
				<Tabs.Trigger value={t.value} class={cn(query && !t.count && 'opacity-40')}>
					{t.label}
					{#if query}
						<span class="tnum ml-1.5 font-mono text-2xs text-muted-foreground">{t.count}</span>
					{/if}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		<!-- Messages -->
		<Tabs.Content value="messages">
			{#if messages.length}
				<div class="overflow-hidden rounded-lg border">
					<table class="w-full text-sm">
						<thead class="label bg-muted/50">
							<tr>
								<th class="w-16 px-3 py-2 text-left font-medium">Status</th>
								<th class="px-3 py-2 text-left font-medium">Message</th>
								<th class="w-40 px-3 py-2 text-left font-medium">Data bytes</th>
								<th class="hidden px-3 py-2 text-left font-medium sm:table-cell">Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each messages as row, i (row.status)}
								{#if i === 0 || messages[i - 1].group !== row.group}
									<tr class="border-t bg-surface-sunken">
										<th
											colspan="4"
											class="label px-3 py-1.5 text-left text-muted-foreground"
											scope="colgroup"
										>
											{row.group}
										</th>
									</tr>
								{/if}
								<tr class="border-t transition-colors hover:bg-muted/40">
									<td class="px-3 py-2 font-mono text-msg-note">{row.status}</td>
									<td class="px-3 py-2">{row.name}</td>
									<td class="px-3 py-2 font-mono text-xs text-muted-foreground">{row.data}</td>
									<td class="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
										{row.note}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="measure mt-3 text-xs leading-relaxed text-muted-foreground">
					<code class="rounded-sm bg-muted px-1 font-mono">n</code> is the channel nibble, 0–15 on the
					wire and 1–16 on the panel. Channel voice messages carry an address; system messages are for
					everyone listening on the cable at once.
				</p>
			{:else}
				{@render noMatches('messages')}
			{/if}
		</Tabs.Content>

		<!-- Controllers -->
		<Tabs.Content value="cc">
			{#if ccs.length}
				<div class="overflow-hidden rounded-lg border">
					<table class="w-full text-sm">
						<thead class="label bg-muted/50">
							<tr>
								<th class="w-14 px-3 py-2 text-right font-medium">CC</th>
								<th class="px-3 py-2 text-left font-medium">Name</th>
								<th class="w-40 px-3 py-2 text-left font-medium">Kind</th>
								<th class="hidden px-3 py-2 text-left font-medium lg:table-cell">Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each ccs as c (c.number)}
								<tr
									class={cn(
										'border-t transition-colors hover:bg-muted/40',
										c.category === 'undefined' && 'text-muted-foreground'
									)}
								>
									<td class="px-3 py-1.5 text-right font-mono text-msg-cc">{c.number}</td>
									<td class="px-3 py-1.5">{c.name}</td>
									<td class="px-3 py-1.5 text-xs text-muted-foreground">
										{CC_KIND[c.category]}
										{#if c.lsb !== undefined}
											<span class="block font-mono text-2xs text-muted-foreground">
												fine half: CC {c.lsb}
											</span>
										{:else if c.msb !== undefined}
											<span class="block font-mono text-2xs text-muted-foreground">
												fine half of CC {c.msb}
											</span>
										{/if}
									</td>
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
				<div class="measure mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
					<p>
						Controllers 0–31 each have a fine half at 32 higher, giving 14-bit resolution when a
						device bothers to send both. Almost none do.
					</p>
					<p>
						Only the channel mode messages at 120–127 and the bank, data-entry and RPN mechanics are
						behaviour the specification requires. Every other name here is a convention: a synth in
						its native mode is free to map CC 74 to anything it likes, and the implementation chart
						in its manual is the only place that says what it actually does.
					</p>
					<p>
						Reset All Controllers (CC 121) is defined to put Expression back to 127, Modulation to
						0, pedals off, pitch bend to centre and the RPN selection to null — but it deliberately
						leaves Volume, Pan and Bank alone.
					</p>
				</div>
			{:else}
				{@render noMatches('controllers')}
			{/if}
		</Tabs.Content>

		<!-- RPN -->
		<Tabs.Content value="rpn">
			{#if rpns.length}
				<div class="overflow-hidden rounded-lg border">
					<table class="w-full text-sm">
						<thead class="label bg-muted/50">
							<tr>
								<th class="w-24 px-3 py-2 text-left font-medium">MSB,LSB</th>
								<th class="w-64 px-3 py-2 text-left font-medium">Parameter</th>
								<th class="px-3 py-2 text-left font-medium">Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each rpns as r (r.name)}
								<tr class="border-t transition-colors hover:bg-muted/40">
									<td class="px-3 py-2 font-mono text-xs text-msg-note">{r.msb},{r.lsb}</td>
									<td class="px-3 py-2">{r.name}</td>
									<td class="px-3 py-2 text-xs leading-snug text-muted-foreground">
										{r.description}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="measure mt-3 text-xs leading-relaxed text-muted-foreground">
					Select with CC 101 (MSB) and CC 100 (LSB), set with CC 6 and optionally CC 38, then
					deselect with RPN 127,127. NRPNs use CC 99 and CC 98 instead and mean whatever the
					manufacturer says.
				</p>
			{:else}
				{@render noMatches('parameters')}
			{/if}
		</Tabs.Content>

		<!-- GM programs -->
		<Tabs.Content value="programs" class="flex flex-col gap-4">
			{#if programGroups.length}
				{#each programGroups as g (g.family)}
					<div class="flex flex-col gap-1.5">
						<p class="label flex items-baseline gap-2">
							{g.family}
							<span class="font-mono text-muted-foreground">{g.f * 8}–{g.f * 8 + 7}</span>
						</p>
						<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4" use:rovingGrid>
							{#each g.items as p (p)}
								<button
									class={cn(
										CHIP,
										'hover:border-msg-program',
										program === p && 'border-msg-program bg-msg-program/8'
									)}
									onclick={() => auditionProgram(p)}
								>
									<span class="tnum w-6 shrink-0 font-mono text-2xs text-muted-foreground">
										{p}
									</span>
									<span class="truncate">{GM_PROGRAMS[p]}</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
				<p class="measure text-xs leading-relaxed text-muted-foreground">
					Clicking sends a Program Change on channel 1 and then plays middle C through it, because a
					Program Change on its own is silent. Program numbers here are byte values 0–127; front
					panels usually show 1–128. The synth in this page has one voice per family, so the eight
					programs in a row sound alike here — on a General MIDI device they don't.
				</p>
			{:else}
				{@render noMatches('programs')}
			{/if}
		</Tabs.Content>

		<!-- Drums -->
		<Tabs.Content value="drums">
			{#if drumHits.length}
				<div class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" use:rovingGrid>
					{#each drumHits as [n, name] (n)}
						<button
							class={cn(CHIP, 'hover:border-msg-note', sounding?.note === n && 'border-msg-note')}
							onclick={() => {
								engine.wake();
								play(n, 110, 9, 220);
							}}
						>
							<span class="tnum w-6 shrink-0 font-mono text-2xs text-muted-foreground">{n}</span>
							<span class="truncate">{name}</span>
						</button>
					{/each}
				</div>
				<p class="measure mt-3 text-xs leading-relaxed text-muted-foreground">
					Click to trigger on channel 10. These note numbers are percussion only by General MIDI
					convention — on any other channel they are pitches.
				</p>
			{:else}
				{@render noMatches('drum sounds')}
			{/if}
		</Tabs.Content>

		<!-- Notes -->
		<Tabs.Content value="notes" class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-2">
				<span class="label">Octave convention</span>
				{#each [['c3', 'Middle C = C3'], ['c4', 'Middle C = C4']] as [v, l] (v)}
					<button
						class={cn(
							'rounded-md border px-2 py-1 text-xs transition-colors',
							settings.octaveConvention === v
								? 'border-msg-note bg-msg-note/8 text-msg-note'
								: 'text-muted-foreground hover:border-foreground/25'
						)}
						onclick={() => (settings.octaveConvention = v as 'c3' | 'c4')}
					>
						{l}
					</button>
				{/each}
				<span class="ml-auto text-xs text-muted-foreground">
					Roland counts from C-1, Yamaha from C-2. Both are right; pick the one your gear prints.
				</span>
			</div>

			{#if noteRows.length}
				<!--
					One stop for the whole map, twelve columns wide: arrow keys walk it
					the way a hand walks a keybed, and Tab steps over it to the note
					underneath rather than through a hundred and twenty-eight of them.
				-->
				<div class="overflow-hidden rounded-lg border" use:rovingGrid={{ columns: 12 }}>
					{#each noteRows as row, i (row.octave)}
						<div class={cn('flex items-stretch', i > 0 && 'border-t')}>
							<div
								class="tnum grid w-10 shrink-0 place-items-center border-r bg-surface-sunken font-mono text-xs text-muted-foreground"
							>
								{row.octave}
							</div>
							<div class="grid flex-1 grid-cols-6 sm:grid-cols-12">
								{#each row.notes as n (n)}
									{@const black = isBlackKey(n)}
									<button
										title="Note {n} · {noteName(n, {
											convention: settings.octaveConvention
										})} · {noteToFrequency(n).toFixed(2)} Hz{GM_DRUMS[n]
											? ` · on channel 10, ${GM_DRUMS[n]}`
											: ''}"
										class={cn(
											'flex flex-col items-center gap-0.5 border-l px-1 py-1.5 transition-colors first:border-l-0',
											black ? 'bg-surface-sunken' : 'bg-card',
											sounding?.note === n ? 'bg-msg-note/15' : 'hover:bg-msg-note/8'
										)}
										onclick={() => {
											engine.wake();
											play(n, 100, 0, 350);
										}}
									>
										<span
											class={cn(
												'font-mono text-xs',
												black ? 'text-muted-foreground' : 'text-foreground'
											)}
										>
											{noteName(n, { convention: settings.octaveConvention, octave: false })}
										</span>
										<span class="tnum font-mono text-2xs text-muted-foreground">
											{n} · {noteToFrequency(n).toFixed(n < 24 ? 1 : 0)}
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<p class="measure text-xs leading-relaxed text-muted-foreground">
					Every note number, its name in the convention you chose, and its equal-tempered frequency
					in hertz at A4 = 440. The shaded columns are the black keys. Note 60 is middle C on every
					device ever made — only the octave <em>label</em> is in dispute.
				</p>
			{:else}
				{@render noMatches('notes')}
			{/if}
		</Tabs.Content>

		<!-- Manufacturers -->
		<Tabs.Content value="makers">
			{#if makerHits.length}
				<div class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
					{#each makerHits as m (m.id + m.name)}
						<div class={cn(CHIP, 'py-1')}>
							<code class="w-20 shrink-0 font-mono text-2xs text-msg-sysex">{m.id}</code>
							<span class="truncate">{m.name}</span>
						</div>
					{/each}
				</div>
				<p class="measure mt-3 text-xs leading-relaxed text-muted-foreground">
					The first byte after F0. <code class="rounded-sm bg-muted px-1 font-mono">7E</code> is
					Universal Non-Real Time and <code class="rounded-sm bg-muted px-1 font-mono">7F</code> is
					Universal Real Time — messages any device should understand. IDs beginning
					<code class="rounded-sm bg-muted px-1 font-mono">00</code> are three bytes long. This is the
					well-known subset, not the full registry.
				</p>
			{:else}
				{@render noMatches('manufacturers')}
			{/if}
		</Tabs.Content>

		<!-- Glossary -->
		<Tabs.Content value="glossary">
			{#if glossaryHits.length}
				<dl class="overflow-hidden rounded-lg border">
					{#each glossaryHits as g, i (g.term)}
						<div
							class={cn(
								'grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[13rem_1fr]',
								i > 0 && 'border-t'
							)}
						>
							<dt class="text-sm font-medium">{g.term}</dt>
							<dd class="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
								{g.definition}
							</dd>
						</div>
					{/each}
				</dl>
			{:else}
				{@render noMatches('terms')}
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>

{#snippet noMatches(what: string)}
	<div class="rounded-lg border border-dashed px-4 py-10 text-center">
		<p class="text-sm text-muted-foreground">
			No {what} match <span class="font-mono text-foreground">{q}</span>.
		</p>
		{#if elsewhere.length}
			<p class="mt-2 text-xs text-muted-foreground">
				Found in
				{#each elsewhere as t, i (t.value)}<button
						class="text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
						onclick={() => (tab = t.value)}>{t.label}</button
					><span class="tnum font-mono text-muted-foreground">&nbsp;{t.count}</span>{i <
					elsewhere.length - 1
						? ', '
						: '.'}{/each}
			</p>
		{/if}
	</div>
{/snippet}
