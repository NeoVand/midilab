<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import DeviceProfileEditor from '$lib/components/midi/DeviceProfileEditor.svelte';
	import SysExLab from '$lib/components/midi/SysExLab.svelte';
	import CcLearn from '$lib/components/midi/CcLearn.svelte';
	import DevicePanel from '$lib/components/midi/DevicePanel.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
	<PageHeader
		title="Device Lab"
		lead="Identify an instrument, learn what its controls actually send, and build a profile you can drive semantically. This is how you map hardware whose documentation you do not have."
		back={{ href: '/lab', label: 'Lab' }}
	/>

	<Tabs.Root value="profile" class="gap-4">
		<Tabs.List variant="line" class="w-fit">
			<Tabs.Trigger value="profile">Profiles</Tabs.Trigger>
			<Tabs.Trigger value="learn">Watch controls</Tabs.Trigger>
			<Tabs.Trigger value="sysex">Identify &amp; SysEx</Tabs.Trigger>
			<Tabs.Trigger value="ports">Ports</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="profile"><DeviceProfileEditor /></Tabs.Content>
		<Tabs.Content value="learn" class="flex flex-col gap-3">
			<p class="measure text-sm leading-relaxed text-muted-foreground">
				Move anything on your controller. This shows every controller number it sends, on which
				channel, and the range it actually covers — which is often not what the manual says.
			</p>
			<CcLearn />
		</Tabs.Content>
		<Tabs.Content value="sysex"><SysExLab /></Tabs.Content>
		<Tabs.Content value="ports"><DevicePanel /></Tabs.Content>
	</Tabs.Root>
</div>
