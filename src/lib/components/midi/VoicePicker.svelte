<script lang="ts">
	/**
	 * The instrument a demonstration speaks through, changeable in place.
	 *
	 * Two problems, one control.
	 *
	 * The first is a bug this fixes rather than papers over: widgets share the
	 * engine's channel, so a demonstration that never sends a Program Change
	 * plays through whatever the previous one left behind. A lesson about
	 * consonance played through a woodblock is not a lesson about consonance —
	 * a percussive one-shot has no sustain, so two notes never overlap long
	 * enough to beat against each other, and the entire point is inaudible. So
	 * every demo now names its own voice and sends it at play time.
	 *
	 * The second is that the *right* voice is a matter of taste as well as of
	 * physics. Somebody who finds the default piano dull should be able to hear
	 * the same interval on strings, and hearing it on four instruments is
	 * genuinely better teaching than hearing it on one — it separates the thing
	 * being demonstrated from the timbre demonstrating it.
	 *
	 * So the control is deliberately quiet: the instrument's name in small grey
	 * type, and nothing else until you press it. It is furniture until you want
	 * it, and then it is a full General MIDI browser.
	 */
	import { onDestroy } from 'svelte';
	import * as Popover from '$lib/components/ui/popover';
	import * as Field from '$lib/components/ui/field';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Empty from '$lib/components/ui/empty';
	import { engine } from '$lib/midi/engine.svelte';
	import { DRUM_KITS, drumKit } from '$lib/audio/drum-machines';
	import { gm } from '$lib/audio/gm.svelte';
	import { GM_FAMILIES, GM_PROGRAMS } from '$lib/midi/constants';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowUpDownIcon, Cancel01Icon, SearchIcon } from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		/** The chosen program. Bind it; the caller sends it when it plays. */
		value: number;
		/** Channel to audition on, and to apply the change to immediately. */
		channel?: number;
		/**
		 * Play a short note on picking, so choosing is a decision you can hear
		 * rather than one you have to commit to and then re-run the demo for.
		 */
		audition?: boolean;
		/**
		 * Told about a pick, for callers whose own state is not a plain number —
		 * `MelodyPlayer` holds `null` to mean "whatever this melody suggests",
		 * which cannot be the target of a two-way binding.
		 */
		onValue?: (program: number) => void;
		title?: string;
		class?: string;
	}
	let {
		value = $bindable(0),
		channel = 0,
		audition = true,
		onValue,
		title = 'Choose an instrument',
		class: className
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);
	let results: HTMLDivElement | null = null;
	const searchId = $props.id();
	const searchLabel = $derived(channel === 9 ? 'Search drum kits' : 'Search instruments');
	const filteredKits = $derived(
		DRUM_KITS.filter((kit) => matches(kit.program, [kit.name, kit.machine, kit.description], true))
	);
	const filteredFamilies = $derived(
		GM_FAMILIES.map((family, f) => ({
			family,
			programs: Array.from({ length: 8 }, (_, i) => f * 8 + i).filter((program) =>
				matches(program, [GM_PROGRAMS[program], family])
			)
		})).filter(({ programs }) => programs.length > 0)
	);
	const noResults = $derived(
		channel === 9 ? filteredKits.length === 0 : filteredFamilies.length === 0
	);
	let offTimer = 0;
	let playingNote: { note: number; channel: number } | null = null;
	let pickVersion = 0;

	function matches(program: number, names: string[], matchNumbersInNames = false) {
		const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
		const text = names.join(' ').toLocaleLowerCase();
		return words.every((word) => {
			if (/^\d+$/.test(word) && !matchNumbersInNames) return Number(word) === program;
			return text.includes(word) || Number(word) === program;
		});
	}

	function setOpen(next: boolean) {
		if (next) query = '';
		open = next;
	}

	function clearSearch() {
		query = '';
		searchInput?.focus();
	}

	function optionButtons() {
		return Array.from(results?.querySelectorAll<HTMLButtonElement>('[data-voice-option]') ?? []);
	}

	function captureResults(element: HTMLDivElement) {
		results = element;
		return () => {
			if (results === element) results = null;
		};
	}

	function searchKeydown(event: KeyboardEvent) {
		if (event.isComposing) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const options = optionButtons();
			event.preventDefault();
			options[event.key === 'ArrowDown' ? 0 : options.length - 1]?.focus();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			optionButtons()[0]?.click();
		}
	}

	function optionKeydown(event: KeyboardEvent) {
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const options = optionButtons();
		const index = options.indexOf(event.currentTarget as HTMLButtonElement);
		if (event.key === 'Home') options[0]?.focus();
		else if (event.key === 'End') options.at(-1)?.focus();
		else if (event.key === 'ArrowUp' && index === 0) searchInput?.focus();
		else
			options[
				(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
			]?.focus();
	}

	function stopAudition() {
		clearTimeout(offTimer);
		if (playingNote) engine.noteOff(playingNote.note, playingNote.channel, 0, 'demo');
		playingNote = null;
	}

	async function pick(p: number) {
		const version = ++pickVersion;
		const sendingChannel = channel;
		stopAudition();
		value = p;
		open = false;
		onValue?.(p);
		await engine.wake();
		if (version !== pickVersion) return;
		engine.programChange(p, sendingChannel);
		if (!audition) return;
		const note = sendingChannel === 9 ? 38 : 64;
		playingNote = { note, channel: sendingChannel };
		engine.noteOn(note, 90, sendingChannel, 'demo');
		offTimer = window.setTimeout(stopAudition, 600);
	}

	function cancelAudition() {
		pickVersion++;
		stopAudition();
	}
	onDestroy(cancelAudition);
	$effect(() => {
		void channel;
		return cancelAudition;
	});
</script>

<Popover.Root bind:open={() => open, setOpen}>
	<Popover.Trigger
		class={cn(
			'flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
			className
		)}
		{title}
	>
		<span class="max-w-[9rem] min-w-0 truncate"
			>{channel === 9 ? drumKit(value).name : GM_PROGRAMS[value]}</span
		>
		<HugeiconsIcon icon={ArrowUpDownIcon} size={11} class="shrink-0 opacity-70" />
	</Popover.Trigger>
	{#if channel === 9 && gm.enabled}
		{#if gm.stateOfDrums(value) === 'loading'}<span class="text-2xs text-muted-foreground"
				>Loading kit…</span
			>
		{:else if gm.stateOfDrums(value) === 'failed'}<span class="text-2xs text-muted-foreground"
				>Synth fallback</span
			>{/if}
	{/if}
	<Popover.Content
		class="w-[min(28rem,calc(100vw-2rem))] gap-0 p-0"
		sideOffset={6}
		align="end"
		onOpenAutoFocus={(event) => {
			event.preventDefault();
			searchInput?.focus();
		}}
	>
		<div class="border-b px-3 py-3">
			<p class="text-xs font-medium">{channel === 9 ? 'Drum kit' : 'Instrument'}</p>
			<p class="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
				Choose a sound for channel {channel + 1}.
			</p>
			<Field.FieldGroup class="mt-2">
				<Field.Field>
					<Field.FieldLabel class="sr-only" for={searchId}>{searchLabel}</Field.FieldLabel>
					<InputGroup.Root class="h-9">
						<InputGroup.Input
							bind:ref={searchInput}
							bind:value={query}
							id={searchId}
							type="search"
							placeholder={channel === 9
								? 'Search kits or drum machines…'
								: 'Name, family, or program number…'}
							autocomplete="off"
							spellcheck={false}
							onkeydown={searchKeydown}
							class="[&::-webkit-search-cancel-button]:appearance-none"
						/>
						<InputGroup.Addon>
							<HugeiconsIcon icon={SearchIcon} size={14} strokeWidth={2} />
						</InputGroup.Addon>
						{#if query}
							<InputGroup.Addon align="inline-end">
								<InputGroup.Button size="icon-sm" aria-label="Clear search" onclick={clearSearch}>
									<HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
								</InputGroup.Button>
							</InputGroup.Addon>
						{/if}
					</InputGroup.Root>
				</Field.Field>
			</Field.FieldGroup>
		</div>
		<div {@attach captureResults} class="max-h-72 overflow-y-auto p-2">
			{#if noResults}
				<Empty.Root role="status">
					<Empty.Header>
						<Empty.Title
							>{channel === 9 ? 'No drum kits found' : 'No instruments found'}</Empty.Title
						>
						<Empty.Description>Try another search or clear the filter.</Empty.Description>
					</Empty.Header>
				</Empty.Root>
			{:else if channel === 9}
				<div class="flex flex-col gap-1">
					{#each filteredKits as kit (kit.program)}
						<button
							type="button"
							data-voice-option
							class={cn(
								'rounded-md px-2 py-2 text-left transition-colors',
								drumKit(value).program === kit.program
									? 'bg-msg-program-bg text-msg-program'
									: 'hover:bg-accent/60'
							)}
							aria-pressed={drumKit(value).program === kit.program}
							onclick={() => pick(kit.program)}
							onkeydown={optionKeydown}
						>
							<span class="text-xs font-medium">{kit.name} · {kit.machine}</span>
							<span class="mt-1 block text-2xs text-muted-foreground">{kit.description}</span>
						</button>
					{/each}
				</div>
			{:else}
				{#each filteredFamilies as { family, programs } (family)}
					<p class="label px-1 pt-2 pb-1 first:pt-0">{family}</p>
					<div class="grid grid-cols-1 gap-1 min-[480px]:grid-cols-2">
						{#each programs as p (p)}
							<button
								type="button"
								data-voice-option
								class={cn(
									'flex items-baseline gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors',
									value === p ? 'bg-msg-program-bg text-msg-program' : 'hover:bg-accent/60'
								)}
								aria-pressed={value === p}
								title={GM_PROGRAMS[p]}
								onclick={() => pick(p)}
								onkeydown={optionKeydown}
							>
								<span class="tnum w-5 shrink-0 font-mono text-2xs text-muted-foreground">{p}</span>
								<span class="min-w-0">{GM_PROGRAMS[p]}</span>
							</button>
						{/each}
					</div>
				{/each}
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
