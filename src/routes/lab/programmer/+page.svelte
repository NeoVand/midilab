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
		lead="Step patterns, algorithmic patterns and Standard MIDI Files — all driven by the same transport as the rest of the app, so they stay in time with your hardware."
		back={{ href: '/lab', label: 'Lab' }}
	/>

	<Tabs.Root value="steps" class="gap-4">
		<Tabs.List variant="line" class="w-fit">
			<Tabs.Trigger value="steps">Step sequencer</Tabs.Trigger>
			<Tabs.Trigger value="patterns">Patterns</Tabs.Trigger>
			<Tabs.Trigger value="files">MIDI files</Tabs.Trigger>
			<Tabs.Trigger value="clock">Clock</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="steps" class="flex flex-col gap-4">
			<StepSequencer persistKey="programmer" />
			<section class="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3">
				<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<p class="label">Channels</p>
					<p class="text-xs text-muted-foreground">
						Lit when something is sounding. Click one to choose where the widgets in this app
						transmit.
					</p>
				</div>
				<ChannelGrid />
			</section>
		</Tabs.Content>

		<Tabs.Content value="patterns">
			<PatternLab persistKey="programmer" />
		</Tabs.Content>

		<Tabs.Content value="files">
			<MidiFileLab />
		</Tabs.Content>

		<Tabs.Content value="clock">
			<ClockLab />
		</Tabs.Content>
	</Tabs.Root>
</div>
