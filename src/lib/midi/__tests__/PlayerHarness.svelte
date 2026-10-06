<script lang="ts">
	import { onMount } from 'svelte';
	import { SequencePlayer } from '../player.svelte';
	let { receive }: { receive: (player: SequencePlayer) => void } = $props();
	const player = new SequencePlayer();
	onMount(() => receive(player));
</script>
