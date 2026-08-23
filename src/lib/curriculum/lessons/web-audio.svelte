<script lang="ts">
	import LessonShell from '$lib/components/lesson/LessonShell.svelte';
	import Section from '$lib/components/lesson/Section.svelte';
	import Callout from '$lib/components/lesson/Callout.svelte';
	import TryThis from '$lib/components/lesson/TryThis.svelte';
	import Checkpoints from '$lib/components/lesson/Checkpoints.svelte';
	import Checkpoint from '$lib/components/lesson/Checkpoint.svelte';
	import Quiz from '$lib/components/lesson/Quiz.svelte';
	import CodeSandbox from '$lib/components/midi/CodeSandbox.svelte';
	import Scope from '$lib/components/midi/Scope.svelte';
	import { lessonById } from '$lib/curriculum/registry';

	const meta = lessonById('web-audio')!;

	const EXAMPLES = [
		{
			name: 'One note, by hand',
			code: `// A whole voice: oscillator → filter → gain → speakers.
const ctx = audio.context;
const t = ctx.currentTime;

const osc = ctx.createOscillator();
osc.type = 'sawtooth';
osc.frequency.value = midi.freq(60);   // middle C, in Hz

const filter = ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.setValueAtTime(4000, t);
filter.frequency.exponentialRampToValueAtTime(400, t + 0.6);

const amp = ctx.createGain();
amp.gain.setValueAtTime(0.0001, t);
amp.gain.linearRampToValueAtTime(0.2, t + 0.01);        // attack
amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); // decay

osc.connect(filter).connect(amp).connect(ctx.destination);
osc.start(t);
osc.stop(t + 1.3);

log('one voice, built from four nodes');`
		},
		{
			name: 'Play your hardware into it',
			code: `// Incoming notes become oscillators. This is a synthesiser
// in fourteen lines.
const ctx = audio.context;
const voices = new Map();

midi.onMessage((e) => {
	if (e.direction !== 'in') return;
	const m = e.message;
	if (m.type === 'noteOn') {
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const amp = ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.value = midi.freq(m.note);
		amp.gain.setValueAtTime(0.0001, t);
		amp.gain.linearRampToValueAtTime((m.velocity / 127) * 0.15, t + 0.01);
		osc.connect(amp).connect(ctx.destination);
		osc.start(t);
		voices.set(m.note, { osc, amp });
	}
	if (m.type === 'noteOff') {
		const v = voices.get(m.note);
		if (!v) return;
		const t = ctx.currentTime;
		v.amp.gain.cancelScheduledValues(t);
		v.amp.gain.setValueAtTime(v.amp.gain.value, t);
		v.amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
		v.osc.stop(t + 0.3);
		voices.delete(m.note);
	}
});

log('play your controller');`
		},
		{
			name: 'The two clocks',
			code: `// They tick at the same rate but from different zeros, and they
// drift. Never assume one is the other.
log('audio.currentTime :', midi.now().toFixed(4), 'seconds');
log('performance.now() :', (midi.perf() / 1000).toFixed(4), 'seconds');
log('difference        :', (midi.perf() / 1000 - midi.now()).toFixed(4));
log('');
log('midi.toPerf(t) maps an audio time into the performance domain,');
log('which is how one scheduled event reaches both the synth and a');
log('hardware MIDI port at the same instant.');
log('');
const t = midi.now() + 0.5;
log('audio time', t.toFixed(4), '→ perf', midi.toPerf(t).toFixed(1));`
		},
		{
			name: 'Sweep a filter from a knob',
			code: `// Watch the scope while this runs.
const ctx = audio.context;
const osc = ctx.createOscillator();
const filter = ctx.createBiquadFilter();
const amp = ctx.createGain();

osc.type = 'sawtooth';
osc.frequency.value = midi.freq(41);
filter.type = 'lowpass';
filter.Q.value = 12;
amp.gain.value = 0.12;

osc.connect(filter).connect(amp).connect(ctx.destination);
osc.start();

const t = ctx.currentTime;
filter.frequency.setValueAtTime(200, t);
filter.frequency.exponentialRampToValueAtTime(6000, t + 2);
filter.frequency.exponentialRampToValueAtTime(200, t + 4);
osc.stop(t + 4.2);

log('four second sweep — resonance is doing the work');`
		}
	];
</script>

<LessonShell lesson={meta}>
	<Section>
		<p class="prose-body">
			The internal synth you have been playing for twenty-five lessons is about four hundred lines
			of Web Audio. This lesson is enough of it to build your own.
		</p>
		<p class="prose-body">
			Web Audio is a graph of nodes. You create sources, connect them through processors, and end at
			the destination. Every parameter is an <strong>AudioParam</strong> with its own schedule — which
			is the part that matters, because scheduling a parameter is how you get an envelope rather than
			a click.
		</p>
		<div
			class="flex flex-wrap items-center gap-2 rounded-lg border bg-surface-sunken p-4 font-mono text-sm"
		>
			<span class="text-msg-note">Oscillator</span>
			<span class="text-muted-foreground">→</span>
			<span class="text-msg-cc">BiquadFilter</span>
			<span class="text-muted-foreground">→</span>
			<span class="text-msg-expr">Gain</span>
			<span class="text-muted-foreground">→</span>
			<span class="text-muted-foreground">destination</span>
		</div>
		<p class="prose-body">
			That chain is a subtractive synthesiser voice. Everything else — detuned second oscillators,
			noise, reverb sends, an LFO on the detune — is more of the same idea.
		</p>
	</Section>

	<Callout variant="key" title="Two clocks, and only one of them is musical">
		<p>
			<code class="rounded-sm bg-muted px-1">AudioContext.currentTime</code> is a monotonic clock in
			<em>seconds</em>, driven by the audio hardware. It is the only clock that matters for
			scheduling sound. <code class="rounded-sm bg-muted px-1">performance.now()</code> is a
			<em>millisecond</em> clock on the page, and it is what Web MIDI timestamps use.
		</p>
		<p class="mt-2">
			They tick at nearly the same rate but from different zeros, and they drift apart over time.
			Anything that must reach the synth and a hardware port together needs to be mapped between
			them — that is what <code class="rounded-sm bg-muted px-1">audioToPerf()</code> in this app
			does, using <code class="rounded-sm bg-muted px-1">getOutputTimestamp()</code> where the browser
			offers it.
		</p>
	</Callout>

	<Section title="Envelopes are scheduled, not polled">
		<p class="prose-body">
			The instinct is to change a gain value in an animation frame. Do not: that gives you a
			stair-stepped envelope at 60 Hz and audible zipper noise, and it stops entirely when the tab
			is busy. Instead, tell the AudioParam what to do in advance:
		</p>
		<pre
			class="scrollbar-thin overflow-x-auto rounded-lg border bg-surface-sunken p-4 font-mono text-sm leading-relaxed"><code
				>{`gain.setValueAtTime(0.0001, t);                    // start silent
gain.linearRampToValueAtTime(peak, t + attack);    // attack
gain.setTargetAtTime(peak * sustain, t + attack, decay / 3);   // decay
// …later, on Note Off:
gain.cancelScheduledValues(off);
gain.setValueAtTime(gain.value, off);              // freeze where we are
gain.setTargetAtTime(0.0001, off, release / 4);    // release`}</code
			></pre>
		<Callout variant="gotcha" title="exponentialRampToValueAtTime cannot reach zero">
			<p>
				It throws if the target is 0, because exponential curves never arrive. Use a small positive
				number — 0.0001 is conventional — and stop the node afterwards. Every Web Audio codebase has
				this constant in it somewhere.
			</p>
		</Callout>
	</Section>

	<TryThis title="Build a voice">
		<Scope class="mb-3" />
		<CodeSandbox initial={EXAMPLES[0].code} examples={EXAMPLES} rows={16} />
	</TryThis>

	<Section title="Turning messages into sound">
		<p class="prose-body">
			A MIDI-driven synth is a dictionary from note number to live voice. Note On creates and
			stores; Note Off looks up, releases and deletes. The whole architecture of the synth in this
			app is that, plus per-channel state, plus a fixed voice budget with stealing.
		</p>
		<p class="prose-body">
			Two details make it feel professional rather than like a demo. <strong
				>Velocity should touch the filter as well as the gain</strong
			>
			— that is what makes dynamics read as dynamics. And
			<strong>controller changes must be smoothed</strong>, with
			<code class="rounded-sm bg-muted px-1">setTargetAtTime</code> rather than direct assignment, or
			every CC 74 message becomes a click.
		</p>
	</Section>

	<Section title="When you need an AudioWorklet">
		<p class="prose-body">
			Everything above runs on the audio thread already — built-in nodes are native code, and the
			main thread only schedules them. You need an AudioWorklet when you want to write the DSP
			yourself: a custom oscillator, a wavefolder, a physical model. It runs in its own thread with
			no DOM access and communicates by message port.
		</p>
		<p class="prose-body">
			For a MIDI application, the honest answer is usually that you do not need one. Reach for it
			when a specific sound demands it, not as a default.
		</p>
	</Section>

	<Quiz
		question="Why should you not update a gain value inside requestAnimationFrame?"
		options={[
			'It is too slow to compute',
			'It runs at frame rate on the main thread — stepped, and it stops when the page is busy',
			'AudioParams are read-only',
			'It only works in Chrome'
		]}
		answer={1}
		explanation="Sixty updates a second is a coarse grid for an envelope, and animation frames stop or bunch up whenever the main thread is busy — exactly when you least want the sound to change. AudioParam scheduling runs on the audio thread at sample rate and does not care what the page is doing."
	/>

	<Checkpoints lesson={meta.id}>
		<Checkpoint
			lesson={meta.id}
			id="voice"
			label="Build and hear a voice from nodes"
			hint="Run the first example."
		/>
		<Checkpoint
			lesson={meta.id}
			id="clocks"
			label="Print both clocks and see the offset between them"
			hint="The two-clocks example."
		/>
		<Checkpoint
			lesson={meta.id}
			id="midi-synth"
			label="Make incoming MIDI drive audio you wrote yourself"
			test={(e) => e.direction === 'in' && e.message.type === 'noteOn'}
		/>
		<Checkpoint
			lesson={meta.id}
			id="envelope"
			label="Write an envelope that does not click"
			hint="Ramp to a small positive value, never to zero."
		/>
	</Checkpoints>
</LessonShell>
