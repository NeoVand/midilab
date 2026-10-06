import { describe, expect, it } from 'vitest';
import { MpeInputState } from './mpe-state';
import { makeZone, configureZone } from './mpe';
import { unitToBend, type MidiMessage } from './messages';
import { setBendRange } from './rpn';

const on = (channel: number, note = 60): MidiMessage => ({
	type: 'noteOn',
	channel,
	note,
	velocity: 90
});
const off = (channel: number, note = 60, velocity = 42): MidiMessage => ({
	type: 'noteOff',
	channel,
	note,
	velocity
});
const cc = (channel: number, controller: number, value: number): MidiMessage => ({
	type: 'controlChange',
	channel,
	controller,
	value
});
const bend = (channel: number, unit: number): MidiMessage => ({
	type: 'pitchBend',
	channel,
	value: unitToBend(unit)
});
const pressure = (channel: number, value: number): MidiMessage => ({
	type: 'channelAftertouch',
	channel,
	pressure: value
});

describe('MPE input receiver', () => {
	it('keeps member expression independent and adds the manager bend', () => {
		const state = new MpeInputState();
		state.push(on(1, 60));
		state.push(on(2, 64));
		state.push(bend(1, 0.5));
		state.push(pressure(1, 80));
		state.push(cc(2, 74, 100));
		state.push(bend(0, 0.5));
		expect(state.active[0].pitchSemitones).toBeCloseTo(25, 2);
		expect(state.active[1].pitchSemitones).toBeCloseTo(1, 2);
		expect(state.active.map((v) => [v.pressure, v.timbre])).toEqual([
			[80, 64],
			[0, 100]
		]);
		expect(state.stats.maxPolyphony).toBe(2);
	});

	it('receives expression before a note and retains release velocity', () => {
		const state = new MpeInputState();
		state.push(bend(1, -0.5));
		state.push(pressure(1, 73));
		state.push(cc(1, 74, 102));
		state.push(on(1), 100);
		expect(state.active[0]).toMatchObject({ pitchSemitones: -24, pressure: 73, timbre: 102 });
		state.push(off(1), 200);
		expect(state.active).toHaveLength(0);
		expect(state.voices[0]).toMatchObject({ releaseVelocity: 42, endedAt: 200 });
	});

	it('matches zone-wide member RPN ranges including cents without treating NRPN as RPN', () => {
		const state = new MpeInputState();
		for (const msg of setBendRange(1, 12, 50)) state.push(msg);
		state.push(on(1));
		state.push(bend(1, 1));
		expect(state.active[0].pitchSemitones).toBe(12.5);
		expect(state.getBendRange(2)).toBe(12.5);
		expect(state.zone.memberBendRange).toBe(12.5);
		state.push(cc(1, 99, 0));
		state.push(cc(1, 98, 0));
		state.push(cc(1, 6, 96));
		expect(state.getBendRange(1)).toBe(12.5);
		for (const msg of setBendRange(0, 3)) state.push(msg);
		state.push(bend(0, -1));
		expect(state.active[0].pitchSemitones).toBe(9.5);
	});

	it('follows both lower and upper MPE configuration and tears down disabled zones', () => {
		const state = new MpeInputState();
		for (const msg of configureZone(makeZone('upper', 3, 24))) state.push(msg);
		expect(state.zone).toMatchObject({ side: 'upper', master: 15, members: [14, 13, 12] });
		expect(state.push(on(1))).toBe(false);
		state.push(on(14));
		state.push(bend(14, 1));
		expect(state.active[0].pitchSemitones).toBe(24);
		state.push(cc(15, 101, 0));
		state.push(cc(15, 100, 6));
		state.push(cc(15, 6, 0));
		expect(state.active).toHaveLength(0);
		expect(state.zone.members).toEqual([]);
	});

	it('recognizes a manager outside the current small zone and restores configuration defaults', () => {
		const state = new MpeInputState(makeZone('upper', 2, 24));
		state.push(on(14));
		for (const msg of configureZone(makeZone('lower', 2))) state.push(msg);
		expect(state.zone).toMatchObject({
			master: 0,
			members: [1, 2],
			memberBendRange: 48,
			masterBendRange: 2
		});
		expect(state.active).toHaveLength(0);
		state.push(on(1));
		state.push(cc(0, 101, 0));
		state.push(cc(0, 100, 6));
		state.push(cc(0, 6, 1));
		expect(state.zone.memberBendRange).toBe(48);
		expect(state.active).toHaveLength(1);
	});

	it('honors manager sustain and retains the frozen old voice when its channel is reused', () => {
		const state = new MpeInputState();
		state.push(on(1));
		state.push(cc(0, 64, 127));
		state.push(off(1), 100);
		expect(state.active[0]).toMatchObject({ held: false, sustained: true });
		state.push(on(1, 64), 110);
		state.push(bend(1, 1), 120);
		expect(state.active).toHaveLength(2);
		expect(state.voices[0].pitchSemitones).toBe(0);
		state.push(off(1, 64), 130);
		state.push(cc(0, 64, 0), 140);
		expect(state.active).toHaveLength(0);
		expect(state.voices[1].endedAt).toBe(140);
	});

	it('freezes released member expression while manager expression still reaches sustained notes', () => {
		const state = new MpeInputState();
		state.push(on(1));
		state.push(bend(1, 0.5));
		state.push(pressure(1, 30));
		state.push(cc(1, 74, 80));
		state.push(cc(0, 64, 127));
		state.push(off(1));
		state.push(bend(1, -1));
		state.push(pressure(1, 100));
		state.push(cc(1, 74, 0));
		state.push(bend(0, 1));
		state.push(pressure(0, 20));
		state.push(cc(0, 74, 74));
		expect(state.active[0]).toMatchObject({
			pitchSemitones: expect.closeTo(26, 2),
			pressure: 30,
			effectivePressure: 50,
			timbre: 80,
			effectiveTimbre: 90
		});
	});

	it('ignores sustain on member channels', () => {
		const state = new MpeInputState();
		state.push(on(1));
		state.push(cc(1, 64, 127));
		state.push(off(1));
		expect(state.active).toHaveLength(0);
	});

	it('verifies the new held voice rather than a sustained predecessor on the same channel', () => {
		const state = new MpeInputState();
		state.push(on(1));
		state.push(cc(0, 64, 127));
		state.push(off(1));
		state.push(on(1, 67));
		state.push(on(2, 64));
		state.push(bend(1, 0.5));
		expect(state.stats.independentBend).toBe(true);
		expect(state.active.find((v) => !v.held)?.pitchSemitones).toBe(0);
	});

	it('supports Poly Mode shared member notes and reports their shared expression', () => {
		const state = new MpeInputState();
		state.push(on(1, 60));
		state.push(on(1, 64));
		state.push(bend(1, 0.5));
		expect(state.active.map((v) => v.pitchSemitones)).toEqual([
			expect.closeTo(24, 2),
			expect.closeTo(24, 2)
		]);
		state.push(off(1, 60));
		expect(state.active.map((v) => v.note)).toEqual([64]);
		expect(state.stats.channelCollisions).toBe(1);
	});

	it('treats velocity-zero Note On as release and supports manager notes with shared expression', () => {
		const state = new MpeInputState();
		state.push(on(0));
		state.push(on(0, 64));
		state.push(bend(0, 1));
		state.push(pressure(0, 40));
		expect(state.active.map((v) => [v.pitchSemitones, v.effectivePressure])).toEqual([
			[2, 40],
			[2, 40]
		]);
		expect(state.stats.independentBend).toBe(false);
		state.push(off(0));
		state.push(off(0, 64));
		state.push(on(1));
		state.push({ type: 'noteOn', channel: 1, note: 60, velocity: 0 });
		expect(state.active).toHaveLength(0);
	});

	it('bounds instrument polyphony under a long pedal-held performance, stealing sustained voices first', () => {
		const state = new MpeInputState();
		state.push(cc(0, 64, 127));
		state.push(on(2, 67));
		for (let i = 0; i < 100; i++) {
			state.push(on(1));
			state.push(off(1));
		}
		expect(state.active).toHaveLength(48);
		expect(state.active.some((v) => v.channel === 2 && v.held)).toBe(true);
		expect(state.stats.voiceSteals).toBe(53);
		expect(state.voices.length).toBeLessThanOrEqual(72);
		state.push(cc(0, 64, 0));
		expect(state.active).toHaveLength(1);
	});

	it('distinguishes All Notes Off under sustain from immediate All Sound Off', () => {
		const state = new MpeInputState();
		state.push(on(1));
		state.push(cc(0, 64, 127));
		state.push(cc(0, 123, 0));
		expect(state.active[0].sustained).toBe(true);
		state.push(cc(0, 120, 0));
		expect(state.active).toHaveLength(0);
		state.push(cc(0, 123, 0));
		expect(state.active).toHaveLength(0);
	});

	it('resets expression and releases sustain on Reset All Controllers', () => {
		const state = new MpeInputState();
		state.push(on(1));
		state.push(bend(1, 1));
		state.push(pressure(1, 90));
		state.push(cc(1, 74, 110));
		state.push(cc(1, 121, 0));
		expect(state.active[0].pitchSemitones).toBe(48);
		state.push(cc(0, 121, 0));
		expect(state.active[0]).toMatchObject({ pitchSemitones: 0, pressure: 0, timbre: 64 });
		state.push(cc(0, 64, 127));
		state.push(off(1));
		state.push(cc(0, 121, 0));
		expect(state.active).toHaveLength(0);
	});

	it('recognizes gentle continuous gestures on held dyads without counting global or solo gestures', () => {
		const state = new MpeInputState();
		state.push(on(1));
		state.push(bend(1, 0.1));
		state.push(on(2, 64));
		state.push(bend(0, 1));
		state.push(pressure(0, 90));
		expect(state.stats.independentBend).toBe(false);
		expect(state.stats.independentPressure).toBe(false);
		for (let value = 1; value <= 10; value++) {
			state.push(pressure(1, value));
			state.push(cc(1, 74, 64 + value));
			state.push(bend(1, 0.1 + value / 1000));
		}
		expect(state.stats).toMatchObject({
			independentBend: true,
			independentPressure: true,
			independentTimbre: true
		});
	});

	it('requires a second held member, rather than a manager note or pedal-only voice, for independence challenges', () => {
		const state = new MpeInputState();
		state.push(on(0));
		state.push(on(1));
		state.push(bend(1, 0.5));
		expect(state.stats.independentBend).toBe(false);
		state.push(on(2, 67));
		state.push(cc(0, 64, 127));
		state.push(off(2, 67));
		state.push(pressure(1, 90));
		expect(state.stats.independentPressure).toBe(false);
	});

	it('bounds trace and released-note memory and clears session evidence', () => {
		const state = new MpeInputState();
		for (let i = 0; i < 60; i++) {
			state.push(on(1));
			for (let j = 0; j < 100; j++) state.push(pressure(1, j), j);
			state.push(off(1));
		}
		expect(state.voices.length).toBeLessThanOrEqual(25);
		expect(state.voices.every((v) => v.history.length <= 80)).toBe(true);
		state.push({ type: 'reset' });
		expect(state.voices).toEqual([]);
		expect(state.stats.noteCount).toBe(0);
	});
});
