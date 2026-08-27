/**
 * Where to go after this page.
 *
 * A course that never points outward is asking you to take its word for
 * everything, which is exactly the wrong posture for a subject whose primary
 * sources are free, readable and still being revised. Every claim in these
 * lessons that came from somewhere has a somewhere, and this is it.
 *
 * The registry is keyed rather than inlined for the same reason `Xref` takes a
 * lesson id: a URL written into eleven lessons is a URL that rots in eleven
 * places. Here it rots in one, and `references.spec.ts` walks the whole table
 * so a typo in a key is a failing test rather than a dead link in production.
 *
 * `kind` decides the affordance, not the decoration — a specification is a
 * different kind of promise from a magazine article, and a reader deciding
 * whether to spend twenty minutes on a PDF deserves to know which one they are
 * about to open.
 */

export type RefKind =
	| 'spec' // a normative document. The thing implementations are measured against.
	| 'docs' // reference documentation for an API or a product.
	| 'article' // somebody explaining something, well.
	| 'paper' // academic, with citations.
	| 'archive' // primary historical material.
	| 'tool' // something you can run or download.
	| 'data'; // a corpus: files, scores, tables.

export interface Reference {
	/** Stable key. Referred to from lessons; never rendered. */
	id: string;
	title: string;
	url: string;
	/** Who stands behind it. Rendered next to the title. */
	publisher: string;
	kind: RefKind;
	/** Why *this* reader should open it. One sentence, specific. */
	note: string;
	/** Rough reading commitment, for the ones that are a commitment. */
	weight?: 'short' | 'long' | 'reference';
	/** Year, where the reader would otherwise assume it is current. */
	year?: number;
}

function ref(
	id: string,
	title: string,
	url: string,
	publisher: string,
	kind: RefKind,
	note: string,
	extra: Partial<Reference> = {}
): Reference {
	return { id, title, url, publisher, kind, note, ...extra };
}

/**
 * The table.
 *
 * Grouped by what they are about rather than alphabetically, because the
 * grouping is how you find a neighbour you did not know to look for.
 */
export const REFERENCES: Reference[] = [
	// ── The specifications themselves ──────────────────────────────────────
	ref(
		'spec-index',
		'MIDI specifications',
		'https://midi.org/specs',
		'The MIDI Association',
		'spec',
		'The index of every normative document: MIDI 1.0, MIDI 2.0, General MIDI, MPE, the recommended practices, and the errata that amend them.',
		{ weight: 'reference' }
	),
	ref(
		'spec-midi1',
		'MIDI 1.0 Detailed Specification',
		'https://midi.org/midi-1-0-detailed-specification',
		'The MIDI Association',
		'spec',
		'The document the whole protocol is defined by. Free, but you must be signed in — and it is the only place some of the edge cases are stated at all.',
		{ weight: 'long' }
	),
	ref(
		'spec-midi1-1996',
		'The Complete MIDI 1.0 Detailed Specification (96.1)',
		'https://archive.org/details/complete_midi_96-1-3',
		'Internet Archive',
		'archive',
		'The 1996 print edition, scanned. Superseded by later addenda but readable without an account, and the wording most implementations were actually written against.',
		{ weight: 'long', year: 1996 }
	),
	ref(
		'spec-summary',
		'Summary of MIDI 1.0 messages',
		'https://midi.org/summary-of-midi-1-0-messages',
		'The MIDI Association',
		'spec',
		'Every status byte and its data, on one page. The table to keep open while you read a monitor.',
		{ weight: 'reference' }
	),
	ref(
		'spec-cc',
		'MIDI 1.0 Control Change messages',
		'https://midi.org/midi-1-0-control-change-messages',
		'The MIDI Association',
		'spec',
		'The authoritative list of all 128 controller numbers, including which are defined, which are reserved, and which were only ever "undefined".',
		{ weight: 'reference' }
	),
	ref(
		'spec-universal-sysex',
		'Universal System Exclusive messages',
		'https://midi.org/midi-1-0-universal-system-exclusive-messages',
		'The MIDI Association',
		'spec',
		'The 0x7E and 0x7F blocks: identity request, sample dump, MTC full-frame, tuning, and the rest of the manufacturer-neutral SysEx.',
		{ weight: 'reference' }
	),
	ref(
		'spec-gm',
		'General MIDI',
		'https://midi.org/general-midi',
		'The MIDI Association',
		'spec',
		'The GM 1 agreement: the 128-program list, the channel 10 percussion map, and the minimum a device must do to wear the logo.'
	),
	ref(
		'spec-gm2',
		'General MIDI 2',
		'https://midi.org/general-midi-2',
		'The MIDI Association',
		'spec',
		'What GM 1 grew into: banks, more controllers, defined RPNs and a much larger drum set. Widely implemented in software, rarely in hardware.'
	),
	ref(
		'spec-smf',
		'Standard MIDI Files',
		'https://midi.org/standard-midi-files',
		'The MIDI Association',
		'spec',
		'The file format specification: chunks, the three format types, delta times and the meta events.'
	),
	ref(
		'spec-mpe',
		'MIDI Polyphonic Expression',
		'https://midi.org/midi-polyphonic-expression-mpe',
		'The MIDI Association',
		'spec',
		'MPE as a formal recommended practice — zones, the configuration message, and the pitch-bend range convention that everything depends on.'
	),
	ref(
		'spec-midi2',
		'MIDI 2.0',
		'https://midi.org/midi-2-0',
		'The MIDI Association',
		'spec',
		'The Universal MIDI Packet, MIDI-CI, Profiles and Property Exchange, plus which parts have shipped in operating systems.'
	),
	ref(
		'spec-midi-ci',
		'MIDI Capability Inquiry (MIDI-CI)',
		'https://midi.org/midi-ci',
		'The MIDI Association',
		'spec',
		'The negotiation layer: how two devices discover each other and agree on what they can both speak, over ordinary MIDI 1.0 SysEx.'
	),
	ref(
		'spec-mts',
		'MIDI Tuning Standard',
		'https://midi.org/midi-tuning-updated-specification',
		'The MIDI Association',
		'spec',
		'Bulk and single-note retuning, to about 0.0061 cents. The part of MIDI that knows the octave might not have twelve notes in it.'
	),
	ref(
		'spec-dls',
		'Downloadable Sounds',
		'https://midi.org/dls',
		'The MIDI Association',
		'spec',
		'The forgotten half of the promise: a format for shipping the *instrument* alongside the notes, so a file sounds the same in two places.'
	),

	// ── Second opinions on the specification ──────────────────────────────
	ref(
		'somascape-spec',
		'Guide to the MIDI 1.0 technical specification',
		'http://www.somascape.org/midi/tech/spec.html',
		'Somascape',
		'article',
		'The best free walkthrough of the protocol there is. Where the official document states a rule, this one explains why the rule is shaped that way.',
		{ weight: 'long' }
	),
	ref(
		'somascape-mfile',
		'The MIDI Files technical specification',
		'http://www.somascape.org/midi/tech/mfile.html',
		'Somascape',
		'article',
		'Every chunk, meta event and edge case of the file format, laid out far more clearly than the original. Keep it open while writing a parser.',
		{ weight: 'reference' }
	),
	ref(
		'wikipedia-midi',
		'MIDI',
		'https://en.wikipedia.org/wiki/MIDI',
		'Wikipedia',
		'article',
		'A genuinely good overview with a dense citation list — the fastest route to the primary sources on any sub-topic.'
	),
	ref(
		'wikipedia-gm',
		'General MIDI',
		'https://en.wikipedia.org/wiki/General_MIDI',
		'Wikipedia',
		'article',
		'The full 128-program table and the channel 10 drum map, in copy-and-pasteable form.',
		{ weight: 'reference' }
	),
	ref(
		'wikipedia-smf',
		'Standard MIDI File',
		'https://en.wikipedia.org/wiki/Standard_MIDI_File',
		'Wikipedia',
		'article',
		'A compact description of the container, with the header and track chunk layouts in one screen.'
	),
	ref(
		'wikipedia-mpe',
		'MIDI Polyphonic Expression',
		'https://en.wikipedia.org/wiki/MIDI_Polyphonic_Expression',
		'Wikipedia',
		'article',
		'The history of how MPE came out of Haken, Roli and Bitwig practice before it was ever a specification.'
	),
	ref(
		'wikipedia-mtc',
		'MIDI timecode',
		'https://en.wikipedia.org/wiki/MIDI_timecode',
		'Wikipedia',
		'article',
		'Quarter-frame messages, the eight-message cycle, and how MTC relates to the SMPTE timecode it carries.'
	),
	ref(
		'wikipedia-mts',
		'MIDI tuning standard',
		'https://en.wikipedia.org/wiki/MIDI_tuning_standard',
		'Wikipedia',
		'article',
		'A readable summary of the message formats, including the three-byte frequency encoding.'
	),

	// ── History ───────────────────────────────────────────────────────────
	ref(
		'history-midi',
		'The history of MIDI',
		'https://www.midi.org/midi-articles/the-history-of-midi',
		'The MIDI Association',
		'archive',
		'A chapter-by-chapter oral history assembled from the people who were there, including the surviving drafts and the NAMM floor accounts.',
		{ weight: 'long' }
	),
	ref(
		'history-associations',
		'MIDI History: MIDI Associations, 1983–1985',
		'https://midi.org/midi-history-chapter-7-midi-associations-1983-1985',
		'The MIDI Association',
		'archive',
		'How the specification survived contact with reality: the JMSC, the IMA, and the trade body that eventually became the MMA.'
	),
	ref(
		'dave-smith',
		'Dave Smith',
		'https://en.wikipedia.org/wiki/Dave_Smith_(engineer)',
		'Wikipedia',
		'article',
		'The Sequential Circuits founder who wrote the 1981 paper that became MIDI, and who kept building synthesisers for forty more years.'
	),
	ref(
		'kakehashi',
		'Ikutaro Kakehashi',
		'https://en.wikipedia.org/wiki/Ikutaro_Kakehashi',
		'Wikipedia',
		'article',
		'Roland’s founder, and the reason MIDI was given away rather than licensed — a decision worth more to music than any patent would have been.'
	),

	// ── The browser ───────────────────────────────────────────────────────
	ref(
		'w3c-webmidi',
		'Web MIDI API',
		'https://www.w3.org/TR/webmidi/',
		'W3C',
		'spec',
		'The normative browser specification: MIDIAccess, port lifecycle, the SysEx permission split, and the timestamp contract.',
		{ weight: 'reference' }
	),
	ref(
		'mdn-webmidi',
		'Web MIDI API',
		'https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API',
		'MDN',
		'docs',
		'The practical version of the same thing, with working examples and a browser-support table that is actually maintained.'
	),
	ref(
		'mdn-webaudio',
		'Web Audio API',
		'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API',
		'MDN',
		'docs',
		'Every node type, with the parameter-automation methods that make sample-accurate envelopes possible.',
		{ weight: 'reference' }
	),
	ref(
		'two-clocks',
		'A tale of two clocks — scheduling Web Audio with precision',
		'https://web.dev/articles/audio-scheduling',
		'Chris Wilson, web.dev',
		'article',
		'The article that taught the web how to sequence music. If you read one thing about browser timing, read this one.',
		{ weight: 'short' }
	),
	ref(
		'caniuse-midi',
		'Web MIDI browser support',
		'https://caniuse.com/midi',
		'Can I Use',
		'data',
		'Which browsers ship Web MIDI today, updated continuously — including the long-running gap on Safari.'
	),

	// ── Music, rhythm, tuning ─────────────────────────────────────────────
	ref(
		'toussaint-euclid',
		'The Euclidean algorithm generates traditional musical rhythms',
		'http://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf',
		'Godfried Toussaint',
		'paper',
		'The paper that noticed Bjorklund’s neutron-timing algorithm and the world’s folk rhythms are the same object. Twelve pages, and it changes how you hear a bar.',
		{ weight: 'short', year: 2005 }
	),
	ref(
		'wikipedia-euclid',
		'Euclidean rhythm',
		'https://en.wikipedia.org/wiki/Euclidean_rhythm',
		'Wikipedia',
		'article',
		'The table of which (pulses, steps) pair names which traditional rhythm — tresillo, cinquillo, the Ruchenitza, the bossa nova.'
	),
	ref(
		'scala',
		'Scala',
		'https://www.huygens-fokker.org/scala/',
		'Huygens-Fokker Foundation',
		'tool',
		'The tuning workbench, and its archive of over five thousand historical and invented scales in a format most microtonal software reads.'
	),
	ref(
		'imslp',
		'IMSLP / Petrucci Music Library',
		'https://imslp.org/wiki/Main_Page',
		'IMSLP',
		'data',
		'Public-domain scores for essentially the entire classical canon. Where to go when you want to see what the notes you are sequencing actually say.'
	),
	ref(
		'mutopia',
		'The Mutopia Project',
		'https://www.mutopiaproject.org/',
		'Mutopia',
		'data',
		'Public-domain music re-engraved from scratch and released freely, with MIDI alongside the notation — so the files themselves are unencumbered too.'
	),

	// ── Tools worth knowing ───────────────────────────────────────────────
	ref(
		'ableton-link',
		'Ableton Link',
		'https://www.ableton.com/en/link/',
		'Ableton',
		'tool',
		'The peer-to-peer tempo protocol with no leader, and the SDK is open source — the closest thing to an answer for wireless jam sessions.'
	),
	ref(
		'tonejs-midi',
		'@tonejs/midi',
		'https://github.com/Tonejs/Midi',
		'Tone.js',
		'tool',
		'A well-tested Standard MIDI File parser in JavaScript. Read it after you have written your own; the disagreements are the interesting part.'
	),
	ref(
		'webmidi-repo',
		'Web MIDI API specification repository',
		'https://github.com/WebAudio/web-midi-api',
		'W3C Audio WG',
		'archive',
		'The issue tracker behind the specification. Every ambiguity you hit in Web MIDI has probably already been argued about here.'
	)
];

const BY_ID = new Map(REFERENCES.map((r) => [r.id, r]));

export function referenceById(id: string): Reference | undefined {
	return BY_ID.get(id);
}

/** Resolve a list of keys, dropping nothing silently — an unknown key throws in dev. */
export function resolveReferences(ids: readonly string[]): Reference[] {
	return ids.map((id) => {
		const r = BY_ID.get(id);
		if (!r) throw new Error(`Unknown reference id: ${id}`);
		return r;
	});
}

/** The hostname, for the small grey hint next to a link. */
export function refHost(r: Reference): string {
	return new URL(r.url).hostname.replace(/^www\./, '');
}

export const KIND_LABEL: Record<RefKind, string> = {
	spec: 'Specification',
	docs: 'Documentation',
	article: 'Article',
	paper: 'Paper',
	archive: 'Primary source',
	tool: 'Tool',
	data: 'Corpus'
};
