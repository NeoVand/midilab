<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import Patchbay from '$lib/components/midi/Patchbay.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8">
	<PageHeader
		title="Patchbay"
		lead="Any input to any output, with channel remapping, transposition, velocity scaling, note-range splits and message filtering on the way. Routes are saved and keep working across the whole app."
		back={{ href: '/lab', label: 'Lab' }}
	/>
	<Patchbay />
	<details class="rounded-xl border">
		<summary class="cursor-pointer px-4 py-2.5 text-sm hover:bg-accent/40">Ports</summary>
		<div class="border-t p-4"><DevicePanel /></div>
	</details>
</div>
