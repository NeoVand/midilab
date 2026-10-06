<script lang="ts">
	import MusicFoundationsLesson from '$lib/components/lesson/MusicFoundationsLesson.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
</script>

<MusicFoundationsLesson lessonId="pulse-and-rhythm">
	<Further
		refs={['ableton-beats', 'theory-duration']}
		lead="Continue with these explanations and interactive examples."
	/>
</MusicFoundationsLesson>
