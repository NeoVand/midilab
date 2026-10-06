<script lang="ts">
	import CircleOfFifths from '$lib/components/music/CircleOfFifths.svelte';
	let { minors = true, class: className }: { minors?: boolean; class?: string } = $props();
</script>

<CircleOfFifths {minors} class={className} />
