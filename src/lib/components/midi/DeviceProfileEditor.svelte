<script lang="ts">
	/**
	 * Build a profile for an instrument, then drive it semantically.
	 *
	 * Learn mode is the useful part: arm it, move a knob on the hardware, and the
	 * incoming controller becomes a named parameter. That is how you map a synth
	 * whose implementation chart you cannot find — and it is considerably faster
	 * than finding it.
	 */
	import { onMount } from 'svelte';
	import { bus } from '$lib/midi/bus';
	import { engine } from '$lib/midi/engine.svelte';
	import { devices } from '$lib/midi/devices/store.svelte';
	import { Device, type Parameter, type DeviceProfile } from '$lib/midi/devices/profile';
	import { RpnParser } from '$lib/midi/rpn';
	import Knob from './Knob.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Add01Icon,
		Delete02Icon,
		Copy01Icon,
		CloudDownloadIcon,
		FileUploadIcon,
		Target02Icon,
		AlertCircleIcon
	} from '@hugeicons/core-free-icons';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}
	let { class: className }: Props = $props();

	const profile = $derived(devices.selected);
	const device = $derived(new Device(profile));
	const editable = $derived(!profile.builtin);

	let learning = $state(false);
	let values = $state<Record<string, number>>({});
	let importText = $state('');
	let importError = $state<string | null>(null);

	const parser = new RpnParser();

	onMount(() =>
		bus.subscribe((e) => {
			if (!learning || e.direction !== 'in') return;
			const edit = parser.push(e.message);
			if (edit) {
				addParameter({
					id: `param.${edit.kind}${edit.msb}_${edit.lsb}`,
					name: `${edit.kind.toUpperCase()} ${edit.msb},${edit.lsb}`,
					protocol: { kind: edit.kind, msb: edit.msb, lsb: edit.lsb, fine: edit.fine },
					min: 0,
					max: edit.fine ? 16383 : 127,
					unverified: true
				});
				learning = false;
				return;
			}
			const m = e.message;
			if (m.type !== 'controlChange' || m.controller >= 96) return;
			addParameter({
				id: `param.cc${m.controller}`,
				name: `CC ${m.controller}`,
				protocol: { kind: 'cc', number: m.controller },
				min: 0,
				max: 127,
				unverified: true
			});
			learning = false;
		})
	);

	function ensureEditable(): DeviceProfile {
		if (editable) return profile;
		const copy = devices.duplicate(profile.id);
		return copy ?? profile;
	}

	function addParameter(param: Parameter) {
		const target = ensureEditable();
		if (target.parameters.some((p) => p.id === param.id)) return;
		devices.update(target.id, { parameters: [...target.parameters, param] });
	}

	function updateParameter(index: number, patch: Partial<Parameter>) {
		const target = ensureEditable();
		const next = target.parameters.map((p, i) => (i === index ? { ...p, ...patch } : p));
		devices.update(target.id, { parameters: next });
	}

	function removeParameter(index: number) {
		const target = ensureEditable();
		devices.update(target.id, { parameters: target.parameters.filter((_, i) => i !== index) });
	}

	function send(param: Parameter, raw: number) {
		values[param.id] = raw;
		engine.wake();
		engine.sendAll(device.set(param.id, raw, { raw: true }));
	}

	function download() {
		const url = URL.createObjectURL(
			new Blob([devices.export(profile.id)], { type: 'application/json' })
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${profile.name.toLowerCase().replace(/\s+/g, '-')}.midiprofile.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function doImport() {
		importError = null;
		const result = devices.import(importText);
		if (!result) importError = 'That did not parse as a device profile.';
		else importText = '';
	}

	const groups = $derived.by(() => {
		const map = new Map<string, Array<{ p: Parameter; i: number }>>();
		profile.parameters.forEach((p, i) => {
			const g = p.group ?? 'Parameters';
			if (!map.has(g)) map.set(g, []);
			map.get(g)!.push({ p, i });
		});
		return [...map.entries()];
	});
</script>

<div class={cn('flex flex-col gap-5', className)}>
	<!-- profile picker -->
	<div class="flex flex-wrap items-center gap-2">
		<Select.Root type="single" value={profile.id} onValueChange={(v) => devices.select(v)}>
			<Select.Trigger class="h-8 w-64 text-xs">{profile.name}</Select.Trigger>
			<Select.Content>
				{#each devices.all as p (p.id)}
					<Select.Item value={p.id}>
						{p.name}{p.builtin ? ' · built in' : ''}
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={() => devices.add()}>
			<HugeiconsIcon icon={Add01Icon} size={13} /> New
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="gap-1.5 text-xs"
			onclick={() => devices.duplicate(profile.id)}
		>
			<HugeiconsIcon icon={Copy01Icon} size={13} /> Duplicate
		</Button>
		<Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={download}>
			<HugeiconsIcon icon={CloudDownloadIcon} size={13} /> Export
		</Button>
		{#if editable}
			<Button
				variant="ghost"
				size="sm"
				class="gap-1.5 text-xs text-destructive"
				onclick={() => devices.remove(profile.id)}
			>
				<HugeiconsIcon icon={Delete02Icon} size={13} /> Delete
			</Button>
		{/if}
	</div>

	{#if profile.notes}
		<div class="flex gap-2.5 rounded-lg border border-warn/40 bg-warn/5 p-3">
			<HugeiconsIcon icon={AlertCircleIcon} size={15} class="mt-0.5 shrink-0 text-warn" />
			<p class="text-xs leading-relaxed">{profile.notes}</p>
		</div>
	{/if}

	<!-- identity -->
	<div class="grid gap-3 sm:grid-cols-3">
		<label class="flex flex-col gap-1">
			<span class="label">Name</span>
			<Input
				value={profile.name}
				class="h-8 text-xs"
				disabled={!editable}
				oninput={(e) => devices.update(profile.id, { name: e.currentTarget.value })}
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="label">Manufacturer</span>
			<Input
				value={profile.manufacturer ?? ''}
				class="h-8 text-xs"
				disabled={!editable}
				oninput={(e) => devices.update(profile.id, { manufacturer: e.currentTarget.value })}
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="label">Channel</span>
			<div class="flex flex-wrap gap-1">
				{#each Array.from({ length: 16 }, (_, i) => i) as c (c)}
					<button
						class={cn(
							'tnum size-5 rounded border font-mono text-2xs',
							profile.channel === c
								? 'border-msg-note bg-msg-note-bg text-msg-note'
								: 'text-muted-foreground/60'
						)}
						onclick={() => editable && devices.update(profile.id, { channel: c })}
					>
						{c + 1}
					</button>
				{/each}
			</div>
		</label>
	</div>

	<!-- learn -->
	<div class="flex flex-wrap items-center gap-3 rounded-lg border p-4">
		<Button
			variant={learning ? 'default' : 'outline'}
			size="sm"
			class="gap-1.5"
			onclick={() => (learning = !learning)}
		>
			<HugeiconsIcon icon={Target02Icon} size={14} />
			{learning ? 'Listening — move a control…' : 'Learn a control'}
		</Button>
		<p class="max-w-lg text-xs leading-relaxed text-muted-foreground">
			Arm this, then move a knob, fader or pedal on the instrument. Whatever it sends — a Control
			Change or a complete NRPN edit — becomes a parameter you can rename. This is the fast way to
			map an instrument you have no chart for.
		</p>
	</div>

	<!-- parameters -->
	<div class="flex flex-col gap-4">
		{#each groups as [group, items] (group)}
			<div class="flex flex-col gap-2">
				<p class="label">{group}</p>
				{#each items as { p, i } (p.id)}
					<div class="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
						<Knob
							value={values[p.id] ?? p.default ?? Math.round((p.min + p.max) / 2)}
							min={p.min}
							max={p.max}
							default={p.default}
							size={40}
							colour="var(--msg-cc)"
							onChange={(v) => send(p, v)}
						/>
						<div class="flex min-w-40 flex-col gap-0.5">
							<Input
								value={p.name}
								class="h-6 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
								disabled={!editable}
								oninput={(e) => updateParameter(i, { name: e.currentTarget.value })}
							/>
							<code class="font-mono text-2xs text-muted-foreground">{p.id}</code>
						</div>
						<span class="font-mono text-xs text-msg-cc">{device.explain(p.id)}</span>
						<span class="font-mono text-2xs text-muted-foreground">
							{p.min}–{p.max}{p.unit ? ` ${p.unit}` : ''}
						</span>
						{#if p.unverified}
							<span class="text-2xs text-warn">unverified</span>
						{/if}
						<div class="flex-1"></div>
						{#if editable}
							<Button
								variant="ghost"
								size="icon"
								class="size-6 text-muted-foreground hover:text-destructive"
								onclick={() => removeParameter(i)}
								aria-label="Remove parameter"
							>
								<HugeiconsIcon icon={Delete02Icon} size={13} />
							</Button>
						{/if}
					</div>
				{/each}
			</div>
		{/each}

		{#if profile.parameters.length === 0}
			<p class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
				No parameters yet. Use Learn to capture them from the hardware, or start from a built-in
				profile and duplicate it.
			</p>
		{/if}
	</div>

	<!-- programs -->
	{#if profile.programs.length > 0}
		<div class="flex flex-col gap-2">
			<p class="label">Programs</p>
			<div class="flex flex-wrap gap-1.5">
				{#each profile.programs as entry (entry.name)}
					<button
						class="rounded border px-2 py-1 text-xs transition-colors hover:border-msg-program"
						onclick={() => {
							engine.wake();
							engine.sendAll(device.selectProgram(entry.name));
						}}
					>
						{entry.name}
						<span class="ml-1 font-mono text-2xs text-muted-foreground">
							{entry.bankMsb ?? '–'}:{entry.bankLsb ?? '–'}:{entry.program}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- import -->
	<details class="rounded-lg border">
		<summary class="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent/40">
			<HugeiconsIcon icon={FileUploadIcon} size={14} />
			Import a profile
		</summary>
		<div class="flex flex-col gap-2 border-t p-4">
			<Textarea
				bind:value={importText}
				rows={5}
				class="font-mono text-xs"
				placeholder="Paste exported profile JSON here"
				spellcheck={false}
			/>
			<div class="flex items-center gap-3">
				<Button size="sm" onclick={doImport} disabled={!importText.trim()}>Import</Button>
				{#if importError}<span class="text-xs text-destructive">{importError}</span>{/if}
			</div>
		</div>
	</details>
</div>
