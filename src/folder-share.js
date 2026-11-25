"use strict";
/*
 * Sharing one folder of question notes as a ZIP.
 *
 * The archive itself is the study bundle written by src/study-bundle.js, so a
 * folder share restores exactly like a full backup: notes keep their paths,
 * existing notes are never overwritten, and the manifest records the folder it
 * came from. This module only decides which folders can be shared, how their
 * counts read, and which ZIPs in the vault a received share could be.
 */
const { str } = require("./util");
const { folderLabel } = require("./filters");
const { QtFuzzySuggestModal } = require("./a11y");

/** Vault folder path with `/` separators; `""` is the vault root. */
function cleanFolder(value) {
  const raw = str(value).replace(/\\/g, "/").trim();
  const parts = raw.split("/").map((part) => part.trim()).filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) return "";
  return parts.join("/");
}

/** The folder that holds a note, or `""` when the note sits at the vault root. */
function noteFolder(path) {
  const clean = str(path).replace(/\\/g, "/");
  return clean.includes("/") ? clean.replace(/\/[^/]*$/, "") : "";
}

/** Whether a note path is the folder itself or anywhere under it. */
function insideFolder(path, folder) {
  const scope = cleanFolder(folder);
  const note = str(path).replace(/\\/g, "/");
  return !scope || note === scope || note.startsWith(scope + "/");
}

/**
 * The folders a share picker offers: the question folder as a whole first,
 * then every folder that directly holds a question note, each with the number
 * of notes it contains (subfolders included).
 */
function questionFolderChoices(paths, root) {
  const scope = cleanFolder(root);
  const pathsInside = (Array.isArray(paths) ? paths : [])
    .map((path) => str(path).replace(/\\/g, "/"))
    .filter((path) => path && insideFolder(path, scope));
  if (!pathsInside.length) return [];
  const countIn = (folder) => pathsInside.filter((path) => insideFolder(path, folder)).length;
  const dirs = [...new Set(pathsInside.map(noteFolder))].sort((a, b) => a.localeCompare(b)).filter((dir) => dir !== scope);
  const all = {
    folder: scope,
    label: scope ? "All questions" : "All questions (whole vault)",
    count: pathsInside.length,
  };
  return [all, ...dirs.map((dir) => ({ folder: dir, label: folderLabel(dir, scope), count: countIn(dir) }))];
}

/** True for a ZIP this plugin writes, so a received share is found by name. */
function isShareZip(path) {
  const name = str(path).replace(/\\/g, "/").split("/").pop();
  return /^mcq-[a-z0-9][a-z0-9 ._-]*-\d{4}-\d{2}-\d{2}(?: \d+)?\.zip$/i.test(name);
}

function choiceText(item) {
  const count = Number(item && item.count) || 0;
  return `${item.label} · ${count} question${count === 1 ? "" : "s"}`;
}

/** Pick the folder to share. */
class ShareFolderPickerModal extends QtFuzzySuggestModal {
  constructor(app, choices, onPick) {
    super(app);
    this.choices = Array.isArray(choices) ? choices : [];
    this.onPick = onPick;
    this.setPlaceholder("Choose a question folder to share");
  }

  qtDialogLabel() {
    return "Share a question folder as a ZIP";
  }

  getItems() {
    return this.choices;
  }

  getItemText(item) {
    return choiceText(item);
  }

  onChooseItem(item) {
    if (typeof this.onPick === "function") this.onPick(item.folder);
  }
}

/** Pick a received ZIP from the vault. */
class SharedZipPickerModal extends QtFuzzySuggestModal {
  constructor(app, paths, onPick) {
    super(app);
    this.paths = Array.isArray(paths) ? paths : [];
    this.onPick = onPick;
    this.setPlaceholder("Choose a questions ZIP to import");
  }

  qtDialogLabel() {
    return "Import questions and flashcards from a ZIP";
  }

  getItems() {
    return this.paths;
  }

  getItemText(item) {
    return str(item).replace(/^.*\//, "");
  }

  onChooseItem(item) {
    if (typeof this.onPick === "function") this.onPick(item);
  }
}

module.exports = {
  ShareFolderPickerModal,
  SharedZipPickerModal,
  choiceText,
  cleanFolder,
  insideFolder,
  isShareZip,
  noteFolder,
  questionFolderChoices,
};
