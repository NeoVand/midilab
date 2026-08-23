# MIDI Lab

An interactive course and toolkit that takes you from "MIDI is the thing that
makes those cheap piano sounds" to running a multi-instrument rig from one
clock — or from your own code.

Thirty lessons across six acts, wired to a live MIDI engine. Nothing here is a
diagram: press a key and the actual bytes appear, decoded, in the same panel.
Lessons end in **checkpoints** the engine verifies by watching the MIDI stream,
so you advance by making MIDI happen rather than by clicking Next.

Everything works with no hardware attached — a full sixteen-channel synthesiser
is built in and receives exactly the messages an external instrument would — and
better with hardware plugged in.

## Running it

```sh
npm install
npm run dev
```

Web MIDI requires a Chromium browser (Chrome, Edge, Brave, Arc) or Firefox, on
desktop or Android. **Safari ships no Web MIDI at all**, on macOS or iOS;
everything except hardware access still works there.

```sh
npm run check     # svelte-check
npm run lint      # eslint + prettier
npm run test      # unit tests, then Playwright e2e
npm run build     # static output in build/
```

## What is in it

**The course** (`/learn`) — six acts:

1. What MIDI actually is — control not sound, note numbers, velocity, the
   status/data bit, Note On and Off
2. The message language — channels, Control Change, pitch bend, aftertouch,
   programs and banks, RPN/NRPN, Channel Mode and panic, System Exclusive
3. Time — MIDI Clock, resolution and swing, MTC and Link, latency and jitter,
   Standard MIDI Files
4. The physical world — DIN, TRS Type A/B, USB host and device, In/Out/Thru,
   studio routing, troubleshooting
5. Expression and the future — MPE, MIDI 2.0 and the Universal MIDI Packet
6. Programming MIDI — Web MIDI, Web Audio, building a sequencer, device
   profiles, algorithmic patterns, and a capstone

**The Lab** (`/lab`) — the tools the lessons are built from, standing alone:
Monitor, Patchbay, Programmer, Device Lab, Diagnostics, and a JavaScript
Console that drives your real hardware.

**Reference** (`/reference`) — status bytes, the full CC table, RPN, GM programs
and drums, a note/frequency table, SysEx manufacturer IDs, and a glossary.

## Architecture

A SvelteKit single-page application, statically built, with no server and no
network calls. State lives in the browser's local storage.

```
src/lib/
  midi/        the protocol: parsing, encoding, clock, routing, files, profiles
  audio/       the built-in synthesiser
  patterns/    the mini-notation language and Euclidean rhythms
  sandbox/     the API exposed to code you write in the Console
  components/  the widget kit and lesson chrome
  curriculum/  lesson metadata, progress, and the 30 lessons
```

The MIDI parser, the Standard MIDI File codec, the pattern language, the
synthesiser and the lookahead scheduler are all written here rather than pulled
from libraries, because reading them is part of the point.

`PLAN.md` describes the design decisions in more detail.
