<script lang="ts">
	import { device } from '$lib/stores/device.svelte';
	import { lessonHref } from '$lib/nav';
	import {
		CURRICULUM,
		ALL_LESSONS,
		TOTAL_MINUTES,
		ACT_ICON,
		actLabel
	} from '$lib/curriculum/registry';
	import { progress } from '$lib/curriculum/progress.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Tick02Icon, PlugSocketIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	const overall = $derived(progress.fractionOf(ALL_LESSONS.map((l) => l.id)));
	const doneLessons = $derived(ALL_LESSONS.filter((l) => progress.isLessonComplete(l.id)).length);
	const hasProgress = $derived(overall > 0);
	const allComplete = $derived(doneLessons === ALL_LESSONS.length);
	const nextLesson = $derived(
		ALL_LESSONS.find((l) => !progress.isLessonComplete(l.id)) ?? ALL_LESSONS[0]
	);
	const nextAct = $derived(CURRICULUM.find((act) => act.lessons.includes(nextLesson)));

	const HARDWARE_TITLE: Record<string, string> = {
		better: 'Better with hardware attached',
		required: 'Needs a MIDI device'
	};

	function actMinutes(lessons: { minutes: number }[]) {
		return lessons.reduce((t, l) => t + l.minutes, 0);
	}

	const DOORS = [
		{
			who: 'New to all of it',
			then: 'Start with a pulse, find a melody, and build your first piece. Nothing is assumed.',
			id: 'just-enough-music'
		},
		{
			who: 'You make music',
			then: 'Go straight to MIDI: what your instrument sends, and what happens next.',
			id: 'control-not-sound'
		},
		{
			who: 'You write code',
			then: 'Build your musical ear first. The bytes will make more sense when you can hear them.',
			id: 'just-enough-music'
		}
	];
</script>

<svelte:head>
	<title>The course — MIDI Lab</title>
	<meta
		name="description"
		content="A hands-on path through music and MIDI: play, hear, experiment, and build your own tools. Start with music basics or go straight to MIDI."
	/>
</svelte:head>

<div class="course-page">
	<header class="course-hero">
		<div class="course-introduction">
			<h1>The course</h1>
			<p class="course-promise">From your first beat to your own MIDI tools.</p>
			<p class="course-lead">
				Act 0 builds the music. Acts I–VII open up MIDI, from the messages behind a note to
				expressive instruments, connected studios, and your own code.
			</p>
			<p class="course-reassurance">
				No music theory or programming experience needed. Start in the browser; bring hardware when
				you're ready.
			</p>
			<div class="course-facts" aria-label="Course overview">
				<span>{ALL_LESSONS.length} hands-on lessons</span>
				<span>About {Math.round(TOTAL_MINUTES / 60)} hours</span>
				<a href={lessonHref('control-not-sound')}>Start with Act I</a>
			</div>
		</div>

		<section class="resume-panel" aria-labelledby="resume-title">
			<div class="resume-heading">
				<h2 id="resume-title">
					{allComplete ? 'Keep exploring' : hasProgress ? 'Your next lesson' : 'Start here'}
				</h2>
				<span class="resume-act">Act {actLabel(nextAct?.number ?? 0)}</span>
			</div>
			<p class="resume-lesson">{nextLesson.title}</p>
			<p class="resume-description">{nextLesson.blurb}</p>
			<div class="resume-action">
				<Button href={lessonHref(nextLesson)} size="xl" class="min-h-11">
					{allComplete ? 'Revisit the course' : hasProgress ? 'Continue' : 'Begin'}
					<HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
				</Button>
				<span>{nextLesson.minutes} min</span>
			</div>
			<div class="course-progress">
				<div class="progress-copy">
					<span>{doneLessons} of {ALL_LESSONS.length} done</span>
					<span>{Math.round(overall * 100)}%</span>
				</div>
				<progress aria-label="Course checkpoint progress" value={overall} max="1"></progress>
				<p>Progress includes verified playing and labelled self-checks.</p>
			</div>
		</section>
	</header>

	{#if !hasProgress}
		<section class="starting-points" aria-labelledby="starting-title">
			<h2 id="starting-title">Find your starting point</h2>
			<div class="starting-links">
				{#each DOORS as door (door.who)}
					{@const lesson = ALL_LESSONS.find((l) => l.id === door.id)}
					{#if lesson}
						<a href={lessonHref(lesson)} class="starting-link">
							<span class="starting-name">
								{door.who}
								<HugeiconsIcon icon={ArrowRight01Icon} size={14} aria-hidden="true" />
							</span>
							<span class="starting-description">{door.then}</span>
							<span class="starting-lesson">{lesson.number}. {lesson.title}</span>
						</a>
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	<nav class="course-outline" aria-label="Course outline">
		<p>Explore the acts</p>
		<ol>
			{#each CURRICULUM as act (act.id)}
				<li>
					<a href={`#${act.id}`}>
						<span class="outline-number">{actLabel(act.number)}</span>
						<span>{act.title}</span>
					</a>
				</li>
			{/each}
		</ol>
	</nav>

	<div class="course-acts">
		{#each CURRICULUM as act (act.id)}
			{@const done = act.lessons.filter((l) => progress.isLessonComplete(l.id)).length}
			{@const fraction = progress.fractionOf(act.lessons.map((l) => l.id))}
			<section id={act.id} class="course-act" aria-labelledby={`${act.id}-title`}>
				<header class="act-introduction">
					<div class="act-heading">
						<span class="act-icon" aria-hidden="true">
							<HugeiconsIcon icon={ACT_ICON[act.id]} size={18} strokeWidth={1.65} />
						</span>
						<p>Act {actLabel(act.number)}</p>
					</div>
					<h2 id={`${act.id}-title`}>{act.title}</h2>
					<p class="act-description">{act.subtitle}</p>
					<div class="act-progress-copy">
						<span>{done}/{act.lessons.length} done</span>
						<span>{actMinutes(act.lessons)} min</span>
					</div>
					<progress
						aria-label={`Act ${actLabel(act.number)} checkpoint progress`}
						value={fraction}
						max="1"
					></progress>
				</header>

				<ol class="lesson-list">
					{#each act.lessons as lesson (lesson.id)}
						{@const complete = progress.isLessonComplete(lesson.id)}
						{@const completedChecks = progress.doneCount(lesson.id)}
						{@const totalChecks = progress.totalFor(lesson.id)}
						{@const isNext = hasProgress && !allComplete && lesson.id === nextLesson.id}
						<li>
							<a
								href={lessonHref(lesson)}
								class={cn('lesson-link', complete && 'lesson-complete', isNext && 'lesson-next')}
							>
								<span class="lesson-number" aria-label={complete ? 'Complete' : undefined}>
									{#if complete}
										<HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} />
									{:else}
										{String(lesson.number).padStart(2, '0')}
									{/if}
								</span>
								<span class="lesson-copy">
									<span class="lesson-title">{lesson.title}</span>
									{#if !device.narrow}
										<span class="lesson-description">{lesson.blurb}</span>
									{/if}
									{#if !complete && completedChecks > 0}
										<span class="lesson-checkpoints">
											{completedChecks} of {totalChecks} checkpoints complete
										</span>
									{/if}
								</span>
								<span class="lesson-meta">
									{#if lesson.hardware && lesson.hardware !== 'none'}
										<HugeiconsIcon
											icon={PlugSocketIcon}
											size={14}
											aria-label={HARDWARE_TITLE[lesson.hardware]}
										/>
									{/if}
									<span>{lesson.minutes} min</span>
								</span>
							</a>
						</li>
					{/each}
				</ol>
			</section>
		{/each}
	</div>
</div>

<style>
	.course-page {
		width: 100%;
		max-width: 1184px;
		margin-inline: auto;
		padding: 48px 36px 88px;
	}

	.course-hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
		align-items: start;
		gap: clamp(32px, 5vw, 76px);
	}

	.course-introduction {
		padding-top: 8px;
	}

	h1 {
		margin: 0;
		font-size: clamp(32px, 3.4vw, 44px);
		line-height: 1.12;
		font-weight: 650;
		letter-spacing: -0.045em;
	}

	.course-promise {
		max-width: 24ch;
		margin-top: 22px;
		font-size: clamp(21px, 2.2vw, 27px);
		line-height: 1.35;
		font-weight: 450;
		letter-spacing: -0.025em;
		text-wrap: balance;
	}

	.course-lead,
	.course-reassurance {
		max-width: 53ch;
		color: var(--muted-foreground);
		font-size: 14px;
		line-height: 1.75;
	}

	.course-lead {
		margin-top: 18px;
	}

	.course-reassurance {
		margin-top: 12px;
	}

	.course-facts {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		margin-top: 25px;
		font-size: 12px;
		color: var(--muted-foreground);
	}

	.course-facts a {
		color: var(--foreground);
		text-decoration: underline;
		text-decoration-color: var(--landing-line, var(--border));
		text-underline-offset: 4px;
	}

	.resume-panel {
		padding: 24px;
		border: 1px solid var(--landing-line, var(--border));
		border-radius: 14px;
		background: var(--landing-panel, var(--card));
	}

	.resume-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		font-size: 12px;
	}

	.resume-heading h2 {
		font-size: inherit;
		font-weight: 500;
		color: var(--landing-accent, var(--foreground));
	}

	.resume-act {
		color: var(--muted-foreground);
	}

	.resume-lesson {
		margin-top: 16px;
		font-size: 21px;
		line-height: 1.35;
		font-weight: 550;
		letter-spacing: -0.025em;
	}

	.resume-description {
		margin-top: 8px;
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted-foreground);
	}

	.resume-action {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 22px;
	}

	.resume-action > span {
		color: var(--muted-foreground);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.course-progress {
		margin-top: 25px;
		padding-top: 20px;
		border-top: 1px solid var(--landing-line, var(--border));
	}

	.progress-copy,
	.act-progress-copy {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		color: var(--muted-foreground);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	progress {
		display: block;
		width: 100%;
		height: 4px;
		margin-top: 10px;
		border: 0;
		border-radius: 999px;
		overflow: hidden;
		appearance: none;
		background: var(--landing-inset, var(--surface-sunken));
		color: var(--landing-accent, var(--ok));
	}

	progress::-webkit-progress-bar {
		border-radius: 999px;
		background: var(--landing-inset, var(--surface-sunken));
	}

	progress::-webkit-progress-value {
		border-radius: 999px;
		background: var(--landing-accent, var(--ok));
	}

	progress::-moz-progress-bar {
		border-radius: 999px;
		background: var(--landing-accent, var(--ok));
	}

	.course-progress p {
		margin-top: 10px;
		font-size: 10px;
		line-height: 1.6;
		color: var(--muted-foreground);
	}

	.starting-points {
		margin-top: 42px;
	}

	.starting-points > h2,
	.course-outline > p {
		font-size: 13px;
		font-weight: 550;
		letter-spacing: -0.01em;
	}

	.starting-links {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 28px;
		margin-top: 16px;
	}

	.starting-link {
		display: flex;
		flex-direction: column;
		gap: 9px;
		padding-top: 16px;
		border-top: 1px solid var(--landing-line, var(--border));
		text-decoration: none;
	}

	.starting-name {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		font-size: 14px;
		font-weight: 550;
	}

	.starting-name :global(svg) {
		color: var(--muted-foreground);
	}

	.starting-description {
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted-foreground);
	}

	.starting-lesson {
		margin-top: auto;
		padding-top: 3px;
		font-size: 11px;
		color: var(--landing-accent, var(--foreground));
	}

	.course-outline {
		margin-top: 45px;
		padding: 20px 0;
		border-top: 1px solid var(--landing-line, var(--border));
		border-bottom: 1px solid var(--landing-line, var(--border));
	}

	.course-outline ol {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 4px 16px;
		margin-top: 12px;
		list-style: none;
	}

	.course-outline a {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding-block: 8px;
		color: var(--muted-foreground);
		font-size: 12px;
		line-height: 1.5;
		text-decoration: none;
	}

	.outline-number {
		width: 20px;
		flex-shrink: 0;
		color: var(--landing-accent, var(--foreground));
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.course-acts {
		display: flex;
		flex-direction: column;
		gap: 64px;
		margin-top: 48px;
	}

	.course-act {
		display: grid;
		grid-template-columns: minmax(180px, 230px) minmax(0, 1fr);
		align-items: start;
		gap: 34px;
		scroll-margin-top: 28px;
	}

	.act-introduction {
		padding-top: 4px;
	}

	.act-heading {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--muted-foreground);
		font-size: 12px;
	}

	.act-icon {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		color: var(--landing-accent, var(--foreground));
		background: var(--landing-accent-soft, var(--muted));
	}

	.act-introduction h2 {
		margin-top: 15px;
		font-size: 21px;
		line-height: 1.35;
		font-weight: 550;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}

	.act-description {
		margin-top: 10px;
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted-foreground);
	}

	.act-progress-copy {
		margin-top: 24px;
	}

	.lesson-list {
		list-style: none;
		overflow: hidden;
		border: 1px solid var(--landing-line, var(--border));
		border-radius: 12px;
		background: var(--landing-panel, var(--card));
	}

	.lesson-list li + li {
		border-top: 1px solid var(--landing-line, var(--border));
	}

	.lesson-link {
		position: relative;
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) auto;
		align-items: baseline;
		gap: 16px;
		padding: 18px 20px;
		text-decoration: none;
		transition: background-color 140ms ease;
	}

	.lesson-number {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted-foreground);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.lesson-title {
		display: block;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.5;
		letter-spacing: -0.01em;
	}

	.lesson-description {
		display: block;
		max-width: 67ch;
		margin-top: 4px;
		font-size: 12px;
		line-height: 1.7;
		color: var(--muted-foreground);
	}

	.lesson-checkpoints {
		display: block;
		margin-top: 6px;
		font-size: 10px;
		color: var(--landing-accent, var(--foreground));
	}

	.lesson-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted-foreground);
		font-size: 11px;
		line-height: 1.5;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.lesson-complete .lesson-number {
		color: var(--ok);
	}

	.lesson-next {
		background: color-mix(in oklch, var(--landing-accent-soft, var(--muted)) 45%, transparent);
	}

	.lesson-next::before {
		position: absolute;
		inset: 15px auto 15px 0;
		width: 2px;
		border-radius: 2px;
		background: var(--landing-accent, var(--ok));
		content: '';
	}

	a:focus-visible {
		outline: 2px solid var(--landing-accent, var(--ring));
		outline-offset: 4px;
		border-radius: 4px;
	}

	.lesson-link:focus-visible {
		outline-offset: -3px;
	}

	@media (hover: hover) {
		.course-facts a:hover,
		.course-outline a:hover,
		.starting-link:hover .starting-name {
			color: var(--landing-accent, var(--foreground));
		}

		.lesson-link:hover {
			background: var(--landing-inset, var(--surface-sunken));
		}
	}

	@media (max-width: 1040px) {
		.course-hero {
			grid-template-columns: minmax(0, 1fr) minmax(260px, 315px);
			gap: 30px;
		}

		.course-act {
			grid-template-columns: minmax(160px, 195px) minmax(0, 1fr);
			gap: 24px;
		}

		.course-outline ol {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.course-page {
			padding: 28px 24px 60px;
		}

		.course-hero {
			grid-template-columns: minmax(0, 1fr);
			gap: 28px;
		}

		.course-introduction {
			padding-top: 0;
		}

		.course-promise {
			max-width: 32ch;
		}

		.course-act {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
		}

		.act-introduction {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			column-gap: 20px;
			padding: 0;
		}

		.act-heading,
		.act-introduction h2,
		.act-description {
			grid-column: 1 / -1;
		}

		.act-introduction h2 {
			margin-top: 12px;
		}

		.act-progress-copy {
			grid-column: 1 / -1;
			justify-content: flex-start;
			margin-top: 14px;
		}

		.act-introduction progress {
			grid-column: 1 / -1;
			max-width: 180px;
		}
	}

	@media (max-width: 540px) {
		.course-page {
			padding: 24px 18px 48px;
		}

		h1 {
			font-size: 24px;
			letter-spacing: -0.035em;
		}

		.course-promise {
			margin-top: 16px;
			font-size: 23px;
			line-height: 1.35;
		}

		.course-lead,
		.course-reassurance {
			font-size: 13px;
		}

		.course-facts {
			gap: 12px 16px;
			margin-top: 20px;
			font-size: 11px;
		}

		.resume-panel {
			padding: 20px;
		}

		.resume-lesson {
			font-size: 20px;
		}

		.starting-points {
			margin-top: 30px;
		}

		.starting-links {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
			margin-top: 4px;
		}

		.starting-link {
			gap: 7px;
		}

		.starting-description {
			max-width: 46ch;
		}

		.course-outline {
			margin-top: 32px;
		}

		.course-outline ol {
			gap: 0 14px;
		}

		.course-outline a {
			min-height: 44px;
			gap: 6px;
			font-size: 11px;
		}

		.outline-number {
			width: 18px;
		}

		.course-acts {
			gap: 42px;
			margin-top: 30px;
		}

		.act-introduction h2 {
			font-size: 20px;
		}

		.act-description {
			margin-top: 7px;
		}

		.lesson-link {
			grid-template-columns: 20px minmax(0, 1fr) auto;
			gap: 10px;
			padding: 16px 14px;
		}

		.lesson-title {
			font-size: 13px;
			line-height: 1.55;
		}

		.lesson-meta {
			gap: 5px;
			font-size: 10px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.lesson-link {
			transition: none;
		}
	}
</style>
