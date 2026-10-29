"use strict";
const { addDays, fmtDate, fmtDateTime, fmtDateTimeSec, str } = require("./util");
const { appendHistory, hasAttemptId, setAttemptErrorType } = require("./history");
const { DEFAULT_SETTINGS, TRACKING_DEFAULTS } = require("./constants");
const { reviewNote } = require("./fsrs");
const { gradeAnswerDetailed } = require("./numeric-grading");
const { formatChoiceSet, isTrueFalseChoices, normalizeTrueFalse, parseChoiceSet } = require("./answer-types");

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

/** A select-all key written in the Answer section, such as "Answers: A, C" or "Answer: B and D". */
function answerSetFromSection(text) {
  const re = /(?:correct\s+)?answers?\s*(?:is|are|:|=|-|–|—)\s*[*_`(]*\s*([A-H](?:\s*(?:,|\/|&|\band\b)\s*[A-H])+)/i;
  const m = str(text).match(re);
  if (!m) return "";
  return formatChoiceSet(parseChoiceSet(m[1]));
}

/** A true/false key written in the Answer section, such as "Correct Answer: False". */
function answerTrueFalseFromSection(text) {
  const re = /(?:correct\s+)?answer\s*(?:is|:|=|-|–|—)\s*[*_`(]*\s*(true|false|t|f|yes|no)\b/i;
  const m = str(text).match(re);
  return m ? normalizeTrueFalse(m[1]) : "";
}

/** Read the key from properties first (several common names), then the note's own answer section, then the whole body. */
function findAnswerKey(fm, sections) {
  for (const k of ["answer", "correct_answer", "correct", "answer_key", "key"]) {
    const raw = str(fm[k]).trim();
    if (!raw) continue;
    // A set stays whole; the single-letter reader below would cut "A, C" to "A".
    if (parseChoiceSet(raw).length > 1) return formatChoiceSet(parseChoiceSet(raw));
    const m = raw.match(/^\(?(?:choice\s+|option\s+)?([A-Ha-h])\)?(?:[.):\s]|$)/i);
    if (m && sections.choices.length) return m[1].toUpperCase();
    if (m && raw.length <= 3) return m[1].toUpperCase();
    return raw;
  }
  const set = answerSetFromSection(sections.answer) || answerSetFromSection(sections.body);
  if (set) return set;
  const tf = answerTrueFalseFromSection(sections.answer) || answerTrueFalseFromSection(sections.body);
  if (tf) return tf;
  return answerFromSection(sections.answer) || answerFromSection(sections.body);
}

/** Decide how to present/grade a note even when question_type is free text like "Multiple choice (4 choices)". */
function inferMode(declared, key, choices) {
  const d = str(declared).toLowerCase();
  const list = Array.isArray(choices) ? choices : [];
  if (!key) return "self";
  const letter = /^[A-H]$/i.test(str(key).trim());
  if (/spr|student.?produced|grid.?in|free.?response|short.?answer|numeric|fill/.test(d)) return "spr";
  if (/select.?all|sata|multi(?:ple)?[ _-]?select|multi.?answer|checkbox/.test(d)) return "multi";
  if (/true[ _-]?false|boolean|(^|\W)tf(\W|$)/.test(d)) return "tf";
  if (/mcq|multiple|choice|select/.test(d)) return parseChoiceSet(key).length > 1 ? "multi" : letter ? "mcq" : "self";
  if (parseChoiceSet(key).length > 1) return "multi";
  if (isTrueFalseChoices(list) || normalizeTrueFalse(key, list)) return "tf";
  if (letter) return "mcq";
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
  const result = gradeAnswerDetailed(fm, chosen);
  return result ? result.correct : null;
}

/** Removes a cap from an earlier attempt when this review is no longer compressed. */
function clearExamCap(fm) {
  if ("exam_cap" in fm) delete fm.exam_cap;
  if ("exam_cap_name" in fm) delete fm.exam_cap_name;
  if ("exam_cap_exam_date" in fm) delete fm.exam_cap_exam_date;
}

/**
 * Never extends an interval. If the scheduler put the next review after the
 * exam, move it to the cap date and record why so later reviews can show it.
 */
function applyExamCap(fm, nextReview, examCap, now) {
  const scheduled = str(nextReview).trim();
  const capDate = str(examCap && examCap.date).trim().slice(0, 10);
  const today = fmtDate(now);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(capDate) && (!today || capDate >= today);
  if (!valid || !scheduled || scheduled <= capDate) {
    clearExamCap(fm);
    return null;
  }
  fm.exam_cap = capDate;
  fm.exam_cap_name = str(examCap.name || "Exam").slice(0, 200);
  if (examCap.examDate) fm.exam_cap_exam_date = str(examCap.examDate).slice(0, 10);
  return { date: capDate, examDate: str(examCap.examDate).slice(0, 10), name: fm.exam_cap_name };
}

/** Mutates `fm` (inside processFrontMatter). Returns a summary. */
function applyAttempt(fm, a, intervals, options) {
  const opts = options || {};
  const attemptId = str(opts.attemptId).trim();
  // A sync conflict or an offline retry can hand us the same id twice. Do not
  // increment counters or append a second row for an attempt we already have.
  if (attemptId && hasAttemptId(fm.history, attemptId)) {
    return {
      duplicate: true,
      streak: Number(fm.streak) || 0,
      attempts: Number(fm.attempts) || 0,
      correctCount: Number(fm.correct_count) || 0,
      nextReview: str(fm.next_review),
      examCap: null,
      target: Number(fm.target_seconds) || 0,
      scheduler: fm.scheduler === "fsrs" ? "fsrs" : "ladder",
      fsrsRating: 0,
      fsrsDays: 0,
      fsrsReplayed: 0,
      fsrsError: "",
      grade: "",
      verdict: "",
      typedAnswer: "",
      verdictOverride: false,
      attemptId,
    };
  }
  if (attemptId) fm.last_attempt_id = attemptId;
  const iv = intervals && intervals.length ? intervals : DEFAULT_SETTINGS.intervals;
  const prev = Number(fm.streak) || 0;
  // Cards rate themselves explicitly. Hard keeps the current rung without
  // advancing it; Easy jumps one rung past Good.
  const grade = ["again", "hard", "good", "easy"].includes(str(opts.grade || a.grade).toLowerCase())
    ? str(opts.grade || a.grade).toLowerCase()
    : "";
  const streak = grade
    ? grade === "again"
      ? 0
      : grade === "hard"
        ? prev
        : prev + 1
    : a.correct
      ? a.conf === 1
        ? prev
        : prev + 1
      : 0;
  let days;
  if (grade) {
    if (grade === "again") days = 1;
    else if (grade === "hard") days = 2;
    else if (grade === "easy") days = iv[Math.min(Math.max(streak, 1), iv.length - 1)];
    else days = iv[Math.min(Math.max(streak, 1) - 1, iv.length - 1)];
  } else if (!a.correct) days = 1;
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
  const when = fmtDateTimeSec(a.now);
  const chosen = str(a.chosen).replace(/[|\n\r]/g, "/");
  const variant = str(a.variant).replace(/[|\n\r]/g, "/").slice(0, 500);
  // date|result|seconds|answer|confidence|error_type|attempt_id|variant
  // The variant field is optional; older rows and readers stop at the id.
  const row = `${when}|${a.correct ? "correct" : "incorrect"}|${a.seconds}|${chosen}|${a.conf}||${attemptId}${variant ? `|${variant}` : ""}`;
  fm.history = appendHistory(fm.history, row, attemptId);
  if (variant) fm.last_variant = variant;
  if (a.variantSeed !== undefined && Number.isFinite(Number(a.variantSeed))) fm.variant_seed = Number(a.variantSeed);

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
  const scheduledReview = fsrsReview ? fsrsReview.nextReview : fmtDate(addDays(a.now, days));
  const examCap = applyExamCap(fm, scheduledReview, opts.examCap, a.now);
  fm.next_review = examCap ? examCap.date : scheduledReview;
  if (fsrsReview) {
    fm.srs = fsrsReview.srs;
    fm.scheduler = "fsrs";
  } else if (fm.srs) {
    // Switching back to the ladder is lossless: keep the FSRS state for later.
    fm.scheduler = "ladder";
  }
  if (grade) fm.last_card_rating = grade;
  if (a.typedAnswer !== undefined) fm.last_typed_answer = str(a.typedAnswer).slice(0, 1000);
  if (a.verdict) {
    fm.last_verdict = str(a.verdict).toLowerCase();
    fm.verdict_override = a.verdictOverride === true;
    fm.graded_by = str(a.gradedBy || "deterministic");
    fm.graded_on = fmtDate(a.now);
    fm.grade_status = a.gradeStatus === "self" ? "self" : "graded";
    const confidence = Number(a.gradeConfidence);
    if (Number.isFinite(confidence)) fm.grade_confidence = Math.max(0, Math.min(1, confidence));
    if (a.gradeFeedback) fm.grade_feedback = str(a.gradeFeedback).slice(0, 500);
  }

  return {
    streak,
    attempts: fm.attempts,
    correctCount: fm.correct_count,
    nextReview: fm.next_review,
    examCap,
    target: Number(fm.target_seconds) || 0,
    scheduler: fsrsReview ? "fsrs" : "ladder",
    fsrsRating: fsrsReview ? fsrsReview.rating : 0,
    fsrsDays: fsrsReview ? fsrsReview.days : 0,
    fsrsReplayed: fsrsReview ? fsrsReview.replayed : 0,
    fsrsError,
    grade,
    verdict: a.verdict || "",
    typedAnswer: a.typedAnswer === undefined ? "" : str(a.typedAnswer),
    verdictOverride: a.verdictOverride === true,
    attemptId: opts.attemptId || "",
  };
}

/** A deliberate "don't know" is not a wrong answer: keep counters, log the skip, and pull the next review forward. */
function applySkip(fm, now, attemptId) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const id = str(attemptId).trim();
  const when = fmtDateTimeSec(at);
  const row = `${when}|skipped|0||||${id}`;
  fm.history = appendHistory(fm.history, row, id);
  fm.skip_count = (Number(fm.skip_count) || 0) + 1;
  fm.last_skipped = fmtDate(at);
  const tomorrow = fmtDate(addDays(at, 1));
  const current = str(fm.next_review).slice(0, 10);
  if (!current || current > tomorrow) fm.next_review = tomorrow;
  if (id) fm.last_attempt_id = id;
  return { skipped: true, nextReview: str(fm.next_review), skippedCount: fm.skip_count, attemptId: id };
}

function setLastErrorType(fm, type) {
  fm.history = setAttemptErrorType(fm.history, "", type);
  fm.last_error_type = type;
}

/** Tag one specific attempt, so an offline retry labels the right history row. */
function setAttemptError(fm, attemptId, type) {
  fm.history = setAttemptErrorType(fm.history, attemptId, type);
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
  answerSetFromSection,
  answerTrueFalseFromSection,
  findAnswerKey,
  inferMode,
  replaceMyNotes,
  gradeAnswer,
  applyAttempt,
  applySkip,
  setLastErrorType,
  setAttemptError,
  fillDefaults,
};
