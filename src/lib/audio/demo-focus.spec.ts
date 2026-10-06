import { describe, expect, it, vi } from 'vitest';
import { claimDemoPlayback } from './demo-focus';

describe('listening example ownership', () => {
	it('stops the preceding example without letting a stale release clear the new owner', () => {
		const first = vi.fn();
		const releaseFirst = claimDemoPlayback(first);
		const second = vi.fn();
		const releaseSecond = claimDemoPlayback(second);
		expect(first).toHaveBeenCalledOnce();
		releaseFirst();
		const releaseThird = claimDemoPlayback(vi.fn());
		expect(second).toHaveBeenCalledOnce();
		releaseSecond();
		releaseThird();
	});

	it('releases naturally completed playback without stopping it again', () => {
		const completed = vi.fn();
		const release = claimDemoPlayback(completed);
		release();
		const releaseNext = claimDemoPlayback(vi.fn());
		expect(completed).not.toHaveBeenCalled();
		releaseNext();
	});
});
