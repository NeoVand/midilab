/**
 * The vocabulary.
 *
 * This list used to hold thirty-nine entries, every one of them about the
 * protocol — and that was an accurate map of who the course was written for.
 * A programmer arriving at "twenty-four ticks a quarter note" needs to be told
 * what a quarter note is far more urgently than what a status byte is, and the
 * course was silently assuming the harder half.
 *
 * So the table now carries the *musical* vocabulary too, and `Term` puts the
 * definitions inline in the prose where the word is first used. The rule for
 * inclusion is not "is this a MIDI word" but "does a sentence in this course
 * lean on this word without stopping to explain it".
 *
 * `category` exists so the reference page can offer the music words on their
 * own — a producer and a programmer are missing opposite halves of this list,
 * and each should be able to see their half.
 */
export type GlossaryCategory =
	| 'protocol' // MIDI itself: messages, bytes, timing.
	| 'music' // notation, rhythm, harmony — what musicians assume of each other.
	| 'sound' // synthesis and acoustics: what the receiver is doing.
	| 'studio' // cables, hosts, routing, gear practice.
	| 'code'; // browser APIs, scheduling, data formats.

export interface GlossaryEntry {
	term: string;
	definition: string;
	category?: GlossaryCategory;
	/**
	 * Other spellings the prose actually uses, so `Term` can be dropped around
	 * the word as written instead of forcing every sentence into the headword.
	 * Matched case-insensitively.
	 */
	aliases?: string[];
	/** Lesson id where this is properly explained, if one does. */
	lesson?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
	{
		term: 'Aftertouch',
		definition:
			'Pressure applied to a key after it is already down. Channel aftertouch sends one value for the whole channel; polyphonic aftertouch sends one per note and is rare.',
		category: 'protocol'
	},
	{
		term: 'Bank Select',
		definition:
			'CC 0 (MSB) and CC 32 (LSB), sent before a Program Change to choose which bank of 128 sounds the program number refers to. Does nothing on its own.',
		category: 'protocol'
	},
	{
		term: 'Channel',
		definition:
			'The low nibble of a status byte: an address, 0–15 on the wire and 1–16 on every front panel. Each channel holds its own program, volume, bend and controller state.',
		category: 'protocol'
	},
	{
		term: 'Channel Mode message',
		definition:
			'Controllers 120–127, which change how a channel behaves rather than moving a parameter. All Notes Off, All Sound Off, Local Control and the Omni/Mono modes.',
		category: 'protocol'
	},
	{
		term: 'Class-compliant',
		definition:
			'A USB device that works with the operating system’s built-in driver and needs nothing installed. Almost all modern MIDI hardware, which is why browsers can talk to it.',
		category: 'studio'
	},
	{
		term: 'Control Change (CC)',
		definition:
			'Status 0xBn. A controller number 0–127 and a value 0–127. Most meanings are conventions rather than guarantees.',
		category: 'protocol'
	},
	{
		term: 'Current loop',
		definition:
			'MIDI’s electrical scheme: about 5 mA is pushed through the cable rather than a voltage being applied. Combined with opto-isolation, it is why MIDI cannot create ground loops or damage equipment.',
		category: 'studio'
	},
	{
		term: 'Data byte',
		definition:
			'A byte whose top bit is 0, so its value is 0–127. Every value in MIDI 1.0 is a data byte, which is why 127 appears everywhere.',
		category: 'protocol'
	},
	{
		term: 'Delta time',
		definition:
			'In a MIDI file, the number of ticks since the previous event, stored as a variable-length quantity. Files store deltas, not timestamps.',
		category: 'code'
	},
	{
		term: 'General MIDI (GM)',
		definition:
			'An agreement layered on top of MIDI fixing a 128-program list, a percussion map on channel 10, and minimum polyphony. A costume MIDI devices can wear, not their natural state.',
		category: 'protocol'
	},
	{
		term: 'Group',
		definition:
			'MIDI 2.0’s outer address level: sixteen groups, each with sixteen channels, on one connection.',
		category: 'protocol'
	},
	{
		term: 'Implementation chart',
		definition:
			'The table at the back of a manual listing what a device transmits and what it recognises. Read it as an API specification.',
		category: 'studio'
	},
	{
		term: 'Jitter',
		definition:
			'Inconsistent delay. Unlike latency it cannot be compensated for, because the amount is different every time. It is what makes a rig feel loose.',
		category: 'code'
	},
	{
		term: 'Latency',
		definition:
			'Consistent delay. Correctable by scheduling or playing earlier by the same amount.',
		category: 'code'
	},
	{
		term: 'Local Control',
		definition:
			'Whether a keyboard is connected to its own sound engine. Turning it off (CC 122 = 0) makes the instrument a pure controller, and is the fix for doubled notes when a computer echoes MIDI back.',
		category: 'studio'
	},
	{
		term: 'Lookahead scheduler',
		definition:
			'The pattern that makes browser timing work: wake up coarsely, plan a little way into the future, and hand every event to the audio and MIDI layers with a timestamp instead of firing it from a timer.',
		category: 'code'
	},
	{
		term: 'MIDI Clock',
		definition:
			'A single byte (0xF8) sent 24 times per quarter note. Tempo is inferred from how fast the ticks arrive; no BPM number is ever transmitted.',
		category: 'protocol'
	},
	{
		term: 'MIDI-CI',
		definition:
			'MIDI 2.0’s Capability Inquiry: the bidirectional negotiation that lets two devices discover each other and agree on what to speak.',
		category: 'protocol'
	},
	{
		term: 'MPE',
		definition:
			'MIDI Polyphonic Expression. A convention for using MIDI 1.0 in which every simultaneously sounding note gets its own channel, so channel-wide bend, pressure and CC 74 become per-note.',
		category: 'protocol'
	},
	{
		term: 'MTC',
		definition:
			'MIDI Time Code. SMPTE hours, minutes, seconds and frames carried over MIDI, for synchronising to a fixed timeline rather than a tempo.',
		category: 'protocol'
	},
	{
		term: 'Multitimbral',
		definition: 'An instrument that plays different sounds on different channels simultaneously.',
		category: 'protocol'
	},
	{
		term: 'NRPN',
		definition:
			'Non-Registered Parameter Number. A parameter selected with CC 99/98 and set with CC 6/38, meaning whatever the manufacturer decided. Where deep synth editing lives.',
		category: 'protocol'
	},
	{
		term: 'Opto-isolator',
		definition:
			'An LED shining on a phototransistor at the receiving end of a MIDI input, so that two connected devices share no electrical path at all.',
		category: 'studio'
	},
	{
		term: 'PPQN',
		definition:
			'Pulses per quarter note. Two different numbers use this name: MIDI Clock is fixed at 24, while a sequencer’s internal resolution is whatever it chooses — 480, 960, 1920.',
		category: 'protocol'
	},
	{
		term: 'Panic',
		definition:
			'Lift the pedals, then All Notes Off, then All Sound Off, then Reset All Controllers, on all sixteen channels — and an explicit Note Off sweep if something is still ringing.',
		category: 'protocol'
	},
	{
		term: 'Pitch bend',
		definition:
			'Status 0xEn. The only 14-bit channel voice message, centred at 8192, with the LSB sent before the MSB. Channel-wide, which is the limitation MPE exists to work around.',
		category: 'protocol'
	},
	{
		term: 'Program Change',
		definition:
			'Status 0xCn plus one data byte: switch to sound number n. Front panels usually number sounds from 1 while the byte counts from 0.',
		category: 'protocol'
	},
	{
		term: 'Property Exchange',
		definition:
			'MIDI 2.0’s mechanism for a device to publish structured information about its own controllers, programs and state.',
		category: 'protocol'
	},
	{
		term: 'RPN',
		definition:
			'Registered Parameter Number. Same mechanism as NRPN but with numbers assigned by the MIDI Association, so they mean the same thing everywhere. Bend range is RPN 0,0.',
		category: 'protocol'
	},
	{
		term: 'Running status',
		definition:
			'Omitting a repeated status byte to save bandwidth. Why a velocity-zero Note On means Note Off, and why MIDI file parsers must be stateful.',
		category: 'protocol'
	},
	{
		term: 'Song Position Pointer',
		definition:
			'A 14-bit count of sixteenth notes from the start of a song, sent before Continue to relocate a follower.',
		category: 'protocol'
	},
	{
		term: 'Status byte',
		definition:
			'A byte whose top bit is 1, so its value is 128–255. The high nibble says what kind of message; for channel messages the low nibble says which channel.',
		category: 'protocol'
	},
	{
		term: 'SysEx',
		definition:
			'System Exclusive. An arbitrarily long block addressed to one manufacturer, meaning whatever that manufacturer decided. Everything between F0 and F7 must be a data byte.',
		category: 'protocol'
	},
	{
		term: 'Thru',
		definition:
			'A socket carrying an exact regenerated copy of whatever arrived at MIDI In. It does not include anything this device is playing — that is MIDI Out.',
		category: 'studio'
	},
	{
		term: 'TRS Type A / Type B',
		definition:
			'Two incompatible ways of wiring MIDI onto a 3.5 mm jack. Type A is the standard. Mixing them produces complete silence with no other symptom.',
		category: 'studio'
	},
	{
		term: 'UMP',
		definition:
			'Universal MIDI Packet. MIDI 2.0’s container: 32-bit words whose first nibble gives the message type and second the group.',
		category: 'protocol'
	},
	{
		term: 'Variable-length quantity',
		definition:
			'MIDI file encoding for numbers: seven bits of value per byte, with the top bit meaning "another byte follows".',
		category: 'code'
	},
	{
		term: 'Velocity',
		definition:
			'How hard a note was struck, 1–127, measured once at the start and never updated. Velocity 0 in a Note On means Note Off.',
		category: 'protocol'
	},
	{
		term: 'Zipper noise',
		definition:
			'The audible stepping caused by applying 7-bit controller values directly to a parameter. Fixed at the receiving end by smoothing, or avoided with 14-bit resolution.',
		category: 'sound'
	},

	// ── Music ─────────────────────────────────────────────────────────────
	//
	// Everything below this line is what a musician assumes another musician
	// already knows. The course leaned on all of it before it defined any of
	// it, which is the single biggest reason a competent programmer could
	// bounce off Act III.
	{
		term: 'Beat',
		definition:
			'The pulse you tap your foot to. Tempo is how many of them go past in a minute; everything else about musical time is counted in fractions and multiples of one.',
		category: 'music',
		aliases: ['beats']
	},
	{
		term: 'Bar',
		definition:
			'A fixed group of beats, repeated for the length of a piece — usually four. Also called a measure. It is the unit sequencers count in, and the reason loops are almost always 1, 2, 4, 8 or 16 of something.',
		category: 'music',
		aliases: ['bars', 'measure', 'measures']
	},
	{
		term: 'Time signature',
		definition:
			'Two stacked numbers saying how a bar is counted: 4/4 is four quarter notes, 3/4 is three (a waltz), 6/8 is six eighths felt as two groups of three. MIDI does not transmit it — only files store it, as a meta event.',
		category: 'music'
	},
	{
		term: 'Tempo',
		definition:
			'Speed, in beats per minute. MIDI Clock never sends the number: the follower measures the gaps between ticks and works it out. Only a MIDI file states a tempo outright.',
		category: 'music',
		aliases: ['BPM', 'beats per minute'],
		lesson: 'midi-clock'
	},
	{
		term: 'Quarter note',
		definition:
			'One beat in the usual 4/4 bar — a crotchet, if you learned the British names. It is the reference unit for almost every timing number in MIDI: 24 clocks per quarter note, PPQN, delta times.',
		category: 'music',
		aliases: ['quarter notes', 'crotchet']
	},
	{
		term: 'Eighth note',
		definition:
			'Half a beat; two per quarter note. Eight of them fill a 4/4 bar, which is why a "straight eighths" groove feels like a steady run.',
		category: 'music',
		aliases: ['eighth notes', 'quaver', 'eighths']
	},
	{
		term: 'Sixteenth note',
		definition:
			'A quarter of a beat; sixteen per 4/4 bar. The default grid of most step sequencers and drum machines, and the unit a Song Position Pointer counts in.',
		category: 'music',
		aliases: ['sixteenth notes', 'semiquaver', 'sixteenths']
	},
	{
		term: 'Triplet',
		definition:
			'Three notes in the space normally taken by two. Where swing comes from, and the reason 24 — divisible by 3 as well as by 2, 4, 6 and 8 — was chosen for MIDI Clock.',
		category: 'music',
		aliases: ['triplets']
	},
	{
		term: 'Downbeat',
		definition:
			'The first beat of a bar, and the strongest. "On the beat" means aligned with one of the four; "off the beat" means deliberately between them.',
		category: 'music',
		aliases: ['downbeats', 'on the beat']
	},
	{
		term: 'Syncopation',
		definition:
			'Putting weight where the pulse is not. Almost every groove that feels alive is doing this somewhere, and Euclidean rhythms are a machine for generating it.',
		category: 'music',
		aliases: ['syncopated'],
		lesson: 'patterns'
	},
	{
		term: 'Swing',
		definition:
			'Delaying every second subdivision so pairs of notes go long-short instead of even. Expressed as a percentage: 50% is straight, 66% is a full triplet feel, and the interesting territory is in between.',
		category: 'music',
		aliases: ['swung', 'shuffle'],
		lesson: 'ppqn-and-groove'
	},
	{
		term: 'Groove',
		definition:
			'The small, consistent timing and velocity deviations that make a part feel human rather than typed. A grid with the life left in it.',
		category: 'music',
		lesson: 'ppqn-and-groove'
	},
	{
		term: 'Quantise',
		definition:
			'Snapping note times to the nearest grid position. Fixes sloppiness and destroys feel in the same operation, which is why every DAW offers it by percentage rather than as a switch.',
		category: 'music',
		aliases: ['quantize', 'quantised', 'quantized', 'quantisation', 'quantization'],
		lesson: 'ppqn-and-groove'
	},
	{
		term: 'Tresillo',
		definition:
			'The three-against-eight pattern (x··x··x·) underneath an enormous amount of Latin, African and modern pop music. Euclidean rhythm E(3,8) generates it exactly.',
		category: 'music',
		lesson: 'patterns'
	},
	{
		term: 'Semitone',
		definition:
			'The smallest step on a keyboard — any key to the very next key, black or white. Add 1 to a MIDI note number and you have moved one semitone. Twelve make an octave.',
		category: 'music',
		aliases: ['semitones', 'half step'],
		lesson: 'notes-and-pitch'
	},
	{
		term: 'Octave',
		definition:
			'Twelve semitones, and a doubling of frequency. Two notes an octave apart sound so alike that every musical culture gives them the same name. In MIDI it is simply +12.',
		category: 'music',
		aliases: ['octaves'],
		lesson: 'notes-and-pitch'
	},
	{
		term: 'Interval',
		definition:
			'The distance between two pitches, counted in semitones and named by tradition: +7 a perfect fifth, +4 a major third, +3 a minor third. Chords and scales are both just sets of intervals.',
		category: 'music',
		aliases: ['intervals'],
		lesson: 'notes-and-pitch'
	},
	{
		term: 'Scale',
		definition:
			'A chosen subset of the twelve pitch classes, repeated in every octave — the palette a piece draws from. Major is 0-2-4-5-7-9-11 semitones from its root; minor lowers the third, sixth and seventh.',
		category: 'music',
		aliases: ['scales']
	},
	{
		term: 'Key',
		definition:
			'Which note a piece treats as home, plus the scale it uses around it. MIDI has no message for it — a file can note it, but a cable never carries it.',
		category: 'music',
		aliases: ['key signature']
	},
	{
		term: 'Root',
		definition:
			'The note a chord is built on and named after. C-E-G is a C chord because C is at the bottom of the stack of thirds, whatever order you actually play them in.',
		category: 'music'
	},
	{
		term: 'Chord',
		definition:
			'More than one note sounding at once. To MIDI it is nothing at all — just several Note Ons that happen to overlap. Every notion of harmony lives in the player or the software, never on the wire.',
		category: 'music',
		aliases: ['chords', 'harmony']
	},
	{
		term: 'Triad',
		definition:
			'A three-note chord built in thirds. Root +4 +7 is major; root +3 +7 is minor. One semitone of difference, and the entire emotional colour changes.',
		category: 'music',
		aliases: ['triads'],
		lesson: 'notes-and-pitch'
	},
	{
		term: 'Inversion',
		definition:
			'The same chord with a different note lowest — C-E-G becomes E-G-C. Same harmony, different voice leading, and to MIDI, different note numbers entirely.',
		category: 'music',
		aliases: ['inversions', 'inverted']
	},
	{
		term: 'Arpeggio',
		definition:
			'A chord played one note at a time instead of all at once. An arpeggiator is a device that does this to whatever you hold down, in time with the clock.',
		category: 'music',
		aliases: ['arpeggios', 'arpeggiated', 'arpeggiator']
	},
	{
		term: 'Transpose',
		definition:
			'Shift everything by the same interval. Trivial in MIDI — add a constant to every note number — and the operation that makes note numbers so much more useful than note names.',
		category: 'music',
		aliases: ['transposition', 'transposed']
	},
	{
		term: 'Dynamics',
		definition:
			'How loud, as a performance decision rather than a mix setting: pianissimo through fortissimo. Velocity is MIDI’s only native way of expressing them.',
		category: 'music',
		lesson: 'velocity'
	},
	{
		term: 'Legato',
		definition:
			'Notes joined without a gap — the next one begins before the last has ended. Many synths detect the overlap and refuse to retrigger the envelope, which is why legato playing can sound completely different from staccato playing on the same patch.',
		category: 'music',
		aliases: ['staccato']
	},
	{
		term: 'Vibrato',
		definition:
			'A small, regular wobble in pitch. In MIDI it is usually not sent as pitch bend at all — CC 1 (Modulation) asks the instrument to apply its own.',
		category: 'music',
		lesson: 'control-change'
	},
	{
		term: 'Portamento',
		definition:
			'Sliding continuously from one pitch to the next instead of jumping. CC 5 sets how long the slide takes, CC 65 switches it on, and CC 84 says which note to slide from.',
		category: 'music',
		aliases: ['glide'],
		lesson: 'control-change'
	},
	{
		term: 'Ghost note',
		definition:
			'A deliberately very quiet hit, usually on a snare, that you feel more than hear. Programming drums without them is most of what makes a pattern sound typed.',
		category: 'music',
		aliases: ['ghost notes']
	},
	{
		term: 'Cents',
		definition:
			'Hundredths of a semitone; 1200 to the octave. The unit for talking about tuning error, because the ear hears pitch ratios rather than differences in hertz.',
		category: 'music',
		aliases: ['cent']
	},
	{
		term: 'Equal temperament',
		definition:
			'Dividing the octave into twelve identical steps so that every key sounds equally usable — and every interval except the octave sounds very slightly wrong. The compromise every keyboard is built on.',
		category: 'music',
		aliases: ['equal-tempered']
	},
	{
		term: 'Just intonation',
		definition:
			'Tuning intervals to exact whole-number frequency ratios — 3:2 for a fifth, 5:4 for a major third. Purer than equal temperament, and unusable on a fixed keyboard in more than one key at a time.',
		category: 'music'
	},
	{
		term: 'Harmonic series',
		definition:
			'The whole-number multiples of a fundamental frequency, which every real instrument produces at once. The reason intervals sound consonant at all: they are already present inside a single note.',
		category: 'sound',
		aliases: ['harmonics', 'overtones', 'overtone series', 'partials'],
		lesson: 'notes-and-pitch'
	},
	{
		term: 'Fundamental',
		definition:
			'The lowest and usually loudest frequency in a note — the one you identify as its pitch, even in instruments where it is barely present.',
		category: 'sound'
	},
	{
		term: 'Timbre',
		definition:
			'What makes a trumpet and a flute playing the same note sound different: the balance of harmonics, and how that balance changes over the length of the note. Pronounced TAM-ber.',
		category: 'sound',
		aliases: ['tone colour', 'tone color']
	},

	// ── Synthesis: what the receiver is actually doing ─────────────────────
	{
		term: 'Envelope',
		definition:
			'How a parameter moves over the life of a note, without any further messages. The classic shape is ADSR: attack, decay, sustain, release. MIDI sends two instants; the envelope is everything in between.',
		category: 'sound',
		aliases: ['ADSR', 'envelopes'],
		lesson: 'envelope'
	},
	{
		term: 'Attack',
		definition:
			'How long a note takes to reach full level after Note On. Short is a plucked string, long is a bowed one. CC 73 asks the receiver to change it.',
		category: 'sound',
		lesson: 'envelope'
	},
	{
		term: 'Release',
		definition:
			'How long a note takes to fade after Note Off. This is why Note Off is not silence, and why a piano patch keeps ringing after you lift your hand. CC 72 asks the receiver to change it.',
		category: 'sound',
		lesson: 'envelope'
	},
	{
		term: 'Oscillator',
		definition:
			'The part of a synthesiser that generates a raw repeating waveform at the requested pitch. Everything after it is subtraction and shaping.',
		category: 'sound',
		aliases: ['oscillators', 'osc']
	},
	{
		term: 'Waveform',
		definition:
			'The shape of one cycle, which determines which harmonics are present. A sawtooth has all of them, a square has only the odd ones, a sine has none but the fundamental.',
		category: 'sound',
		aliases: ['waveforms', 'sawtooth', 'square wave']
	},
	{
		term: 'Filter',
		definition:
			'A control that removes part of the frequency range — almost always the highs. Sweeping one is the single most recognisable gesture in electronic music, and CC 74 is how you ask for it remotely.',
		category: 'sound',
		aliases: ['filters', 'low-pass']
	},
	{
		term: 'Cutoff',
		definition:
			'Where a filter starts removing things. Low cutoff is dark and muffled, high is bright and open. CC 74 by convention, and the most-automated controller in existence.',
		category: 'sound',
		aliases: ['brightness']
	},
	{
		term: 'Resonance',
		definition:
			'A boost right at the filter’s cutoff point, which makes a sweep sing rather than just dull. CC 71 by convention. Enough of it and the filter oscillates on its own.',
		category: 'sound'
	},
	{
		term: 'LFO',
		definition:
			'Low-Frequency Oscillator: a wave too slow to hear, used to move something else. Aimed at pitch it is vibrato, at volume tremolo, at a filter a wobble.',
		category: 'sound'
	},
	{
		term: 'Subtractive synthesis',
		definition:
			'Start with a harmonically rich waveform and take things away with a filter. The architecture almost every analogue synthesiser and most digital ones use, and the one MIDI’s CC conventions were designed around.',
		category: 'sound'
	},
	{
		term: 'Patch',
		definition:
			'One saved sound — every parameter of the instrument at once. Also called a preset, a program, or a voice depending on the manufacturer’s mood. Program Change recalls one by number.',
		category: 'sound',
		aliases: ['patches', 'preset', 'presets']
	},
	{
		term: 'Polyphony',
		definition:
			'How many notes an instrument can sound at once. Exceed it and something has to give: the oldest note is usually stolen, which is why dense chords can make earlier notes vanish.',
		category: 'sound',
		aliases: ['polyphonic', 'voice stealing']
	},
	{
		term: 'Monophonic',
		definition:
			'One note at a time. Send a second Note On and the instrument moves the single voice rather than adding one — the behaviour bass and lead patches usually want.',
		category: 'sound',
		aliases: ['mono', 'monosynth']
	},
	{
		term: 'Velocity layer',
		definition:
			'In a sampler, a different recording of the same note captured at a different playing strength. Why a well-sampled piano gets brighter as you play harder instead of just louder.',
		category: 'sound',
		aliases: ['velocity layers', 'round robin'],
		lesson: 'velocity'
	},
	{
		term: 'Sampler',
		definition:
			'An instrument that plays back recordings rather than generating waveforms. It can be told when to start and stop and how loud, but it cannot be asked to change what was recorded.',
		category: 'sound',
		aliases: ['sample', 'samples']
	},

	// ── The studio and the software ────────────────────────────────────────
	{
		term: 'DAW',
		definition:
			'Digital Audio Workstation — Ableton Live, Logic, FL Studio, Reaper, Bitwig, Cubase, Pro Tools. The program that records, arranges and plays back both audio and MIDI, and the place most people meet MIDI first.',
		category: 'studio'
	},
	{
		term: 'Piano roll',
		definition:
			'The grid every DAW draws MIDI in: pitch up the side, time across, one rectangle per note. It shows exactly three of the things a Note On carries — pitch, start, length — and hides velocity in a lane below.',
		category: 'studio'
	},
	{
		term: 'MIDI Learn',
		definition:
			'A mode where a plugin or device watches for the next controller you move and binds it to the parameter you selected. The reason nobody needs to look up CC numbers any more, and the reason nobody knows them.',
		category: 'studio'
	},
	{
		term: 'Automation',
		definition:
			'Parameter changes recorded against the timeline rather than played live. In MIDI terms it is a dense stream of Control Change messages, which is why heavy automation can crowd a busy cable.',
		category: 'studio',
		aliases: ['CC lane', 'automation lane']
	},
	{
		term: 'Virtual instrument',
		definition:
			'A software synthesiser or sampler running inside a DAW as a plugin — VST, AU, AAX or CLAP. It receives exactly the messages a hardware instrument would; the cable is just shorter.',
		category: 'studio',
		aliases: ['plugin', 'VST', 'soft synth']
	},
	{
		term: 'Control surface',
		definition:
			'A box of faders and buttons that drives the DAW itself rather than an instrument — transport, track volume, mutes. Usually speaking Mackie Control or HUI, which are MIDI messages given entirely different meanings.',
		category: 'studio',
		aliases: ['Mackie Control', 'HUI']
	},
	{
		term: 'Host',
		definition:
			'On USB, the end that supplies power and asks the questions. Computers and phones are hosts; most instruments are devices. Two hosts joined by a cable achieve nothing at all.',
		category: 'studio',
		lesson: 'transports'
	}
];

/**
 * Lookup by headword *or* alias, case-insensitively.
 *
 * `Term` wraps the word as the sentence actually spells it — "quarter notes",
 * "quantised", "overtones" — rather than forcing the prose to bend to the
 * headword, so the index has to cover the inflections the course really uses.
 */
const BY_KEY = new Map<string, GlossaryEntry>();
for (const e of GLOSSARY) {
	BY_KEY.set(e.term.toLowerCase(), e);
	for (const a of e.aliases ?? []) BY_KEY.set(a.toLowerCase(), e);
}

export function glossaryLookup(key: string): GlossaryEntry | undefined {
	return BY_KEY.get(key.trim().toLowerCase());
}

export const GLOSSARY_CATEGORIES: { id: GlossaryCategory; label: string; blurb: string }[] = [
	{ id: 'protocol', label: 'Protocol', blurb: 'MIDI itself — messages, bytes, timing.' },
	{ id: 'music', label: 'Music', blurb: 'What musicians assume of each other.' },
	{ id: 'sound', label: 'Sound', blurb: 'Synthesis and acoustics — what the receiver does.' },
	{ id: 'studio', label: 'Studio', blurb: 'Cables, hosts, software, practice.' },
	{ id: 'code', label: 'Code', blurb: 'Browser APIs, scheduling, file formats.' }
];
