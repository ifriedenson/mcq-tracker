"use strict";
/*
 * Inline quizzes for ordinary notes.
 *
 * A fenced `mcq-quiz` block is parsed by this module; the plugin renders it in
 * place. The format deliberately mirrors a question note:
 *
 *   pass: 80
 *   imprecise: 60
 *   gated: true
 *   Q: Which gas do plants take in?
 *   A. Oxygen
 *   B. Carbon dioxide
 *   Answer: B
 *   Why: The light reactions use CO2.
 *   ID: Q-123
 *
 * Quizzator-style additions are opt-in per question:
 *
 *   Q: In what year was JavaScript created?
 *   Type: slider
 *   Min: 1980
 *   Max: 2010
 *   Step: 1
 *   Tolerance: 2
 *   Answer: 1995
 *   Weight: 2
 *
 *   Q: What is the capital of France?
 *   Type: text
 *   Answer: Paris
 *   Context: The city, not the country.
 *
 * `gated` hides every question after the current one until the reader answers.
 * Per-option feedback is shown for every choice, not only the picked one.
 */
const { str } = require("./util");
const { formatChoiceSet, parseChoiceSet } = require("./answer-types");

const LETTERS = "ABCDEFGH";
const DEFAULT_PASS = 80;
const DEFAULT_IMPRECISE = 60;

function clean(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function number(value, fallback) {
  const n = Number(clean(value));
  return Number.isFinite(n) ? n : fallback;
}

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

function normalizeQuestionType(value) {
  const text = clean(value).toLowerCase();
  if (/reorder|sequence|chronological/.test(text)) return "reorder";
  if (/numeric(?!\s*[-]?\s*estimate)|number|decimal|integer/.test(text)) return "numeric";
  if (/slider|range|numeric.?estimate/.test(text)) return "slider";
  if (/text|free|short|written|open/.test(text)) return "text";
  return "choice";
}

/** Read an explicit item order from `C, A, B`, `CAB` or an array; duplicates are rejected. */
function resolveOrder(raw, choices) {
  const tokens = Array.isArray(raw)
    ? raw
    : clean(raw).match(/[A-Ha-h]/g) || [];
  const letters = tokens.map((token) => clean(token).toUpperCase()).filter((letter) => /^[A-H]$/.test(letter));
  const available = new Set((choices || []).map((choice) => choice.letter));
  if (letters.length !== (choices || []).length) return "";
  if (new Set(letters).size !== letters.length) return "";
  if (!letters.every((letter) => available.has(letter))) return "";
  return letters.join(", ");
}

function resolveAnswer(raw, choices) {
  const text = clean(raw).replace(/^[*_`"']+|[*_`"']+$/g, "");
  if (!text) return "";
  const byText = choices.findIndex((choice) => clean(choice.text).toLowerCase() === text.toLowerCase());
  if (byText >= 0) return LETTERS[byText];
  const set = parseChoiceSet(text);
  if (set.length && set.every((letter) => LETTERS.indexOf(letter) < choices.length)) return formatChoiceSet(set);
  const single = text.match(/^\(?([A-Ha-h])\)?(?:[.):\s]|$)/);
  if (!single) return "";
  const letter = single[1].toUpperCase();
  return LETTERS.indexOf(letter) < choices.length ? letter : "";
}

function newQuestion() {
  return {
    type: "choice",
    question: "",
    choices: [],
    sharedOptions: false,
    answer: "",
    explanation: "",
    context: "",
    id: "",
    min: 0,
    max: 100,
    minSet: false,
    maxSet: false,
    step: 1,
    tolerance: 0,
    weight: 1,
    issues: [],
  };
}

/**
 * Parse one fenced block. Never throws: malformed questions are returned with
 * an `issues` list so the renderer can explain the problem in place.
 */
function parseQuizBlock(text) {
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  let gated = false;
  let quizId = "";
  let pass = DEFAULT_PASS;
  let imprecise = DEFAULT_IMPRECISE;
  const questions = [];
  const sharedChoices = [];
  let cur = null;
  let last = null;

  const start = () => {
    cur = newQuestion();
    questions.push(cur);
    last = null;
  };
  const append = (key, value, choiceIndex) => {
    if (!cur || !value) return;
    if (key === "choice") cur.choices[choiceIndex].text = `${cur.choices[choiceIndex].text} ${value}`.trim();
    else if (key === "feedback") cur.choices[choiceIndex].feedback = `${cur.choices[choiceIndex].feedback} ${value}`.trim();
    else cur[key] = `${cur[key]} ${value}`.trim();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (/^gated\s*:\s*(true|yes|on)$/i.test(line)) {
      gated = true;
      continue;
    }
    const blockId = line.match(/^(?:(?:quiz[\s-]*)?id)\s*[:=]\s*(.*)$/i);
    if (!cur && blockId) {
      quizId = clean(blockId[1]).slice(0, 120);
      continue;
    }
    const passLine = line.match(/^(?:pass(?:ing)?(?:\s*score)?|min_score_to_pass)\s*[:=]\s*(\d+(?:\.\d+)?)$/i);
    if (!cur && passLine) {
      pass = clampScore(passLine[1]);
      continue;
    }
    const impreciseLine = line.match(/^(?:(?:imprecise|partial|fail(?:ing)?)(?:\s*score)?|min_score_to_fail)\s*[:=]\s*(\d+(?:\.\d+)?)$/i);
    if (!cur && impreciseLine) {
      imprecise = clampScore(impreciseLine[1]);
      continue;
    }
    if (/^---+$/.test(line)) {
      cur = null;
      last = null;
      continue;
    }
    const question = line.match(/^(?:Q|Question)\s*[:.)]\s*(.*)$/i);
    if (question) {
      start();
      cur.question = question[1].trim();
      last = { key: "question" };
      continue;
    }
    const sharedOption = !cur && line.match(/^([A-H])\s*[.):]\s*(.*)$/);
    if (sharedOption) {
      sharedChoices.push({ letter: sharedOption[1].toUpperCase(), text: sharedOption[2].trim(), feedback: "" });
      continue;
    }
    if (!cur) continue;

    const id = line.match(/^(?:ID|Question[\s-]*ID)\s*[:.)]\s*(.*)$/i);
    if (id) {
      cur.id = id[1].trim();
      last = { key: "id" };
      continue;
    }
    const type = line.match(/^(?:Type|Question\s*type)\s*[:.=]\s*(.*)$/i);
    if (type) {
      cur.type = normalizeQuestionType(type[1]);
      last = null;
      continue;
    }
    const field = (name) => line.match(new RegExp(`^${name}\\s*[:=]\\s*(.*)$`, "i"));
    const min = field("Min(?:imum)?");
    const max = field("Max(?:imum)?");
    const step = field("Step");
    const tolerance = field("Tolerance");
    const weight = field("Weight");
    const context = field("Context");
    if (min) {
      cur.min = number(min[1], 0);
      cur.minSet = true;
      last = null;
      continue;
    }
    if (max) {
      cur.max = number(max[1], 100);
      cur.maxSet = true;
      last = null;
      continue;
    }
    if (step) {
      cur.step = number(step[1], 1);
      last = null;
      continue;
    }
    if (tolerance) {
      cur.tolerance = Math.max(0, number(tolerance[1], 0));
      last = null;
      continue;
    }
    if (weight) {
      cur.weight = Math.max(0.01, number(weight[1], 1));
      last = null;
      continue;
    }
    if (context) {
      cur.context = context[1].trim();
      last = { key: "context" };
      continue;
    }
    const option = line.match(/^([A-H])\s*[.):]\s*(.*)$/);
    if (option) {
      cur.choices.push({ letter: option[1].toUpperCase(), text: option[2].trim(), feedback: "" });
      last = { key: "choice", index: cur.choices.length - 1 };
      continue;
    }
    const whyOption = line.match(/^(?:Why|Feedback|Note)\s+([A-H])\s*[:.)]\s*(.*)$/i);
    if (whyOption) {
      const index = cur.choices.findIndex((choice) => choice.letter === whyOption[1].toUpperCase());
      if (index >= 0) {
        cur.choices[index].feedback = whyOption[2].trim();
        last = { key: "feedback", index };
      }
      continue;
    }
    const answer = line.match(/^(?:Answer|Key|Correct(?:\s+answer)?)\s*[:.)]\s*(.*)$/i);
    if (answer) {
      cur.answer = answer[1].trim();
      last = { key: "answer" };
      continue;
    }
    const why = line.match(/^(?:Why|Explanation|Rationale)\s*[:.)]\s*(.*)$/i);
    if (why) {
      cur.explanation = why[1].trim();
      last = { key: "explanation" };
      continue;
    }
    if (!line) continue;
    if (last && last.key === "choice") append("choice", line, last.index);
    else if (last && last.key === "feedback") append("feedback", line, last.index);
    else if (last && ["question", "answer", "explanation", "context"].includes(last.key)) append(last.key, line);
  }

  for (const [index, question] of questions.entries()) {
    question.question = clean(question.question);
    question.explanation = clean(question.explanation);
    question.context = clean(question.context).slice(0, 1000);
    if (!question.choices.length && sharedChoices.length && question.type === "choice") {
      question.choices = sharedChoices.map((choice) => ({ ...choice }));
      question.sharedOptions = true;
    }
    question.choices = question.choices.filter((choice) => clean(choice.text));
    if (!question.question) question.issues.push(`Question ${index + 1} has no text.`);
    if (question.type === "choice") {
      if (question.choices.length < 2) question.issues.push(`Question ${index + 1} needs at least two choices.`);
      if (!question.answer) question.issues.push(`Question ${index + 1} has no Answer line.`);
      else {
        const key = resolveAnswer(question.answer, question.choices);
        if (!key) question.issues.push(`Question ${index + 1}: "${question.answer.slice(0, 30)}" is not one of its choices.`);
        question.answer = key;
      }
    } else if (question.type === "reorder") {
      if (question.choices.length < 2) question.issues.push(`Question ${index + 1} needs at least two items.`);
      if (!question.answer) question.issues.push(`Question ${index + 1} has no Answer line.`);
      else {
        const key = resolveOrder(question.answer, question.choices);
        if (!key) question.issues.push(`Question ${index + 1}: Answer must list every item letter once.`);
        question.answer = key;
      }
    } else if (question.type === "numeric") {
      const answer = number(question.answer, NaN);
      if (!Number.isFinite(answer)) question.issues.push(`Question ${index + 1} needs a numeric Answer.`);
      if (question.minSet && question.maxSet && !(question.min < question.max)) question.issues.push(`Question ${index + 1} needs Min smaller than Max.`);
      if (Number.isFinite(answer) && question.minSet && answer < question.min) question.issues.push(`Question ${index + 1}: the Answer is below Min.`);
      if (Number.isFinite(answer) && question.maxSet && answer > question.max) question.issues.push(`Question ${index + 1}: the Answer is above Max.`);
      question.answer = Number.isFinite(answer) ? String(answer) : "";
    } else if (question.type === "slider") {
      if (!Number.isFinite(number(question.answer, NaN))) question.issues.push(`Question ${index + 1} needs a numeric Answer for its slider.`);
      if (!(question.min < question.max)) question.issues.push(`Question ${index + 1} needs Min smaller than Max.`);
      if (!(question.step > 0)) question.issues.push(`Question ${index + 1} needs a Step greater than 0.`);
      const answer = number(question.answer, NaN);
      if (Number.isFinite(answer) && (answer < question.min || answer > question.max)) {
        question.issues.push(`Question ${index + 1}: the slider Answer is outside Min-Max.`);
      }
      question.answer = Number.isFinite(answer) ? String(answer) : "";
    } else if (!question.answer) {
      question.issues.push(`Question ${index + 1} has no Answer line.`);
    }
    question.pass = pass;
    question.imprecise = imprecise;
    question.valid = question.issues.length === 0;
  }
  return { gated, id: quizId, pass, imprecise, questions };
}

/** Grade one multiple-choice selection and mark every option with its feedback. */
function gradeQuizBlockQuestion(question, selected) {
  const q = question || {};
  const key = parseChoiceSet(q.answer);
  const picked = parseChoiceSet(selected);
  const correct = key.length > 0 && key.length === picked.length && key.every((letter) => picked.includes(letter));
  const options = (Array.isArray(q.choices) ? q.choices : []).map((choice) => ({
    letter: str(choice.letter).toUpperCase(),
    text: str(choice.text),
    correct: key.includes(str(choice.letter).toUpperCase()),
    selected: picked.includes(str(choice.letter).toUpperCase()),
    feedback: str(choice.feedback),
  }));
  return {
    correct,
    score: correct ? 100 : 0,
    mode: "choice",
    type: "choice",
    weight: Number(q.weight) || 1,
    key: key.join(", "),
    selected: picked.join(", "),
    options,
    explanation: str(q.explanation),
    band: correct ? "pass" : "fail",
  };
}

function textAnswer(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[.!?。]+$/g, "")
    .replace(/\s+/g, " ");
}

function gradeSliderQuestion(question, selected) {
  const q = question || {};
  const expected = number(q.answer, NaN);
  const picked = number(selected, NaN);
  const tolerance = Math.max(0, Number(q.tolerance) || 0);
  const correct = Number.isFinite(expected) && Number.isFinite(picked) && Math.abs(picked - expected) <= tolerance;
  return {
    correct,
    score: correct ? 100 : 0,
    mode: "slider",
    type: "slider",
    weight: Number(q.weight) || 1,
    key: String(expected),
    selected: Number.isFinite(picked) ? String(picked) : "",
    explanation: str(q.explanation),
    band: correct ? "pass" : "fail",
  };
}

function gradeTextQuestion(question, selected, aiScore) {
  const q = question || {};
  const score = clampScore(aiScore);
  const exact = textAnswer(q.answer) && textAnswer(selected) === textAnswer(q.answer);
  const finalScore = score === null ? (exact ? 100 : 0) : score;
  return {
    correct: finalScore >= (Number(q.pass) || DEFAULT_PASS),
    score: finalScore,
    mode: "text",
    type: "text",
    weight: Number(q.weight) || 1,
    key: str(q.answer),
    selected: str(selected),
    explanation: str(q.explanation),
    band: bandForScore(finalScore, q.pass, q.imprecise),
  };
}

/** Grade a typed number with an inclusive ± tolerance. */
function gradeNumericQuestion(question, selected) {
  const q = question || {};
  const expected = number(q.answer, NaN);
  const picked = number(selected, NaN);
  const tolerance = Math.max(0, Number(q.tolerance) || 0);
  const correct = Number.isFinite(expected) && Number.isFinite(picked) && Math.abs(picked - expected) <= tolerance;
  return {
    correct,
    score: correct ? 100 : 0,
    mode: "numeric",
    type: "numeric",
    weight: Number(q.weight) || 1,
    key: String(expected),
    selected: Number.isFinite(picked) ? String(picked) : "",
    explanation: str(q.explanation),
    band: correct ? "pass" : "fail",
  };
}

/** Grade an exact sequence of item letters. */
function gradeReorderQuestion(question, selected) {
  const q = question || {};
  const key = resolveOrder(q.answer, q.choices || []);
  const picked = resolveOrder(selected, q.choices || []);
  const correct = !!key && key === picked;
  return {
    correct,
    score: correct ? 100 : 0,
    mode: "reorder",
    type: "reorder",
    weight: Number(q.weight) || 1,
    key,
    selected: picked,
    explanation: str(q.explanation),
    band: correct ? "pass" : "fail",
  };
}

/** Grade one answer. `aiScore` is only used for text questions. */
function gradeQuizQuestion(question, selected, aiScore) {
  if (question && question.type === "reorder") return gradeReorderQuestion(question, selected);
  if (question && question.type === "numeric") return gradeNumericQuestion(question, selected);
  if (question && question.type === "slider") return gradeSliderQuestion(question, selected);
  if (question && question.type === "text") return gradeTextQuestion(question, selected, aiScore);
  return gradeQuizBlockQuestion(question, selected);
}

function bandForScore(score, pass, imprecise) {
  const n = Number(score) || 0;
  const p = Number.isFinite(Number(pass)) ? Number(pass) : DEFAULT_PASS;
  const i = Number.isFinite(Number(imprecise)) ? Number(imprecise) : DEFAULT_IMPRECISE;
  if (n >= p) return "pass";
  if (n >= i) return "imprecise";
  return "fail";
}

/** Gated blocks show one unanswered question at a time; open blocks show all. */
function visibleQuizCount(total, answered, gated) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  if (!gated) return n;
  return Math.min(n, Math.max(0, Math.round(Number(answered) || 0)) + 1);
}

/**
 * Weighted score across the whole block. Unanswered questions contribute zero,
 * so the percentage reflects the complete quiz, while `answered` reports
 * progress. A selection can be a raw answer or a completed grade result.
 */
function quizBlockScore(questions, selections, settings) {
  const list = Array.isArray(questions) ? questions : [];
  const picks = selections && typeof selections === "object" ? selections : {};
  const opts = settings || {};
  const pass = Number(opts.pass);
  const imprecise = Number(opts.imprecise);
  let answered = 0;
  let correct = 0;
  let earned = 0;
  let weight = 0;
  list.forEach((question, index) => {
    if (!question || question.valid === false) return;
    const w = Math.max(0.01, Number(question.weight) || 1);
    weight += w;
    if (!(index in picks)) return;
    answered++;
    const pick = picks[index];
    const grade =
      pick && typeof pick === "object" && Number.isFinite(Number(pick.score))
        ? pick
        : gradeQuizQuestion(question, pick, pick && pick.aiScore);
    earned += (Number(grade.score) || 0) * w;
    if (grade.correct) correct++;
  });
  const percent = weight ? Math.round(earned / weight) : 0;
  return {
    answered,
    correct,
    total: list.length,
    percent,
    band: bandForScore(percent, pass, imprecise),
  };
}

/** Parse a small AI reply for a free-text score. Accepts JSON or a bare score. */
function parseQuizAiEvaluation(text) {
  const raw = str(text).trim();
  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    /* plain text */
  }
  const score = obj && typeof obj === "object" ? obj.score : (raw.match(/(?:score|percent(?:age)?)\D{0,12}(\d{1,3})/i) || [])[1];
  const value = clampScore(score);
  if (value === null) throw new Error("The AI did not return a score from 0 to 100.");
  return {
    score: value,
    explanation: str((obj && (obj.explanation || obj.feedback || obj.reason)) || "").trim().slice(0, 1000),
  };
}

/** The opt-in note property Quizzable-compatible dashboards can read. */
function quizResultProperties(quizId, score) {
  const id = clean(quizId);
  if (!id || !score || typeof score !== "object") return null;
  const totalPoints = Math.max(0, Math.round(Number(score.total) || 0));
  return {
    key: id,
    value: {
      score: Math.max(0, Math.round(Number(score.correct) || 0)),
      totalPoints,
      percentage: Math.max(0, Math.min(100, Math.round(Number(score.percent) || 0))),
      passed: score.band === "pass",
    },
  };
}

module.exports = {
  DEFAULT_IMPRECISE,
  DEFAULT_PASS,
  LETTERS,
  bandForScore,
  gradeQuizBlockQuestion,
  gradeNumericQuestion,
  gradeQuizQuestion,
  gradeReorderQuestion,
  normalizeQuestionType,
  parseQuizAiEvaluation,
  parseQuizBlock,
  quizBlockScore,
  quizResultProperties,
  resolveAnswer,
  resolveOrder,
  visibleQuizCount,
};
