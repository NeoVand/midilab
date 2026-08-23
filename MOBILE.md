# The phone version

A survey, then a plan. Everything below was measured in a 375×812 viewport
against the real app, not inferred from the source.

The goal is not a responsive squeeze. It is the same capabilities, laid out for
a device you hold in one hand and touch with a finger 9 mm wide — while the
desktop layout stays exactly as it is.

## What the measurements say

| Where                                           | Measured                                                          | Why it matters                                           |
| ----------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| Every screen                                    | Rail is 52 px of 375 — 14% of the width, permanently              | Phones put navigation at the bottom, not down the side   |
| Every screen                                    | Shell is `h-screen`; no `viewport-fit`, no safe-area padding      | Content sits under the iOS home indicator and toolbars   |
| Home                                            | White keys **10.2 px** wide, black keys **5.9 px**                | Apple asks for 44 pt, Material for 48 dp                 |
| Home                                            | **145 of 151** touch targets under 32 px                          | Almost nothing on the main screen is finger-sized        |
| Home                                            | Output panel is 49 px tall and contains **no canvas at all**      | The analyser does not merely shrink — it never renders   |
| Home                                            | Faceplate wraps "transmitting on channel 1" over three lines      | The held-note count is pushed off the right edge         |
| `/lab/monitor`                                  | `PageHeader` collapses the lead to **one word per line**          | Reads as broken; affects every Lab page with actions     |
| `/lab/monitor`                                  | Log overflows its box by 185 px                                   | Five columns of a table that assumes a desk              |
| `/lab/programmer`                               | Step grid overflows by **439 px**; 121 of 152 targets under 32 px | The sequencer is the least usable screen in the app      |
| `/lab/console`                                  | Overflows by 135 px                                               | A code editor, on a phone, is its own design problem     |
| `/settings`, `/lab/devices`, `/lab/diagnostics` | Rows overflow by 15–66 px                                         | Label-and-control rows that never learned to wrap        |
| `/learn/envelope`                               | 104 of 111 targets under 32 px; keybed overflows by 144 px        | Lesson widgets inherit every keyboard and knob problem   |
| Everywhere                                      | 30 hover tooltips, 225 `title` attributes                         | A finger cannot hover; some of these carry real teaching |
| Everywhere                                      | "Play with A–'", key caps, "shift octave with Z / X"              | Instructions for a keyboard the reader does not have     |

Two screens already behave: `/learn` (0 targets under 32 px) and `/reference`.
They are prose and cards, which is the shape phones like.

## What we are building

### 1. The shell

- **Bottom tab bar** below `md`, replacing the rail: Learn, Lab, Tables, Home,
  each 48 px+ with a label. The rail stays exactly as it is from `md` up.
- **`h-dvh`** instead of `h-screen`, `viewport-fit=cover`, and
  `env(safe-area-inset-*)` on the bar and the dock, so nothing hides under the
  home indicator or a browser toolbar that comes and goes.
- **The engine dock becomes a sheet.** On desktop it is a 48 px strip that
  expands. On a phone that strip competes with the tab bar for the same edge,
  so instead: a single-line status pill that opens a full-height sheet with the
  transport, ports, meters and panic.
- **A touch route to the command palette**, which is currently ⌘K only.

### 2. Touch as a first-class input

- A `coarse` media query and a `device` store, so components can ask _how they
  are being touched_ rather than _how wide the window is_ — a 44 px minimum on
  every control that a finger drives.
- Knobs: keep the vertical drag, widen the grab area, and make the whole cell
  the target rather than the 50 px dial.
- Drop the typing-row captions and key caps when there is no keyboard.
- Anything explained only by a `title` gets a visible affordance instead: a tap
  target that reveals the same sentence.

### 3. The instrument

The single most important screen, and the one furthest from working.

- **A keyboard built for thumbs**: two octaves instead of three, ~44 px keys,
  swipe to shift octave rather than Z/X, and a landscape mode that gives the
  keybed the whole screen.
- Notation, output and voice stack instead of sitting in three columns, each
  with a real height — the analyser especially, which currently has none.
- The faceplate loses the sentence and keeps the numbers.

### 4. The Lab

- **Monitor**: the log becomes a list of cards, one message per row, with the
  byte inspector in a bottom sheet on tap instead of a 26 rem side panel.
- **Programmer**: the step grid scrolls horizontally with the lane names pinned,
  cells at 44 px, and the pattern editor gets its own screen rather than a
  column.
- **Patchbay, Devices, Diagnostics**: rows that wrap, controls that stack.
- **Console**: honest about wanting a keyboard, but the examples should still
  run — a run-only mode with the snippets as taps.

### 5. The course

- Lesson widgets inherit the keyboard and knob work above.
- Checkpoints and the progress rail want a compact form.
- Reference tables become stacked cards below `sm`.

### 6. Phone-native polish

- A web app manifest, so it installs to the home screen and runs without
  browser chrome.
- Haptics on key press where the platform offers them.
- An honest word about Web MIDI on iOS, where there is none — everything except
  hardware still works, and the app should say so once rather than fail quietly.

## Order of work

1. **Foundations** — dvh, safe areas, the device store, the tab bar, the dock
   sheet, and the `PageHeader` collapse. Nothing else can be judged until the
   shell is right.
2. **The instrument** — keyboard, panel, analyser.
3. **The Lab** — monitor, programmer, then the rest.
4. **The course** — widgets, checkpoints, tables.
5. **Polish** — manifest, haptics, landscape.

The desktop layout is the control in this experiment: every step is checked at
1280 px as well as 375 px, and the e2e suite runs at both.
