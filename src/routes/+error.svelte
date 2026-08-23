<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="mx-auto grid h-full max-w-lg place-items-center px-8 py-24 text-center">
	<div class="flex flex-col items-center gap-4">
		<p class="font-mono text-5xl text-muted-foreground">{page.status}</p>
		<h1 class="text-2xl font-semibold tracking-tight">
			{page.status === 404 ? 'Nothing here' : 'Something went wrong'}
		</h1>
		<p class="text-sm leading-relaxed text-muted-foreground">
			{page.error?.message ?? 'That address does not correspond to anything in the app.'}
		</p>
		<div class="mt-2 flex gap-2">
			<Button href="/">Home</Button>
			<Button variant="outline" href="/learn">The course</Button>
			<Button variant="outline" href="/lab">The Lab</Button>
		</div>
	</div>
</div>
