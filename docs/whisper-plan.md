# Local audio capture and Whisper transcription — implementation plan

**Status:** approved on November 23, 2026 (plan.md §11 decision 2, recorded in
[plan-decisions.md](plan-decisions.md)), **implemented in 1.307.33** and
**verified end to end on Linux in 1.307.34**, as a desktop-only, opt-in slice. The gate moved from "no provider is approved" to
three concrete questions this document answers: which model, where the size
goes, and how a real microphone is validated. The code is
`src/whisper-registry.js` (pins, models, settings), `src/whisper-wav.js` (the
16 kHz encoder), `src/whisper-run.js` (argv, deadline, parsing, cancellation),
`src/whisper-note.js` (the transcript note), `src/whisper-install.js` (the
hash-checked downloader) and `src/whisper-picker.js`; the tests are
`tests/whisper.test.js` and the real-microphone half is the owner's sheet below.

The owner-run checklist that will prove the implementation is
[whisper-smoke-test.md](whisper-smoke-test.md).

## Why this is a separate slice, not a patch

`main.js` is **about 4.38 MB** — under Obsidian Sync's 5 MB per-file limit by
roughly 0.62–0.86 MB depending on whether the limit is decimal or binary — and
the startup gate measures **359 of 384 modules eager in 5,490,652 source bytes**
against a budget of 360 / 5,600,000. That leaves **109,348 bytes** of startup
room.

A whisper.cpp model file is 31–466 MiB. It is three to four orders of magnitude
larger than the entire headroom, so it can never be bundled into `main.js`, and
neither can a platform binary. The only shape that fits is: a thin, lazy-loaded
client in `src/`, and a binary plus model that the user downloads on request into
the plugin's own data folder.

| Asset | Size | Where it lives | Bundled into `main.js` |
|---|---|---|---|
| whisper.cpp CLI | single-digit MB per platform, measured when the release is pinned | plugin data folder, `whisper/bin/` | No |
| Model | 31 MiB–466 MiB, depending on choice | plugin data folder, `whisper/models/` | No |
| Capture, convert, note code | a few KB of pure logic | `src/` | Yes, behind a command |

## Model choice

Sizes and memory are whisper.cpp's own numbers for its `ggml` files; the
quantized figures come from the published `ggerganov/whisper.cpp` model table.

| Model | Disk | RAM | Use |
|---|---|---|---|
| `tiny.en-q5_1` | 31 MiB | about 273 MB | weak laptops; rough drafts |
| `base.en-q5_1` | 57 MiB | about 388 MB | **default** — English lectures |
| `base.en-q8_0` | 78 MiB | about 388 MB | slightly better, still small |
| `base.en` | 142 MiB | about 388 MB | unquantized baseline |
| `small.en` | 466 MiB | about 852 MB | accents, technical vocabulary, noisy rooms |
| `small` / `base` (multilingual) | 466 / 142 MiB | as above | any non-English language |

**Recommendation:** `base.en-q5_1` by default. It is small enough to download on
a phone hotspot, fast enough on four CPU cores, and the transcript is editable,
so its mistakes are cheap. Offer `small.en` as the one-click accuracy upgrade and
`tiny.en-q5_1` as the low-disk option. When the language setting is not `en`,
swap to the multilingual variant of the same size instead of the `.en` file.

**Rejected for v1:** a WebAssembly build (a large JS payload against the bundle
cap, no threads in the renderer), `transformers.js` (a dependency, and the
project ships none), and any provider transcription (audio upload is a new
privacy and cost surface, and §11 decision 3 approves no hosted provider).
whisper.cpp itself is MIT — Copyright (c) 2023-2026 The ggml authors — and the
converted model files are MIT too, so redistribution is allowed with the notice
kept; the plugin still ships no binaries, only a pinned download.

## Runtime contract

- **Desktop only.** Node's `child_process` is loaded lazily by literal name, the
  same pattern as `src/opencode-manager.js`; on mobile the command refuses with
  the same calm sentence instead of throwing.
- **Fixed argv, no shell.** `whisper-cli -m <model> -f <wav> -otxt -of <out>
  -l <lang> -t <threads>`. Nothing from the vault, the user or a note becomes a
  flag; paths are passed as separate array entries.
- **16 kHz mono WAV is mandatory.** whisper.cpp reads no other container, while
  the recorder in `src/voice-memo.js` produces `webm`, `m4a`, `ogg` or `wav`.
  A non-WAV recording is decoded with the renderer's own decoder
  (`decodeAudioData`); a 16-bit PCM WAV is read directly by `decodePcm16Wav`,
  so it needs no renderer decoder at all. Both are downmixed and resampled to
  16 kHz mono and written through the pure encoder in `src/`. The encoder and
the direct decoder are the testable core: RIFF header, sample count, clipping,
  silence, odd lengths, round trip.
- **Deadline and cancel.** The job gets `max(2 minutes, 2 × audio length)`;
  cancel kills the child and deletes the temporary WAV. There is no retry loop.
- **Progress.** whisper.cpp prints timestamped segments to stderr, so the
  progress line reads `12:34 of 48:00` from the last segment it reported, with a
  Cancel button. A failed run shows the last few stderr lines, not a stack.

## Install and verify

The OpenCode installer is the model, with one extra rule: nothing executes that
was not hashed first.

1. **Audio: set up local transcription…** shows the source repository, the
   pinned release tag, the platform asset name, the model name, its size and its
   SHA-256 — before anything is written.
2. Nothing downloads until the user confirms. The plugin never downloads on
   load, on update or in the background.
3. The download lands as a temporary file inside the plugin's data folder; the
   SHA-256 is computed and compared with the hash recorded in the in-repo
   registry. A mismatch deletes the file and refuses to run it.
4. The executable bit is set only after the hash matches; a receipt records
   release tag, hash, model and date.
5. **Audio: remove local transcription files** deletes binary, models and the
   receipt, and leaves recordings and transcripts untouched.
6. The registry lives in source as platform → asset → SHA-256, so a reviewer can
   read exactly what may be fetched, and no URL is assembled from user input.

**macOS note.** A downloaded binary carries the quarantine attribute and
Gatekeeper will warn about it. The plan documents that, and offers a "point at
your own `whisper-cli`" field so a Homebrew install works without the plugin
touching system security settings (`xattr` is never run).

## Capture and note surfaces

- The existing Voice memo card in the Read aloud tab records through
  `MediaRecorder` and saves `Recordings/Voice <stamp>.<ext>`. A **Transcribe**
  action sits beside **Stop and save**, and **Audio: transcribe a recording…**
  works on any audio file already in the vault.
- The transcript note is `Recordings/Transcripts/Voice <stamp>.md` with
  frontmatter `type: transcript`, `audio`, `duration`, `language`,
  `transcribed_by: whisper.cpp`, `model`, `transcribed_on`, and `course` when the
  recording sits in a course folder. The body opens with `## Transcript`.
- Timestamped mode writes `**[00:12]** text` lines; the bookmark timestamps in
  `src/audio-bookmarks.js` stay the copyable-link format they already are.
- **Lecture compile.** `src/lecture-compiler.js` turns lecture-log entries
  into one study note. Since 1.307.34 `transcriptLectureRow` maps a transcript
  note to the same row shape, `plugin.transcriptLectureRows()` reads the
  transcript folder while the module is on, and the compiler card merges both
  lists, so a transcript is another valid input with no new AI path, provider
  or prompt.
- **Never auto-graded, never auto-sent.** A transcript lands in an editable
  field or note; it is not graded, not uploaded and not fed to a model unless
  the learner asks. This is the rule already recorded in plan.md for voice work.

## Settings

One new optional module, off by default, normalized with the other defaults in
`src/constants.js`:

| Key | Default | Meaning |
|---|---|---|
| `audioTranscription.enabled` | `false` | the whole slice is opt-in |
| `audioTranscription.binaryPath` | `""` | empty means the managed install |
| `audioTranscription.model` | `"base.en-q5_1"` | registry entry name |
| `audioTranscription.language` | `"en"` | `auto` passes whisper's own detection |
| `audioTranscription.timestamps` | `true` | write `[mm:ss]` per segment |
| `audioTranscription.folder` | `"Recordings/Transcripts"` | where transcripts land |

No existing key changes, no note schema changes, and no network default changes:
transcription is local, and the only request the slice ever makes is the
explicit, confirmed binary/model download.

## Bundle and startup budget

The installer, the transcriber and the transcript view are required lazily from
the command handler and the Read-aloud view, the way the PDF editor stack is, so
`scripts/check-startup-budget.js` should stay at **359–360 modules** and under
**5,600,000 bytes** with no budget raise. Only the pure registry, WAV encoder and
note builder ride in the eager bundle — expected in the low tens of KB, against
the ~0.65–0.89 MB of room left under the Sync limit. The measured numbers go in
the release note, as every previous size change did.

## Tests

All pure in the suite: no model, no microphone, no network, no spawned process.
The real run is recorded under [Verified run](#verified-run-130734) below.

- **Registry** — every platform row carries a tag, asset and hash; an unknown
  platform refuses; no user string can become a URL or a flag.
- **WAV encoder** — 16 kHz mono header, sample count for a known duration,
  clipping, silence, odd lengths, and a round-trip decode of the header.
- **Transcriber** — argv shape, deadline scaling, `.txt` parsing into segments,
  empty output, stderr tail on failure, cancellation, all against an injected
  spawn boundary (the `speechFactory` pattern already used by the dictation
  tests).
- **Transcript note** — frontmatter keys, timestamped and plain bodies, unsafe
  folder refusal, no overwrite of an existing transcript.
- **WAV decode** — a 16-bit PCM file round-trips to float channels, anything
  else is refused, and `decodeRecording` decodes a WAV with no audio context.
- **Lecture bridge** — a transcript note becomes a compiler row, a non-transcript
  or silent note is refused, the compiled note carries its date/title/text, and
  the bridge stays off with the module.
- **Settings** — defaults, normalization of bad values, and a disabled module
  refusing the command with a readable reason.

The real microphone, real model and real binary are the owner's checklist in
[whisper-smoke-test.md](whisper-smoke-test.md), not a headless test claim.

## Slices, in shipping order

1. Registry, WAV encoder and settings normalization with their tests — no UI.
2. Installer with hash verification, plus the remove command.
3. **Audio: transcribe a recording…** over an existing file, and the note
   builder.
4. The **Transcribe** action on the Voice memo card, with progress and cancel.
5. Lecture-compile bridge and timestamped transcripts — timestamped bodies
   shipped in 1.307.33; the bridge shipped in 1.307.34.
6. README section and the owner smoke sheet run — the README section shipped in
   1.307.33, the headless half of the sheet ran in 1.307.34, and the
   microphone/live-window half is still the owner's.

## Verified run (1.307.34)

On Linux, with the shipped modules and no injected spawn or stand-in decoder:

- **Program.** Built from the pinned `v1.8.6` source tag with CMake, because no
official Linux asset is published; `src/whisper-install.js` says so on Linux and
  the settings field pointed at the build. Kept in a scratch directory.
- **Model.** `base.en-q5_1`, 59,721,011 bytes, downloaded by
  `INSTALL.installModel` into a disposable vault's plugin data folder and
  verified against the registry hash (`verified: true`).
- **Audio.** `samples/jfk.wav` from the same tagged source — real speech.
- **argv.** `-m <data>/whisper/models/ggml-base.en-q5_1.bin -f
  <data>/whisper/tmp/run-mwtjrln9/recording.wav -l en -t 4 -otxt -oj -of
  <data>/whisper/tmp/run-mwtjrln9/transcript`.
- **Result.** Exit code 0 in 1.85 s; the 11-second recording's deadline was the
  120 s floor. The note landed at `Recordings/Transcripts/jfk.md` with
  `type: transcript`, `audio: Recordings/jfk.wav`, `duration: "00:11"`,
  `language: en`, `transcribed_by: whisper.cpp`, `model: base.en-q5_1` and
  `transcribed_on: 2026-11-23`, and the body matched the speech.
- **Cancel.** A 240-second silent WAV cancelled 1.5 s in returned
  `cancelled: true`, wrote no note and left no temporary folder.
- **Bridge.** The real note produced one compiler row and compiled into one
  lecture section.

Still not verified here, and left on the owner sheet: a real microphone
(`MediaRecorder` in Obsidian), a live Obsidian window, the managed Windows
asset, multilingual audio, and a 45-minute lecture's wall time and memory.

Each slice is independently shippable and leaves the plugin working when the
module is off.

## Out of scope

Mobile capture (no device here to validate the WebView microphone), provider
transcription, pronunciation scoring (declined in §11), model summarisation
(needs an approved provider), bundled binaries in the repository (size and
review policy: a pinned release with an in-repo hash is reviewable, a checked-in
blob is not), and any background or automatic download.

## Risks

| Risk | Mitigation |
|---|---|
| Supply chain: a tampered binary or model | pinned release tag, SHA-256 in source, refuse a mismatch, no auto-update |
| Gatekeeper or antivirus blocks the binary | documented, plus a bring-your-own `whisper-cli` path |
| Transcript quality on accents or noise | `base.en-q5_1` default, one-click `small.en`, editable note, never auto-graded |
| Long lecture files | deadline scales with length, cancel kills the child, oversized files refused with a reason |
| Disk use | every size shown before download; one remove command clears it |
| Licence attribution | whisper.cpp and its `ggml` models are MIT; a `NOTICES.md` entry ships with the installer |

## Open questions for the owner

1. Ship the managed download (recommended), or only the bring-your-own binary in
   the first release?
2. Keep `base.en-q5_1` as the default (recommended), or start at `tiny.en-q5_1`
   for size and `small.en` for accuracy?
3. Host the pinned binary as a repository release asset (recommended) or on the
   plugin's own site?
