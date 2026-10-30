"use strict";
/*
 * Simple Note Quiz: turn an ordinary note into a self-marked quiz.
 *
 * A question is a line ending in the configured marker (default `?`). Its
 * answer is the following group of lines. Marks are visible at the end of the
 * question line as a check or cross; no scheduler state or question frontmatter
 * is touched. This is the note-level counterpart to the `quiz` blocks, not a
 * second question bank.
 */
const { str } = require("./util");

const SIMPLE_NOTE_QUIZ_MODES = ["all", "unmarked", "unknown"];
const SIMPLE_NOTE_QUIZ_SEPARATORS = ["blank", "bullet"];
const SIMPLE_NOTE_QUIZ_MARKS = { known: "✅", unknown: "❌" };
const SIMPLE_NOTE_QUIZ_MAX_QUESTIONS = 300;
const DEFAULT_SIMPLE_NOTE_QUIZ = {
  questionMark: "?",
  separator: "blank",
  shuffle: false,
};

function normalizeSimpleNoteQuiz(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const requestedMark = str(src.questionMark).trim();
  const questionMark = requestedMark && requestedMark.length <= 16 ? requestedMark : DEFAULT_SIMPLE_NOTE_QUIZ.questionMark;
  const separator = SIMPLE_NOTE_QUIZ_SEPARATORS.includes(src.separator)
    ? src.separator
    : DEFAULT_SIMPLE_NOTE_QUIZ.separator;
  return {
    questionMark,
    separator,
    shuffle: src.shuffle === true,
  };
}

function stripSimpleNoteQuizMarks(line) {
  let text = str(line);
  let previous;
  do {
    previous = text;
    text = text.replace(/\s*(?:✅|❌)\s*$/u, "");
  } while (text !== previous);
  return text;
}

function simpleNoteQuizMark(line) {
  const text = str(line).replace(/\s+$/u, "");
  if (text.endsWith(SIMPLE_NOTE_QUIZ_MARKS.known)) return "known";
  if (text.endsWith(SIMPLE_NOTE_QUIZ_MARKS.unknown)) return "unknown";
  return "";
}

function isQuestionLine(line, questionMark) {
  return stripSimpleNoteQuizMarks(line).trimEnd().endsWith(questionMark);
}

function dedentAnswer(lines) {
  const list = (Array.isArray(lines) ? lines : []).map((line) => str(line).replace(/\s+$/u, ""));
  const nonblank = list.filter((line) => line.trim());
  if (!nonblank.length) return "";
  const indent = Math.min(...nonblank.map((line) => (line.match(/^\s*/) || [""])[0].length));
  return list
    .map((line) => line.slice(Math.min(indent, line.length)))
    .join("\n")
    .replace(/^\s*\n|\n\s*$/g, "")
    .trimEnd();
}

/**
 * Parse a note into questions and answers. Fenced code and YAML frontmatter are
 * ignored so a note can show syntax examples without turning them into cards.
 */
function parseSimpleNoteQuiz(text, options) {
  const opts = normalizeSimpleNoteQuiz(options);
  const source = str(text);
  const lines = source.split(/\r?\n/);
  const questions = [];
  const issues = [];
  let inFrontmatter = lines.length > 0 && lines[0].trim() === "---";
  let fence = "";

  const questionAt = (index) => {
    const line = lines[index];
    if (line === undefined || !line.trim() || !isQuestionLine(line, opts.questionMark)) return null;
    const mark = simpleNoteQuizMark(line);
    const question = stripSimpleNoteQuizMarks(line).trim();
    return question ? { lineIndex: index, line, question, mark } : null;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    if (inFrontmatter) {
      if (index > 0 && (trimmed === "---" || trimmed === "...")) inFrontmatter = false;
      continue;
    }

    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fence === fenceMatch[1][0]) fence = "";
      continue;
    }
    if (fence) continue;

    const found = questionAt(index);
    if (!found) continue;
    if (questions.length >= SIMPLE_NOTE_QUIZ_MAX_QUESTIONS) {
      issues.push(`Only the first ${SIMPLE_NOTE_QUIZ_MAX_QUESTIONS} questions were loaded.`);
      break;
    }

    let answerEnd = index + 1;
    while (answerEnd < lines.length) {
      if (questionAt(answerEnd)) break;
      if (opts.separator === "blank" && !lines[answerEnd].trim()) break;
      if (opts.separator === "bullet" && /^[-*+]\s+/.test(lines[answerEnd])) break;
      answerEnd++;
    }
    const answer = dedentAnswer(lines.slice(index + 1, answerEnd));
    if (!answer) {
      issues.push(`Line ${index + 1}: “${found.question}” has no answer; skipped.`);
      index = Math.max(index, answerEnd - 1);
      continue;
    }

    questions.push({ ...found, answer });
    index = Math.max(index, answerEnd - 1);
  }

  return {
    questions,
    issues,
    options: opts,
    counts: simpleNoteQuizCounts(questions),
  };
}

function simpleNoteQuizCounts(questions) {
  const list = Array.isArray(questions) ? questions : [];
  return {
    total: list.length,
    known: list.filter((question) => question.mark === "known").length,
    unknown: list.filter((question) => question.mark === "unknown").length,
    unmarked: list.filter((question) => !question.mark).length,
  };
}

/** Select a quiz subset, preserving the original question order unless shuffled. */
function selectSimpleNoteQuizQuestions(questions, mode, options) {
  const wanted = SIMPLE_NOTE_QUIZ_MODES.includes(mode) ? mode : "all";
  const opts = options || {};
  const list = (Array.isArray(questions) ? questions : []).filter((question) => {
    if (wanted === "unmarked") return !question.mark;
    if (wanted === "unknown") return question.mark === "unknown";
    return true;
  });
  if (!opts.shuffle) return list.slice();
  const random = typeof opts.random === "function" ? opts.random : Math.random;
  const shuffled = list.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const value = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = value;
  }
  return shuffled;
}

function lineEol(text) {
  return str(text).includes("\r\n") ? "\r\n" : "\n";
}

function markedLine(line, status) {
  const clean = stripSimpleNoteQuizMarks(line).replace(/\s+$/u, "");
  if (!SIMPLE_NOTE_QUIZ_MARKS[status]) return clean;
  return `${clean} ${SIMPLE_NOTE_QUIZ_MARKS[status]}`;
}

/**
 * Write or clear selected marks. Results carry the parser's lineIndex, so a
 * filtered quiz preserves marks on questions it did not ask.
 */
function applySimpleNoteQuizMarks(text, results) {
  const eol = lineEol(text);
  const lines = str(text).split(/\r?\n/);
  const entries = Array.isArray(results) ? results : [];
  let changed = 0;
  for (const result of entries) {
    const index = Number(result && result.lineIndex);
    if (!Number.isInteger(index) || index < 0 || index >= lines.length) continue;
    const status = result && result.status;
    if (status !== "known" && status !== "unknown") continue;
    const next = markedLine(lines[index], status);
    if (next !== lines[index]) {
      lines[index] = next;
      changed++;
    }
  }
  return { text: lines.join(eol), changed };
}

function clearSimpleNoteQuizMarks(text) {
  const eol = lineEol(text);
  const lines = str(text).split(/\r?\n/);
  let changed = 0;
  for (let index = 0; index < lines.length; index++) {
    if (!simpleNoteQuizMark(lines[index])) continue;
    const next = stripSimpleNoteQuizMarks(lines[index]).replace(/\s+$/u, "");
    if (next !== lines[index]) {
      lines[index] = next;
      changed++;
    }
  }
  return { text: lines.join(eol), changed };
}

module.exports = {
  DEFAULT_SIMPLE_NOTE_QUIZ,
  SIMPLE_NOTE_QUIZ_MARKS,
  SIMPLE_NOTE_QUIZ_MAX_QUESTIONS,
  SIMPLE_NOTE_QUIZ_MODES,
  SIMPLE_NOTE_QUIZ_SEPARATORS,
  applySimpleNoteQuizMarks,
  clearSimpleNoteQuizMarks,
  dedentAnswer,
  isQuestionLine,
  normalizeSimpleNoteQuiz,
  parseSimpleNoteQuiz,
  selectSimpleNoteQuizQuestions,
  simpleNoteQuizCounts,
  simpleNoteQuizMark,
  stripSimpleNoteQuizMarks,
};
