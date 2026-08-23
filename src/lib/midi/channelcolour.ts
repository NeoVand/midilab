/**
 * Per-channel colour.
 *
 * A second, independent axis from the message palette: that one answers "what
 * kind of message is this", this one answers "which of the sixteen addresses
 * did it go to". Hue carries the channel; lightness comes from the theme, so
 * the same channel reads as the same colour on a white keybed and on a dark
 * panel without being tuned twice.
 */

const CHANNEL_HUES = [150, 262, 318, 75, 197, 20, 220, 100, 285, 340, 45, 175, 240, 300, 60, 210];

export function channelColour(channel: number): string {
	return `oklch(var(--channel-l) 0.17 ${CHANNEL_HUES[channel & 0x0f]})`;
}

export function channelHue(channel: number): number {
	return CHANNEL_HUES[channel & 0x0f];
}
