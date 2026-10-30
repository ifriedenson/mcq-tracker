"use strict";
/*
 * Inline quizzes for ordinary notes.
 *
 * A fenced `mcq-quiz` block is parsed by this module; the plugin renders it in
 * place. The format deliberately mirrors a question note:
 *
 *   gated: true
 *   Q: Which gas do plants take in?
 *   A. Oxygen
 *   B. Carbon dioxide
 *   Why A: Oxygen is released, not taken in.
 *   Why B: Photosynthesis consumes carbon dioxide.
 *   Answer: B
 *   Why: The light reactions use CO2.
 *   ID: Q-123          (optional: record the attempt on that question note)
 *
 * `gated` hides every question after the current one until the reader answers.
 * Per-option feedback is shown for every choice, not only the picked one.
 */
const { str } = require("./util");
const { formatChoiceSet, parseChoiceSet } = require("./answer-types");

const LETTERS = "ABCDEFGH";

function clean(value) {
  return str(value).replace(/\s+/g, " ").trim();
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
  return { question: "", choices: [], answer: "", explanation: "", id: "", issues: [] };
}

/**
 * Parse one fenced block. Never throws: malformed questions are returned with
 * an `issues` list so the renderer can explain the problem in place.
 */
function parseQuizBlock(text) {
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  let gated = false;
  const questions = [];
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
    if (!cur) continue;

    const id = line.match(/^(?:ID|Question[\s-]*ID)\s*[:.)]\s*(.*)$/i);
    if (id) {
      cur.id = id[1].trim();
      last = { key: "id" };
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
    else if (last && ["question", "answer", "explanation"].includes(last.key)) append(last.key, line);
  }

  for (const [index, question] of questions.entries()) {
    question.question = clean(question.question);
    question.explanation = clean(question.explanation);
    question.choices = question.choices.filter((choice) => clean(choice.text));
    if (!question.question) question.issues.push(`Question ${index + 1} has no text.`);
    if (question.choices.length < 2) question.issues.push(`Question ${index + 1} needs at least two choices.`);
    if (!question.answer) question.issues.push(`Question ${index + 1} has no Answer line.`);
    else {
      const key = resolveAnswer(question.answer, question.choices);
      if (!key) question.issues.push(`Question ${index + 1}: "${question.answer.slice(0, 30)}" is not one of its choices.`);
      question.answer = key;
    }
    question.valid = question.issues.length === 0;
  }
  return { gated, questions };
}

/** Grade one choice selection and mark every option with its own feedback. */
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
  return { correct, key: key.join(", "), selected: picked.join(", "), options, explanation: str(q.explanation) };
}

/** Gated blocks show one unanswered question at a time; open blocks show all. */
function visibleQuizCount(total, answered, gated) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  if (!gated) return n;
  return Math.min(n, Math.max(0, Math.round(Number(answered) || 0)) + 1);
}

function quizBlockScore(questions, selections) {
  const list = Array.isArray(questions) ? questions : [];
  const picks = selections && typeof selections === "object" ? selections : {};
  let answered = 0;
  let correct = 0;
  list.forEach((question, index) => {
    if (!(index in picks)) return;
    answered++;
    if (gradeQuizBlockQuestion(question, picks[index]).correct) correct++;
  });
  return {
    answered,
    correct,
    total: list.length,
    percent: answered ? Math.round((correct / answered) * 100) : 0,
  };
}

module.exports = {
  LETTERS,
  gradeQuizBlockQuestion,
  parseQuizBlock,
  quizBlockScore,
  resolveAnswer,
  visibleQuizCount,
};
