<script lang="ts">
	import { asset } from '$app/paths';

	interface Props {
		wordmark?: boolean;
		size?: 'default' | 'hero' | 'compact';
		class?: string;
	}

	let { wordmark = true, size = 'default', class: className }: Props = $props();
</script>

<span class={['midi-brand', `midi-brand-${size}`, className]}>
	<!-- One drawing for the app, the browser tab, and the course entrance. -->
	<img class="brand-mark" src={asset('/favicon.svg')} width="56" height="56" alt="" />
	{#if wordmark}
		<span class="brand-wordmark">MIDI Lab</span>
	{:else}
		<span class="sr-only">MIDI Lab</span>
	{/if}
</span>

<style>
	.midi-brand {
		display: inline-flex;
		align-items: center;
		gap: var(--brand-gap, 0.55rem);
		color: var(--brand-color, var(--foreground));
		vertical-align: middle;
		white-space: nowrap;
	}

	.brand-mark {
		display: block;
		width: var(--brand-mark-size, 2rem);
		height: var(--brand-mark-size, 2rem);
		flex: none;
		filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.18));
	}

	.brand-wordmark {
		font-family: var(--font-sans);
		font-size: var(--brand-font-size, 1.4rem);
		font-weight: 650;
		line-height: 1;
		letter-spacing: -0.052em;
	}

	.midi-brand-compact .brand-mark {
		width: var(--brand-mark-size, 1.5rem);
		height: var(--brand-mark-size, 1.5rem);
	}

	.midi-brand-compact .brand-wordmark {
		font-size: var(--brand-font-size, 1.05rem);
	}

	.midi-brand-hero {
		gap: var(--brand-gap, clamp(0.8rem, 1.25vw, 1.15rem));
	}

	.midi-brand-hero .brand-mark {
		width: var(--brand-mark-size, clamp(3.15rem, 4vw + 1rem, 4.7rem));
		height: var(--brand-mark-size, clamp(3.15rem, 4vw + 1rem, 4.7rem));
		filter: drop-shadow(0 3px 3px rgb(0 0 0 / 0.2));
	}

	.midi-brand-hero .brand-wordmark {
		font-size: var(--brand-font-size, clamp(2.5rem, 3.6vw + 1rem, 4rem));
		font-weight: 640;
	}
</style>
