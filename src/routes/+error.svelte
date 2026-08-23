<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';

	const notFound = $derived(page.status === 404);
</script>

<div class="mx-auto grid h-full max-w-lg place-items-center px-8 py-24 text-center">
	<div class="flex flex-col items-center gap-4">
		<p class="tnum font-mono text-4xl text-muted-foreground/50">{page.status}</p>
		<h1 class="text-2xl font-semibold tracking-tight">
			{notFound ? 'Nothing here' : 'Something went wrong'}
		</h1>
		<!--
			A 404 whose body text is the string "Not Found" has said the heading
			twice and helped nobody. Say where things actually are instead.
		-->
		<p class="measure text-sm leading-relaxed text-muted-foreground">
			{#if notFound}
				That address does not correspond to anything in the app. The course lives under
				<code class="rounded-sm bg-muted px-1 font-mono">/learn</code>, the tools under
				<code class="rounded-sm bg-muted px-1 font-mono">/lab</code>, and the tables under
				<code class="rounded-sm bg-muted px-1 font-mono">/reference</code>.
			{:else}
				{page.error?.message ??
					'The app hit an error it did not expect. Reloading usually clears it.'}
			{/if}
		</p>
		<div class="mt-2 flex flex-wrap justify-center gap-2">
			<Button href="/">Home</Button>
			<Button variant="outline" href="/learn">The course</Button>
			<Button variant="outline" href="/lab">The Lab</Button>
			<Button variant="outline" href="/reference">Reference</Button>
		</div>
	</div>
</div>
