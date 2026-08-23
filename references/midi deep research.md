# MIDI From First Principles: A Practical Producer’s Guide to Channels, CCs, Programs, Sync, MPE, Hardware, and Code

MIDI becomes much easier once you stop thinking of it as “something keyboards use” and start thinking of it as a **language of timestampable control events**. A MIDI connection does not normally carry the sound of your synthesizer. It carries instructions such as “start note 60 with velocity 100,” “move controller 74 to 92,” “switch to program 17,” “bend the currently sounding notes upward,” or “advance the shared musical clock by one pulse.” Audio still has to travel through an audio cable, USB audio stream, mixer, or audio interface. citeturn17view3turn16view1

Once that distinction is internalized, almost everything else falls into a manageable hierarchy:

```text
connection / MIDI port
    ↓
MIDI messages
    ↓
some messages have a MIDI channel
    ↓
notes, controllers, programs, pitch bend, pressure...
    ↓
the receiving device decides what those messages actually do
```

That last line is enormously important. **The MIDI specification defines the language; the instrument defines much of the meaning.** Program Change says “select program number X,” but MIDI does not generally dictate which sound X must be. CC74 has a standardized “brightness” role, but an MPE instrument uses it for per-note timbre/Slide, while individual devices may document still other mappings. Bank numbers are likewise just addresses until the manufacturer's MIDI implementation tells you what they select. citeturn16view1turn17view0

For your particular collection—OP-XY, MPC Live III, OP-1 field, Yamaha and Korg instruments, Push 3, and Seaboard RISE 2—the most valuable skill is therefore not memorizing every MIDI number. It is learning the protocol well enough that, given any instrument's **MIDI implementation/reference**, you can immediately translate its table into a working sequencing, automation, synchronization, or programming setup.

## The mental model that makes MIDI make sense

The original MIDI protocol is remarkably small. In MIDI 1.0, most musical messages consist of a **status byte** followed by one or two **data bytes**. The status tells you which kind of event this is and, for Channel Voice messages, which MIDI channel it addresses. The subsequent bytes contain things such as note number, velocity, controller number, or controller value. MIDI's original data-byte representation uses seven useful bits, which is why the number **127** appears constantly: a seven-bit field has 128 possible values, from 0 through 127. citeturn16view0turn16view1

### The vocabulary you should never confuse

These terms sound similar in music-equipment UIs but refer to different layers:

| Term                         | What it really means                                       | Example                                    |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| **MIDI port**                | An input/output endpoint or stream                         | “OP-XY MIDI Out,” an interface's DIN Out 2 |
| **MIDI channel**             | A logical address embedded in Channel messages             | Channel 3                                  |
| **Sequencer track**          | A container invented by a sequencer/DAW                    | MPC track “Korg Bass”                      |
| **Part / timbre**            | A receiver's independently playable sound section          | Part 3 of a multitimbral synth             |
| **Program / patch / preset** | A stored sound or receiver-defined selection               | “Warm Pad”                                 |
| **Bank**                     | A namespace used to enlarge the program-selection space    | Bank MSB 63, LSB 4                         |
| **Voice**                    | An individual sounding note allocation inside a synth      | One note of an eight-note chord            |
| **CC**                       | A Control Change message identified by a controller number | CC1 modulation                             |
| **MIDI Clock**               | Repeating musical timing pulses                            | 24 pulses per quarter note                 |
| **MTC**                      | MIDI Time Code, describing absolute time                   | Synchronizing to video/timecode            |
| **SysEx**                    | Manufacturer/system-specific variable-length data          | Patch dump or device command               |

A **track is not a channel**. Your MPC might have five tracks that all transmit on channel 1, or one track whose events eventually address different channels. A Standard MIDI File also distinguishes tracks from channels; tracks are file/sequencer organization, whereas channels are encoded into MIDI Channel messages. citeturn2search14turn16view1

Similarly, a **MIDI channel is not an audio channel**. Sending something on MIDI channel 4 does not put sound on audio output 4. The receiving synth decides that MIDI channel 4 controls, say, Part 4, and that part's sound then follows whatever audio routing the instrument provides. MIDI itself transmits control information rather than that resulting audio. citeturn17view3turn16view1

### What a channel actually is

MIDI 1.0 Channel Voice messages contain a four-bit channel field, providing sixteen logical channels. The protocol encodes those internally as values 0–15, while musicians and equipment UIs conventionally call them **channels 1–16**. That difference becomes important when writing code: channel 1 corresponds to a channel nibble of zero. citeturn16view0

For example:

```text
0x90 = Note On, channel 1
0x91 = Note On, channel 2
...
0x9F = Note On, channel 16

0xB0 = Control Change, channel 1
0xB1 = Control Change, channel 2
...
0xBF = Control Change, channel 16
```

Conceptually:

```text
status byte = message-type + channel
```

or in code:

```js
status = baseStatus | (humanChannel - 1);
```

This is why the same physical MIDI cable can simultaneously control several parts of a multitimbral synthesizer. A sequencer can send bass notes on channel 1, a pad on channel 2, drums on another channel, and automation for each independently, assuming the receiver has parts configured to those channels. Channel Voice messages affect their specified channel; System messages such as MIDI Clock are instead connection-wide rather than channel-specific. citeturn16view1turn16view0

A useful mental picture is:

```text
             one MIDI port
                  │
     ┌────────────┼─────────────┐
     │            │             │
 MIDI ch 1     MIDI ch 2     MIDI ch 3 ...
     │            │             │
 Bass part      Pad part      Lead part
```

Not every synthesizer is multitimbral. A simple synth may listen on one selected receive channel and ignore the other fifteen. MIDI also defines Omni modes in which a receiver listens more broadly, though modern production rigs usually work more predictably when you deliberately assign channels. citeturn16view1

### MIDI In, Out, and Thru

The traditional model is directional:

```text
sequencer MIDI OUT ─────► synth MIDI IN
```

The synth may then have a MIDI **THRU** path that forwards incoming data onward. Modern USB equipment, computers, grooveboxes, and software routers often implement similar routing in software, sometimes called soft thru or MIDI echo. The important engineering principle is to know which component originates an event and which components merely forward it. Otherwise it is easy to create feedback loops. MIDI's original architecture and later transports retain the sender/receiver message model even though the physical connection may now be USB, Bluetooth, or another transport instead of five-pin DIN. citeturn17view2turn17view3

For example, this is dangerous:

```text
Keyboard ─► MPC ─► Synth
   ▲              │
   └──────────────┘
```

if the return path forwards everything back again. A single key press can circulate repeatedly or produce doubled notes and controllers.

### Local Control

**Local Control** solves a closely related keyboard-workstation problem. On an instrument containing both a keyboard and an internal sound engine, Local Control determines whether the physical keyboard directly drives the local engine. MIDI defines CC122 for Local Control: value 0 means Off and 127 means On. citeturn16view0turn17view1

A common studio arrangement is:

```text
Synth keyboard
      │ MIDI
      ▼
    MPC
      │ processed/recorded MIDI
      ▼
Synth sound engine
```

With Local Control still On, the sound engine might receive your key once directly and once when the MPC echoes it back. Turning Local Control Off lets the sequencer become the central routing authority. Whether this is desirable depends on the instrument and workflow, but understanding it is foundational. citeturn16view1

### MIDI is separate from its transport

Another conceptual breakthrough is to separate **the MIDI protocol** from **the cable carrying it**. MIDI 1.0 began as a byte stream associated with five-pin DIN, but MIDI data has subsequently been carried over USB and many other transports. MIDI 2.0 formalizes an even clearer separation through Universal MIDI Packets. citeturn17view2

In your studio you may encounter:

```text
5-pin DIN MIDI
3.5 mm TRS MIDI
USB MIDI
Bluetooth MIDI
virtual computer MIDI ports
network-based MIDI systems
```

The musical concepts—Note On, CC, Program Change, channels—can remain essentially the same while the physical transport changes. citeturn17view2turn17view3

With **TRS MIDI**, be particularly careful about Type A versus Type B wiring. They are physically similar 3.5 mm connectors but wire MIDI differently. Teenage Engineering specifically documents a **Type A TRS-to-DIN adapter** for the OP-XY's MIDI use. citeturn15search4turn8search1

USB introduces another issue: one side normally needs to act as USB host. Hardware-to-hardware USB MIDI therefore cannot be inferred simply from “both devices have USB-C.” The device manuals have to say that the desired host/device configuration is supported. The OP-XY documentation explicitly describes connecting USB MIDI devices, while Akai's current MPC Live III guidance says controllers intended for standalone operation should connect through its USB-A ports and reserves its USB-C connection for computer connectivity. citeturn15search4turn15search21

### MIDI versus music theory

MIDI itself has surprisingly little opinion about music theory. A Note On contains a numeric **key number** and velocity. It does not inherently contain “C-major chord,” “Dorian scale,” or “minor seventh.” Those higher-level musical concepts belong to your sequencer, algorithm, or performance. citeturn16view1

So think of the layers this way:

```text
musical idea
    ↓
"play this scale/chord/pattern"
    ↓
sequencer / Strudel / algorithm
    ↓
individual MIDI note numbers and events
    ↓
synthesizer
    ↓
audio
```

Pitch-bend messages can then move the pitch continuously between the note positions, while MPE extends that idea to independent bends and expression for separate notes. citeturn16view0turn0search2

## The MIDI message language in practical detail

Almost all day-to-day MIDI programming comes down to a relatively small set of message families. MIDI 1.0 defines Note On, Note Off, Polyphonic Key Pressure, Control Change, Program Change, Channel Pressure, and Pitch Bend as Channel Voice messages. System Common, System Real-Time, and System Exclusive messages handle synchronization and broader/device-specific functions. citeturn16view0turn16view1

Here is the producer's cheat sheet:

| Message          | MIDI 1.0 status family | Main data              | Typical purpose                      |
| ---------------- | ---------------------: | ---------------------- | ------------------------------------ |
| Note Off         |                   `8n` | note, release velocity | End note                             |
| Note On          |                   `9n` | note, velocity         | Start note                           |
| Poly Pressure    |                   `An` | note, pressure         | Pressure independently for a note    |
| Control Change   |                   `Bn` | CC number, value       | Knobs, pedals, parameters            |
| Program Change   |                   `Cn` | program                | Select preset/program                |
| Channel Pressure |                   `Dn` | pressure               | One pressure value for whole channel |
| Pitch Bend       |                   `En` | 14-bit bend            | Continuous pitch movement            |
| SysEx            |            `F0 ... F7` | variable               | Device-specific data                 |
| MIDI Clock       |                   `F8` | none                   | Musical synchronization              |
| Start            |                   `FA` | none                   | Begin sequence                       |
| Continue         |                   `FB` | none                   | Resume sequence                      |
| Stop             |                   `FC` | none                   | Stop sequence                        |

These status formats and data layouts come directly from the MIDI 1.0 message definition. citeturn16view0

### Notes and velocity

A Note On is essentially:

```text
Note On
├─ MIDI channel
├─ note/key number 0–127
└─ velocity 0–127
```

Velocity originates from how strongly a controller reports the initial attack, but **velocity is not inherently volume**. The receiver decides what to do with it. A synthesizer may map velocity to amplitude, filter brightness, envelope depth, sample layer, or several things simultaneously. The MIDI Association describes amplitude as a normal use, not as the only possible interpretation. citeturn16view1

A matching Note Off ends the note and can also contain **release velocity**. Many instruments ignore release velocity; expressive devices such as ROLI controllers can make deliberate use of it. citeturn16view1turn15search14

That leads to an important sequencer rule:

> Every note you start should eventually have a corresponding termination.

Lost Note Off messages are one cause of the classic **stuck note** problem.

### Aftertouch and pressure

MIDI 1.0 has two distinct pressure concepts.

**Channel Pressure**, often called channel aftertouch, supplies one pressure value for the entire MIDI channel. If you are holding a chord, it cannot independently distinguish pressure on each key. **Polyphonic Key Pressure** includes the note number, so each held note can have an independent pressure value. citeturn16view0turn16view1

That distinction matters enormously when comparing:

```text
ordinary aftertouch     → one pressure value for channel
poly aftertouch         → one pressure value per note
MPE                     → several expressive dimensions per note
```

Push 3 exposes MPE, Poly Aftertouch, and Mono/Channel Aftertouch as separate expression modes, which is a useful practical illustration that these technologies are related but not interchangeable. citeturn3view6

### Pitch bend is unusually high-resolution

Most ordinary MIDI 1.0 controller values are seven-bit values from 0 to 127. Pitch Bend is different: it combines two seven-bit data fields into a **14-bit value**, yielding 16,384 possible positions. Its center position is 8192 (`0x2000`). citeturn16view0

The crucial wrinkle is that the message does **not itself mean “bend two semitones.”** It describes a position within the receiver's configured bend range. The receiver determines the pitch sensitivity, which MIDI can also configure through Registered Parameter Number 0 when supported. citeturn16view0turn16view1

Therefore:

```text
same pitch-bend MIDI value
              │
       ┌──────┴───────┐
       ▼              ▼
receiver ±2       receiver ±48
semitones         semitones
       │              │
 small bend       enormous bend
```

This is one of the most common reasons an MPE controller appears “out of tune”: sender and receiver disagree about bend range. ROLI explicitly instructs users to match the Seaboard's pitch-bend range to the instrument it controls. citeturn15search17turn15search20

### What a CC actually is

**CC means Control Change.**

A MIDI 1.0 Control Change message contains:

```text
status:      Control Change + MIDI channel
data byte:   controller number
data byte:   controller value
```

For example:

```text
B0 01 7F
```

means, in hexadecimal:

```text
B0    Control Change on channel 1
01    controller 1
7F    value 127
```

CC1 is standardized as the Modulation Wheel/Lever controller, so this commonly means “maximum modulation-wheel value on channel 1.” citeturn16view0turn16view2

The best way to think about a CC is:

```text
CC number = which control?
CC value  = where is that control?
channel   = which addressed part?
```

### The CCs worth memorizing

You do not need to memorize 128 numbers. A producer will encounter this core subset repeatedly:

|      CC | Standard role                           | Why it matters                        |
| ------: | --------------------------------------- | ------------------------------------- |
|       0 | Bank Select MSB                         | Patch-bank addressing                 |
|       1 | Modulation Wheel                        | Standard performance modulation       |
|       2 | Breath Controller                       | Expressive control                    |
|       4 | Foot Controller                         | Pedal/expression applications         |
|       5 | Portamento Time                         | Glide timing                          |
|       6 | Data Entry MSB                          | RPN/NRPN editing                      |
|       7 | Channel Volume                          | Channel-level volume                  |
|      10 | Pan                                     | Stereo placement                      |
|      11 | Expression                              | Continuous expression                 |
|      32 | Bank Select LSB                         | Fine portion of bank address          |
|      38 | Data Entry LSB                          | Fine RPN/NRPN value                   |
|      64 | Sustain/Damper                          | Pedal, Off ≤63 / On ≥64               |
|      65 | Portamento switch                       | Glide enable/disable                  |
|      66 | Sostenuto                               | Pedal                                 |
|      67 | Soft pedal                              | Pedal                                 |
|   70–79 | Sound Controllers                       | Timbre/envelope-type roles            |
|      74 | Sound Controller 5 / default Brightness | Especially important for MPE timbre   |
|      91 | Effects 1 / default reverb send         | Effects control                       |
|      93 | Effects 3 / default chorus send         | Effects control                       |
|      96 | Data Increment                          | RPN/NRPN                              |
|      97 | Data Decrement                          | RPN/NRPN                              |
|   98–99 | NRPN LSB/MSB                            | Select manufacturer-defined parameter |
| 100–101 | RPN LSB/MSB                             | Select standardized parameter         |
|     120 | All Sound Off                           | Emergency silencing                   |
|     121 | Reset All Controllers                   | Controller reset                      |
|     122 | Local Control                           | Local keyboard-engine connection      |
|     123 | All Notes Off                           | Panic/release aid                     |

The assignments and switching thresholds above are defined in the MIDI Association's current MIDI 1.0 controller table. citeturn16view2turn17view0turn17view1

### Standard CC meaning versus device mapping

This point deserves special emphasis.

The MIDI specification assigns meanings to some controller numbers, designates others as general purpose, and leaves some undefined. A manufacturer can then expose its own MIDI implementation in ways that depend on the device. citeturn16view2turn17view1

Consequently, seeing:

```text
CC 46
```

is not enough to conclude what will happen on every synth.

Your workflow should always be:

```text
instrument manual
      ↓
MIDI implementation / MIDI reference
      ↓
find parameter
      ↓
see whether it uses:
  CC?
  NRPN?
  RPN?
  SysEx?
      ↓
program sequencer/controller accordingly
```

Teenage Engineering provides device-specific CC references for its instruments, for example, while the OP-XY's external MIDI track lets you choose eight CC numbers to transmit to whatever instrument you are sequencing. citeturn15search0turn3view3

This distinction also explains why **“CC74 = filter cutoff” is not a safe universal rule**. The core table gives CC74 a default Sound Controller/Brightness meaning; MPE standardizes an important per-note timbral use for it; Strudel's own documentation notes that the exact synth mapping must be considered when sending CC74. citeturn17view0turn14view0turn0search2

### Seven-bit controllers and stepping

A normal CC value has 128 positions:

```text
0, 1, 2, ... 126, 127
```

For switches such as sustain, the receiving behavior may divide this into two regions. CC64, for example, is Off for values 63 and below and On for 64 and above. citeturn17view0

For a continuously varying parameter, 128 positions may sometimes feel coarse. MIDI 1.0 therefore provides higher-resolution mechanisms. Controllers 0–31 can have corresponding LSB controllers 32–63. Thus CC1 can be paired with CC33, CC7 with CC39, CC10 with CC42, and so forth, if both sender and receiver implement the paired high-resolution control. citeturn17view0

The conceptual reconstruction is:

```text
14-bit value = (MSB << 7) | LSB
```

giving:

```text
0 ... 16383
```

Do not assume every synth implements the fine LSB half. The receiver's implementation documentation remains authoritative. citeturn17view0

### RPN and NRPN

When 128 ordinary controller numbers are insufficient, MIDI 1.0 provides **Registered Parameter Numbers** and **Non-Registered Parameter Numbers**.

They work like an address-selection mechanism:

```text
select a parameter
      ↓
change the selected parameter's value
```

For an RPN:

```text
CC101  RPN MSB
CC100  RPN LSB
CC6    Data Entry MSB
```

For an NRPN:

```text
CC99   NRPN MSB
CC98   NRPN LSB
CC6    Data Entry MSB
```

CC38 can provide the Data Entry LSB for appropriate high-resolution uses, while CC96 and CC97 provide increment/decrement operations. citeturn16view1turn17view1

The difference is semantic:

**RPNs** are registered parameters whose meanings are standardized. Pitch-bend sensitivity and tuning are examples. **NRPNs** are a large manufacturer-assignable parameter space. A synth might use NRPNs to expose oscillator shape, envelope stages, effect parameters, sequencer settings, or practically anything its manufacturer chooses. citeturn16view1

This makes NRPN one of the first places to look when you discover that a synth has many more editable parameters than it has obvious CC mappings.

For programming purposes, treat RPN/NRPN sequences as **stateful compound operations**: send the parameter selector and its data in a coherent sequence rather than casually interleaving edits to different parameters on the same channel. That recommendation follows from their select-then-edit architecture. citeturn16view1turn17view1

### Programs and patches

A MIDI 1.0 **Program Change** message has a single seven-bit program field, so it can identify 128 program numbers. citeturn16view0turn16view1

Conceptually:

```text
Program Change 17
             ↓
receiver decides what "17" selects
```

The receiver might interpret that as:

```text
preset 17
a drum kit
a sequence
a track
an internal sound slot
something device-specific
```

This is why you should distinguish **the MIDI message** from **the receiver's interpretation**.

A particularly good example exists in Akai's documentation: MPC can be configured to use incoming Program Change for selection behavior such as sequences or tracks, and its MPC 3 behavior documents mappings beginning with raw Program Change 0 selecting item 1. citeturn3view5

Likewise, the OP-1 field's documented Program Change mapping uses raw values 0–7 for synth slots 1–8 and 8–15 for drum slots 1–8. citeturn4view0turn4view3

Those examples explain a notorious source of MIDI confusion:

```text
protocol value: 0
UI label:       1
```

Some products present program labels as 1–128 even though the transmitted field is 0–127; others expose raw numbers. Never blindly subtract one or add one—check the particular device's implementation.

### Banks solve the 128-program limit

Suppose your synth has 2,000 presets. Program Change alone cannot identify all of them.

MIDI's solution is **Bank Select**, using:

```text
CC0   Bank Select MSB
CC32  Bank Select LSB
```

followed by:

```text
Program Change
```

The full selection concept is therefore:

```text
bank MSB
   +
bank LSB
   +
program
```

MIDI's two seven-bit bank fields create 16,384 possible bank addresses, each theoretically containing up to 128 programs. citeturn16view1turn16view2

On channel 3, a raw sequence might conceptually be:

```text
B2 00 3F   Bank Select MSB = 63
B2 20 04   Bank Select LSB = 4
C2 11      Program = 17
```

Notice the `2` in the status nibble: human channel 3 is internally channel index 2.

The most important caveat is that **MIDI does not define how your synthesizer must map those bank numbers to its named banks**. Manufacturers define the mapping. Yamaha's historically standardized XG practices and other manufacturer-specific systems exist precisely because the base MIDI protocol does not tell you which sound Bank MSB 63 / LSB 4 / Program 17 should represent. citeturn16view1

Therefore your Yamaha or Korg manual may contain a table such as:

```text
Sound             MSB   LSB   PC
Warm Analog Pad    63     4   17
FM Bass            63     5   42
...
```

That table is what you program. The MIDI specification provides the mechanism; the manufacturer's table supplies the address.

### General MIDI is not “MIDI”

This distinction is historically important. MIDI itself does **not** generally standardize Program 17 as one particular instrument sound. General MIDI is a higher-level compatibility profile that standardizes a sound organization and other behavior so MIDI files can produce roughly corresponding instrumentation on different General MIDI devices. The base MIDI protocol is much broader and does not require your modern synth to behave as a General MIDI sound module. citeturn11search6turn16view1

So for hardware production:

```text
Generic MIDI:
"program 17"

General MIDI:
"program 17 has standardized musical semantics"

Your synthesizer:
"consult its program/bank map"
```

### SysEx: the escape hatch

**System Exclusive**, or SysEx, exists for information that ordinary MIDI messages do not adequately express.

A MIDI 1.0 SysEx message begins with `F0`, contains an identifying structure including a manufacturer ID for manufacturer-specific messages, contains arbitrary protocol-defined data, and terminates with `F7`. Manufacturers have used SysEx for patch parameters, patch dumps, samples, configuration, remote editing, and many other purposes. Universal SysEx formats provide certain standardized system-level functions as well. citeturn16view0turn16view1

Conceptually:

```text
F0
│
├─ manufacturer / universal identification
├─ device/model information
├─ command
├─ parameter/data
├─ perhaps checksum
└─ F7
```

You cannot safely invent the bytes between `F0` and `F7`. You need the manufacturer's SysEx specification because model IDs, device IDs, data packing, addresses, and checksums are protocol-specific. citeturn16view1

SysEx is what can turn MIDI from “notes and knobs” into a **full hardware editor/librarian protocol**.

It also deserves respect. The W3C's Web MIDI security model treats SysEx as a more privileged capability partly because SysEx can reach unusually sensitive device functions, including firmware-related mechanisms on some equipment. Web applications therefore request SysEx permission explicitly. citeturn19view0

### Panic messages

For real hardware experimentation, learn these immediately:

```text
CC120  All Sound Off
CC123  All Notes Off
CC121  Reset All Controllers
```

All Sound Off instructs a receiver to silence sounding oscillators as quickly as possible; All Notes Off terminates notes according to the device's MIDI mode behavior; Reset All Controllers returns supported controllers to defaults. citeturn16view0turn17view1

A MIDI tool you write should have a highly visible **Panic** button.

## Timing, synchronization, files, routing, and real-world reliability

Playing individual notes is the easy part of MIDI. Building a studio that stays synchronized, avoids duplicated events, recalls patches correctly, and behaves consistently is where MIDI literacy becomes engineering literacy.

### MIDI Clock

MIDI Timing Clock is a one-byte System Real-Time message, `F8`, transmitted **24 times per quarter note** when MIDI synchronization is being used. Start (`FA`), Continue (`FB`), and Stop (`FC`) supply transport semantics. citeturn16view0turn16view1

At 120 BPM:

```text
1 quarter note = 500 ms

500 ms / 24 clocks
≈ 20.833 ms per MIDI Clock pulse
```

A sixteenth note occupies six MIDI clocks:

```text
24 clocks / 4
= 6 clocks per sixteenth note
```

That fact also appears in the MIDI Song Position Pointer definition. citeturn16view0

The practical architecture is:

```text
               clock master
                    │
        F8 F8 F8 F8 F8 F8 ...
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
     OP-XY        Synth        MPC
    follower      follower     follower
```

**Choose one master whenever possible.** Two devices simultaneously trying to dictate tempo usually creates an ambiguous or unstable system. This is an engineering recommendation based on the master-clock protocol rather than a separate MIDI command. citeturn16view1

### Clock does not equal sequencer PPQN

This confuses even experienced users.

MIDI Clock's wire-level timing remains:

```text
24 pulses per quarter note
```

A sequencer may internally use:

```text
96 PPQN
480 PPQN
960 PPQN
or something else
```

Those are internal sequencing/time-grid resolutions. Standard MIDI Files also have their own timestamp/delta-time representations. They are not evidence that MIDI Timing Clock itself is suddenly sending 480 or 960 `F8` messages per quarter note. citeturn16view0turn2search14

### Start versus Continue

These are not merely synonyms.

**Start** tells the receiver to start the current sequence from its beginning. **Continue** resumes from the position at which playback was stopped. Stop stops playback. citeturn16view0

Some rigs additionally use **Song Position Pointer**. MIDI defines it as a fourteen-bit count of “MIDI beats,” where this slightly unfortunate term means **six MIDI clocks**, equivalent to a sixteenth-note unit under the standard 24-clock-per-quarter relationship. citeturn16view0

So the synchronization stack can contain:

```text
Clock               tempo/phase pulses
Start/Stop/Continue  transport
Song Position        musical playback location
```

Not every device implements every element equally, so once again the implementation chart matters.

### MIDI Clock versus MIDI Time Code

MIDI Clock is primarily **musical** synchronization. Its meaning is naturally tied to beats and tempo. MIDI Time Code, by contrast, exists for timecode synchronization and includes MTC Quarter Frame messages, historically useful for synchronizing MIDI equipment with recording or video systems. citeturn16view1

A useful rule:

```text
"Keep these grooveboxes on the same BPM/bar"
               ↓
           MIDI Clock

"Chase a specific absolute film/tape time"
               ↓
              MTC
```

MIDI Machine Control is another concept again: it concerns remote machine/transport control rather than being the tempo clock itself. The MIDI specification family includes MTC and MMC as separate extensions. citeturn16view1

### MIDI Real-Time messages are special

Clock, Start, Stop, Continue, Active Sensing, and Reset are System Real-Time messages. The MIDI architecture gives these timing-sensitive messages special treatment; they may occur interleaved with other MIDI 1.0 byte-stream traffic. citeturn16view1turn16view0

This is why a MIDI parser should not naïvely assume:

```text
status byte
data byte
data byte
```

will always arrive as an uninterrupted trio at the raw byte-stream level. A Real-Time message can occur between the pieces. Higher-level APIs such as Web MIDI present complete MIDI messages to your application and handle this underlying assembly. citeturn19view3

### Latency versus jitter

For production, distinguish two problems:

**Latency** is a consistent delay between intended and actual event time.

**Jitter** is variation in that delay.

A constant 8 ms delay can often be compensated. A delay jumping unpredictably between 1 ms and 15 ms tends to feel much worse rhythmically.

This matters because a MIDI performance involves several scheduling stages:

```text
sequencer
   ↓
OS / hardware scheduler
   ↓
MIDI transport
   ↓
receiver MIDI parser
   ↓
synth voice engine
   ↓
audio engine / converters
   ↓
your ears
```

The MIDI transport is therefore only one contributor to the timing you perceive. Modern Web MIDI even lets a program enqueue outgoing messages with explicit high-resolution timestamps rather than requiring JavaScript to execute at the exact instant each note should leave. citeturn19view3

### Dense automation has a cost

If you generate hundreds of parameter values every tiny fraction of a beat, more data must be serialized, parsed, and acted upon. An LFO implemented as CC messages is therefore fundamentally different from an LFO running inside the synth: the former produces a stream of discrete external control events; the latter can run at the synth's internal modulation/control rate.

Practically, use enough MIDI automation resolution to sound smooth, but do not blindly send redundant values. A controller sweep that changes only when the seven-bit value changes is often more sensible than sending identical values repeatedly. MIDI 2.0's expanded resolution and newer controller mechanisms address several limitations inherent in MIDI 1.0 control data. citeturn18view0

### MIDI files

A **Standard MIDI File** is not the same thing as the real-time MIDI connection.

A live MIDI connection carries events between endpoints. An SMF stores MIDI events and timing-related information so the performance can be reconstructed later. SMF Type 0 conventionally combines MIDI data into one track, while Type 1 supports multiple synchronized tracks. The tracks are organizational structures and should still not be confused with MIDI channels. citeturn2search14turn2search20

A `.mid` file therefore does not normally contain the actual audio timbre of the synthesizer. If a sequence relied on a specific Korg patch or custom SysEx state, merely loading its notes on an unrelated synth will not magically reproduce the same audio unless the required sound/configuration is also available and correctly selected. MIDI's core protocol is a description/control system, not an audio recording format. citeturn17view3

### A robust studio routing pattern

For a multi-device setup, I would strongly favor an explicit topology similar to:

```text
                 MASTER SEQUENCER
                 OP-XY or MPC
                        │
         ┌──────────────┼───────────────┐
         │              │               │
       Port A          Port B          USB
         │              │               │
      Korg            Yamaha         OP-1 field
     MIDI ch 2        MIDI ch 3       MIDI ch 4

Audio:
Korg ─────────┐
Yamaha ───────┼──► mixer / MPC / interface
OP-1 field ───┘
```

The exact channel numbers above are illustrative, not device defaults. What matters is that you can explain every route: **which port, which channel, who owns clock, which unit echoes MIDI, and where audio returns**.

A useful rig worksheet is:

| Device     | MIDI path | Receive ch. | Transmit ch. | Clock role | Bank/PC          | Important CC/NRPN  | Audio return |
| ---------- | --------- | ----------: | -----------: | ---------- | ---------------- | ------------------ | ------------ |
| OP-XY      | —         |           — |            — | Master     | —                | —                  | mixer        |
| Korg       | DIN A     |           2 |            — | Follow     | map from manual  | cutoff, resonance… | mixer        |
| Yamaha     | USB       |           3 |            — | Follow     | map from manual  | expression…        | mixer        |
| OP-1 field | USB/DIN   |           4 |            — | Follow     | documented slots | TE mapping         | mixer        |

Constructing this chart for each project will eliminate a remarkable percentage of “why doesn't this work?” sessions.

### Troubleshooting in the right order

When a synth does not respond, debug from the outside inward:

```text
Is the cable/USB route correct?
        ↓
Does the output port actually exist?
        ↓
Are transmit and receive MIDI channels matched?
        ↓
Is the synth configured to accept external MIDI?
        ↓
Are notes reaching it?
        ↓
Are CC / Program Change reception enabled?
        ↓
Is the bank/program numbering correct?
        ↓
Is local control / MIDI thru producing duplication?
        ↓
Is audio actually routed and audible?
```

That order prevents the classic mistake of debugging “MIDI” for twenty minutes when the real problem is an audio input muted on the mixer.

## Turning the concepts into workflows on your hardware

Your collection is particularly good for learning MIDI because it contains devices that occupy nearly every MIDI role: sequencers, controllers, synthesis engines, expressive controllers, USB hosts, and computer-integrated devices.

### OP-XY as a MIDI laboratory

The OP-XY is unusually well suited to making the concepts above tangible. Teenage Engineering's dedicated **external MIDI track** lets you choose the MIDI channel, bank, and program and provides **eight MIDI CC controls that can be edited, sequenced, and recorded**. Its keyboard and sequencer can then play and sequence the external instrument. citeturn15search0

Teenage Engineering documents the layout as:

```text
M1 → channel / bank / program
M2 + M3 → eight MIDI CC controls
```

Holding Shift while turning an encoder selects/enables the desired CC, after which the encoder controls its value. citeturn15search0turn15search4

That gives you an excellent first experiment.

Imagine your Korg manual says:

```text
MIDI Receive Channel: configurable
Bank: MSB 0 / LSB 3
Program: 17
Filter Cutoff: CC74
Resonance: CC71
Attack: CC73
Release: CC72
```

Do not assume these hypothetical numbers apply to your unspecified Korg model; they are illustrating the workflow.

On the OP-XY you would set:

```text
channel → target Korg receive channel

bank/program →
according to Korg's table

CC slot A → CC74
CC slot B → CC71
CC slot C → CC73
CC slot D → CC72
```

Now the OP-XY sequencer is not merely triggering notes. It can record and sequence **sound design**:

```text
step 1: cutoff 32
step 2: cutoff 40
step 3: cutoff 61
step 4: cutoff 110
...
```

This is the essence of MIDI parameter automation.

The OP-XY can also turn an instrument track into an external MIDI sequencing track, which Teenage Engineering specifically suggests when sequencing multiple external devices. It supports external MIDI via its multi-out/TRS arrangement and supported USB MIDI connections. citeturn15search4turn15search8

The practical lesson is that **an external MIDI track is essentially a structured message generator**:

```text
notes
velocity
channel
bank
program
CC automation
timing
```

Once you see it that way, a computer script and an OP-XY track are fundamentally doing the same type of job.

### Inbound versus outbound MIDI on the OP-XY

Keep two maps separate in your mind:

```text
OP-XY → external synth
```

Here, you choose CC numbers according to the **external synth's** MIDI implementation.

Versus:

```text
computer/controller → OP-XY
```

Here, you use **Teenage Engineering's OP-XY MIDI map**, because the OP-XY is now the receiver. Teenage Engineering documents many remotely controllable parameters, including channel-related volume/pan controls and system/scene/project-related commands. citeturn3view3

The receiver decides the semantics.

That is perhaps the single most transferable MIDI lesson in this entire report.

### OP-1 field as an implementation-chart case study

The OP-1 field provides another excellent demonstration of device-specific MIDI semantics. Its documented MIDI reference includes ordinary Note On/Off and pitch bend, synchronization messages, a large device-specific control map, and Program Change behavior that loads its synth and drum slots. citeturn3view4turn4view0

For example, Teenage Engineering documents Program Change values:

```text
0–7    → synth slots 1–8
8–15   → drum slots 1–8
```

rather than treating the number as some universal preset name. citeturn4view0turn4view3

Its MIDI reference also maps various CCs to things including mixer, active synthesis/drum parameters, envelopes, effects, tape/transport-related functions, and other OP-1 field-specific controls. citeturn4view3

That should permanently cure you of the notion:

> “A CC number always means exactly the same thing everywhere.”

Some CC assignments are standardized or recommended; others are contextual. **Your device's MIDI reference is part of your instrument.**

### The MPC Live III as MIDI central command

The MPC family is well suited to the opposite role: rather than being merely an external synth target, it can become the central MIDI sequencer/router.

Akai describes MPC MIDI Programs as capable of sending **MIDI Notes, Control Change, Program Change, and other performance controls** through MIDI outputs to external synthesizers, drum machines, and other MIDI equipment. citeturn15search30

The conceptual MPC routing is:

```text
MPC track
  │
  ├─ output MIDI port
  ├─ MIDI channel
  ├─ notes
  ├─ CC automation
  ├─ Program Change
  └─ timing
        ↓
 external synth
```

Once you understand that, the MPC's many routing pages become variations on the same port-plus-channel model rather than mysterious settings.

The MPC can also itself be the **receiver** of Program Change, with Akai documenting selectable Program Change behavior for tracks/sequences under MPC 3. That again demonstrates that the recipient defines how a Program Change command is interpreted. citeturn3view5

For controllers plugged directly into your MPC Live III in standalone mode, Akai's current Live III troubleshooting documentation specifies the normal USB-A ports for MIDI controllers, while describing the USB-C port as the computer connection. citeturn15search21

A sensible role for the MPC in a large rig is:

```text
controllers
    ↓
   MPC
    ├────────► Korg
    ├────────► Yamaha
    ├────────► OP-1 field
    └────────► another module
```

with the MPC recording performances, filtering/routing channels, sending program changes, and possibly serving as the single tempo master.

### Which should be your clock master?

Between an OP-XY, MPC, computer, and Push-based Live rig, all are plausible candidates depending on the session. The bad strategy is allowing the choice to happen accidentally.

A studio policy might be:

```text
OP-XY-centered jam:
OP-XY = clock master

MPC production:
MPC = clock master

Ableton/Push session:
Live/Push = clock master

Strudel experiment:
computer = clock master
```

Ableton documents both sending MIDI Clock from Live to external sequencers/drum machines and synchronizing Live to an external MIDI clock source. citeturn15search28

The important part is not which box wins. It is that everyone knows who won.

### Use your Yamaha and Korg manuals differently

Because you did not specify the Yamaha and Korg models, the right universal technique is to search their manuals for these sections:

```text
MIDI Implementation Chart
MIDI Implementation
MIDI Parameter Guide
Data List
Voice List
Bank Select MSB/LSB
Program Change
Control Change
NRPN
SysEx
MIDI Receive Channel
Local Control
Clock / Sync
```

When you find the implementation chart, read it as a **capabilities contract**.

You want to answer:

```text
Does it transmit this message?
Does it receive this message?
On which channels?
Which CC controls which parameter?
Does it support bank select?
What are the MSB/LSB/program numbers?
Does it support NRPN?
Does it document SysEx?
Will it follow MIDI clock?
Does it respond to Start/Stop?
```

The MIDI protocol deliberately leaves bank-to-sound mappings and manufacturer-specific parameters outside the generic mechanism, so the manufacturer's implementation documentation is indispensable. citeturn16view1

### A practical first laboratory exercise

You could learn most of MIDI 1.0 in a single afternoon by deliberately performing this progression with the OP-XY or MPC and one external synth.

Start by sending **only notes** on one channel. Verify Note On/Off and velocity.

Then assign one known CC from the synth's manual. Record a slow sweep. Verify that playback reproduces it.

Add sustain with CC64 if the receiver uses it.

Next, issue a Program Change and observe the patch selection.

Then determine the correct bank MSB/LSB and perform a full Bank Select + Program Change.

Configure the sequencer as clock master and the synth as clock follower if the synth has a sequencer/arpeggiator.

Finally, create a deliberate stuck-note scenario by interrupting the connection, reconnect it, and use a Panic operation based on All Notes Off / All Sound Off.

At that point the abstract concepts will have become physical behaviors.

### A more ambitious multi-instrument exercise

A hypothetical project could be:

```text
OP-XY
├─ channel 2 → Korg bass
├─ channel 3 → Yamaha pad
├─ channel 4 → OP-1 field sound
└─ clock      → all synchronized devices
```

On each track:

```text
notes      → composition
velocity   → articulation
CC         → evolving sound
bank + PC  → initial patch recall
```

Then record all three instruments' **audio** separately.

You now have two parallel representations of the performance:

```text
MIDI
editable intent / notes / controls
        │
        └── can be changed and replayed

AUDIO
actual resulting waveform
        │
        └── exact rendered sound
```

That distinction is central to professional production. MIDI is editable control data; audio is what actually gets mixed and mastered. citeturn17view3

## MPE and MIDI 2.0

MPE makes much more sense after ordinary MIDI channels, pitch bend, pressure, and CC74 are understood. It is not a completely unrelated protocol. It is a clever way of using MIDI 1.0's existing architecture to achieve independent expression for multiple simultaneously sounding notes. citeturn0search2

### The problem MPE solves

Imagine holding a three-note chord on ordinary MIDI channel 1:

```text
C
E
G
```

Now send Pitch Bend on channel 1.

Ordinary MIDI 1.0 pitch bend applies to the **channel**, so all three notes bend together. Likewise, Channel Pressure is channel-wide. citeturn16view0turn16view1

But on a Seaboard you want:

```text
C bends down
E stays still
G bends up

and

C has little pressure
E has medium pressure
G has lots of pressure
```

MPE achieves this by assigning independently expressive notes to separate **member channels** within an MPE zone. Channel-scoped messages such as pitch bend and pressure then effectively become per-note controls because each active note has its own channel context. A master channel carries zone/global information. citeturn0search2turn0search20

Conceptually:

```text
ordinary MIDI:

channel 2
├─ C
├─ E
└─ G
   ↓
pitch bend affects all


MPE:

channel 2 → C
channel 3 → E
channel 4 → G

bend ch 2 → C only
bend ch 3 → E only
bend ch 4 → G only
```

This is why understanding ordinary MIDI channels first makes MPE almost obvious.

### Zones and member channels

MPE defines zones containing a master channel and a configurable range of member channels. In the standard lower-zone arrangement, channel 1 is the master and channels above it are allocated as members; an upper zone works from channel 16 downward. The number of available member channels therefore determines how many independently channelized notes can be represented at once in that zone. citeturn0search2turn15search10

Ableton exposes these concepts directly: its MPE/Multi-Channel settings let you choose upper or lower zone behavior and the range/number of note channels used when transmitting MPE to an external device or plug-in. citeturn15search10

### The Seaboard's expressive dimensions

ROLI's mapping gives you an exceptionally intuitive way to memorize MPE-related messages:

| ROLI gesture | MIDI representation            |
| ------------ | ------------------------------ |
| **Strike**   | Note-On velocity               |
| **Press**    | Pressure / aftertouch          |
| **Glide**    | Pitch Bend                     |
| **Slide**    | CC74                           |
| **Lift**     | Note Off plus release velocity |

ROLI documents these mappings for its Seaboard family. citeturn15search32turn15search14

This is the deep reason MPE feels different from an ordinary MIDI keyboard. You are not merely producing:

```text
note + velocity
```

You are producing evolving gestural streams throughout the life of each note:

```text
Note On
   │
   ├──── pitch bend changing continuously
   ├──── pressure changing continuously
   ├──── CC74 changing continuously
   │
Note Off + release velocity
```

and doing so independently for multiple notes.

### Push 3

Ableton Push 3's pads support MPE expression. Ableton describes its MPE mode as providing pressure, slide, and per-note pitch-bend dimensions, while also distinguishing MPE from Poly Aftertouch and Mono Aftertouch modes. citeturn3view6

Push can also function as part of a hardware-centric environment: Ableton explicitly documents playing external synthesizers/drum machines through Push's MIDI ports and controlling external MIDI equipment, and class-compliant MIDI devices can be connected through Push 3's USB-A port for use in the appropriate Live/Push configuration. citeturn15search6turn15search25

### MPE versus polyphonic aftertouch

These are not equivalent.

Polyphonic aftertouch solves:

```text
independent pressure per note
```

because Polyphonic Key Pressure includes a note number. citeturn16view0

But traditional MIDI 1.0 Pitch Bend and ordinary CC messages remain channel-level controls.

MPE instead constructs a larger expressive environment in which each note gets a member channel, allowing:

```text
per-note pitch bend
per-note pressure
per-note CC74/timbre
```

among other expression. citeturn0search2turn15search10

So a synth saying “supports poly aftertouch” does not automatically mean “supports MPE.”

### Pitch-bend-range matching is mandatory for good MPE behavior

Suppose the Seaboard believes maximum Glide means:

```text
+48 semitones
```

while the synth believes the same MIDI bend value means:

```text
+2 semitones
```

The MIDI bytes can be perfectly valid while the musical result is completely wrong.

ROLI explicitly documents setting the receiving instrument's pitch bend range to match the controller. ROLI's workflows commonly use wide bend ranges to accommodate long Seaboard Glides. citeturn15search17turn15search29

Whenever troubleshooting MPE, therefore inspect:

```text
MPE enabled on sender?
MPE enabled on receiver?
same zone?
same member-channel range?
same pitch-bend range?
CC74 interpreted appropriately?
pressure type supported?
```

before blaming cables or notes.

### MIDI 2.0 attacks the problem more directly

MPE was an ingenious way of obtaining per-note expression using MIDI 1.0's channel architecture. MIDI 2.0 adds **native expanded per-note controls** rather than requiring every new expressive concept to be shoehorned through channel allocation. MIDI 2.0 extends Channel Voice resolution, introduces additional per-note messages, and retains translation/backward-compatibility mechanisms with MIDI 1.0. citeturn18view0

Its foundational representation is the **Universal MIDI Packet**, or UMP, which replaces MIDI 1.0's fundamental byte-stream representation with packets of 32, 64, 96, or 128 bits. UMP can carry MIDI 1.0 protocol messages as well as MIDI 2.0 messages. citeturn17view2turn18view0

### Groups expand addressing

MIDI 1.0 gives a byte-stream connection sixteen channels. UMP introduces a **Group** field. For translation purposes, each Group roughly corresponds to one MIDI 1.0 connection, and sixteen Groups are available; Channel messages within each Group still have sixteen channel addresses. citeturn17view2

Conceptually:

```text
MIDI 1.0
one stream
   └─ 16 channels

UMP
endpoint
   ├─ group 1
   │    └─ 16 channels
   ├─ group 2
   │    └─ 16 channels
   ...
   └─ group 16
        └─ 16 channels
```

### Higher resolution

MIDI 2.0 extends Channel Voice message resolution and allows controller values with dramatically greater precision. Its Registered Controllers and Assignable Controllers—the MIDI 2.0 successors to the RPN/NRPN compound mechanism—can carry values up to 32-bit resolution. citeturn18view0

It also makes previously compound operations more atomic. MIDI 1.0 needs multiple messages to select a bank and then a program; MIDI 2.0's Program Change message can contain the bank-selection information as part of the same operation. citeturn18view0

### MIDI-CI, Profiles, and Property Exchange

This is arguably the most interesting part of MIDI 2.0 for the kind of software and AI tooling you are imagining.

**MIDI-CI**, or MIDI Capability Inquiry, provides mechanisms for devices to discover capabilities. MIDI-CI encompasses areas including Profile Configuration and Property Exchange. citeturn18view0

A **Profile** is essentially a standardized behavior agreement:

```text
"we both support this particular functional mapping"
```

so devices can configure themselves more predictably for a use case. citeturn18view1

**Property Exchange** can expose machine-readable information including controller lists, patch names and metadata, device/model/version information, and configuration properties. The MIDI Association describes Property Exchange resources using JSON-formatted key/value data transported within the MIDI framework. citeturn18view0

That points toward a future experience like:

```text
software:
"What parameters do you have?"

synth:
"I have cutoff, resonance, attack...
 here are their names, ranges and capabilities."

software:
"What programs do you have?"

synth:
"Here are my program names and metadata."
```

instead of:

```text
human downloads 180-page PDF
human manually enters CC numbers
```

For an AI-controlled hardware environment, that is highly relevant.

### But learn MIDI 1.0 first

MIDI 2.0 is designed to coexist with MIDI 1.0 rather than erase it. UMP explicitly supports carrying MIDI 1.0 protocol messages, USB MIDI 2.0 defines compatibility mechanisms, and MIDI 2.0 retains the MIDI 1.0 architecture where possible for translation. citeturn17view2turn18view0

For your practical education, the priority should therefore be:

```text
channels
notes
velocity
CC
pitch bend
programs
bank select
clock
routing
RPN/NRPN
SysEx
        ↓
MPE
        ↓
MIDI 2.0 / UMP / MIDI-CI
```

Once the first layer is intuitive, the newer systems are extensions rather than a new universe.

## Programming MIDI on computers, the web, Strudel, and with AI

Your instinct that MIDI lends itself beautifully to programming is correct. The protocol's event-oriented representation is exactly the sort of thing software handles well.

The most useful architecture is to separate three layers:

```text
MUSICAL INTENT
"play a C, sweep cutoff, switch patch"

        ↓

DEVICE-INDEPENDENT EVENTS
note, velocity, parameter, timestamp

        ↓

DEVICE ADAPTER
"this synth uses CC43 for that parameter"
"this patch is MSB 63, LSB 4, PC 17"

        ↓

TRANSPORT
Web MIDI / native MIDI / USB / DIN

        ↓

HARDWARE
```

That separation becomes especially important once an AI is generating commands.

### Web MIDI versus Web Audio

The two Web APIs do different jobs.

The **Web MIDI API** enumerates MIDI input/output interfaces and lets JavaScript receive and transmit MIDI messages. It is deliberately low-level and does not try to decide the semantic meaning of “CC74” or “note 60.” citeturn17view3

The **Web Audio API** synthesizes and processes **audio** using a graph of AudioNode objects. It can implement oscillators, filters, gains, delays, worklet-based processors, routing, and parameter automation. citeturn20view0

So:

```text
Web MIDI
    │
    ├─ talks to physical MIDI devices
    └─ receives MIDI controllers

Web Audio
    │
    ├─ generates/processes browser audio
    └─ provides audio-rate/control automation

Together:
MIDI controller → browser synth
browser sequencer → hardware synth
hardware MIDI → Web Audio effects/synthesis controls
```

The W3C explicitly anticipates Web MIDI being used alongside Web Audio. citeturn17view3

### Getting MIDI access in a browser

Web MIDI is a permission-controlled feature available in secure contexts in implementations that support the API. Access begins with:

```js
const access = await navigator.requestMIDIAccess();
```

The resulting `MIDIAccess` exposes input and output port maps and device-state changes. Requesting `{ sysex: true }` asks for the stronger System Exclusive permission and can fail if SysEx access is denied. citeturn19view0turn19view2

A minimal explorer:

```js
async function inspectMidi() {
	if (!('requestMIDIAccess' in navigator)) {
		throw new Error('Web MIDI is not available in this browser.');
	}

	const midi = await navigator.requestMIDIAccess({ sysex: false });

	console.log('Inputs:');
	for (const input of midi.inputs.values()) {
		console.log({
			id: input.id,
			manufacturer: input.manufacturer,
			name: input.name,
			state: input.state
		});
	}

	console.log('Outputs:');
	for (const output of midi.outputs.values()) {
		console.log({
			id: output.id,
			manufacturer: output.manufacturer,
			name: output.name,
			state: output.state
		});
	}

	return midi;
}
```

The port metadata, input/output maps, and connection-state behavior are part of the Web MIDI API. citeturn19view0turn19view2

### Receiving MIDI

Incoming MIDI events expose their bytes as a `Uint8Array`. citeturn18view2

A useful decoder skeleton is:

```js
function decodeMidiMessage(data) {
	const [status, data1 = 0, data2 = 0] = data;

	// System messages do not have a MIDI channel.
	if (status >= 0xf0) {
		return {
			type: 'system',
			status,
			data: Array.from(data.slice(1))
		};
	}

	const type = status & 0xf0;
	const channel = (status & 0x0f) + 1; // human numbering: 1–16

	switch (type) {
		case 0x80:
			return { type: 'noteOff', channel, note: data1, velocity: data2 };

		case 0x90:
			return { type: 'noteOn', channel, note: data1, velocity: data2 };

		case 0xa0:
			return {
				type: 'polyPressure',
				channel,
				note: data1,
				pressure: data2
			};

		case 0xb0:
			return { type: 'cc', channel, cc: data1, value: data2 };

		case 0xc0:
			return { type: 'programChange', channel, program: data1 };

		case 0xd0:
			return { type: 'channelPressure', channel, pressure: data1 };

		case 0xe0: {
			const value14 = data1 | (data2 << 7);
			return { type: 'pitchBend', channel, value14 };
		}

		default:
			return { type: 'unknown', status, data: Array.from(data) };
	}
}
```

You can then attach it to all inputs:

```js
for (const input of midi.inputs.values()) {
	input.onmidimessage = (event) => {
		console.log(event.timeStamp, decodeMidiMessage(event.data));
	};
}
```

Web MIDI reports each received MIDI message as an event with high-resolution timing information and a `Uint8Array` containing the message data. citeturn18view2turn19view3

This little monitor may be one of the most educational MIDI tools you can write. Plug in the Seaboard, Push, OP-1 field, Yamaha, or OP-XY and physically manipulate every control while watching the bytes.

Suddenly:

```text
B0 4A 57
```

stops being mysterious and becomes:

```text
Control Change
channel 1
CC74
value 87
```

### Sending useful MIDI messages

A compact reusable implementation looks like this:

```js
function assertChannel(channel) {
	if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
		throw new RangeError('MIDI channel must be an integer from 1 to 16.');
	}
}

function byte7(value, name = 'value') {
	if (!Number.isInteger(value) || value < 0 || value > 127) {
		throw new RangeError(`${name} must be an integer from 0 to 127.`);
	}
	return value;
}

function statusByte(base, channel) {
	assertChannel(channel);
	return base | (channel - 1);
}

function noteOn(output, channel, note, velocity = 100, when = 0) {
	output.send([statusByte(0x90, channel), byte7(note, 'note'), byte7(velocity, 'velocity')], when);
}

function noteOff(output, channel, note, releaseVelocity = 0, when = 0) {
	output.send(
		[statusByte(0x80, channel), byte7(note, 'note'), byte7(releaseVelocity, 'release velocity')],
		when
	);
}

function cc(output, channel, controller, value, when = 0) {
	output.send(
		[statusByte(0xb0, channel), byte7(controller, 'controller'), byte7(value, 'value')],
		when
	);
}

function programChange(output, channel, program, when = 0) {
	output.send([statusByte(0xc0, channel), byte7(program, 'program')], when);
}

function pitchBend(output, channel, value14, when = 0) {
	if (!Number.isInteger(value14) || value14 < 0 || value14 > 16383) {
		throw new RangeError('Pitch bend must be 0–16383.');
	}

	const lsb = value14 & 0x7f;
	const msb = (value14 >> 7) & 0x7f;

	output.send([statusByte(0xe0, channel), lsb, msb], when);
}
```

Those byte layouts follow MIDI 1.0's Channel Voice definitions. citeturn16view0

### Bank and program selection in code

Now the abstract bank discussion becomes concrete:

```js
function selectPatch(output, channel, { bankMsb, bankLsb, program }, when = 0) {
	if (bankMsb !== undefined) {
		cc(output, channel, 0, bankMsb, when);
	}

	if (bankLsb !== undefined) {
		cc(output, channel, 32, bankLsb, when);
	}

	programChange(output, channel, program, when);
}
```

Usage:

```js
selectPatch(output, 3, {
	bankMsb: 63,
	bankLsb: 4,
	program: 17
});
```

The sequence—Bank Select MSB, Bank Select LSB, then Program Change—is the MIDI 1.0 selection mechanism; what that address means depends on the target instrument. citeturn16view1

### Add a panic function immediately

```js
function panic(output) {
	for (let channel = 1; channel <= 16; channel++) {
		cc(output, channel, 120, 0); // All Sound Off
		cc(output, channel, 123, 0); // All Notes Off
	}
}
```

CC120 and CC123 are the MIDI-defined All Sound Off and All Notes Off Channel Mode messages. citeturn17view1turn16view0

Do this before writing the fancy sequencer.

### Timestamp your outgoing events

A key Web MIDI feature is that `MIDIOutput.send()` accepts a `DOMHighResTimeStamp`. A timestamp of zero or the past means “as soon as possible”; future timestamps let the implementation enqueue events for later transmission. Calls at the same timestamp preserve call order. citeturn19view3

That means this:

```js
const t = performance.now() + 100;

noteOn(output, 1, 60, 100, t);
noteOff(output, 1, 60, 0, t + 500);
```

is architecturally better than:

```js
noteOn(...);

setTimeout(() => {
  noteOff(...);
}, 500);
```

when precise scheduling matters.

The principle is:

```text
JavaScript timer:
"wake me up approximately near this time"

MIDI timestamp:
"please schedule this MIDI event for this time"
```

So use JavaScript timers primarily to **keep a future scheduling window filled**, rather than depending on a callback to execute at the exact musical instant. That is an engineering inference from the timestamped Web MIDI model and the corresponding scheduled-time model used by Web Audio. citeturn19view3turn20view0

A sequencer might repeatedly schedule the next 100–200 ms:

```text
now
 │
 ├──────── already playing
 │
 ├──────── scheduled event
 ├──────── scheduled event
 ├──────── scheduled event
 │
 ▼
lookahead horizon
```

The exact lookahead is an application-design choice.

### Web MIDI deliberately wants complete messages

Web MIDI's `send()` expects complete valid MIDI messages. It explicitly disallows MIDI 1.0 **running status** in the submitted data even though running-status-style compression exists at lower MIDI representations, because underlying systems cannot be assumed to support it in this API context. citeturn19view3

That is convenient for application programming: send self-contained messages rather than attempting to optimize the wire representation yourself.

### Connecting MIDI to Web Audio

Web Audio represents synthesis and processing as an **audio graph**:

```text
oscillator
    ↓
filter
    ↓
gain
    ↓
destination
```

with parameters represented by `AudioParam` objects where appropriate. citeturn20view0turn20view3

A MIDI CC can therefore control a Web Audio parameter:

```text
MIDI CC74 value 0–127
          ↓
normalize 0–1
          ↓
map to 80–12,000 Hz
          ↓
BiquadFilterNode.frequency
```

This is not “MIDI turning into audio.” Your program is **interpreting MIDI control data** and applying it to a Web Audio synthesizer.

A simple normalization is:

```js
const normalized = midiValue / 127;
```

Then map it according to your desired parameter curve. For frequency, an exponential mapping generally feels more musically useful than a simple linear Hz mapping because perceptual pitch/frequency relationships are nonlinear.

Web Audio's `BiquadFilterNode`, for example, exposes frequency, detune, Q, and gain as automatable parameters. citeturn20view3

### Web Audio has its own timing world

Web Audio schedules operations relative to the audio context's timeline rather than the MIDI port's DOM timestamp. Its architecture is explicitly designed around scheduled audio rendering rather than making your JavaScript callback itself perform every audio operation at the exact sample instant. citeturn20view0

For a serious combined MIDI/audio application, maintain a translation layer:

```text
musical time
bars/beats/subdivision
       │
       ├────────► Web MIDI timestamp
       │
       └────────► AudioContext time
```

That is much better than allowing separate MIDI and audio loops to drift independently.

For advanced synchronization, Web Audio exposes timing/latency information intended to relate context/render timing to performance timing. The engineering goal is to establish a mapping between the two clocks and schedule both external MIDI and browser audio from one musical event timeline. citeturn13view2turn19view3

### AudioWorklet

When you eventually write custom synthesis or audio DSP, **AudioWorklet** is the Web Audio mechanism designed for custom processing in the real-time audio rendering environment. MIDI event interpretation and hardware routing can remain in your MIDI/application layers while an AudioWorklet handles operations that genuinely need to occur in the audio-rendering path. citeturn3view1

That separation produces a strong architecture:

```text
UI / sequencer / AI
       │
       ├─ MIDI event model
       │      └─ Web MIDI → hardware
       │
       └─ synthesis parameters
              └─ Web Audio / AudioWorklet → browser audio
```

### Strudel is already surprisingly close to the tool you are imagining

Strudel provides both browser-audio synthesis and external MIDI integration. Its MIDI facilities include selecting MIDI ports/channels and producing note, controller, program, SysEx, pitch-bend, touch, and system real-time commands. citeturn14view0

For notes:

```js
note('c3 e3 g3 c4').midichan(2).midi();
```

Strudel documents MIDI channels 1–16 and lets `.midi()` target output devices. citeturn14view0

For CC automation:

```js
ccv(sine.segment(16).slow(4)).ccn(74).midichan(2).midi();
```

Strudel's `ccn` selects the CC number and `ccv` supplies a normalized 0–1 value. citeturn14view0turn14view1

This is conceptually beautiful because:

```text
sine wave pattern
       ↓
CC value pattern
       ↓
hardware parameter
```

turns algorithmic pattern language into hardware modulation.

Strudel also provides `progNum` for Program Change values 0–127 and explicitly notes that the resulting patch depends on the target MIDI device's configuration. citeturn14view0

Pitch bend and touch are exposed as `midibend` and `miditouch`, and system real-time support includes clock, start, stop, and continue commands through `midicmd`. citeturn14view0

That means Strudel can function as:

```text
algorithmic composer
        +
MIDI sequencer
        +
CC automation generator
        +
hardware performance system
        +
browser audio instrument
```

rather than being limited to generating sounds inside the browser.

### Strudel MIDI mappings

An especially useful facility for building reusable hardware abstractions is Strudel's **midimap** mechanism. Instead of spreading magic numbers like CC74 throughout a composition, you can define named parameters mapped to specific CCs. citeturn14view0

Conceptually:

```js
midimaps({
	mySynth: {
		cutoff: 74,
		resonance: 71
	}
});
```

Then your musical code can speak in semantic terms rather than raw controller numbers.

That points directly toward the architecture I would recommend for your own tool.

### Do not make your application fundamentally CC-number-centric

A first MIDI experiment can expose:

```text
CC number
CC value
channel
```

A serious instrument-control platform should instead expose:

```text
parameter:
  id: filter.cutoff
  displayName: Filter Cutoff
  protocol:
    type: cc
    number: 74
    channel: 3
  range:
    min: 0
    max: 127
```

Another synth might represent the same semantic control as:

```text
parameter:
  id: filter.cutoff
  protocol:
    type: nrpn
    msb: ...
    lsb: ...
```

and another as SysEx.

Your composition or AI should be able to say:

```text
set filter.cutoff to 70%
```

without caring whether the device adapter translates that into:

```text
CC74 = 89
```

or:

```text
NRPN selector + Data Entry
```

or a SysEx packet.

That abstraction is precisely why MIDI-CI Property Exchange is interesting: MIDI 2.0 is moving toward devices being able to expose structured information about controllers, programs, properties, and capabilities themselves. citeturn18view0

### A good data model for your future MIDI experimentation tool

At minimum, I would represent devices something like:

```json
{
	"id": "my-korg",
	"name": "Korg Synth",
	"portId": "some-midi-port",
	"receiveChannel": 2,
	"clock": {
		"receive": true,
		"send": false
	},
	"parameters": {
		"filter.cutoff": {
			"kind": "cc",
			"cc": 74,
			"min": 0,
			"max": 127
		},
		"filter.resonance": {
			"kind": "cc",
			"cc": 71,
			"min": 0,
			"max": 127
		}
	},
	"programs": {
		"warm-pad": {
			"bankMsb": 63,
			"bankLsb": 4,
			"program": 17
		}
	}
}
```

The numbers above are illustrative rather than a claim about your unspecified Korg.

Then the application's public API becomes:

```js
device.set('filter.cutoff', 0.75);
device.selectProgram('warm-pad');
device.noteOn(60, 0.8);
device.noteOff(60);
```

instead of forcing every caller to understand raw bytes.

### This is also the correct AI boundary

For AI/MCP-style control, I would strongly recommend **not** initially exposing an unrestricted tool such as:

```text
send_arbitrary_midi_bytes(bytes)
```

to the model.

Instead expose constrained semantic tools:

```text
list_midi_devices()
describe_device(device)

play_note(
  device,
  channel,
  note,
  velocity,
  duration
)

set_parameter(
  device,
  parameter,
  normalized_value
)

select_program(
  device,
  bank,
  program
)

start_transport()
stop_transport()
panic()
```

The adapter can validate ranges, preserve note lifecycles, enforce device/channel assignments, and translate high-level calls to CC, NRPN, Program Change, or approved SysEx.

For SysEx in particular, an allowlist is wise because Web MIDI's own security model recognizes that SysEx can access unusually sensitive device functions, potentially including firmware mechanisms. citeturn19view0

A safe architecture is:

```text
LLM / agent
     │
     │ semantic command
     ▼
MCP/tool schema
     │
     ▼
validator + policy
     │
     ▼
device profile
     │
     ├─ CC
     ├─ NRPN / RPN
     ├─ Program/Bank
     └─ allowlisted SysEx
     │
     ▼
scheduler
     │
     ▼
MIDI output
```

This also gives you transaction logging:

```text
14:32:10.100
AI → set Korg cutoff to 0.63
translated → CC74 value 80, channel 2
scheduled → MIDI port X
```

which will be invaluable when debugging generative performances.

### Treat MIDI programming like API programming

Once you understand MIDI properly, an instrument starts to look like a hardware API.

Its MIDI implementation is the API documentation:

```text
methods:
  Note On
  Note Off
  Program Change

properties:
  CC mappings
  NRPNs

addressing:
  port + channel

extended API:
  SysEx

event clock:
  MIDI Clock / transport

capability discovery:
  MIDI-CI / MIDI 2.0
```

Your OP-XY's external MIDI tracks are effectively a visual API client. Your MPC is an event recorder/router/API client. A Seaboard is a high-bandwidth expressive event generator. Strudel is a pattern-oriented API client. Web MIDI is a low-level programming interface. MIDI-CI and Property Exchange point toward increasingly discoverable APIs. citeturn15search0turn15search30turn15search32turn14view0turn18view0

That is the conceptual leap that unlocks the entire ecosystem.

A producer or audio engineer who considers themselves fluent in MIDI should ultimately be able to look at an unfamiliar synthesizer and reason through the following without guesswork:

| Question                                      | Concept you should reach for                                            |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| “Why is there no sound?”                      | MIDI versus audio routing                                               |
| “Why is the wrong synth playing?”             | Port and channel                                                        |
| “How do I automate this knob?”                | CC → NRPN → SysEx investigation                                         |
| “Why are there only 128 patches?”             | Bank MSB/LSB + Program Change                                           |
| “Why did Program 1 load when I sent 0?”       | Protocol versus UI numbering                                            |
| “Why does my chord all bend together?”        | Channel-wide Pitch Bend                                                 |
| “How does the Seaboard bend one note?”        | MPE member channels                                                     |
| “Why does MPE sound out of tune?”             | Pitch-bend-range mismatch                                               |
| “Why are both sequencers drifting/fighting?”  | Choose one clock master                                                 |
| “Why did playback resume in the wrong place?” | Start/Continue/SPP implementation                                       |
| “Why is a note stuck forever?”                | Lost Note Off; Panic messages                                           |
| “How do I edit obscure synth parameters?”     | NRPN or SysEx                                                           |
| “Can a browser control the synth?”            | Web MIDI                                                                |
| “Can a browser synthesize/process sound?”     | Web Audio                                                               |
| “Can Strudel animate hardware knobs?”         | MIDI CC patterns                                                        |
| “How should an AI control this safely?”       | Semantic device adapter, validation, scheduled MIDI                     |
| “What does MIDI 2.0 add?”                     | UMP, resolution, per-note control, MIDI-CI, Profiles, Property Exchange |

The practical learning order I would regard as the foundation for your rig is therefore:

```text
PORTS AND ROUTING
        ↓
CHANNELS
        ↓
NOTES + VELOCITY
        ↓
CC AUTOMATION
        ↓
PROGRAM CHANGE
        ↓
BANK SELECT
        ↓
CLOCK / START / STOP
        ↓
PITCH BEND + PRESSURE
        ↓
RPN / NRPN
        ↓
SYSEX
        ↓
MPE
        ↓
WEB MIDI / PROGRAMMING
        ↓
MIDI 2.0 / PROPERTY EXCHANGE
```

Once the first seven or eight layers become second nature, you will no longer think of your OP-XY, MPC, OP-1 field, Korg, Yamaha, Push, and Seaboard as isolated pieces of equipment. They become nodes in one programmable musical system—and MIDI becomes the common language that lets sequencers, controllers, computers, algorithms, and eventually AI systems compose, perform, automate, synchronize, configure, and interrogate that system. citeturn16view1turn17view2turn17view3
