import type { PracticeNote } from '$lib/music/practice';

interface Drill {
	id: string;
	title: string;
	description: string;
	notes: PracticeNote[];
	bpm?: number;
	program?: number;
	assessVelocity?: boolean;
	assessDuration?: boolean;
}
export interface MusicFoundation {
	title: string;
	intro: string;
	sections: { title: string; paragraphs: string[] }[];
	drills: Drill[];
	question: string;
	options: string[];
	answer: number;
	explanation: string;
	task: string;
	example: string;
}
const line = (pitches: number[], starts: number[], duration = 0.65): PracticeNote[] =>
	pitches.map((note, index) => ({
		note,
		start: starts[index],
		duration,
		velocity: 88,
		channel: 0
	}));

export const MUSIC_FOUNDATIONS: Record<string, MusicFoundation> = {
	'pulse-and-rhythm': {
		title: 'Pulse, rhythm and the space between',
		intro:
			'A beat is something your body can follow before you know its name. Start with that pulse, then put notes and silence around it. By the end you will play a two-bar rhythm without losing beat one.',
		sections: [
			{
				title: 'Find the pulse',
				paragraphs: [
					'Tap your foot with a steady count: one, two, three, four. The pulse carries on when no instrument plays. Tempo tells you how quickly those beats pass; 80 BPM means 80 beats in a minute.',
					'A bar groups beats. In 4/4, count four quarter-note beats, then begin another bar. Beat one gives the group its home. In 3/4 you count three; in 6/8 the six eighth notes often group into two larger pulses. Meter changes the grouping, not the mathematical relationship between note values.'
				]
			},
			{
				title: 'Divide a beat without speeding up',
				paragraphs: [
					'For eighth notes, say “one and two and three and four and.” Keep the numbers where your foot lands. For sixteenths say “one e and a.” A quarter note lasts twice an eighth; an eighth lasts twice a sixteenth. A whole note is four quarters, whatever the meter.',
					'A rest is intentional silence with a length. Keep counting through it. Playing fewer notes can make the next entrance much stronger; silence is part of the rhythm, not an interruption.'
				]
			},
			{
				title: 'Hear the shape of a bar',
				paragraphs: [
					'An accent makes one note stand out. Try making beat one a little stronger, then accent the offbeats while your foot keeps the same pulse. You have changed the rhythm’s feel without changing its tempo.',
					'Triplets divide a beat into three equal pieces. Swing stretches the first of a pair and shortens the second; its amount depends on tempo and style. Straight subdivisions are a useful starting point, and deliberate swing is a musical choice.'
				]
			}
		],
		drills: [
			{
				id: 'pulse',
				title: 'Keep four steady beats',
				description:
					'Play C four times, one note on each beat after the count-in. The click continues to help you hold the pulse.',
				notes: line([60, 60, 60, 60], [0, 1, 2, 3]),
				bpm: 72
			},
			{
				id: 'rests',
				assessDuration: true,
				title: 'Keep counting through a rest',
				description:
					'Play on 1, the “and” of 2, then 4. In the second bar answer on 1 and 3. Leave the other spaces silent.',
				notes: line([60, 60, 60, 60, 60], [0, 1.5, 3, 4, 6], 0.3),
				bpm: 72
			}
		],
		question: 'You stop playing for one beat. What should happen to the pulse?',
		options: [
			'Keep counting at the same speed',
			'Restart the bar when you play again',
			'Slow down to make room for the rest'
		],
		answer: 0,
		explanation:
			'The beat continues through rests. The next note has a place because the silent beat still counts.',
		task: 'In the Studio, mute the melody and bass. Change two drum hits while keeping the same four-beat bar; listen to the difference before changing the tempo.',
		example: 'pocket-soul'
	},
	'pitch-and-melody': {
		title: 'Notes that sound like a melody',
		intro:
			'A melody is a line you can sing back: pitches, rhythm and the spaces that give them shape. Learn a small palette, make a question, then answer it.',
		sections: [
			{
				title: 'Names, neighbours and octaves',
				paragraphs: [
					'The letters A through G repeat across the keyboard. A sharp raises a note by a semitone; a flat lowers it. Between B and C, and E and F, the white keys are already one semitone apart. The black keys fill the other gaps.',
					'An interval is the distance between notes. C to D is two semitones; C to E is four. Moving by a small step feels different from a large leap. An octave repeats a pitch class twelve semitones higher; it sounds higher while retaining the same letter name.'
				]
			},
			{
				title: 'A scale gives you a palette',
				paragraphs: [
					'C major uses C D E F G A B. Its step pattern is whole, whole, half, whole, whole, whole, half. Move the whole pattern to another starting note and you keep the kind of scale while changing its key.',
					'A minor uses A B C D E F G. It shares C major’s notes, but A becomes the tonic: the note that feels like home. A key is more than a collection of notes; the way phrases settle helps your ear hear which note is home. “Root” usually names the note a chord is built from.'
				]
			},
			{
				title: 'Make a question and an answer',
				paragraphs: [
					'Begin with three or four notes. Repeat a small idea, change its ending, and leave a breath. A phrase that stops away from the tonic can sound unfinished; a later answer that lands on the tonic can make it feel complete.',
					'You can borrow the rhythm of your own first phrase and change only its pitches. Repetition gives the listener something to recognise. A melody does not have to climb a scale, use every available note, or keep playing all the time.'
				]
			}
		],
		drills: [
			{
				id: 'steps',
				title: 'Hear and play three scale steps',
				description:
					'Play C, D, E, then return to C. Listen for the difference between the stepwise rise and the final leap.',
				notes: line([60, 62, 64, 60], [0, 1, 2, 3]),
				bpm: 72
			},
			{
				id: 'melody',
				title: 'Answer a small musical question',
				description:
					'An original two-bar phrase: C E G E, then D and a longer C. Leave the breath before the answer.',
				notes: line([60, 64, 67, 64, 62, 60], [0, 1, 2, 3, 4.5, 6], 0.7),
				bpm: 80
			}
		],
		question:
			'C major and A minor can use the same white keys. What helps them sound like different keys?',
		options: [
			'The note treated as home and how the phrases move toward it',
			'The instrument must change',
			'Minor always has fewer notes'
		],
		answer: 0,
		explanation:
			'The tonic and the musical context establish the key. The same collection can support different melodies and chords.',
		task: 'In Sunlit Pop, mute everything except the melody. Change its last note, hear whether it feels finished, then try an ending on C.',
		example: 'sunlit-pop'
	},
	'chords-and-movement': {
		title: 'Chords that move somewhere',
		intro:
			'A chord is a group of notes heard together. A progression is their journey. Learn two useful chord shapes, then connect them with less jumping around.',
		sections: [
			{
				title: 'Build a triad',
				paragraphs: [
					'A major triad has a root, a major third four semitones above it, and a perfect fifth seven semitones above it. C major is C E G. A minor triad lowers the third by one semitone: C E-flat G.',
					'Major and minor have different colours, but neither guarantees a mood. Tempo, register, rhythm, melody, instrument and the surrounding chords all matter. Learn to hear the changed third rather than using “happy” or “sad” as a rule.'
				]
			},
			{
				title: 'Keep the chord, change the bass',
				paragraphs: [
					'C E G, E G C and G C E are all C major. They are root position, first inversion and second inversion. The chord root remains C even when E or G is its lowest sounding note.',
					'An inversion lets you keep nearby notes when a chord changes. From C E G to A C E, C and E can remain while G moves to A. This smooth movement is voice leading: individual notes make small, sensible journeys.'
				]
			},
			{
				title: 'Build chords from the key',
				paragraphs: [
					'Stack alternate notes of C major and you get C, D minor, E minor, F, G, A minor and B diminished. Musicians label these I, ii, iii, IV, V, vi and vii°; the numbers describe scale degrees rather than fixed letter names.',
					'Try I–vi–IV–V: C–Am–F–G. The G chord often makes returning to C feel convincing. A cadence is an ending gesture; a V–I motion is one common kind. Other styles use different endings, and looping progressions need not resolve each time.'
				]
			}
		],
		drills: [
			{
				id: 'triad',
				title: 'Build C major with your fingers',
				description:
					'After the count-in, press C, E and G together on beat one. Three notes, one chord.',
				notes: line([60, 64, 67], [0, 0, 0], 2),
				bpm: 65
			},
			{
				id: 'inversion',
				title: 'Move to first inversion',
				description:
					'Play C E G on beat one. On beat three play E G C an octave higher. The note order changes; the chord name stays C major.',
				notes: line([60, 64, 67, 64, 67, 72], [0, 0, 0, 2, 2, 2], 1.5),
				bpm: 60
			}
		],
		question: 'You hear E, G and C, with E at the bottom. Which chord is it?',
		options: [
			'C major in first inversion',
			'E minor, because E is lowest',
			'A different chord with no root'
		],
		answer: 0,
		explanation:
			'Inversion changes the lowest note. The three chord tones still belong to C major, whose root is C.',
		task: 'Open Sunlit Pop, hear the C–G–Am–F chords, then move one chord tone by an octave. Keep the pitch classes and hear how the voicing changes.',
		example: 'sunlit-pop'
	},
	'bass-and-drums': {
		title: 'Make the bass and drums agree',
		intro:
			'A useful groove is a conversation. The drums make a rhythmic frame; the bass supplies low notes that connect that frame to the harmony. Start with a little, then add only what serves the pattern.',
		sections: [
			{
				title: 'Give each drum a job',
				paragraphs: [
					'In a simple 4/4 backbeat, put the kick on beats 1 and 3, the snare on 2 and 4, and a closed hi-hat on each eighth note. This is a starting pattern, not a rule for every genre. The kick grounds the phrase; the snare marks a response; the hat makes the subdivisions audible.',
					'Remove a hit before adding one. A gap can make the next kick stand out. A quiet snare ghost note fills space without competing with the backbeat. The strongest hit should have a reason to be strong.'
				]
			},
			{
				title: 'Let the bass name the harmony',
				paragraphs: [
					'Begin by playing the chord root near a strong kick. Over C, play a low C; over A minor, a low A. Then try holding the bass through a snare hit so the parts do different jobs.',
					'You can use another chord tone or a passing scale note between roots. Aim for a clear destination on the next strong beat. Bass and kick can share some entrances without copying each other on every subdivision.'
				]
			},
			{
				title: 'Make a variation, then return',
				paragraphs: [
					'A two-bar groove is easy to recognise when the second bar changes one thing. Add a short pickup before beat one, move the last kick, or open the hat near the end. Returning to the familiar first bar makes the variation meaningful.',
					'Human timing and velocity are choices you can hear in context. A precise electronic grid can feel right; a swung or relaxed part can feel right too. Compare both and keep the one that fits your music.'
				]
			}
		],
		drills: [
			{
				id: 'drums',
				title: 'Play a kick and snare backbeat',
				description:
					'Kick on 1 and 3, snare on 2 and 4. Use the displayed drum shortcuts after the count-in.',
				notes: [36, 38, 36, 38].map((note, start) => ({
					note,
					start,
					duration: 0.2,
					velocity: 96,
					channel: 9
				})),
				bpm: 72
			},
			{
				id: 'bass',
				title: 'Place a bass pickup',
				description:
					'Play low C on beat one, G on the “and” of 2, then C again on 3. Notice the space left for the snare.',
				notes: line([48, 55, 48], [0, 1.5, 2], 0.7),
				bpm: 80,
				program: 33
			}
		],
		question:
			'Your kick and bass are both busy on every sixteenth. What is a useful first experiment?',
		options: [
			'Remove a few entrances and give each part space',
			'Make every note louder',
			'Speed up until the conflict disappears'
		],
		answer: 0,
		explanation:
			'Space makes the roles easier to hear. Shared accents can be strong without requiring identical patterns.',
		task: 'Open Pocket Soul. Solo drums, then bass, then both. Remove two bass notes and listen to whether the kick becomes clearer.',
		example: 'pocket-soul'
	},
	'musical-expression': {
		title: 'Play the same notes with intention',
		intro:
			'The notes are only the beginning. Strength, length, silence and the shape of a phrase tell the listener what matters. Change one of those at a time so you can hear your decision.',
		sections: [
			{
				title: 'Give the phrase an accent',
				paragraphs: [
					'Dynamics describe musical loudness and its changes. MIDI velocity measures the beginning of a note; the instrument may use it for loudness, brightness or a different sample. A phrase with one clear accent has direction.',
					'Try a strong first note and a quieter answer. Then reverse them. The pitch sequence has not changed, but your ear follows a different path. On the on-screen instrument, pointer position controls strength; a velocity-sensitive controller lets your fingers do it directly.'
				]
			},
			{
				title: 'Decide when to let go',
				paragraphs: [
					'Staccato notes are short and separated. Legato notes connect, with little or no gap; some instruments respond to overlapping notes with a different attack. Note duration is a choice about phrasing, not just how long a rectangle looks.',
					'Let a phrase breathe. A held note followed by a rest can be stronger than filling every space. The sound’s release may continue after Note Off, so listen to the instrument while deciding when to lift your fingers.'
				]
			},
			{
				title: 'Shape a whole line',
				paragraphs: [
					'A crescendo grows through the phrase; a decrescendo settles. Use a small change rather than making every note maximum strength. Expression, modulation and filter movement can shape a held note when the instrument supports those controls.',
					'Compare your playing with the reference, then ask one musical question: which note should stand out? Timing feedback is a guide to deliberate placement. It does not require every style to use a rigid grid.'
				]
			}
		],
		drills: [
			{
				id: 'dynamics',
				title: 'Play a strong note and a soft answer',
				description:
					'Play C strongly on beat one, then E softly on beat three. Use pointer height or a velocity-sensitive controller; typing alone sends a fixed strength.',
				notes: [
					{ note: 60, start: 0, duration: 0.6, velocity: 105, channel: 0 },
					{ note: 64, start: 2, duration: 0.6, velocity: 42, channel: 0 }
				],
				bpm: 72,
				assessVelocity: true
			},
			{
				id: 'space',
				assessDuration: true,
				title: 'Give the ending room',
				description:
					'Play C and E on the first two beats, leave beat three silent, then G on four. Hold the final note as the bar turns.',
				notes: [
					{ note: 60, start: 0, duration: 0.3 },
					{ note: 64, start: 1, duration: 0.3 },
					{ note: 67, start: 3, duration: 1.6 }
				],
				bpm: 72
			}
		],
		question:
			'You want the second note to sound like a quiet answer. Which is the most direct change?',
		options: [
			'Lower its velocity and listen to the result',
			'Raise the tempo',
			'Add another chord tone automatically'
		],
		answer: 0,
		explanation:
			'Changing the note’s strength changes its role in the phrase. The instrument decides exactly how velocity affects its sound.',
		task: 'In Night Drive, lower the velocities of alternate melody notes. Compare the result with the original before changing any pitches.',
		example: 'night-drive'
	},
	'first-composition': {
		title: 'Your first eight bars',
		intro:
			'You now have enough musical material to finish something small. Eight bars is long enough for an idea, a variation and a return, and short enough to hear the whole piece while making decisions.',
		sections: [
			{
				title: 'Start with a groove you can recognise',
				paragraphs: [
					'Open the Studio with an original example, or create your own blank project. Choose a comfortable tempo and one drum pattern. Repeat it across eight bars before adding complexity. Listen for a clear beat one and an intentional backbeat.',
					'Choose instruments you enjoy. Then write a title for the piece; a named project is easier to find and continue later. The goal is a complete musical sketch you can replay.'
				]
			},
			{
				title: 'Connect bass, chords and melody',
				paragraphs: [
					'Use one chord per bar to begin. In C major, C–Am–F–G gives you a four-bar journey you can repeat. Put bass roots near the strong kicks. Keep the bass rhythm simple enough that the chord changes are clear.',
					'Record a short melody in bars 1–2, leave a breath, and answer in bars 3–4. Repeat or vary that idea in bars 5–8. Start with scale tones, then choose an ending that feels finished to you.'
				]
			},
			{
				title: 'Make the second half different',
				paragraphs: [
					'Change one thing in bars 5–8: lift the melody, add a drum fill, change an inversion, or leave a whole beat empty. A listener should recognise the first idea and hear why it returned.',
					'Mute one part at a time. If a part adds nothing, simplify it or leave it out. Listen from the beginning without editing, then make one change based on what you heard.'
				]
			},
			{
				title: 'Keep a finished version',
				paragraphs: [
					'Save the named project in this browser, return to it, and play it again. Export a MIDI file to continue in a DAW, and download a project backup to preserve the instruments and editable notes. You can render audio in your DAW when you want someone to hear the sound you chose.',
					'A first piece is finished when its parts work together and you can replay it from beginning to end. You can keep learning the MIDI protocol while returning to this project whenever a new control gives you another musical idea.'
				]
			}
		],
		drills: [],
		question:
			'You have eight bars but every part plays constantly. What should you try before adding more sounds?',
		options: [
			'Listen with parts muted, then remove anything that obscures the main idea',
			'Add a fifth melody',
			'Turn every track to maximum velocity'
		],
		answer: 0,
		explanation:
			'Arrangement is deciding what plays, when, and why. Space and contrast help an idea stay audible.',
		task: 'Finish a named eight-bar piece: drums, bass, chords and a melody, with one intentional variation in its second half. Save it, replay it from the start and export a version you can keep.',
		example: 'sunlit-pop'
	}
};
