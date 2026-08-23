# MIDI Lab — Build Plan

An interactive, desktop-scale web application that takes someone from "MIDI is
the thing that makes those cheap piano sounds" to "I can wire six devices,
pick a clock master, map an undocumented synth, and write code that drives it."

---

## 1. The core idea

Most MIDI education is prose plus screenshots. The one thing a browser app can
do that a book cannot is **make the protocol visible while it is happening, on
your own hardware.**

So the app is not a set of articles with demos bolted on. It is a **live MIDI
engine with a curriculum wrapped around it.** Every lesson taps the same
runtime — the same port manager, the same monitor, the same synth, the same
clock — that you keep using afterwards as a real studio utility.

Three consequences that shape everything:

1. **One engine, always running.** A persistent "Engine Dock" sits at the
   bottom of every screen: connected devices, transport, activity meters, live
   monitor, panic. You are never more than zero clicks from the machine.
2. **You advance by doing, not by clicking Next.** Lessons declare
   _checkpoints_ — assertions the engine verifies live ("send a Note On with
   velocity above 100 on channel 3", "get your device to emit CC 74", "make
   this app follow your OP-XY's clock"). The engine watches the MIDI stream and
   ticks them off. Reading is optional; producing the right bytes is not.
3. **Every visual is generated from real message data.** No mock diagrams. The
   byte inspector, the piano roll, the routing graph and the monitor all render
   the same `MidiMessage` union type. What you see is literally what went down
   the wire.

### The design hook: a message color language

Each message family gets one hue, used with total consistency everywhere in the
app — monitor rows, piano-roll blocks, packets animating along the routing
graph, byte-inspector nibbles, sequencer lanes, activity meters.

| Family                  | Role                                      |
| ----------------------- | ----------------------------------------- |
| Note On / Off           | primary — the loudest thing on screen     |
| Control Change          | secondary                                 |
| Pitch Bend / Aftertouch | expression hue                            |
| Program / Bank          | structural hue                            |
| Clock / Transport       | timing hue, deliberately dim and rhythmic |
| SysEx                   | "danger/deep" hue                         |
| System Common           | neutral                                   |

Learn it once in Act I, and by Act VI you read a dense monitor stream at a
glance. That single decision does more for comprehension than any amount of
copy, and it is also what gives the app a look nothing else has.

---

## 2. Architecture

SvelteKit + `adapter-static` (a real SPA — no server, deployable anywhere),
Svelte 5 runes throughout, Tailwind 4, shadcn-svelte (`mira` / `mist`),
hugeicons. TypeScript strict. Zero runtime dependencies beyond what is already
installed — the MIDI parser, the SMF reader/writer, the synth and the scheduler
are all written here, because _writing them is the subject matter._

```
src/lib/
  midi/                     # the protocol, as pure typed code
    messages.ts             # encode/decode every MIDI 1.0 message; the MidiMessage union
    access.svelte.ts        # Web MIDI access, permissions, ports, hot-plug, sysex gating
    monitor.svelte.ts       # ring buffer of timestamped messages + filters
    clock.ts                # lookahead scheduler, transport, PPQN, clock in/out, jitter analysis
    rpn.ts                  # RPN/NRPN build + parse (14-bit)
    mpe.ts                  # zones, member-channel allocation, per-note state
    sysex.ts                # manufacturer IDs, universal SysEx, device inquiry, checksums
    smf.ts                  # Standard MIDI File read/write (VLQ, chunks, meta events)
    router.svelte.ts        # the patchbay: in→out, remap, transpose, filter, thru
    devices/                # semantic device profiles (see §4)
  audio/                    # so the whole app works with zero hardware
    engine.ts               # graph, master bus, analyser, generated-IR reverb, delay
    voice.ts                # polyphonic subtractive voice: osc, filter, ADSR, LFO
    drums.ts                # synthesized GM-ish kit on channel 10
    mpe-voice.ts            # per-note pitch/pressure/slide
  components/
    ui/                     # shadcn-svelte primitives
    midi/                   # the instrument kit (see §3)
    lesson/                 # lesson chrome: objective, checkpoint, callout, try-this, quiz
  curriculum/
    registry.ts             # lesson metadata, ordering, prerequisites
    progress.svelte.ts      # persisted progress + checkpoint verification engine
  stores/                   # settings, theme, layout, persistence (localStorage/IndexedDB)
src/routes/
  learn/[act]/[lesson]      # the course
  lab/                      # standalone tools (monitor, patchbay, programmer, device lab, diagnostics)
  reference/                # the lookup tables you keep coming back to
```

**Timing model.** Everything scheduled goes through one lookahead scheduler: a
~25 ms `setInterval` tick that looks ~100 ms ahead and stamps events with
`AudioContext.currentTime` for audio and `performance.now()` offsets for
`output.send()`. Nothing is ever fired "now" from a timer. This is both correct
engineering and Lesson 17.

---

## 3. The widget kit

These are the app's identity. Each is a proper instrument, not a form control.

- **Keyboard** — 1–7 octaves, velocity from click-Y, multi-touch, computer-key
  mapping, incoming-note highlight per channel colour, optional note-name /
  number / frequency labels, MPE glide + per-note bend visualisation.
- **PadGrid** — 4×4 velocity pads with GM drum labels; also serves as a
  step-input surface.
- **Knob / Fader / XYPad / PitchWheel / ModWheel** — inertia, fine-drag with
  shift, value readout in both 0–127 and semantic units, 7-bit vs 14-bit mode
  so stepping is audible _and_ visible.
- **ByteInspector** — the signature widget. A message rendered as hex bytes →
  binary bits with the MSB flagged → status/channel nibble split → plain-English
  sentence. Scrub any field and the bytes update live. This is where "the whole
  protocol is built on one bit" stops being a claim.
- **MidiMonitor** — colour-coded, filterable, freezable, with raw hex, decoded
  form, delta times, and per-source lanes. Exportable.
- **PortGraph** — animated signal-flow diagram of your actual rig; packets
  travel the wires in their family colour as messages pass. Doubles as the
  patchbay UI and the loop/echo diagnosis tool.
- **PianoRoll / StepSequencer / AutomationLane** — editing surfaces for the
  Programmer, sharing one data model with the SMF exporter.
- **Scope / Spectrum / ClockRuler / JitterPlot** — the measurement instruments.

---

## 4. Device profiles — the "don't be CC-number-centric" principle

Straight from your research notes, and it is the most important architectural
choice in the app. Devices are described semantically:

```ts
{ id: 'filter.cutoff', name: 'Filter Cutoff',
  protocol: { kind: 'cc', number: 74 },      // or nrpn / rpn / sysex
  range: { min: 0, max: 127 }, unit: 'norm' }
```

Callers say `device.set('filter.cutoff', 0.75)`; the adapter decides whether
that becomes CC 74, an NRPN pair, or a SysEx packet. Ships with profiles for
General MIDI, GM drums, OP-XY, OP-1 Field, MPC, plus a **profile editor** and
JSON import/export.

**Device Lab** builds profiles for you: fire a Universal Device Inquiry, then
"wiggle a knob and I'll learn it" — the app watches the incoming stream,
identifies the CC/NRPN, and lets you name it. That is how your Korg and Yamaha
get mapped without reading a 200-page PDF, and it is genuinely useful the day
after you finish the course.

---

## 5. Curriculum

Six acts, ~30 lessons. Each lesson: objectives → live experiment → checkpoints →
"what just happened" byte-level debrief → a hardware task where relevant.
Every lesson works with **no hardware at all** (the built-in synth is the
fallback device) and _better_ with hardware.

**Act I — What MIDI actually is** (no hardware needed)

1. Control, not sound — same notes, different instrument; 2 KB vs 40 MB
2. Notes and pitch — 0–127, middle C = 60, the C3/C4 war, just enough theory
3. Velocity and dynamics
4. **Bytes and bits** — the MSB rule, status vs data, nibbles, channels
5. Note On, Note Off, running status, the velocity-0 note-off trick

**Act II — The message language** 6. Channels, multitimbral instruments, channel 10, omni/poly/mono 7. Control Change — the CC ecosystem, the ones worth memorising, 7-bit stepping 8. Pitch bend — 14-bit, bend range, why it is the odd one out 9. Aftertouch — channel vs polyphonic 10. Program Change and Bank Select MSB/LSB, General MIDI, the off-by-one trap 11. RPN and NRPN — building a 14-bit parameter edit byte by byte 12. Channel Mode messages, Local Control, and how to write a proper Panic 13. SysEx — manufacturer IDs, universal messages, device inquiry, checksums, why the browser gates it

**Act III — Time** 14. MIDI Clock — 24 PPQN, Start/Stop/Continue, Song Position Pointer 15. Clock PPQN vs sequencer PPQN, quantisation, swing 16. MTC, Ableton Link, and choosing a clock master on purpose 17. Latency vs jitter — measure both, then build the lookahead scheduler 18. Standard MIDI Files — chunks, delta times, VLQ, meta events; parse and export a real .mid

**Act IV — The physical world** 19. Transports — 5-pin DIN and the current loop, **TRS Type A vs B** and its
silent failure, USB host vs device, BLE MIDI, network MIDI 20. In / Out / Thru, daisy chains vs star, feedback loops, Local Control off 21. Studio routing patterns — build your rig in the PortGraph, assign channels 22. Troubleshooting in the right order — an interactive decision tree

**Act V — Expression and the future** 23. MPE — the problem it solves, zones, member channels, the five dimensions,
bend-range matching, per-note visualisation 24. MIDI 2.0 and UMP — groups, 32-bit resolution, per-note controllers,
MIDI-CI, profiles, property exchange, and honestly where it stands today

**Act VI — Programming MIDI** 25. The Web MIDI API from zero — permissions, secure context, ports, hot-plug,
in a **live code sandbox that runs against your real devices** 26. Web Audio — turning messages into sound; voices, envelopes, its timing world 27. Building a sequencer on the scheduler 28. Device abstraction — write a real OP-XY profile, control it semantically 29. Pattern and algorithmic composition — mini-notation, Euclidean rhythms, generative lines 30. **Capstone** — three devices, one clock master, CC automation, program
recall, clean panic; verified end-to-end by the checkpoint engine

**Reference section** (permanent, searchable): CC table, GM instrument and drum
maps, note-number/frequency table, status-byte table, manufacturer IDs, message
cheat sheets, glossary, and a guide to reading a MIDI implementation chart.

---

## 6. The Lab — tools that outlive the course

- **Monitor** — full-screen, multi-port, with filters and export
- **Patchbay** — any input → any output; channel remap, transpose, velocity
  curve, filter, split, layer, thru. A real utility.
- **Programmer** — the "create MIDI programs" surface: tracks × steps, note and
  CC lanes, per-track port and channel, piano roll, plus a scripting console
  (`note()`, `cc()`, `every()`, Euclidean helpers). Exports .mid.
- **Device Lab** — inquiry, CC learning, profile editor
- **Diagnostics** — round-trip latency, jitter histogram, loopback test, stuck-note
  panic, connection troubleshooter

---

## 7. Look and feel

Desktop-first, and unapologetically so: a left icon rail (Learn / Lab /
Reference / Settings), a content column that goes wide when the material wants
room, an optional right inspector, and the persistent Engine Dock across the
bottom. ⌘K command palette. Dark-first with a proper light mode, built on the
existing mist/mira tokens plus the seven message hues. Motion is physical and
restrained — notes bloom, packets travel, knobs carry inertia; nothing bounces
for decoration.

---

## 8. Delivery phases

Vertical slices, each independently testable — you can point the OP-XY at it
from Phase 1 onward.

| Phase | Ships                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 0     | App shell, shadcn components, theme + message palette, nav, command palette                             |
| 1     | MIDI core, port manager, Engine Dock, Monitor, ByteInspector, Panic, Diagnostics — **first OP-XY test** |
| 2     | Web Audio engine + widget kit; everything playable with no hardware                                     |
| 3     | Curriculum engine, checkpoints, progress; Acts I–II                                                     |
| 4     | Scheduler, transport, clock in/out, jitter meter, SMF import/export; Act III                            |
| 5     | Patchbay, PortGraph, troubleshooter; Act IV                                                             |
| 6     | MPE + MIDI 2.0 explainers; Act V                                                                        |
| 7     | Programmer, code sandbox, Device Lab, profiles; Act VI + capstone                                       |
| 8     | Reference library, polish, performance, accessibility, tests                                            |

---

## 9. Known constraints (designed around, not discovered later)

- **Web MIDI is Chromium/Firefox only** — no Safari, no iOS. The app detects
  this and shows a clear, non-apologetic explanation plus the full built-in-synth
  experience, which still teaches ~80% of the material.
- **Secure context required**, and Chrome 124+ prompts for _all_ MIDI access.
  A first-run permission flow handles this deliberately rather than failing silently.
- **SysEx is a separate permission gate** — off by default, requested only when
  Lesson 13 or Device Lab needs it, with an honest explanation of why it is gated.
- **Browser timing is main-thread-bound** — hence the lookahead scheduler
  everywhere, and honest jitter measurement rather than pretending it is tight.
- **Reference docs are AI-generated** and flagged as partially unverified
  (OP-XY Program Change off-by-one, MPC clock jitter figures). Anything of that
  kind is cross-checked against primary sources before it becomes lesson content,
  and marked as community-reported where it stays uncertain.

---

## 10. Decisions taken

- **Lesson authoring: Svelte components.** Each lesson is a `.svelte` file built
  from a shared lesson-chrome kit (`Objective`, `Checkpoint`, `TryThis`,
  `Callout`, `ByteWalkthrough`, `Quiz`). Maximum interactivity, no extra
  dependency, custom layout per lesson where the material wants it.
- **Act VI includes the live JS sandbox and the pattern/algorithmic track.**
  The sandbox executes user-written Web MIDI / Web Audio code against actually
  connected devices, with the monitor showing what it emits.
- **No AI/MCP chapter** for now. The semantic device-profile boundary that
  chapter would have argued for is built into the architecture anyway (§4), so
  it can be added later as a single lesson without rework.
- **Build straight through** all phases, checking in only when blocked or when a
  decision materially changes the outcome.

---

## 11. Status

All nine phases are built.

**Protocol layer** (`src/lib/midi/`) — message encode/decode with a streaming
running-status parser, note/frequency conversion, the full CC and RPN tables,
GM programs and drum map, manufacturer IDs, RPN/NRPN builder and reassembler,
SysEx helpers with validation and identity parsing, a Standard MIDI File codec
(read and write, VLQ, meta events), MPE zones with round-robin allocation, UMP
conversion with MIDI 2.0's min-centre-max scaling, the lookahead scheduler and
transport, the patchbay router, and semantic device profiles. Unit tests cover
the message codec, the SMF round trip and the pattern language (46 tests).

**Audio** (`src/lib/audio/`) — a sixteen-channel multitimbral subtractive synth
with per-channel state, a synthesised GM drum kit, generated-impulse reverb and
delay, and scheduled note placement on the audio clock.

**Widgets** (`src/lib/components/midi/`) — ByteInspector, Keyboard, PadGrid,
Knob, Fader, Wheel, XYPad, MessageBuilder, MidiMonitor, ActivityStrip,
DevicePanel, Patchbay, CcPanel, CcLearn, RpnLab, SysExLab, MpeLab, ClockLab,
JitterPlot, SchedulerLab, LatencyTest, GrooveLab, StepSequencer, PatternLab,
MidiFileLab, DeviceProfileEditor, Troubleshooter, CableFigure, Scope,
NoteExplorer, VelocityMeter, PhrasePlayer, Drone, ChannelGrid, CodeSandbox.

**Curriculum** — all 30 lessons written as Svelte components, with 110+ live
checkpoints verified against the MIDI bus.

**Lab** — Monitor, Patchbay, Programmer (step sequencer, patterns, MIDI files,
clock), Device Lab, Diagnostics, Console.

**Reference** — messages, controllers, RPN, GM programs, GM drums, note table,
manufacturer IDs, glossary.
