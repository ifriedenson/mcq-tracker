"use strict";
const { addDays, fmtDate, fmtDateTime, str } = require("./util");
const { DEFAULT_SETTINGS, TRACKING_DEFAULTS } = require("./constants");
const { reviewNote } = require("./fsrs");

const HEAD_ALIASES = {
  stimulus: ["stimulus", "passage", "source", "excerpt", "reading", "text", "figure"],
  question: ["question", "stem", "prompt"],
  choices: ["answer choices", "choices", "options", "answers choices"],
  answer: ["answer", "answer key", "correct answer", "answer and rationale", "solution"],
  notes: ["my notes", "notes"],
};

/** Hard-wrapped blockquotes (one line per paragraph) get re-joined into real paragraphs. */
function tidyStimulus(text) {
  const lines = String(text || "").split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (!nonEmpty.length || nonEmpty.some((l) => !/^\s*>/.test(l))) return text;
  const inner = lines.map((l) => l.replace(/^\s*>\s?/, "").trim());
  const texts = inner.filter(Boolean);
  if (texts.length < 3) return text;
  let seps = 0;
  for (let i = 1; i < inner.length - 1; i++) if (inner[i] === "" && inner[i - 1] && inner[i + 1]) seps++;
  if (seps < texts.length - 2) return text; // only when almost every line sits in its own paragraph
  const maxLen = Math.max(...texts.map((t) => t.length));
  const paras = [];
  let last = "";
  for (const t of texts) {
    const ended = /[.!?:;"”’)\]*_]$/.test(last) || /^!\[\[/.test(last) || /^!\[\[/.test(t);
    const lastShort = last.length < maxLen * 0.75; // a wrapped line runs close to full width; a paragraph's last line falls short
    if (paras.length && !(ended && lastShort)) paras[paras.length - 1] += " " + t;
    else paras.push(t);
    last = t;
  }
  return paras.map((x) => "> " + x).join("\n>\n");
}

function parseSections(text) {
  const norm = String(text).replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n?/, "");
  const raw = {};
  let cur = null;
  for (const line of norm.split("\n")) {
    const m = line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/);
    if (m) {
      cur = m[1].toLowerCase().replace(/[*_`]/g, "").trim();
      if (!raw[cur]) raw[cur] = [];
      continue;
    }
    if (cur) raw[cur].push(line);
  }
  const first = (names) => {
    for (const n of names) if (raw[n] && raw[n].join("\n").trim()) return raw[n].join("\n").trim();
    return "";
  };
  const choiceText = first(HEAD_ALIASES.choices);
  const choices = [];
  for (const line of choiceText.split("\n")) {
    const m = line.match(/^\s*(?:[-*+]\s*)?\**\(?([A-H])\)?[.):]\**\s+(.*)$/);
    if (m) choices.push({ letter: m[1], text: m[2].trim() });
    else if (choices.length && /^\s{2,}\S/.test(line)) choices[choices.length - 1].text += " " + line.trim(); // wrapped choice
  }
  return {
    stimulus: tidyStimulus(first(HEAD_ALIASES.stimulus)),
    question: first(HEAD_ALIASES.question),
    choices,
    answer: first(HEAD_ALIASES.answer),
    notes: first(HEAD_ALIASES.notes),
    body: norm,
  };
}

function extractRationale(answerText) {
  return answerText
    .split("\n")
    .map((l) => l.replace(/^>\s?/, ""))
    .filter((l) => !/^\[!answer\]/i.test(l))
    .join("\n")
    .trim();
}

const KEY_PATTERNS = [
  /correct\s+(?:answer|choice|option|response)\s*(?:is|:|=|-|–|—)?\s*[*_`(\[]*\s*(?:choice|option)?\s*\(?([A-Ha-h])\b/gi,
  /(?:^|\n)[>\s*_-]*answer(?:\s+key)?\s*[*_]*\s*(?:is|:|=|-|–|—)\s*[*_`(\[]*\s*(?:choice|option)?\s*\(?([A-Ha-h])\b/gi,
  /\bthe\s+(?:right|correct)\s+(?:answer|choice)\s+is\s*[*_`(\[]*\(?([A-H])\b/g,
];

/** Pull a letter answer out of free text ("Correct Answer: A", "**Answer:** B", "The correct answer is C"). */
function answerFromSection(text) {
  const t = str(text);
  for (const re of KEY_PATTERNS) {
    for (const m of t.matchAll(re)) {
      // lowercase single letters are usually the word "a" ("the correct answer is a ..."): only accept capitals
      if (m[1] === m[1].toUpperCase()) return m[1];
    }
  }
  return "";
}

/** Read the key from properties first (several common names), then the note's own answer section, then the whole body. */
function findAnswerKey(fm, sections) {
  for (const k of ["answer", "correct_answer", "correct", "answer_key", "key"]) {
    const raw = str(fm[k]).trim();
    if (!raw) continue;
    const m = raw.match(/^\(?(?:choice\s+|option\s+)?([A-Ha-h])\)?(?:[.):\s]|$)/i);
    if (m && sections.choices.length) return m[1].toUpperCase();
    if (m && raw.length <= 3) return m[1].toUpperCase();
    return raw;
  }
  return answerFromSection(sections.answer) || answerFromSection(sections.body);
}

/** Decide how to present/grade a note even when question_type is free text like "Multiple choice (4 choices)". */
function inferMode(declared, key, choices) {
  const d = str(declared).toLowerCase();
  if (!key) return "self";
  const letter = /^[A-H]$/i.test(key);
  if (/spr|student.?produced|grid.?in|free.?response|short.?answer|numeric|fill/.test(d)) return "spr";
  if (/mcq|multiple|choice|select/.test(d)) return letter ? "mcq" : "self";
  if (!d && letter) return "mcq";
  if (letter && choices.length) return "mcq";
  return "self";
}

function replaceMyNotes(data, text) {
  const body = text.trim();
  const re = /(^## My Notes[ \t]*\n)([\s\S]*?)(?=^## |(?![\s\S]))/m;
  if (re.test(data)) {
    return data.replace(re, (_m, head) => `${head}\n${body}${body ? "\n" : ""}\n`);
  }
  return data.replace(/\s*$/, "") + `\n\n## My Notes\n\n${body}\n`;
}

function gradeAnswer(fm, chosen) {
  const key = str(fm.answer).trim();
  const type = fm.question_type || "mcq";
  if (!key) return null;
  if (type === "spr") {
    const norm = (x) => str(x).trim().toLowerCase().replace(/\s+/g, "");
    return key.split("|").map(norm).includes(norm(chosen));
  }
  return str(chosen).toUpperCase() === key.toUpperCase();
}

/** Mutates `fm` (inside processFrontMatter). Returns a summary. */
function applyAttempt(fm, a, intervals, options) {
  const opts = options || {};
  if (opts.attemptId) fm.last_attempt_id = opts.attemptId;
  const iv = intervals && intervals.length ? intervals : DEFAULT_SETTINGS.intervals;
  const prev = Number(fm.streak) || 0;
  const streak = a.correct ? (a.conf === 1 ? prev : prev + 1) : 0;
  let days;
  if (!a.correct) days = 1;
  else if (a.conf === 1) days = 2;
  else days = iv[Math.min(Math.max(streak, 1) - 1, iv.length - 1)];

  // FSRS reads the history before this attempt is appended, so a note that has
  // never used FSRS is seeded from its existing history exactly once.
  let fsrsReview = null;
  let fsrsError = "";
  if (opts.scheduler === "fsrs") {
    try {
      fsrsReview = reviewNote(fm, a, opts.fsrsRetention);
    } catch (e) {
      fsrsError = str(e && e.message);
    }
  }

  const now = fmtDateTime(a.now);
  const chosen = str(a.chosen).replace(/[|\n\r]/g, "/");
  const history = Array.isArray(fm.history) ? fm.history : [];
  // date|result|seconds|answer|confidence|error_type
  history.push(`${now}|${a.correct ? "correct" : "incorrect"}|${a.seconds}|${chosen}|${a.conf}|`);
  fm.history = history;

  fm.attempts = (Number(fm.attempts) || 0) + 1;
  fm.correct_count = (Number(fm.correct_count) || 0) + (a.correct ? 1 : 0);
  fm.streak = streak;
  fm.time_spent_total = (Number(fm.time_spent_total) || 0) + a.seconds;
  fm.last_time_spent = a.seconds;
  fm.last_answer = chosen;
  fm.last_confidence = a.conf;
  fm.last_error_type = "";
  fm.result = a.correct ? "correct" : "incorrect";
  fm["date attempted"] = now;
  if (!fm.first_attempted) fm.first_attempted = now;
  fm.next_review = fsrsReview ? fsrsReview.nextReview : fmtDate(addDays(a.now, days));
  if (fsrsReview) {
    fm.srs = fsrsReview.srs;
    fm.scheduler = "fsrs";
  } else if (fm.srs) {
    // Switching back to the ladder is lossless: keep the FSRS state for later.
    fm.scheduler = "ladder";
  }

  return {
    streak,
    attempts: fm.attempts,
    correctCount: fm.correct_count,
    nextReview: fm.next_review,
    target: Number(fm.target_seconds) || 0,
    scheduler: fsrsReview ? "fsrs" : "ladder",
    fsrsRating: fsrsReview ? fsrsReview.rating : 0,
    fsrsDays: fsrsReview ? fsrsReview.days : 0,
    fsrsReplayed: fsrsReview ? fsrsReview.replayed : 0,
    fsrsError,
    attemptId: opts.attemptId || "",
  };
}

function setLastErrorType(fm, type) {
  const history = Array.isArray(fm.history) ? fm.history : [];
  if (history.length) {
    const parts = str(history[history.length - 1]).split("|");
    while (parts.length < 6) parts.push("");
    parts[5] = type;
    history[history.length - 1] = parts.slice(0, 6).join("|");
    fm.history = history;
  }
  fm.last_error_type = type;
}

function fillDefaults(fm) {
  let n = 0;
  for (const [k, v] of Object.entries(TRACKING_DEFAULTS)) {
    if (!(k in fm)) {
      fm[k] = Array.isArray(v) ? [] : v;
      n++;
    }
  }
  return n;
}

module.exports = {
  HEAD_ALIASES,
  tidyStimulus,
  parseSections,
  extractRationale,
  KEY_PATTERNS,
  answerFromSection,
  findAnswerKey,
  inferMode,
  replaceMyNotes,
  gradeAnswer,
  applyAttempt,
  setLastErrorType,
  fillDefaults,
};
