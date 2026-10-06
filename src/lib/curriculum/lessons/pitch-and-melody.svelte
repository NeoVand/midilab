<script lang="ts">
	import MusicFoundationsLesson from '$lib/components/lesson/MusicFoundationsLesson.svelte';
	import Further from '$lib/components/lesson/Further.svelte';
</script>

<MusicFoundationsLesson lessonId="pitch-and-melody">
	<Further
		refs={['ableton-pitch', 'theory-major']}
		lead="Continue with these explanations and interactive examples."
	/>
</MusicFoundationsLesson>
