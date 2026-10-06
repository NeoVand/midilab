<script lang="ts">
	import MusicFoundationsLesson from '$lib/components/lesson/MusicFoundationsLesson.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import Xref from '$lib/components/lesson/Xref.svelte';
</script>

<MusicFoundationsLesson lessonId="first-composition">
	<Callout variant="key" title="From music to MIDI">
		<p>
			You now have a piece with rhythm, melody, harmony and a shape of its own. Keep it as your
			working example. Act I begins with <Xref to="control-not-sound" /> and explores the instructions
			that let the same performance play through different instruments.
		</p>
	</Callout>
	<Further
		refs={['ableton-structure', 'theory-lessons']}
		lead="Continue with these explanations and interactive examples."
	/>
</MusicFoundationsLesson>
