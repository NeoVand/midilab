<script lang="ts">
	import { page } from '$app/state';
	import { lessonById } from '$lib/curriculum/registry';
	import { loadLesson } from '$lib/curriculum/lessons';
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import { Spinner } from '$lib/components/ui/spinner';
	import type { Component } from 'svelte';

	const id = $derived(page.params.lesson ?? '');
	const meta = $derived(lessonById(id));

	let LessonComponent = $state<Component | null>(null);
	let loading = $state(true);

	$effect(() => {
		const current = id;
		loading = true;
		LessonComponent = null;
		loadLesson(current).then((c) => {
			if (current !== id) return;
			LessonComponent = c;
			loading = false;
		});
	});
</script>

{#if !meta}
	<div class="mx-auto max-w-2xl px-8 py-20 text-center">
		<h1 class="text-2xl font-semibold">No such lesson</h1>
		<p class="mt-2 text-muted-foreground">
			<a href="/learn" class="underline">Back to the course</a>
		</p>
	</div>
{:else if loading}
	<div class="grid h-64 place-items-center"><Spinner /></div>
{:else if LessonComponent}
	<LessonComponent />
{:else}
	<LessonShell lesson={meta}>
		<div class="rounded-xl border border-dashed p-8 text-center">
			<p class="text-sm text-muted-foreground">
				This lesson has not been written yet. Its objectives above are the plan.
			</p>
		</div>
	</LessonShell>
{/if}
