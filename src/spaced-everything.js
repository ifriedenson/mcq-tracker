"use strict";
/*
 * Spaced Everything: whole-note SuperMemo 2 review.
 *
 * This is an optional mode for the existing whole-note review queue. It stores
 * scheduling in readable `se-*` frontmatter and never writes question/card
 * tracking fields. Clean-room implementation of the published SM-2 formula.
 */
const { fmtDate, str } = require("./util");
const { isNoteCandidate } = require("./note-review");
const { isStudyable } = require("./study-status");

const DEFAULT_SPACED_EVERYTHING = {
  enabled: false,
  defaultInterval: 1,
  defaultEase: 2.5,
  captureFolder: "",
  titleTemplate: "Inbox {{date}} {{time}}",
  noteTemplate: "## Captured thought\n{{thought}}",
};

const SPACED_RATINGS = [
  { id: "fruitful", label: "Fruitful", score: 1, description: "Good progress; bring it back soon." },
  { id: "unfruitful", label: "Unfruitful", score: 5, description: "Limited progress; space it out further." },
  { id: "ignore", label: "Ignore", score: 3, description: "A normal review; keep the current pace." },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function round4(value) {
  return Number(Number(value).toFixed(4));
}

function normalizeSpacedEverything(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: src.enabled === true,
    defaultInterval: clampNumber(src.defaultInterval, 1, 3650, DEFAULT_SPACED_EVERYTHING.defaultInterval),
    defaultEase: clampNumber(src.defaultEase, 1.3, 5, DEFAULT_SPACED_EVERYTHING.defaultEase),
    captureFolder: str(src.captureFolder).trim().replace(/^\/+|\/+$/g, ""),
    titleTemplate: str(src.titleTemplate).trim() || DEFAULT_SPACED_EVERYTHING.titleTemplate,
    noteTemplate: str(src.noteTemplate) || DEFAULT_SPACED_EVERYTHING.noteTemplate,
  };
}

function ratingFor(value) {
  const id = str(value).trim().toLowerCase();
  return SPACED_RATINGS.find((rating) => rating.id === id) || null;
}

/** The published SuperMemo 2 formula, using the writing-practice score labels. */
function superMemoSchedule(input) {
  const score = clampNumber(input && input.reviewScore, 0, 5, 3);
  const previousInterval = clampNumber(input && input.interval, 0, 36500, 1);
  const previousEase = clampNumber(input && input.easeFactor, 1.3, 10, DEFAULT_SPACED_EVERYTHING.defaultEase);
  const adjustment = 0.1 - (5 - score) * (0.08 + (5 - score) * 0.02);
  const ease = Math.max(1.3, round4(previousEase + adjustment));
  const interval = score < 3 ? 1 : round4(Math.max(1, previousInterval * ease));
  return { interval, easeFactor: ease };
}

function parseTimestamp(value) {
  const text = str(value).trim();
  if (!text) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text) ? `${text}Z` : text;
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(now) {
  const date = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hasSpacedState(fm) {
  return !!fm && Object.prototype.hasOwnProperty.call(fm, "se-interval");
}

function spacedState(fm, config) {
  const cfg = normalizeSpacedEverything(config);
  const rawInterval = Number(fm && fm["se-interval"]);
  const rawEase = Number(fm && fm["se-ease"]);
  const interval = Number.isFinite(rawInterval) && rawInterval > 0 ? Math.min(36500, rawInterval) : cfg.defaultInterval;
  const ease = Number.isFinite(rawEase) && rawEase >= 1.3 ? Math.min(10, rawEase) : cfg.defaultEase;
  const lastReviewed = parseTimestamp(fm && fm["se-last-reviewed"]);
  return { interval, easeFactor: ease, lastReviewed, onboarded: hasSpacedState(fm) };
}

/** Due at the last review + interval; an onboarded note with no timestamp is due now. */
function spacedDueAt(fm, config) {
  if (!hasSpacedState(fm)) return null;
  const state = spacedState(fm, config);
  if (!state.lastReviewed) return 0;
  return state.lastReviewed.getTime() + state.interval * DAY_MS;
}

function spacedDueDate(fm, config) {
  const dueAt = spacedDueAt(fm, config);
  return dueAt === null ? "" : fmtDate(new Date(dueAt));
}

/**
 * Due notes from the same candidate set used by whole-note review. Spaced notes
 * opt in with `se-interval`; question and card notes are still excluded.
 */
function buildSpacedQueue(notes, options) {
  const opts = options || {};
  const config = normalizeSpacedEverything(opts.config);
  const now = opts.now instanceof Date && !isNaN(opts.now.getTime()) ? opts.now : new Date();
  const allowed = Array.isArray(opts.files) ? new Set(opts.files.map((file) => str(file && file.path))) : null;
  const includeUnonboarded = opts.includeUnonboarded === true;
  const rows = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    if (!isNoteCandidate(note)) continue;
    const path = note.file.path;
    if (allowed && !allowed.has(path)) continue;
    const onboarded = hasSpacedState(note.fm);
    if (!onboarded && !includeUnonboarded) continue;
    if (!isStudyable(note.fm, fmtDate(now))) continue;
    const state = spacedState(note.fm, config);
    const dueAt = onboarded ? spacedDueAt(note.fm, config) : 0;
    if (onboarded && dueAt > now.getTime()) continue;
    rows.push({
      note,
      file: note.file,
      path,
      title: str(note.fm && note.fm.title) || str(note.file.basename) || path.replace(/^.*\//, "").replace(/\.md$/i, ""),
      onboarded,
      interval: state.interval,
      easeFactor: state.easeFactor,
      lastReviewed: state.lastReviewed,
      dueAt,
      dueDate: dueAt ? fmtDate(new Date(dueAt)) : fmtDate(now),
      overdueDays: Math.max(0, Math.floor((now.getTime() - dueAt) / DAY_MS)),
    });
  }
  rows.sort((a, b) => a.dueAt - b.dueAt || a.path.localeCompare(b.path));
  const limit = opts.limit === undefined ? 20 : Math.max(0, Math.round(Number(opts.limit) || 0));
  return {
    items: limit ? rows.slice(0, limit) : [],
    all: rows,
    counts: {
      due: rows.length,
      onboarded: rows.filter((row) => row.onboarded).length,
    },
  };
}

/** Apply one review and return the new state without touching any attempt fields. */
function applySpacedReview(fm, rating, now, config) {
  const selected = ratingFor(rating);
  if (!selected) return null;
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const state = spacedState(fm, config);
  const next = superMemoSchedule({
    interval: state.interval,
    easeFactor: state.easeFactor,
    reviewScore: selected.score,
  });
  const lastReviewed = formatTimestamp(at);
  fm["se-interval"] = next.interval;
  fm["se-ease"] = next.easeFactor;
  fm["se-last-reviewed"] = lastReviewed;
  return {
    rating: selected.id,
    label: selected.label,
    score: selected.score,
    previousInterval: state.interval,
    previousEase: state.easeFactor,
    interval: next.interval,
    easeFactor: next.easeFactor,
    lastReviewed,
    dueAt: at.getTime() + next.interval * DAY_MS,
  };
}

function renderSpacedTemplate(template, thought, now) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const date = fmtDate(at);
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  const unixtime = String(Math.floor(at.getTime() / 1000));
  return str(template)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{unixtime\}\}/g, unixtime)
    .replace(/\{\{thought\}\}/g, str(thought));
}

function spacedCaptureText(thought, now, config) {
  const cfg = normalizeSpacedEverything(config);
  const body = renderSpacedTemplate(cfg.noteTemplate, thought, now);
  return body.includes(str(thought)) || !str(thought) ? body : `${body}\n\n${str(thought)}`;
}

module.exports = {
  DEFAULT_SPACED_EVERYTHING,
  SPACED_RATINGS,
  applySpacedReview,
  buildSpacedQueue,
  formatTimestamp,
  hasSpacedState,
  normalizeSpacedEverything,
  parseTimestamp,
  ratingFor,
  renderSpacedTemplate,
  spacedCaptureText,
  spacedDueAt,
  spacedDueDate,
  spacedState,
  superMemoSchedule,
};
