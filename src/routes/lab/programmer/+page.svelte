<script lang="ts">
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import StepSequencer from '$lib/components/midi/StepSequencer.svelte';
	import PatternLab from '$lib/components/midi/PatternLab.svelte';
	import ClockLab from '$lib/components/midi/ClockLab.svelte';
	import MidiFileLab from '$lib/components/midi/MidiFileLab.svelte';
	import ChannelGrid from '$lib/components/midi/ChannelGrid.svelte';
	import * as Tabs from '$lib/components/ui/tabs';
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-8">
	<PageHeader
		title="Programmer"
		lead="Build MIDI programs: step patterns, algorithmic patterns, and Standard MIDI Files. Everything here is driven by the same transport as the rest of the app, so it stays in time with your hardware."
		back={{ href: '/lab', label: 'Lab' }}
	/>

	<Tabs.Root value="steps" class="gap-4">
		<Tabs.List class="w-fit">
			<Tabs.Trigger value="steps">Step sequencer</Tabs.Trigger>
			<Tabs.Trigger value="patterns">Patterns</Tabs.Trigger>
			<Tabs.Trigger value="files">MIDI files</Tabs.Trigger>
			<Tabs.Trigger value="clock">Clock</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="steps" class="flex flex-col gap-4">
			<StepSequencer />
			<ChannelGrid />
		</Tabs.Content>

		<Tabs.Content value="patterns">
			<PatternLab />
		</Tabs.Content>

		<Tabs.Content value="files">
			<MidiFileLab />
		</Tabs.Content>

		<Tabs.Content value="clock">
			<ClockLab />
		</Tabs.Content>
	</Tabs.Root>
</div>
