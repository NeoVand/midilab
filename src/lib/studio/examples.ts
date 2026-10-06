import {
	makeNote,
	studioId,
	type StudioNote,
	type StudioProject,
	type StudioTrack,
	type TrackId
} from './model';

export interface StudioExample {
	id: string;
	title: string;
	description: string;
	bpm: number;
	key: string;
	feel: string;
	chords: string[];
	tips: Record<TrackId, string>;
}

/** Original eight-bar studies: short enough to understand, complete enough to enjoy. */
export const STUDIO_EXAMPLES: StudioExample[] = [
	{
		id: 'pocket-soul',
		title: 'Pocket Soul',
		bpm: 92,
		key: 'D minor',
		feel: 'A relaxed backbeat with a little space',
		description:
			'Soft electric piano, a warm bassline, and a melody that answers itself. The hats lean back while the kick stays steady.',
		chords: ['Dm9', 'Dm9', 'Gm9', 'Gm9', 'C9', 'C9', 'Fmaj9', 'Fmaj9'],
		tips: {
			drums:
				'The snare marks beats 2 and 4. Quiet offbeat hats make the stronger beats feel warmer. Try removing a kick and listen to the space it leaves.',
			bass: 'Follow D, G, C, then F. The short pickup near the end of each bar pulls you toward the next chord without crowding the kick.',
			chords:
				'These four-note voicings share several notes. Small movements connect the chords smoothly; the ninth adds color without a bigger leap.',
			melody:
				'Play a short question, leave a breath, then answer it. The final A belongs to the F chord and gives the eight bars a resting place.'
		}
	},
	{
		id: 'night-drive',
		title: 'Night Drive',
		bpm: 116,
		key: 'A minor',
		feel: 'A steady pulse with a bright, rising hook',
		description:
			'Four-to-the-floor drums, a pulsing synth bass, and a tiny hook that grows in the second half. Small changes keep the loop moving.',
		chords: ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G'],
		tips: {
			drums:
				'The kick lands on every beat. The open hat lives between beats, so it answers the kick. Add a last-bar clap fill to announce the return.',
			bass: 'The root gives the chord its floor; the octave gives it energy. Try a shorter duration before changing the notes.',
			chords:
				'A minor, F, C, and G all use the same seven-note collection. Listen to how the mood changes while the scale stays the same.',
			melody:
				'The opening E–G–A idea is only three pitches. The second half reaches C, then settles on G over the final chord. Leave a little breath before the loop returns.'
		}
	},
	{
		id: 'sunlit-pop',
		title: 'Sunlit Pop',
		bpm: 104,
		key: 'C major',
		feel: 'An easy bounce and a singable melody',
		description:
			'Clean guitar chords, a friendly bassline, and a melody you can hum. Hear how the same small idea changes over four different chords.',
		chords: ['C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F'],
		tips: {
			drums:
				'The clap gives beats 2 and 4 a clear landmark. The kick just before beat 3 creates a little bounce. Keep the extra hits quieter.',
			bass: 'C, G, A, and F trace the harmony. The fifth of each chord adds movement while keeping the bassline grounded.',
			chords:
				'C–G–Am–F is I–V–vi–IV in C major. These voicings keep common notes nearby instead of moving every note together.',
			melody:
				'E–G–A–G is a little arch. Repeat its rhythm with different pitches, then leave room at the end for the listener to hear the answer.'
		}
	}
];

function part(id: TrackId, name: string, channel: number, program: number): StudioTrack {
	return { id, name, channel, program, muted: false, notes: [] };
}

function add(notes: StudioNote[], note: number, start: number, duration: number, velocity: number) {
	notes.push(makeNote(note, start, duration, velocity));
}

function drums(notes: StudioNote[], style: string) {
	for (let bar = 0; bar < 8; bar++) {
		const at = bar * 4;
		const kicks =
			style === 'night-drive' ? [0, 1, 2, 3] : style === 'sunlit-pop' ? [0, 1.75, 2.5] : [0, 2.5];
		for (const beat of kicks) add(notes, 36, at + beat, 0.12, beat === 0 ? 110 : 94);
		for (const beat of [1, 3]) add(notes, style === 'pocket-soul' ? 38 : 39, at + beat, 0.12, 94);
		for (let hat = 0; hat < 8; hat++) {
			const swing = style === 'pocket-soul' && hat % 2 === 1 ? 0.06 : 0;
			const open = style === 'night-drive' && hat % 2 === 1;
			add(notes, open ? 46 : 42, at + hat * 0.5 + swing, open ? 0.25 : 0.1, hat % 2 ? 49 : 70);
		}
		if (style === 'pocket-soul' && bar % 2 === 1) add(notes, 38, at + 2.75, 0.1, 34);
		if (bar === 7) {
			for (const beat of [3.5, 3.75])
				add(notes, style === 'pocket-soul' ? 38 : 39, at + beat, 0.1, beat === 3.5 ? 55 : 78);
		}
	}
}

function bass(notes: StudioNote[], roots: number[], style: string) {
	for (let bar = 0; bar < 8; bar++) {
		const root = roots[bar];
		const at = bar * 4;
		if (style === 'night-drive') {
			for (let pulse = 0; pulse < 8; pulse++)
				add(notes, pulse % 4 === 3 ? root + 12 : root, at + pulse * 0.5, 0.3, pulse % 2 ? 75 : 92);
		} else {
			add(notes, root, at, 1.15, 96);
			add(notes, root + 7, at + 1.5, 0.45, 74);
			add(notes, root, at + 2.5, 0.65, 88);
			add(notes, bar === 7 ? root + 12 : roots[Math.min(7, bar + 1)], at + 3.5, 0.4, 68);
		}
	}
}

function harmony(notes: StudioNote[], voicings: number[][], style: string) {
	for (let bar = 0; bar < 8; bar++) {
		const chord = voicings[Math.floor(bar / 2)];
		const at = bar * 4;
		if (style === 'night-drive') {
			for (const note of chord) add(notes, note, at, 3.7, 64);
		} else {
			for (let i = 0; i < chord.length; i++) {
				const strum = style === 'sunlit-pop' ? i * 0.025 : 0;
				add(notes, chord[i], at + strum, 1.75, 65 + i * 3);
				add(notes, chord[i], at + 2.5 + strum, 1.2, 54 + i * 3);
			}
		}
	}
}

function melody(notes: StudioNote[], style: string) {
	// Each row occupies one bar; omitted beats are intentional breaths.
	const phrases: Record<string, [number, number, number][][]> = {
		'pocket-soul': [
			[
				[69, 0.5, 0.5],
				[72, 1.5, 0.5],
				[74, 2, 1]
			],
			[
				[72, 0, 0.75],
				[69, 1, 0.75]
			],
			[
				[67, 0.5, 0.5],
				[69, 1.5, 0.5],
				[70, 2, 1]
			],
			[
				[69, 0, 0.75],
				[67, 1, 1]
			],
			[
				[67, 0.5, 0.5],
				[70, 1.5, 0.5],
				[74, 2, 1]
			],
			[
				[72, 0, 0.75],
				[70, 1, 0.75],
				[67, 2.5, 0.5]
			],
			[
				[69, 0.5, 0.5],
				[72, 1.5, 0.5],
				[76, 2, 1]
			],
			[
				[72, 0, 0.5],
				[69, 1, 2.5]
			]
		],
		'night-drive': [
			[
				[76, 0.5, 0.4],
				[79, 1.5, 0.4],
				[81, 2.5, 0.9]
			],
			[
				[79, 0.5, 0.4],
				[76, 1.5, 1.4]
			],
			[
				[76, 0.5, 0.4],
				[79, 1.5, 0.4],
				[81, 2.5, 0.9]
			],
			[
				[79, 0.5, 0.4],
				[77, 1.5, 1.4]
			],
			[
				[79, 0.5, 0.4],
				[81, 1.5, 0.4],
				[84, 2.5, 0.9]
			],
			[
				[83, 0.5, 0.4],
				[79, 1.5, 0.4],
				[76, 2.5, 0.9]
			],
			[
				[79, 0.5, 0.4],
				[81, 1.5, 0.4],
				[83, 2.5, 0.9]
			],
			[
				[81, 0.5, 0.4],
				[79, 1.5, 1.4]
			]
		],
		'sunlit-pop': [
			[
				[64, 0, 0.5],
				[67, 1, 0.5],
				[69, 2, 0.5],
				[67, 3, 0.75]
			],
			[
				[64, 0, 0.75],
				[62, 1, 0.5],
				[60, 2, 1.5]
			],
			[
				[62, 0, 0.5],
				[67, 1, 0.5],
				[69, 2, 0.5],
				[67, 3, 0.75]
			],
			[
				[71, 0, 0.75],
				[69, 1, 0.5],
				[67, 2, 1.5]
			],
			[
				[64, 0, 0.5],
				[69, 1, 0.5],
				[72, 2, 0.5],
				[71, 3, 0.75]
			],
			[
				[69, 0, 0.75],
				[67, 1, 0.5],
				[64, 2, 1.5]
			],
			[
				[65, 0, 0.5],
				[69, 1, 0.5],
				[72, 2, 0.5],
				[69, 3, 0.75]
			],
			[
				[67, 0, 0.5],
				[65, 1, 2.5]
			]
		]
	};
	for (let bar = 0; bar < 8; bar++) {
		for (const [pitch, beat, duration] of phrases[style][bar])
			add(notes, pitch, bar * 4 + beat, duration, beat === 0 || beat === 0.5 ? 91 : 79);
	}
}

export function createProject(exampleId = 'pocket-soul'): StudioProject {
	const example = STUDIO_EXAMPLES.find((item) => item.id === exampleId) ?? STUDIO_EXAMPLES[0];
	const style = example.id;
	const tracks = [
		part('drums', 'Drums', 9, style === 'night-drive' ? 25 : style === 'sunlit-pop' ? 24 : 0),
		part('bass', 'Bass', 1, style === 'night-drive' ? 38 : 33),
		part('chords', 'Chords', 2, style === 'pocket-soul' ? 4 : style === 'night-drive' ? 89 : 24),
		part('melody', 'Melody', 3, style === 'night-drive' ? 80 : style === 'pocket-soul' ? 11 : 0)
	];
	drums(tracks[0].notes, style);
	const roots =
		style === 'pocket-soul'
			? [38, 38, 43, 43, 36, 36, 41, 41]
			: style === 'night-drive'
				? [33, 33, 41, 41, 36, 36, 43, 43]
				: [36, 36, 31, 31, 33, 33, 41, 41];
	bass(tracks[1].notes, roots, style);
	const voicings =
		style === 'pocket-soul'
			? [
					[53, 57, 60, 64],
					[53, 57, 58, 62],
					[52, 58, 62, 67],
					[55, 57, 60, 64]
				]
			: style === 'night-drive'
				? [
						[57, 60, 64],
						[57, 60, 65],
						[55, 60, 64],
						[55, 59, 62]
					]
				: [
						[60, 64, 67],
						[59, 62, 67],
						[60, 64, 69],
						[60, 65, 69]
					];
	harmony(tracks[2].notes, voicings, style);
	melody(tracks[3].notes, style);
	return {
		version: 1,
		id: studioId(),
		title: example.title,
		bpm: example.bpm,
		bars: 8,
		beatsPerBar: 4,
		key: example.key,
		exampleId: example.id,
		tracks,
		updatedAt: Date.now()
	};
}

export function emptyProject(exampleId = 'pocket-soul'): StudioProject {
	const project = createProject(exampleId);
	project.title = 'My first track';
	for (const track of project.tracks) track.notes = [];
	return project;
}
