interface DemoClaim {
	stop: () => void;
}

let active: DemoClaim | null = null;

/** Listening examples share one foreground, including sounds outside MIDI. */
export function claimDemoPlayback(stop: () => void): () => void {
	const previous = active;
	active = null;
	previous?.stop();
	const claim = { stop };
	active = claim;
	return () => {
		if (active === claim) active = null;
	};
}
