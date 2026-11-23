"use strict";
/*
 * The recording picker for **Audio: transcribe a recording…**.
 *
 * A fuzzy list of the audio files already in the vault, newest-looking name
 * first is unnecessary: paths sort, so the list is stable and predictable.
 * Nothing is read until a file is chosen.
 */
const { QtFuzzySuggestModal } = require("./a11y");
const note = require("./whisper-note");

function audioFiles(files) {
  return (Array.isArray(files) ? files : [])
    .filter((file) => file && typeof file.path === "string" && note.isAudioPath(file.path))
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path));
}

class AudioFilePickerModal extends QtFuzzySuggestModal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder("Choose a recording to transcribe");
  }

  getItems() {
    return audioFiles(this.app && this.app.vault && typeof this.app.vault.getFiles === "function" ? this.app.vault.getFiles() : []);
  }

  qtDialogLabel() {
    return "Choose a recording";
  }

  getItemText(file) {
    return file && file.path ? file.path : "";
  }

  onChooseItem(file) {
    if (typeof this.onPick === "function") this.onPick(file);
  }
}

module.exports = { AudioFilePickerModal, audioFiles };
