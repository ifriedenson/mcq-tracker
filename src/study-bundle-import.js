"use strict";
/*
 * Restore a study bundle written by src/study-bundle.js.
 *
 * Policy (chosen once, documented in plan.md and the README):
 * - Notes go back to their original vault paths.
 * - A missing note is created.
 * - An existing note with identical text is reported as "already there" and
 *   is not duplicated.
 * - An existing note with different text is never overwritten; it is reported
 *   as a conflict and left exactly as it was.
 * - Absolute paths, `..` hops and unsafe characters are rejected, never
 *   normalized into a write outside the vault.
 * - Cards are skipped while the Cards module is off.
 *
 * The archive is read with the plugin's existing local ZIP reader; nothing is
 * extracted to disk, and no dependency is added.
 */
const { str } = require("./util");
const { readZipEntries } = require("./apkg");
const { BUNDLE_SCHEMA } = require("./study-bundle");

const MAX_NOTES = 20000;

function cleanRestorePath(value) {
  const raw = str(value).replace(/\\/g, "/").trim();
  if (!raw || raw.startsWith("/") || /^[a-zA-Z]:\//.test(raw)) return "";
  const parts = raw.split("/").map((part) => part.trim()).filter((part) => part && part !== ".");
  if (!parts.length || parts.some((part) => part === "..")) return "";
  const clean = parts
    .map((part) => part.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!clean.length) return "";
  let name = clean.pop();
  if (!/\.md$/i.test(name)) name += ".md";
  return [...clean, name].join("/");
}

function restorePath(note, folder) {
  const source = str(note.source);
  if (source) {
    const direct = cleanRestorePath(source);
    if (!direct) return ""; // an unsafe source is rejected, not redirected
    return direct;
  }
  const entry = str(note.entry).replace(/^questions\//, "").replace(/^cards\//, "");
  const base = entry.split("/").filter(Boolean).pop() || "";
  return base ? cleanRestorePath(`${str(folder).replace(/\/+$/, "")}/${base}`) : "";
}

/** Read and validate the archive. Manifest failures throw before anything is written. */
function parseStudyBundle(input) {
  const entries = readZipEntries(input);
  const manifestEntry = entries.get("manifest.json");
  if (!manifestEntry) throw new Error("That ZIP is not an MCQ Tracker study bundle: manifest.json is missing.");
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.toString("utf8"));
  } catch (e) {
    throw new Error("That study bundle's manifest.json is not valid JSON.");
  }
  if (!manifest || typeof manifest !== "object") throw new Error("That study bundle's manifest.json is not an object.");
  if (Number(manifest.schema) !== BUNDLE_SCHEMA) {
    throw new Error(`This study bundle uses schema ${str(manifest.schema) || "(missing)"}; this plugin reads schema ${BUNDLE_SCHEMA}.`);
  }
  if (str(manifest.plugin) !== "mcq-tracker") throw new Error("That ZIP is not an MCQ Tracker study bundle.");
  const notes = manifest.notes;
  if (!notes || typeof notes !== "object" || !Array.isArray(notes.questions) || !Array.isArray(notes.cards)) {
    throw new Error("That study bundle's manifest has no note list.");
  }
  if (notes.questions.length + notes.cards.length > MAX_NOTES) {
    throw new Error("That study bundle has too many notes to import in one go.");
  }

  const read = (kind, list) => {
    const out = [];
    const invalid = [];
    for (const record of list) {
      const source = str(record && record.source);
      const entry = str(record && (record.path || record.entry));
      if (!entry || entry.startsWith("/") || entry.split("/").some((part) => part === "..") || !entry.startsWith(`${kind}/`)) {
        invalid.push({ kind, source, entry, reason: "unsafe archive path" });
        continue;
      }
      const data = entries.get(entry);
      if (!data) {
        invalid.push({ kind, source, entry, reason: "the note is missing from the archive" });
        continue;
      }
      out.push({ kind, source, entry, text: data.toString("utf8") });
    }
    return { out, invalid };
  };
  const questions = read("questions", notes.questions);
  const cards = read("cards", notes.cards);
  return {
    manifest,
    questions: questions.out,
    cards: cards.out,
    invalid: [...questions.invalid, ...cards.invalid],
  };
}

/**
 * Decide what to create without touching the vault.
 * `readExisting(path)` is async and returns the note text, or null when absent.
 */
async function planStudyBundleRestore(bundle, options) {
  const opts = options || {};
  const readExisting = typeof opts.readExisting === "function" ? opts.readExisting : async () => null;
  const folders = opts.folders || {};
  const cardsEnabled = opts.cardsEnabled !== false;
  const creates = [];
  const identical = [];
  const conflicts = [];
  const invalid = Array.isArray(bundle.invalid) ? [...bundle.invalid] : [];
  let cardsSkipped = 0;
  const targets = new Map();

  const groups = [
    { kind: "questions", list: bundle.questions, folder: str(folders.questions).trim() || "Questions" },
    { kind: "cards", list: bundle.cards, folder: str(folders.cards).trim() || "Cards" },
  ];
  for (const group of groups) {
    if (group.kind === "cards" && !cardsEnabled) {
      cardsSkipped += group.list.length;
      continue;
    }
    for (const note of group.list) {
      const target = restorePath(note, group.folder);
      if (!target) {
        invalid.push({ kind: group.kind, source: note.source, entry: note.entry, reason: "unsafe note path" });
        continue;
      }
      const key = target.toLowerCase();
      const seen = targets.get(key);
      if (seen) {
        if (seen.text !== note.text) {
          invalid.push({ kind: group.kind, source: note.source, entry: note.entry, path: target, reason: "two bundle notes map to the same vault path" });
        } else {
          identical.push({ kind: group.kind, path: target, reason: "repeated inside the bundle" });
        }
        continue;
      }
      targets.set(key, note);
      const existing = await readExisting(target);
      if (existing === null || existing === undefined) creates.push({ kind: group.kind, path: target, text: note.text });
      else if (existing === note.text) identical.push({ kind: group.kind, path: target, reason: "identical note already exists" });
      else conflicts.push({ kind: group.kind, path: target, reason: "a different note already exists" });
    }
  }
  return { creates, identical, conflicts, invalid, cardsSkipped };
}

module.exports = {
  cleanRestorePath,
  parseStudyBundle,
  planStudyBundleRestore,
  restorePath,
};
