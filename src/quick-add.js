"use strict";
/*
 * Plain-text quick authoring: one pasted block becomes one ordinary question
 * note. Nothing here touches the vault, so the parser can be tested on its own
 * and the note text stays in the same shape as every other question note.
 *
 *   Q: Which gas do plants take in?
 *   A. Oxygen
 *   B. Carbon dioxide
 *   Answer: B
 *   Why: Photosynthesis consumes carbon dioxide.
 *   Course: Biology
 *   Skill: photosynthesis
 *
 * A block starts at each "Q:" line. Stimulus, Course, Skill, Difficulty, Unit
 * and Test are optional; a block with no choices is written as an SPR item.
 */
const { stringifyYaml } = require("obsidian");
const { formatChoiceSet, parseChoiceSet } = require("./answer-types");
const { str } = require("./util");

const LETTERS = "ABCDEFGH";
const NAMED_FIELDS = {
  stimulus: "stimulus",
  passage: "stimulus",
  source: "stimulus",
  answer: "answer",
  key: "answer",
  "correct answer": "answer",
  correct: "answer",
  why: "explanation",
  explanation: "explanation",
  rationale: "explanation",
  course: "course",
  skill: "skill",
  difficulty: "difficulty",
  unit: "unit",
  test: "test",
};

/** The field a line opens, or null when the line continues the previous one. */
function fieldAt(line) {
  const question = line.match(/^(?:Q|Question)\s*[:.)]\s*(.*)$/i);
  if (question) return { key: "question", text: question[1] };
  const choice = line.match(/^[-*+]?\s*([A-H])\s*[.):]\s*(.*)$/);
  if (choice) return { key: "choice", text: choice[2] };
  const named = line.match(/^(Stimulus|Passage|Source|Answer|Key|Correct answer|Correct|Why|Explanation|Rationale|Course|Skill|Difficulty|Unit|Test)\s*[:.)]\s*(.*)$/i);
  if (named) {
    const key = NAMED_FIELDS[named[1].toLowerCase().replace(/\s+/g, " ")];
    if (key) return { key, text: named[2] };
  }
  return null;
}

const TEXT_FIELDS = new Set(["question", "stimulus", "explanation"]);
const META_FIELDS = new Set(["course", "skill", "difficulty", "unit", "test"]);

function emptyBlock() {
  return { question: "", stimulus: "", explanation: "", answer: "", choices: [], meta: {}, last: null };
}

/** Split pasted text into blocks. Everything before the first "Q:" line is ignored. */
function splitBlocks(text) {
  const blocks = [];
  let cur = null;
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (/^-{3,}$/.test(line)) continue; // a rule between blocks is just a separator
    const field = fieldAt(line);
    if (field && field.key === "question") {
      cur = emptyBlock();
      cur.question = field.text.trim();
      cur.last = { type: "question" };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (field) {
      if (field.key === "choice") {
        cur.choices.push(str(field.text).trim());
        cur.last = { type: "choice", index: cur.choices.length - 1 };
      } else if (META_FIELDS.has(field.key)) {
        cur.meta[field.key] = str(field.text).trim();
        cur.last = { type: "meta", key: field.key };
      } else {
        cur[field.key] = str(field.text).trim();
        cur.last = { type: field.key };
      }
      continue;
    }
    if (!line) {
      // A blank line separates paragraphs inside a question, stimulus or explanation.
      if (cur.last && TEXT_FIELDS.has(cur.last.type)) cur[cur.last.type] += "\n";
      continue;
    }
    if (!cur.last) continue;
    if (cur.last.type === "choice") {
      const at = cur.last.index;
      cur.choices[at] = `${cur.choices[at]} ${line}`.trim();
    } else if (TEXT_FIELDS.has(cur.last.type)) {
      cur[cur.last.type] += `\n${line}`;
    } else if (cur.last.type === "meta") {
      const key = cur.last.key;
      cur.meta[key] = `${cur.meta[key]} ${line}`.trim();
    } else if (cur.last.type === "answer") {
      cur.answer = `${cur.answer} ${line}`.trim();
    }
  }
  return blocks;
}

const cleanText = (value) => str(value).replace(/[ \t]+\n/g, "\n").trim();

/**
 * Read the key the user typed. A choice's own text, a letter and a set
 * ("A, C") all resolve to the letter(s) the note needs.
 */
function resolveKey(raw, choices) {
  const text = cleanText(raw).replace(/^[*_`"']+|[*_`"']+$/g, "").trim();
  if (!text) return "";
  const byText = choices.findIndex((choice) => choice.toLowerCase() === text.toLowerCase());
  if (byText >= 0) return LETTERS[byText];
  const set = parseChoiceSet(text);
  if (set.length > 1 && set.every((letter) => LETTERS.indexOf(letter) < choices.length)) return formatChoiceSet(set);
  const single = text.match(/^\(?([A-Ha-h])\)?(?:[.):\s]|$)/);
  if (!single) return "";
  const letter = single[1].toUpperCase();
  return LETTERS.indexOf(letter) < choices.length ? letter : "";
}

function normalizeBlock(block, defaults) {
  const d = defaults || {};
  const question = cleanText(block.question);
  const choices = block.choices.map((choice) => cleanText(choice)).filter(Boolean);
  const rawKey = cleanText(block.answer);
  const issues = [];

  if (!question) issues.push('Add the question text on a line starting with "Q:".');
  else if (question.length < 5) issues.push("The question is too short to make a note.");
  if (block.choices.length && choices.length < 2) issues.push('Add at least two answer choices, one per line as "A. …", "B. …".');

  let answer = "";
  let questionType = "";
  if (!choices.length) {
    if (!rawKey) issues.push('Add the key with "Answer:", for example "Answer: 12.5".');
    else {
      answer = rawKey;
      questionType = "spr";
    }
  } else if (!rawKey) {
    issues.push('Add the key with "Answer:" or "Key:".');
  } else {
    answer = resolveKey(rawKey, choices);
    if (!answer) issues.push(`"${rawKey.slice(0, 30)}" is not one of the choices; use a letter such as B${choices.length > 1 ? " or a set such as A, C" : ""}.`);
    else questionType = answer.includes(",") ? "multi" : "mcq";
  }

  const pick = (key) => cleanText(block.meta[key] || d[key] || "");
  const difficulty = pick("difficulty").toLowerCase();
  const unit = pick("unit");
  const item = {
    question,
    stimulus: cleanText(block.stimulus),
    choices,
    answer,
    explanation: cleanText(block.explanation),
    questionType,
    test: pick("test"),
    course: pick("course"),
    skill: pick("skill"),
    difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "",
    unit: /^\d+$/.test(unit) ? Number(unit) : unit,
  };
  return { item, issues };
}

/** Parse pasted text into ready items and per-block issues. Never writes anything. */
function parseQuickAdd(text, defaults) {
  const blocks = splitBlocks(text);
  const items = [];
  const issues = [];
  blocks.forEach((block, index) => {
    const result = normalizeBlock(block, defaults);
    for (const message of result.issues) {
      issues.push({ index, question: cleanText(block.question).slice(0, 60), message });
    }
    if (!result.issues.length) items.push(result.item);
  });
  return { items, issues };
}

/** A note title from the question text, short enough to read in the file list. */
function quickAddTitle(question) {
  const clean = str(question)
    .replace(/[*_`>#]/g, " ")
    .replace(/[\\/:*?"<>|#[\]^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 60).trim() || "Question";
}

/** The note text: the same properties and headings every question note uses. */
function quickAddNote(item, qid) {
  const data = item || {};
  const choices = Array.isArray(data.choices) ? data.choices.slice(0, 8) : [];
  const fm = { question_id: qid };
  for (const key of ["test", "course", "unit", "skill", "difficulty"]) {
    if (data[key] !== undefined && data[key] !== null && str(data[key]).trim() !== "") fm[key] = data[key];
  }
  fm.question_type = data.questionType || (choices.length ? "mcq" : "spr");
  if (choices.length) fm.choices = choices.length;
  fm.answer = str(data.answer).trim();

  const lines = ["---", stringifyYaml(fm).trimEnd(), "---", ""];
  const stimulus = str(data.stimulus).trim();
  if (stimulus) {
    lines.push("## Stimulus", "");
    for (const line of stimulus.split("\n")) lines.push(line ? `> ${line}` : ">");
    lines.push("");
  }
  lines.push("## Question", "", str(data.question).trim(), "");
  if (choices.length) {
    lines.push("## Answer Choices", "");
    choices.forEach((choice, index) => lines.push(`- ${LETTERS[index]}. ${str(choice).trim()}`));
    lines.push("");
  }
  lines.push("## Answer", "", "> [!answer]- Reveal answer");
  lines.push(choices.length ? `> **Correct Answer: ${fm.answer}**` : `> **Answer: ${fm.answer}**`, ">");
  const explanation = str(data.explanation).trim();
  for (const line of explanation.split("\n")) lines.push(line ? `> ${line}` : ">");
  lines.push("", "## My Notes", "");
  return lines.join("\n");
}

module.exports = {
  LETTERS,
  fieldAt,
  quickAddNote,
  quickAddTitle,
  parseQuickAdd,
  resolveKey,
  splitBlocks,
};
