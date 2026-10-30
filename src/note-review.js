"use strict";
/*
 * Whole-note review, built on the same scheduler as questions and cards.
 *
 * A note is reviewable when it matches a note set (folder and/or tag) and is
 * not itself a question or card note. Reviewing it writes the ordinary
 * tracking properties (`history`, `attempts`, `next_review`, `streak`, `srs`)
 * through `applyAttempt`, so the ladder and FSRS behave exactly as elsewhere.
 * `note_review_priority` (high/normal/low) only changes queue order.
 */
const { str } = require("./util");
const { isStudyable } = require("./study-status");

const PRIORITIES = ["high", "normal", "low"];

function normalizePriority(value) {
  const text = str(value).trim().toLowerCase();
  return PRIORITIES.includes(text) ? text : "normal";
}

/** One set per line: Name | folders | tags | priority. Blank fields mean "any". */
function parseNoteSets(text) {
  const sets = [];
  for (const raw of str(text).replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|").map((part) => part.trim());
    const name = parts[0] || `Set ${sets.length + 1}`;
    const folders = (parts[1] || "")
      .split(",")
      .map((value) => value.trim().replace(/^\/+|\/+$/g, ""))
      .filter(Boolean);
    const tags = (parts[2] || "")
      .split(",")
      .map((value) => value.trim().replace(/^#/, ""))
      .filter(Boolean);
    sets.push({ name, folders, tags, priority: normalizePriority(parts[3]) });
  }
  return sets;
}

function formatNoteSets(sets) {
  return (Array.isArray(sets) ? sets : [])
    .map((set) => [set.name, (set.folders || []).join(", "), (set.tags || []).join(", "), normalizePriority(set.priority)].join(" | "))
    .join("\n");
}

function normalizeNoteReview(value) {
  const src = value && typeof value === "object" ? value : {};
  const sets = Array.isArray(src.sets)
    ? src.sets
        .filter((set) => set && typeof set === "object")
        .map((set) => ({
          name: str(set.name).trim() || "Notes",
          folders: (Array.isArray(set.folders) ? set.folders : []).map((folder) => str(folder).trim().replace(/^\/+|\/+$/g, "")).filter(Boolean),
          tags: (Array.isArray(set.tags) ? set.tags : []).map((tag) => str(tag).trim().replace(/^#/, "")).filter(Boolean),
          priority: normalizePriority(set.priority),
        }))
    : [];
  const limit = Math.max(1, Math.min(200, Math.round(Number(src.limit) || 20)));
  return { enabled: src.enabled === true, sets, limit };
}

function tagsOf(fm) {
  const value = fm ? fm.tags : undefined;
  return (Array.isArray(value) ? value : str(value).split(/[,;]+/))
    .map((tag) => str(tag).trim().replace(/^#/, ""))
    .filter(Boolean);
}

function inFolder(path, folders) {
  const list = Array.isArray(folders) ? folders : [];
  if (!list.length) return true;
  const target = str(path).replace(/^\/+/, "");
  return list.some((folder) => target === folder || target.startsWith(`${folder}/`));
}

function matchesNoteSet(note, set) {
  if (!note || !set) return false;
  if (!inFolder(note.file && note.file.path, set.folders)) return false;
  const wanted = Array.isArray(set.tags) ? set.tags : [];
  if (!wanted.length) return true;
  const have = tagsOf(note.fm);
  return wanted.some((tag) => have.includes(tag));
}

/** The first matching set; an explicitly marked note is included when no set matches. */
function noteSetFor(note, sets) {
  for (const set of Array.isArray(sets) ? sets : []) {
    if (matchesNoteSet(note, set)) return set;
  }
  if (!Array.isArray(sets) || !sets.length) {
    if (note && note.fm && note.fm.note_review === true) return { name: "Marked notes", folders: [], tags: [], priority: "normal" };
  }
  return null;
}

function isNoteCandidate(note) {
  const fm = (note && note.fm) || {};
  const path = str(note && note.file && note.file.path);
  if (!path || !/\.md$/i.test(path)) return false;
  if (str(fm.question_id).trim() || str(fm.card_id).trim() || str(fm.card_type).trim()) return false;
  if (/^(flashcard|vocab|vocabulary)$/i.test(str(fm.type).trim())) return false;
  return true;
}

function notePriority(note, set) {
  return normalizePriority((note && note.fm && note.fm.note_review_priority) || (set && set.priority));
}

function noteDueDate(fm) {
  return str(fm && fm.next_review).slice(0, 10);
}

/**
 * Due/new whole notes, ordered by priority, then due date, then path.
 * `sets` is the configured list; an empty list falls back to `note_review: true`.
 */
function buildNoteQueue(notes, options) {
  const opts = options || {};
  const today = str(opts.today);
  const sets = Array.isArray(opts.sets) ? opts.sets : [];
  const rows = [];
  const setCounts = new Map();
  for (const note of Array.isArray(notes) ? notes : []) {
    if (!isNoteCandidate(note)) continue;
    const set = noteSetFor(note, sets);
    if (!set) continue;
    const fm = note.fm || {};
    if (!isStudyable(fm, today)) continue;
    const isNew = !Number(fm.attempts);
    const dueDate = noteDueDate(fm);
    if (!isNew && (!dueDate || dueDate > today)) continue;
    const row = {
      note,
      file: note.file,
      path: note.file.path,
      title: str(fm.title || note.file.basename || note.file.path.replace(/^.*\//, "").replace(/\.md$/i, "")),
      set: set.name,
      priority: notePriority(note, set),
      isNew,
      dueDate,
    };
    rows.push(row);
    setCounts.set(set.name, (setCounts.get(set.name) || 0) + 1);
  }
  const rank = { high: 0, normal: 1, low: 2 };
  rows.sort((a, b) => {
    if (a.priority !== b.priority) return rank[a.priority] - rank[b.priority];
    if (a.isNew !== b.isNew) return a.isNew ? 1 : -1;
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.path.localeCompare(b.path);
  });
  const limit = opts.limit === undefined ? 20 : Math.max(0, Math.round(Number(opts.limit) || 0));
  return {
    items: limit ? rows.slice(0, limit) : [],
    all: rows,
    counts: {
      due: rows.length,
      new: rows.filter((row) => row.isNew).length,
      sets: [...setCounts.entries()].map(([name, count]) => ({ name, count })),
    },
  };
}

/** Map a four-button rating onto the attempt shape `applyAttempt` already reads. */
function noteReviewAttempt(grade, seconds, now) {
  const value = ["again", "hard", "good", "easy"].includes(str(grade).toLowerCase()) ? str(grade).toLowerCase() : "good";
  const conf = value === "again" ? 0 : value === "hard" ? 1 : value === "easy" ? 3 : 2;
  return {
    grade: value,
    chosen: value,
    correct: value !== "again",
    conf,
    seconds: Math.max(0, Math.round(Number(seconds) || 0)),
    now: now instanceof Date ? now : new Date(),
  };
}

module.exports = {
  PRIORITIES,
  buildNoteQueue,
  formatNoteSets,
  grade: noteReviewAttempt,
  isNoteCandidate,
  matchesNoteSet,
  normalizeNoteReview,
  normalizePriority,
  noteDueDate,
  notePriority,
  noteReviewAttempt,
  noteSetFor,
  parseNoteSets,
  tagsOf,
};
