/**
 * The three places in the course where you write rather than read.
 *
 * They live here rather than inside their lessons because Settings claims to
 * list everything this app stores, and a promise like that only holds if there
 * is one list. These are also the only bytes in local storage the user typed
 * themselves, which is why they are the one thing worth being able to take out.
 */

import { load, remove } from '$lib/stores/persist';

export interface Worksheet {
	key: string;
	/** Heading used in the exported file. */
	title: string;
	/** Lesson it belongs to, for the link back. */
	lesson: string;
	template: string;
}

export const WORKSHEETS: Worksheet[] = [
	{
		key: 'routing-plan',
		title: 'Port and channel map',
		lesson: 'studio-routing',
		template: `PORT / CHANNEL MAP

ch 1   →
ch 2   →
ch 3   →
ch 10  →  drums
ch 11+ →  spare / MPE member channels

CLOCK LEADER  →
LOCAL CONTROL OFF ON  →
NOTES:`
	},
	{
		key: 'clock-policy',
		title: 'Clock policy',
		lesson: 'sync-options',
		template: `OP-XY jam            → OP-XY is clock leader
MPC production       → MPC is clock leader
Ableton / Push       → Live is clock leader
Browser experiment   → this machine is leader

Everything else set to EXTERNAL sync.
Local Control OFF on anything being sequenced.`
	},
	{
		key: 'capstone-notes',
		title: 'Rig notes',
		lesson: 'capstone',
		template: `RIG FOR THIS SESSION

clock leader   →
ch __  →
ch __  →
ch 10  →  drums

local control OFF on →
what went wrong, and what fixed it:`
	}
];

/** The ones you have actually changed — an untouched template is not writing. */
export function filledWorksheets(): { sheet: Worksheet; text: string }[] {
	return WORKSHEETS.map((sheet) => ({ sheet, text: load(sheet.key, sheet.template) })).filter(
		({ sheet, text }) => text.trim() !== sheet.template.trim() && text.trim() !== ''
	);
}

/** One plain-text file, in course order, with the empty ones left out. */
export function worksheetsToText(): string {
	return filledWorksheets()
		.map(
			({ sheet, text }) =>
				`${sheet.title.toUpperCase()}\n${'='.repeat(sheet.title.length)}\n\n${text.trim()}\n`
		)
		.join('\n\n');
}

export function clearWorksheets(): void {
	for (const w of WORKSHEETS) remove(w.key);
}
