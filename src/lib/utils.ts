import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Pointer capture, defensively.
 *
 * `setPointerCapture` throws if the pointer id is no longer active — which
 * happens for real when a pointer is cancelled between the event firing and the
 * handler running. Losing capture is a minor degradation; throwing out of a
 * pointerdown handler means the note never sounds.
 */
export function capturePointer(el: Element | null | undefined, pointerId: number): void {
	try {
		el?.setPointerCapture?.(pointerId);
	} catch {
		/* the pointer went away; carry on without capture */
	}
}

/**
 * Hand the browser a file to save.
 *
 * The anchor goes into the document before it is clicked and the object URL is
 * released on the next tick rather than the same one: revoking synchronously
 * can cancel the download that was just started, and a detached anchor is not
 * clickable everywhere. Four places in this app export something; they all go
 * through here so the awkward parts are only got right once.
 */
export function downloadFile(data: BlobPart, filename: string, type: string): void {
	const url = URL.createObjectURL(new Blob([data], { type }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	a.style.display = 'none';
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
