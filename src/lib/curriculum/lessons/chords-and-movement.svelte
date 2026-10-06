<script lang="ts">
	import MusicFoundationsLesson from '$lib/components/lesson/MusicFoundationsLesson.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
</script>

<MusicFoundationsLesson lessonId="chords-and-movement">
	<Further
		refs={[
			'ableton-chords',
			'theory-inversions',
			'omt-key-signatures',
			'omt-voice-leading',
			'sethares-consonance',
			'sethares-model',
			'minutephysics-dissonance',
			'bhatia-dissonance'
		]}
		lead="Continue with these explanations and interactive examples."
	/>
</MusicFoundationsLesson>
