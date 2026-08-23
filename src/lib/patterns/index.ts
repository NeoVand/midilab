/**
 * A small pattern language, in the tradition of TidalCycles and Strudel.
 *
 * The central idea is worth stating because it is not obvious: a pattern is not
 * a list of events. It is a **function from a cycle number to the events in
 * that cycle**. That is what lets `<a b>` alternate, what lets patterns be
 * combined without flattening, and what makes an infinite pattern finite to
 * store.
 *
 * Supported notation:
 *
 *   bd sd hh hh      four events, one per quarter of the cycle
 *   ~                a rest
 *   [bd sd]          subdivide one slot into two
 *   bd*3             three of them inside one slot
 *   <bd sd>          alternate between cycles
 *   bd(3,8)          Euclidean: three hits spread over eight steps
 *   bd(3,8,2)        …rotated by two
 *   bd,hh*8          stack — both at once
 */

export interface Hap {
	/** Start time, in cycles. */
	begin: number;
	end: number;
	value: string;
}

export type Node =
	| { type: 'atom'; value: string }
	| { type: 'rest' }
	| { type: 'seq'; children: Node[] }
	| { type: 'stack'; children: Node[] }
	| { type: 'alt'; children: Node[] }
	| { type: 'repeat'; child: Node; count: number }
	| { type: 'euclid'; child: Node; pulses: number; steps: number; rotation: number };

/* -------------------------------------------------------------------------- */
/* Euclidean rhythms                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Bjorklund's algorithm: distribute `pulses` as evenly as possible over
 * `steps`. Almost every traditional rhythm in the world turns out to be one of
 * these, which is why they sound musical rather than arbitrary.
 */
export function euclid(pulses: number, steps: number, rotation = 0): boolean[] {
	const p = Math.max(0, Math.min(steps, Math.round(pulses)));
	const n = Math.max(1, Math.round(steps));
	if (p === 0) return Array(n).fill(false);
	if (p === n) return Array(n).fill(true);

	let a: boolean[][] = Array.from({ length: p }, () => [true]);
	let b: boolean[][] = Array.from({ length: n - p }, () => [false]);

	while (b.length > 1) {
		const pairs = Math.min(a.length, b.length);
		const merged: boolean[][] = [];
		for (let i = 0; i < pairs; i++) merged.push([...a[i], ...b[i]]);
		const remainder = a.length > b.length ? a.slice(pairs) : b.slice(pairs);
		a = merged;
		b = remainder;
	}

	const flat = [...a, ...b].flat();
	if (rotation === 0) return flat;
	const r = ((rotation % n) + n) % n;
	return [...flat.slice(r), ...flat.slice(0, r)];
}

/** A readable rendering, e.g. "x..x..x." */
export function euclidString(pulses: number, steps: number, rotation = 0): string {
	return euclid(pulses, steps, rotation)
		.map((v) => (v ? 'x' : '.'))
		.join('');
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

class Parser {
	#src: string;
	#i = 0;

	constructor(src: string) {
		this.#src = src;
	}

	parse(): Node {
		const node = this.#parseStack(null);
		this.#skip();
		if (this.#i < this.#src.length) {
			throw new Error(`Unexpected "${this.#src[this.#i]}" at position ${this.#i}`);
		}
		return node;
	}

	#skip() {
		while (this.#i < this.#src.length && /\s/.test(this.#src[this.#i])) this.#i++;
	}

	#peek(): string {
		return this.#src[this.#i] ?? '';
	}

	/** A stack is comma-separated sequences. */
	#parseStack(closer: string | null): Node {
		const layers: Node[] = [this.#parseSeq(closer)];
		while (this.#peek() === ',') {
			this.#i++;
			layers.push(this.#parseSeq(closer));
		}
		return layers.length === 1 ? layers[0] : { type: 'stack', children: layers };
	}

	#parseSeq(closer: string | null): Node {
		const items: Node[] = [];
		for (;;) {
			this.#skip();
			const c = this.#peek();
			if (c === '' || c === ',' || (closer && c === closer)) break;
			items.push(this.#parseTerm());
		}
		if (items.length === 0) return { type: 'rest' };
		return items.length === 1 ? items[0] : { type: 'seq', children: items };
	}

	#parseTerm(): Node {
		let node = this.#parseAtomOrGroup();
		// Postfix modifiers, applied left to right.
		for (;;) {
			const c = this.#peek();
			if (c === '*') {
				this.#i++;
				node = { type: 'repeat', child: node, count: Math.max(1, this.#parseNumber()) };
			} else if (c === '!') {
				this.#i++;
				const n = Math.max(1, this.#parseNumber());
				node = { type: 'seq', children: Array.from({ length: n }, () => node) };
			} else if (c === '(') {
				this.#i++;
				const pulses = this.#parseNumber();
				this.#expect(',');
				const steps = this.#parseNumber();
				let rotation = 0;
				this.#skip();
				if (this.#peek() === ',') {
					this.#i++;
					rotation = this.#parseNumber();
				}
				this.#expect(')');
				node = { type: 'euclid', child: node, pulses, steps, rotation };
			} else {
				return node;
			}
		}
	}

	#parseAtomOrGroup(): Node {
		this.#skip();
		const c = this.#peek();
		if (c === '[') {
			this.#i++;
			const inner = this.#parseStack(']');
			this.#expect(']');
			return inner;
		}
		if (c === '<') {
			this.#i++;
			const inner = this.#parseSeq('>');
			this.#expect('>');
			return {
				type: 'alt',
				children: inner.type === 'seq' ? inner.children : [inner]
			};
		}
		if (c === '~') {
			this.#i++;
			return { type: 'rest' };
		}
		const start = this.#i;
		while (this.#i < this.#src.length && /[^\s[\]<>(),*!]/.test(this.#src[this.#i])) this.#i++;
		if (this.#i === start) throw new Error(`Unexpected "${c}" at position ${this.#i}`);
		return { type: 'atom', value: this.#src.slice(start, this.#i) };
	}

	#parseNumber(): number {
		this.#skip();
		const start = this.#i;
		if (this.#peek() === '-') this.#i++;
		while (/\d/.test(this.#peek())) this.#i++;
		const text = this.#src.slice(start, this.#i);
		if (!text || text === '-') throw new Error(`Expected a number at position ${start}`);
		return Number(text);
	}

	#expect(ch: string) {
		this.#skip();
		if (this.#peek() !== ch) throw new Error(`Expected "${ch}" at position ${this.#i}`);
		this.#i++;
	}
}

export function parsePattern(source: string): Node {
	return new Parser(source.trim()).parse();
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

/** Events produced by `node` between `begin` and `end`, in cycle time. */
export function render(node: Node, begin = 0, end = 1, cycle = Math.floor(begin)): Hap[] {
	switch (node.type) {
		case 'rest':
			return [];
		case 'atom':
			return [{ begin, end, value: node.value }];
		case 'stack':
			return node.children.flatMap((c) => render(c, begin, end, cycle));
		case 'alt': {
			if (node.children.length === 0) return [];
			const pick =
				node.children[
					((cycle % node.children.length) + node.children.length) % node.children.length
				];
			return render(pick, begin, end, cycle);
		}
		case 'seq': {
			const n = node.children.length;
			if (n === 0) return [];
			const span = (end - begin) / n;
			return node.children.flatMap((c, i) =>
				render(c, begin + i * span, begin + (i + 1) * span, cycle)
			);
		}
		case 'repeat': {
			const span = (end - begin) / node.count;
			return Array.from({ length: node.count }, (_, i) =>
				render(node.child, begin + i * span, begin + (i + 1) * span, cycle)
			).flat();
		}
		case 'euclid': {
			const hits = euclid(node.pulses, node.steps, node.rotation);
			const span = (end - begin) / hits.length;
			return hits.flatMap((on, i) =>
				on ? render(node.child, begin + i * span, begin + (i + 1) * span, cycle) : []
			);
		}
	}
}

/** One cycle's worth of events, with times relative to the start of the cycle. */
export function queryCycle(node: Node, cycle: number): Hap[] {
	return render(node, cycle, cycle + 1, cycle)
		.map((h) => ({ ...h, begin: h.begin - cycle, end: h.end - cycle }))
		.sort((a, b) => a.begin - b.begin);
}

/* -------------------------------------------------------------------------- */
/* Musical helpers                                                             */
/* -------------------------------------------------------------------------- */

export const SCALES: Record<string, number[]> = {
	major: [0, 2, 4, 5, 7, 9, 11],
	minor: [0, 2, 3, 5, 7, 8, 10],
	dorian: [0, 2, 3, 5, 7, 9, 10],
	phrygian: [0, 1, 3, 5, 7, 8, 10],
	lydian: [0, 2, 4, 6, 7, 9, 11],
	mixolydian: [0, 2, 4, 5, 7, 9, 10],
	harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
	pentatonic: [0, 2, 4, 7, 9],
	minorPentatonic: [0, 3, 5, 7, 10],
	blues: [0, 3, 5, 6, 7, 10],
	wholeTone: [0, 2, 4, 6, 8, 10],
	chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

/** Degree 0 is the root; negative and out-of-range degrees wrap by octave. */
export function degreeToNote(degree: number, root = 60, scaleName = 'minor'): number {
	const scale = SCALES[scaleName] ?? SCALES.minor;
	const n = scale.length;
	const octave = Math.floor(degree / n);
	const index = ((degree % n) + n) % n;
	return root + octave * 12 + scale[index];
}

/** The GM drum names the pattern language understands as shorthand. */
export const DRUM_ALIASES: Record<string, number> = {
	bd: 36,
	kick: 36,
	sd: 38,
	snare: 38,
	rim: 37,
	cp: 39,
	clap: 39,
	hh: 42,
	oh: 46,
	ht: 50,
	mt: 47,
	lt: 45,
	cr: 49,
	crash: 49,
	rd: 51,
	ride: 51,
	tb: 54,
	cb: 56
};
