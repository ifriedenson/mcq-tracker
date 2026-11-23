# Local Whisper transcription — owner smoke test

This sheet proves the parts of the planned audio slice that no headless test can
reach: a real microphone, a real `whisper-cli` process, a real model file and a
real Obsidian window. The slice ships in 1.307.33; run this sheet against that
build, using [whisper-plan.md](whisper-plan.md) for the design it describes.

Run it on a **desktop** vault with a copy of your notes. Recording writes audio
files into the vault and transcription writes a note, so make a backup or use Git
first. Every step names what you should see; a step that behaves differently is a
failure to record, not something to work around.

## Prep

1. Enable the audio transcription module in Settings and restart Obsidian.
   **Expected:** the module is off before you touch it; after enabling, the
   commands below appear in the palette and no download has started.
2. Run **Audio: set up local transcription…** and read the confirmation.
   **Expected:** source repository, pinned tag, platform asset, model name,
   size and SHA-256 are all shown, and nothing is written until you confirm.
3. Confirm the download and watch it finish.
   **Expected:** progress is visible, the file lands in the plugin's data folder
   (not the vault), the hash is verified, and a receipt names the tag, hash,
   model and date.
4. With the network disconnected, run the setup command again.
   **Expected:** it refuses with a readable message and does not corrupt or
   delete the working install.

## Capture and transcribe

1. Record 30 seconds of speech from the Voice memo card, then press
   **Transcribe**.
   **Expected:** the progress line advances (`0:05 of 0:30` and so on), the
   transcript matches what you said closely enough to edit, and the audio file
   is still in `Recordings/`.
2. Press Cancel during a second transcription.
   **Expected:** the child process stops, the temporary WAV is deleted, and the
   recording is untouched.
3. Transcribe a recording in German or Spanish with the language set to that
   language.
   **Expected:** the multilingual model is used and the text is in that
   language; with `en` forced, it is visibly worse rather than silent.
4. Transcribe a 45-minute lecture.
   **Expected:** the deadline is at least twice the audio length, the progress
   line keeps moving, and memory use stays under about 1 GB for `small.en`.
5. Rename the model file on disk, then transcribe.
   **Expected:** a clear "model missing, run setup" message and no crash.

## The transcript note

1. Open the created transcript note.
   **Expected:** `type: transcript`, `audio`, `duration`, `language`,
   `transcribed_by: whisper.cpp`, `model` and `transcribed_on` are present, and
   the body opens with `## Transcript`.
2. Check the timestamped body against the audio.
   **Expected:** `[mm:ss]` markers land within a few seconds of the words they
   introduce.
3. Run **Compile lecture notes** with the transcript included.
   **Expected:** the compiled note quotes the transcript and no model request is
   made.
4. Edit the transcript by hand and re-run transcription for the same recording.
   **Expected:** the existing note is not silently overwritten.
5. Run **Audio: remove local transcription files**.
   **Expected:** binary, models and receipt are gone; every recording and every
   transcript is still there.

## Refusals

1. Try transcribing on Obsidian Mobile.
   **Expected:** a desktop-only message, no download attempt.
2. Try transcribing with the module disabled.
   **Expected:** the command explains that the module is off and changes nothing.

## Report template

```
Version:            (manifest version you tested)
Obsidian:           (e.g. 1.15.1)
OS:                 (name + version, CPU)
whisper.cpp tag:    (from the setup receipt)
Model:              (e.g. base.en-q5_1, 57 MiB)

Prep 1-4:           pass / fail  (notes)
Capture 1-5:        pass / fail  (notes)
Note 1-5:           pass / fail  (notes)
Refusals 1-2:       pass / fail  (notes)

Wall time, 30 s clip:      ___ s
Wall time, 45 min lecture: ___ s
Transcript accuracy (rough): ___%
Failures to fix before release: (paste the message, the stderr tail and the note)
```
