/**
 * Step patterns, and turning one into a Standard MIDI File.
 *
 * The export lived inside the sequencer component, which meant the app's
 * headline "exports Standard MIDI Files" claim was the one part of the codec
 * path nothing could test. It is a pure function now, and it is tested.
 */

import { writeMidiFile, type TrackEvent } from './smf';

export interface SeqTrack {
	id: string;
	name: string;
	note: number;
	channel: number;
	steps: number[];
	mute: boolean;
}

export interface StepExportOptions {
	stepCount: number;
	bpm: number;
	/** Ticks per quarter note in the written file. */
	division?: number;
	/** Fraction of a step the note is held for. */
	gate?: number;
	name?: string;
}

/**
 * A muted track is not written.
 *
 * A MIDI file has no concept of mute, so the choice is between exporting a
 * part you had silenced or leaving it out. Leaving it out is the one that
 * matches what you were listening to when you pressed the button.
 */
export function stepsToMidiFile(tracks: SeqTrack[], opts: StepExportOptions): Uint8Array {
	const { stepCount, bpm, division = 480, gate = 0.85, name = 'MIDI Lab pattern' } = opts;
	const perStep = division / 4;

	const parts = tracks
		.filter((t) => !t.mute && t.steps.slice(0, stepCount).some((v) => v > 0))
		.map((t) => {
			const events: TrackEvent[] = [];
			t.steps.slice(0, stepCount).forEach((velocity, i) => {
				if (!velocity) return;
				const tick = i * perStep;
				events.push({
					delta: 0,
					tick,
					event: { type: 'noteOn', channel: t.channel, note: t.note, velocity }
				});
				events.push({
					delta: 0,
					tick: tick + Math.max(1, Math.round(perStep * gate)),
					event: { type: 'noteOff', channel: t.channel, note: t.note, velocity: 0 }
				});
			});
			return { name: t.name, events };
		});

	return writeMidiFile(parts, { division, bpm, name });
}
