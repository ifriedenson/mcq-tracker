"use strict";
/*
 * CSV export for practice results and attempt history.
 *
 * This is deliberately a plain CSV writer, with no spreadsheet or CSV
 * dependency. It is for analysis outside Obsidian; all values come from the
 * note properties already stored in the vault.
 */
const { str } = require("./util");
const { parseHistory } = require("./stats");
const { isDue } = require("./filters");
const { sourceOf } = require("./provenance");

const SUMMARY_COLUMNS = [
  "kind",
  "id",
  "path",
  "deck",
  "course",
  "test",
  "section",
  "domain",
  "skill",
  "unit",
  "difficulty",
  "attempts",
  "correct_count",
  "accuracy",
  "accuracy_percent",
  "time_spent_seconds",
  "average_seconds",
  "streak",
  "last_result",
  "last_date",
  "next_review",
  "last_confidence",
  "last_error_type",
  "flagged",
  "study_status",
  "due",
  "source",
  "source_link",
];

const ATTEMPT_COLUMNS = [
  "kind",
  "id",
  "path",
  "deck",
  "course",
  "attempt",
  "when",
  "result",
  "seconds",
  "answer",
  "confidence",
  "error_type",
];

/** A field that starts with a spreadsheet formula marker is neutralised, not executed. */
function csvCell(value) {
  let s = str(value);
  if (/^[=+@\t\r]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells) {
  return cells.map(csvCell).join(",");
}

function csvText(columns, rows) {
  return [csvLine(columns), ...rows.map(csvLine)].join("\n") + "\n";
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function rounded(value, digits) {
  const factor = 10 ** (digits === undefined ? 2 : digits);
  return Math.round(value * factor) / factor;
}

function resultRow(item, kind, today) {
  const fm = (item && item.fm) || {};
  const attempts = Math.max(0, Math.round(number(fm.attempts)));
  const correct = Math.min(attempts, Math.max(0, Math.round(number(fm.correct_count))));
  const seconds = Math.max(0, Math.round(number(fm.time_spent_total)));
  const source = sourceOf(fm);
  return {
    kind,
    id: str(kind === "card" ? fm.card_id : fm.question_id),
    path: item && item.file ? item.file.path : "",
    deck: str(item && item.deck !== undefined ? item.deck : fm.deck),
    course: str(item && item.course !== undefined ? item.course : fm.course),
    test: str(fm.test),
    section: str(fm.section),
    domain: str(fm.domain),
    skill: str(fm.skill),
    unit: str(fm.unit),
    difficulty: str(fm.difficulty),
    attempts: String(attempts),
    correct_count: String(correct),
    accuracy: attempts ? String(rounded(correct / attempts, 4)) : "",
    accuracy_percent: attempts ? String(rounded((correct / attempts) * 100, 1)) : "",
    time_spent_seconds: String(seconds),
    average_seconds: attempts ? String(rounded(seconds / attempts, 1)) : "",
    streak: String(Math.round(number(fm.streak))),
    last_result: str(fm.result),
    last_date: str(fm["date attempted"]),
    next_review: str(fm.next_review).slice(0, 10),
    last_confidence: str(fm.last_confidence),
    last_error_type: str(fm.last_error_type),
    flagged: fm.flagged === true ? "true" : "false",
    study_status: str(fm.study_status),
    due: isDue(fm, today) ? "true" : "false",
    source: source.label || str(fm.source),
    source_link: source.link,
  };
}

function attemptRows(item, kind) {
  const fm = (item && item.fm) || {};
  const id = str(kind === "card" ? fm.card_id : fm.question_id);
  const path = item && item.file ? item.file.path : "";
  const deck = str(item && item.deck !== undefined ? item.deck : fm.deck);
  const course = str(item && item.course !== undefined ? item.course : fm.course);
  return parseHistory(fm.history).map((entry, index) => ({
    kind,
    id,
    path,
    deck,
    course,
    attempt: String(index + 1),
    when: entry.when,
    result: entry.result,
    seconds: String(entry.seconds),
    answer: entry.answer,
    confidence: entry.conf,
    error_type: entry.error,
  }));
}

function orderedRows(rows, columns) {
  return rows.map((row) => columns.map((column) => row[column] === undefined ? "" : row[column]));
}

/** Summary of every question and card, one row per note. */
function buildResultsCsv(questions, cards, options) {
  const opts = options || {};
  const today = str(opts.today).slice(0, 10);
  const rows = [
    ...(Array.isArray(questions) ? questions : []).map((item) => resultRow(item, "question", today)),
    ...(Array.isArray(cards) ? cards : []).map((item) => resultRow(item, "card", today)),
  ].sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path, undefined, { numeric: true }));
  return { columns: SUMMARY_COLUMNS.slice(), rows, text: csvText(SUMMARY_COLUMNS, orderedRows(rows, SUMMARY_COLUMNS)) };
}

/** One row per stored attempt, for retention curves and time-series work. */
function buildAttemptsCsv(questions, cards, options) {
  const rows = [
    ...(Array.isArray(questions) ? questions : []).flatMap((item) => attemptRows(item, "question")),
    ...(Array.isArray(cards) ? cards : []).flatMap((item) => attemptRows(item, "card")),
  ].sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path, undefined, { numeric: true }) || a.attempt.localeCompare(b.attempt, undefined, { numeric: true }));
  return { columns: ATTEMPT_COLUMNS.slice(), rows, text: csvText(ATTEMPT_COLUMNS, orderedRows(rows, ATTEMPT_COLUMNS)) };
}

const safeDay = (date) => {
  const value = str(date).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "export";
};

function resultFileNames(date) {
  const day = safeDay(date);
  return {
    summary: `mcq-results-${day}.csv`,
    attempts: `mcq-attempts-${day}.csv`,
  };
}

module.exports = {
  SUMMARY_COLUMNS,
  ATTEMPT_COLUMNS,
  buildAttemptsCsv,
  buildResultsCsv,
  csvCell,
  csvLine,
  csvText,
  resultFileNames,
};
