/** Pitch spelling and tonal examples for the harmonic compass. */
export interface DiatonicChord {
	degree: number;
	roman: string;
	label: string;
	quality: 'major' | 'minor' | 'diminished';
	rootPc: number;
	notes: number[];
}

export interface MajorKey {
	tonic: string;
	label: string;
	tonicPc: number;
	relativeMinor: string;
	parallelMinor: string;
	signatureText: string;
	accidentals: string[];
	scale: string[];
	chords: DiatonicChord[];
	enharmonic?: string;
}

const KEY_SPELLINGS = [
	{ tonic: 'C', pc: 0, count: 0, scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
	{ tonic: 'G', pc: 7, count: 1, scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'] },
	{ tonic: 'D', pc: 2, count: 2, scale: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'] },
	{ tonic: 'A', pc: 9, count: 3, scale: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'] },
	{ tonic: 'E', pc: 4, count: 4, scale: ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'] },
	{ tonic: 'B', pc: 11, count: 5, scale: ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'] },
	{
		tonic: 'F♯',
		pc: 6,
		count: 6,
		scale: ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'],
		enharmonic: 'G♭'
	},
	{
		tonic: 'D♭',
		pc: 1,
		count: -5,
		scale: ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'],
		enharmonic: 'C♯'
	},
	{
		tonic: 'A♭',
		pc: 8,
		count: -4,
		scale: ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'],
		enharmonic: 'G♯'
	},
	{
		tonic: 'E♭',
		pc: 3,
		count: -3,
		scale: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'],
		enharmonic: 'D♯'
	},
	{
		tonic: 'B♭',
		pc: 10,
		count: -2,
		scale: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'],
		enharmonic: 'A♯'
	},
	{ tonic: 'F', pc: 5, count: -1, scale: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'] }
];
const SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const ROMANS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const QUALITIES: DiatonicChord['quality'][] = [
	'major',
	'minor',
	'minor',
	'major',
	'major',
	'minor',
	'diminished'
];
const SHARPS = ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯'];
const FLATS = ['B♭', 'E♭', 'A♭', 'D♭', 'G♭'];

export const CIRCLE_KEYS: MajorKey[] = KEY_SPELLINGS.map((key) => ({
	tonic: key.tonic,
	label: `${key.tonic} major`,
	tonicPc: key.pc,
	relativeMinor: `${key.scale[5]} minor`,
	parallelMinor: `${key.tonic} minor`,
	enharmonic: key.enharmonic,
	signatureText:
		key.count === 0
			? 'No sharps or flats'
			: `${Math.abs(key.count)} ${key.count > 0 ? 'sharp' : 'flat'}${Math.abs(key.count) === 1 ? '' : 's'}`,
	accidentals: key.count > 0 ? SHARPS.slice(0, key.count) : FLATS.slice(0, -key.count),
	scale: key.scale,
	chords: key.scale.map((name, degree) => {
		const quality = QUALITIES[degree];
		const rootPc = (key.pc + SCALE_OFFSETS[degree]) % 12;
		const root = 60 + rootPc;
		return {
			degree: degree + 1,
			roman: ROMANS[degree],
			label: `${name}${quality === 'minor' ? 'm' : quality === 'diminished' ? '°' : ''}`,
			quality,
			rootPc,
			notes: [root, root + (quality === 'major' ? 4 : 3), root + (quality === 'diminished' ? 6 : 7)]
		};
	})
}));

export function majorKey(index: number): MajorKey {
	const wrapped = Number.isFinite(index) ? ((Math.trunc(index) % 12) + 12) % 12 : 0;
	return CIRCLE_KEYS[wrapped];
}

/** Find a compact inversion near the preceding voices, retaining each pitch class. */
export function nearbyVoicing(chord: DiatonicChord, previous: number[]): number[] {
	const pcs = chord.notes.map((note) => note % 12);
	let best = chord.notes;
	let cost = Infinity;
	for (let inversion = 0; inversion < 3; inversion++) {
		const order = [...pcs.slice(inversion), ...pcs.slice(0, inversion)];
		for (let octave = 4; octave <= 6; octave++) {
			const notes = [order[0] + octave * 12];
			for (const pc of order.slice(1)) {
				let note = pc + octave * 12;
				while (note <= notes.at(-1)!) note += 12;
				notes.push(note);
			}
			const movement = notes.reduce(
				(sum, note, voice) => sum + Math.abs(note - previous[voice]),
				0
			);
			if (movement < cost) {
				best = notes;
				cost = movement;
			}
		}
	}
	return best;
}

/** Tonal comparison: ii–V–I resolves; ii–V–vi redirects the expected ending. */
export function cadence(keyIndex: number, ending: 'home' | 'surprise'): DiatonicChord[] {
	const key = majorKey(keyIndex);
	const chords = [key.chords[1], key.chords[4], key.chords[ending === 'home' ? 0 : 5]];
	let previous = key.chords[1].notes;
	return chords.map((chord, index) => {
		const notes = index === 0 ? previous : nearbyVoicing(chord, previous);
		previous = notes;
		return { ...chord, notes: [...notes] };
	});
}
