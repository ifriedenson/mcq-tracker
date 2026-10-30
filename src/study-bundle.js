"use strict";
/*
 * A portable backup of the study vault: every question note and card note,
 * with its properties and review history, inside one stored ZIP.
 *
 * The bundle is a restore path, not a second data store. Notes keep their
 * original vault paths under `questions/` and `cards/`, and `manifest.json`
 * records the mapping so a future importer can put them back. No note content
 * is rewritten, so properties, `history`, scheduling and source links survive
 * a round trip. Images and audio stay in the vault and are not bundled.
 */
const { str } = require("./util");
const { zipStore } = require("./zip-write");

const BUNDLE_SCHEMA = 1;
const BUNDLE_PREFIX = "mcq-study-bundle";

function safeDay(value) {
  const text = str(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "export";
}

function bundleFileName(date) {
  return `${BUNDLE_PREFIX}-${safeDay(date)}.zip`;
}

/** One safe ZIP path segment; never allows a parent-directory hop. */
function cleanSegment(value) {
  const clean = str(value)
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean && clean !== "." && clean !== ".." ? clean : "_";
}

/** `Folder/Note.md` becomes `questions/Folder/Note.md`, with unique names. */
function bundleNotePath(prefix, vaultPath, used, extension) {
  const parts = str(vaultPath)
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  let name = parts.pop() || "note";
  if (!new RegExp(`\\.${extension}$`, "i").test(name)) name += `.${extension}`;
  const dirs = parts.map(cleanSegment);
  let candidate = [prefix, ...dirs, cleanSegment(name)].join("/");
  const base = candidate.replace(new RegExp(`\\.${extension}$`, "i"), "");
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} ${n}.${extension}`;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function bundleReadme(manifest) {
  const counts = manifest.counts || {};
  return [
    "# MCQ Tracker study bundle",
    "",
    `Exported ${manifest.exported} with MCQ Tracker ${manifest.plugin_version || "(development build)"}.`,
    "",
    `- ${counts.questions} question note${counts.questions === 1 ? "" : "s"} under \`questions/\``,
    `- ${counts.cards} card note${counts.cards === 1 ? "" : "s"} under \`cards/\``,
    "",
    "Every note is an unchanged Markdown copy, so its properties (including `history`, `next_review` and `srs`) are preserved.",
    "To restore, extract the folder back into a vault and rescan; the notes are ordinary question and card notes.",
    "",
    "`manifest.json` records each original vault path. Images, audio and PDFs stay in the vault and are not bundled.",
    "",
  ].join("\n");
}

/**
 * Build the archive from already-read notes.
 * `input` is { questions: [{ path, text }], cards: [...], date, version }.
 */
function buildStudyBundle(input) {
  const data = input && typeof input === "object" ? input : {};
  const used = new Set();
  const entries = [];
  const collect = (prefix, notes, extension) => {
    const out = [];
    for (const note of Array.isArray(notes) ? notes : []) {
      const text = str(note && note.text);
      if (!text.trim()) continue;
      const path = bundleNotePath(prefix, note.path, used, extension);
      entries.push({ name: path, data: text });
      out.push({ path, source: str(note.path) });
    }
    return out;
  };
  const questions = collect("questions", data.questions, "md");
  const cards = collect("cards", data.cards, "md");
  const manifest = {
    schema: BUNDLE_SCHEMA,
    plugin: "mcq-tracker",
    plugin_version: str(data.version),
    exported: safeDay(data.date),
    counts: { questions: questions.length, cards: cards.length },
    notes: { questions, cards },
  };
  entries.unshift({ name: "manifest.json", data: JSON.stringify(manifest, null, 2) + "\n" });
  entries.unshift({ name: "README.md", data: bundleReadme(manifest) });
  return { archive: zipStore(entries), manifest, entries: entries.map((entry) => entry.name) };
}

module.exports = {
  BUNDLE_SCHEMA,
  buildStudyBundle,
  bundleFileName,
  bundleNotePath,
  bundleReadme,
  cleanSegment,
  safeDay,
};
