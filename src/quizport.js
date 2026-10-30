"use strict";
/*
 * QuizPort JSON blocks: a portable, plain-JSON quiz format that also runs on
 * quizport.io. A block can contain the JSON directly:
 *
 *   {
 *     "title": "Capitals",
 *     "questions": [
 *       {
 *         "question": "What is the capital of France?",
 *         "choices": ["London", "Paris", "Berlin"],
 *         "answer": 1,
 *         "hint": "It is on the Seine.",
 *         "explanation": "Paris has been the capital since 987 AD."
 *       }
 *     ]
 *   }
 *
 * or point at a `.json` file in the vault:
 *
 *   file: quizzes/capitals.json
 *   shuffle: true
 *
 * `answer` is a 0-based index, or an array of indexes for multi-select. The
 * player only reads and grades; it never writes attempts, history, streak or
 * scheduler state.
 */
const { str } = require("./util");

const LETTERS = "ABCDEFGH";

function textOf(value) {
  return str(value).replace(/\r\n?/g, "\n").trim();
}

function line(value) {
  return textOf(value).replace(/\s+/g, " ");
}

function emptyResult() {
  return {
    title: "",
    description: "",
    category: "",
    difficulty: "",
    author: "",
    tags: [],
    shuffle: false,
    questions: [],
    issues: [],
  };
}

function normalizeChoices(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          text: line(item.text !== undefined ? item.text : item.label !== undefined ? item.label : item.value),
          correct: item.correct === true,
        };
      }
      return { text: line(item), correct: false };
    })
    .filter((choice) => choice.text);
}

/**
 * Resolve an answer index, an array of indexes, a letter, or the choice text.
 * Indexes are 0-based, matching the QuizPort format.
 */
function answerIndexes(raw, choices) {
  if (raw === undefined || raw === null) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < choices.length) {
      out.push(value);
      continue;
    }
    const text = line(value).replace(/^[*_`"']+|[*_`"']+$/g, "");
    if (!text) continue;
    const byText = choices.findIndex((choice) => choice.text.toLowerCase() === text.toLowerCase());
    if (byText >= 0) {
      out.push(byText);
      continue;
    }
    const letter = text.match(/^\(?([A-Ha-h])\)?$/);
    if (letter) {
      const at = LETTERS.indexOf(letter[1].toUpperCase());
      if (at >= 0 && at < choices.length) out.push(at);
      continue;
    }
    const number = Number(text);
    if (Number.isInteger(number) && number >= 0 && number < choices.length) out.push(number);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function normalizeQuestion(raw, index, issues) {
  const source = raw && typeof raw === "object" ? raw : {};
  const prompt = line(source.question !== undefined ? source.question : source.prompt !== undefined ? source.prompt : source.q);
  const choices = normalizeChoices(source.choices !== undefined ? source.choices : source.options);
  let answers = answerIndexes(source.answer, choices);
  if (!answers.length) {
    const marked = choices.map((choice, at) => (choice.correct ? at : -1)).filter((at) => at >= 0);
    if (marked.length) answers = marked;
  }
  if (!prompt) issues.push(`Question ${index + 1} has no question text.`);
  if (choices.length < 2) issues.push(`Question ${index + 1} needs at least two choices.`);
  if (!answers.length) issues.push(`Question ${index + 1} has no valid answer index.`);
  return {
    prompt,
    choices: choices.map((choice) => ({ text: choice.text })),
    answers,
    hint: textOf(source.hint),
    explanation: textOf(source.explanation),
    multi: answers.length > 1,
    valid: !!prompt && choices.length >= 2 && answers.length > 0,
  };
}

/** Normalize a parsed QuizPort object (or a bare question array). Never throws. */
function parseQuizPortData(data) {
  const result = emptyResult();
  let list = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object" && Array.isArray(data.questions)) {
    list = data.questions;
    result.title = line(data.title);
    result.description = line(data.description);
    result.category = line(data.category);
    result.difficulty = line(data.difficulty);
    result.author = line(data.author);
    result.tags = Array.isArray(data.tags) ? data.tags.map(line).filter(Boolean) : [];
    result.shuffle = data.shuffle === true;
  } else {
    result.issues.push("Add a QuizPort object with a questions array, or a question array.");
    return result;
  }
  if (!list.length) {
    result.issues.push("This QuizPort quiz has no questions.");
    return result;
  }
  list.forEach((raw, index) => {
    result.questions.push(normalizeQuestion(raw, index, result.issues));
  });
  return result;
}

/** Read a fenced `quizport` block. `file:` blocks are loaded by the plugin. */
function parseQuizPortBlock(source) {
  const raw = str(source).replace(/\r\n?/g, "\n").trim();
  const result = emptyResult();
  if (!raw) {
    result.issues.push("Add QuizPort JSON or a file: path.");
    return result;
  }
  if (/^[\[{]/.test(raw)) {
    try {
      const data = JSON.parse(raw);
      const parsed = parseQuizPortData(data);
      parsed.shuffle = parsed.shuffle || (data && data.shuffle === true);
      return parsed;
    } catch (e) {
      result.issues.push("That quizport block is not valid JSON.");
      return result;
    }
  }
  const jsonLines = [];
  for (const rawLine of raw.split("\n")) {
    const option = rawLine.trim().match(/^(file|shuffle)\s*[:=]\s*(.*)$/i);
    if (option) {
      if (option[1].toLowerCase() === "file") result.file = textOf(option[2]);
      else result.shuffle = /^(true|yes|on|1)$/i.test(textOf(option[2]));
      continue;
    }
    jsonLines.push(rawLine);
  }
  const jsonText = jsonLines.join("\n").trim();
  if (!jsonText) {
    if (!result.file) result.issues.push("Add QuizPort JSON or a file: path.");
    return result;
  }
  try {
    const parsed = parseQuizPortData(JSON.parse(jsonText));
    parsed.shuffle = result.shuffle || parsed.shuffle;
    return parsed;
  } catch (e) {
    result.issues.push("That quizport block is not valid JSON.");
    return result;
  }
}

/** Grade one answer. A multi-select answer must match the key exactly. */
function scoreQuizPortAnswer(question, picked) {
  const answers = Array.isArray(question && question.answers) ? question.answers : [];
  const count = question && Array.isArray(question.choices) ? question.choices.length : 0;
  const chosen = [...new Set((Array.isArray(picked) ? picked : [picked]).map(Number))]
    .filter((value) => Number.isInteger(value) && value >= 0 && value < count)
    .sort((a, b) => a - b);
  return {
    correct: answers.length > 0 && chosen.length === answers.length && answers.every((answer) => chosen.includes(answer)),
    answers: answers.slice(),
    picked: chosen,
  };
}

/** Score the whole quiz from per-question results. Unanswered questions count as wrong. */
function quizPortResult(questions, records) {
  const list = Array.isArray(questions) ? questions : [];
  const list2 = Array.isArray(records) ? records : [];
  let answered = 0;
  let correct = 0;
  const missed = [];
  list.forEach((_question, index) => {
    const record = list2[index];
    if (!record) return;
    answered++;
    if (record.correct) correct++;
    else missed.push(index);
  });
  return {
    answered,
    total: list.length,
    correct,
    percent: list.length ? Math.round((correct / list.length) * 100) : 0,
    missed,
  };
}

/** Deterministic shuffle, used for both question and choice order. */
function seededRandom(seed) {
  let state = 2166136261 >>> 0;
  for (const char of String(seed)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledOrder(length, random) {
  const order = Array.from({ length }, (_value, index) => index);
  for (let at = order.length - 1; at > 0; at--) {
    const swap = Math.floor(random() * (at + 1));
    [order[at], order[swap]] = [order[swap], order[at]];
  }
  return order;
}

/**
 * Shuffle questions and each question's choices while remapping its answer
 * indexes, so the same choice text stays correct after a shuffle.
 */
function shuffleQuizPortQuestions(questions, seed) {
  const list = Array.isArray(questions) ? questions : [];
  const random = seededRandom(seed === undefined ? "quizport" : seed);
  const order = shuffledOrder(list.length, random);
  return order.map((index) => {
    const question = list[index];
    const choiceOrder = shuffledOrder(question.choices.length, random);
    const choices = choiceOrder.map((at) => ({ text: question.choices[at].text }));
    const answers = question.answers
      .map((answer) => choiceOrder.indexOf(answer))
      .filter((at) => at >= 0)
      .sort((a, b) => a - b);
    return { ...question, choices, answers };
  });
}

module.exports = {
  LETTERS,
  answerIndexes,
  parseQuizPortBlock,
  parseQuizPortData,
  quizPortResult,
  scoreQuizPortAnswer,
  shuffleQuizPortQuestions,
};
