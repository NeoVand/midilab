<script lang="ts">
	import MusicFoundationsLesson from '$lib/components/lesson/MusicFoundationsLesson.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
</script>

<MusicFoundationsLesson lessonId="bass-and-drums">
	<Further
		refs={['ableton-bass', 'ableton-beats']}
		lead="Continue with these explanations and interactive examples."
	/>
</MusicFoundationsLesson>
