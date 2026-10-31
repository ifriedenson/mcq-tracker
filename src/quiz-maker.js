"use strict";
/*
 * Quiz Maker-style fenced blocks. A block is a named study pack with one or
 * more questions. Everything is local and read-only: answers are graded in
 * memory and never create attempts, history or schedule writes.
 *
 *   ```quiz-maker
 *   Pack: Biology warmup
 *   Type: assertion
 *   Assertion: Plants release oxygen.
 *   Reason: Oxygen is a product of photosynthesis.
 *   Answer: explains
 *   Why: The reason is the mechanism behind the assertion.
 *   ---
 *   Type: correction
 *   Statement: The mitochondria is the powerhouse of the cell.
 *   Answer: mitochondrion
 *   ---
 *   Type: evidence
 *   Question: Which result supports osmosis?
 *   A. Water moved across the membrane.
 *   B. Starch stayed inside.
 *   Answer: A
 *   ---
 *   Type: branch
 *   Scenario: A cell is placed in pure water.
 *   A. Water enters; the cell swells. => The cell may lyse.
 *   B. Water leaves; the cell shrinks. => That would happen in a hypertonic solution.
 *   ```
 */
const { str } = require("./util");

const TYPES = ["assertion", "correction", "evidence", "branch"];
const ASSERTION_ANSWERS = [
  { value: "explains", label: "Both are true; the reason explains the assertion." },
  { value: "true-no-explain", label: "Both are true; the reason does not explain the assertion." },
  { value: "assertion-only", label: "The assertion is true; the reason is false." },
  { value: "reason-only", label: "The assertion is false; the reason is true." },
  { value: "both-false", label: "Both are false." },
];
const TYPE_LABELS = {
  assertion: "Assertion and reason",
  correction: "Error correction",
  evidence: "Evidence selection",
  branch: "Branching scenario",
};

function clean(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function normalizeType(value) {
  const text = clean(value).toLowerCase();
  if (/assertion|reason/.test(text)) return "assertion";
  if (/correct|fix|error/.test(text)) return "correction";
  if (/evidence|support|cite/.test(text)) return "evidence";
  if (/branch|scenario|decision/.test(text)) return "branch";
  return "";
}

function normalizeAssertionAnswer(value) {
  const text = clean(value).toLowerCase();
  if (!text) return "";
  if (ASSERTION_ANSWERS.some((answer) => answer.value === text)) return text;
  if (/both.*true.*explain|reason.*explain/.test(text)) return "explains";
  if (/both.*true.*(?:not|no).*explain|does not explain/.test(text)) return "true-no-explain";
  if (/assertion.*true.*reason.*false|reason.*false/.test(text)) return "assertion-only";
  if (/assertion.*false.*reason.*true|assertion.*false/.test(text)) return "reason-only";
  if (/both.*false/.test(text)) return "both-false";
  return "";
}

function parseChoiceLine(line) {
  const match = clean(line).match(/^([A-H])\s*[.):]\s*(.*)$/i);
  if (!match) return null;
  const raw = match[2].trim();
  const parts = raw.split(/\s*=>\s*/);
  return {
    letter: match[1].toUpperCase(),
    text: parts[0].trim(),
    outcome: parts.slice(1).join(" => ").trim(),
  };
}

function normalizeQuizMakerSettings(value) {
  return { enabled: !(value === false || (value && typeof value === "object" && value.enabled === false)) };
}

/** Parse a whole pack. Malformed questions keep their issues for in-place display. */
function parseQuizMakerBlock(source) {
  const text = str(source).replace(/\r\n?/g, "\n");
  const sections = [];
  let lines = [];
  for (const line of text.split("\n")) {
    if (/^---+$/.test(line.trim())) {
      if (lines.some((entry) => entry.trim())) sections.push(lines);
      lines = [];
    } else {
      lines.push(line);
    }
  }
  if (lines.some((entry) => entry.trim())) sections.push(lines);

  let pack = "";
  const questions = [];
  for (const section of sections) {
    let type = "";
    let prompt = "";
    let reason = "";
    let answer = "";
    let explanation = "";
    let last = "";
    const choices = [];
    const outcomes = {};
    for (const raw of section) {
      const line = raw.trim();
      if (!line) continue;
      const packLine = line.match(/^(?:pack|study\s*pack|title)\s*[:=]\s*(.*)$/i);
      if (packLine && !prompt && !choices.length && !type) {
        pack = clean(packLine[1]).slice(0, 160);
        continue;
      }
      const typeLine = line.match(/^type\s*[:=]\s*(.*)$/i);
      if (typeLine && !prompt) {
        type = normalizeType(typeLine[1]);
        continue;
      }
      const assertionLine = line.match(/^(?:assertion|claim)\s*[:=]\s*(.*)$/i);
      if (assertionLine) {
        prompt = assertionLine[1].trim();
        last = "prompt";
        continue;
      }
      const reasonLine = line.match(/^reason\s*[:=]\s*(.*)$/i);
      if (reasonLine) {
        reason = reasonLine[1].trim();
        last = "reason";
        continue;
      }
      const statementLine = line.match(/^(?:statement|scenario|prompt|question)\s*[:=]\s*(.*)$/i);
      if (statementLine) {
        prompt = statementLine[1].trim();
        last = "prompt";
        continue;
      }
      const answerLine = line.match(/^(?:answer|correction)\s*[:=]\s*(.*)$/i);
      if (answerLine) {
        answer = clean(answerLine[1]);
        last = "answer";
        continue;
      }
      const whyLine = line.match(/^(?:why|explanation|rationale)\s*[:=]\s*(.*)$/i);
      if (whyLine) {
        explanation = clean(whyLine[1]);
        last = "explanation";
        continue;
      }
      const outcomeLine = line.match(/^outcome\s+([A-H])\s*[:=]\s*(.*)$/i);
      if (outcomeLine) {
        outcomes[outcomeLine[1].toUpperCase()] = clean(outcomeLine[2]);
        last = "";
        continue;
      }
      const choice = parseChoiceLine(line);
      if (choice) {
        choices.push({ letter: choice.letter, text: choice.text, outcome: choice.outcome });
        if (choice.outcome) outcomes[choice.letter] = choice.outcome;
        last = "";
        continue;
      }
      if (last === "prompt") prompt = `${prompt} ${line}`.trim();
      else if (last === "reason") reason = `${reason} ${line}`.trim();
      else if (last === "explanation") explanation = `${explanation} ${line}`.trim();
      else if (last === "answer") answer = `${answer} ${line}`.trim();
    }
    if (!type && !clean(prompt) && !choices.length) continue;
    const issues = [];
    const normalizedPrompt = clean(prompt);
    const normalizedChoices = choices.filter((choice) => clean(choice.text));
    if (!type) issues.push("Add a Type: assertion, correction, evidence or branch line.");
    if (!normalizedPrompt) issues.push("Add a question, assertion, statement or scenario.");
    let normalizedAnswer = answer;
    if (type === "assertion") {
      const assertionAnswer = normalizeAssertionAnswer(answer);
      if (!assertionAnswer) issues.push("Add an Answer line: explains, true-no-explain, assertion-only, reason-only or both-false.");
      normalizedAnswer = assertionAnswer;
      if (!reason) issues.push("Assertion questions need a Reason line.");
    } else if (type === "correction") {
      if (!normalizedAnswer) issues.push("Correction questions need an Answer line with the correction.");
    } else if (type === "evidence") {
      if (normalizedChoices.length < 2) issues.push("Evidence questions need at least two lettered choices.");
      const byText = normalizedChoices.find((choice) => clean(choice.text).toLowerCase() === clean(answer).toLowerCase());
      const letter = clean(answer).toUpperCase().match(/^[A-H]/);
      normalizedAnswer = byText ? byText.letter : letter && normalizedChoices.some((choice) => choice.letter === letter[0]) ? letter[0] : "";
      if (!normalizedAnswer) issues.push("Evidence answers need the letter of a listed choice.");
    } else if (type === "branch") {
      if (normalizedChoices.length < 1) issues.push("Branching scenarios need at least one lettered choice.");
      normalizedAnswer = "";
      for (const choice of normalizedChoices) {
        if (!outcomes[choice.letter]) outcomes[choice.letter] = choice.outcome || choice.text;
      }
    }
    questions.push({
      type,
      prompt: normalizedPrompt,
      reason: clean(reason),
      choices: normalizedChoices,
      answer: normalizedAnswer,
      outcomes,
      explanation: clean(explanation),
      valid: issues.length === 0,
      issues,
    });
  }
  const blockIssues = questions.length ? [] : ["Add at least one question separated by ---."];
  return {
    pack: pack || "Quiz Maker pack",
    questions,
    issues: blockIssues.concat(questions.flatMap((question, index) => question.issues.map((issue) => `Question ${index + 1}: ${issue}`))),
  };
}

function textAnswer(value) {
  return clean(value).toLowerCase().replace(/[.!?。]+$/g, "");
}

function gradeQuizMakerQuestion(question, response) {
  const q = question || {};
  if (q.type === "assertion") {
    const correct = !!q.answer && clean(response) === q.answer;
    return {
      correct,
      key: ASSERTION_ANSWERS.find((answer) => answer.value === q.answer)?.label || q.answer,
      feedback: q.explanation,
      type: q.type,
    };
  }
  if (q.type === "correction") {
    const correct = !!q.answer && textAnswer(response) === textAnswer(q.answer);
    return { correct, key: q.answer, feedback: q.explanation, type: q.type };
  }
  if (q.type === "evidence") {
    const picked = clean(response).toUpperCase().match(/^[A-H]/)?.[0] || "";
    return { correct: !!q.answer && picked === q.answer, key: q.answer, feedback: q.explanation, type: q.type };
  }
  if (q.type === "branch") {
    const letter = clean(response).toUpperCase().match(/^[A-H]/)?.[0] || "";
    return {
      correct: null,
      key: "",
      outcome: q.outcomes[letter] || "",
      feedback: q.explanation,
      type: q.type,
    };
  }
  return { correct: false, key: "", feedback: q.explanation || "", type: q.type || "" };
}

function renderQuizMakerBlock(plugin, source, el, ctx) {
  const parsed = parseQuizMakerBlock(source);
  const box = el.createDiv({ cls: "qt-quiz-maker" });
  box.createDiv({ cls: "qt-quiz-maker-title", text: `Quiz Maker · ${parsed.pack}` });
  box.createDiv({ cls: "qt-quiz-maker-meta", text: `${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"} · local preview · no attempts recorded` });
  for (const issue of parsed.issues.slice(0, 8)) box.createDiv({ cls: "qt-quiz-maker-issue", text: issue });
  for (const [index, question] of parsed.questions.entries()) {
    if (!question.valid) continue;
    const card = box.createDiv({ cls: "qt-quiz-maker-question" });
    card.createDiv({ cls: "qt-quiz-maker-type", text: `${index + 1}. ${TYPE_LABELS[question.type] || question.type}` });
    card.createDiv({ cls: "qt-quiz-maker-prompt", text: question.prompt });
    if (question.reason) card.createDiv({ cls: "qt-quiz-maker-reason", text: `Reason: ${question.reason}` });
    const feedback = card.createDiv({ cls: "qt-quiz-maker-feedback" });
    const show = (graded) => {
      feedback.empty();
      feedback.toggleClass("is-correct", graded.correct === true);
      feedback.toggleClass("is-wrong", graded.correct === false);
      if (graded.type === "branch") {
        feedback.createDiv({ cls: "qt-quiz-maker-outcome", text: graded.outcome || "No outcome was written for that choice." });
      } else {
        feedback.createDiv({ cls: "qt-quiz-maker-verdict", text: graded.correct ? "Correct" : `Not quite. Answer: ${graded.key}` });
        if (graded.feedback) feedback.createDiv({ cls: "qt-hint", text: graded.feedback });
      }
    };
    if (question.type === "assertion") {
      const choices = card.createDiv({ cls: "qt-quiz-maker-choices" });
      const buttons = [];
      for (const answer of ASSERTION_ANSWERS) {
        const button = choices.createEl("button", { cls: "qt-quiz-maker-choice", text: answer.label });
        buttons.push(button);
        button.addEventListener("click", () => {
          for (const entry of buttons) entry.disabled = true;
          show(gradeQuizMakerQuestion(question, answer.value));
        });
      }
    } else if (question.type === "correction") {
      const row = card.createDiv({ cls: "qt-quiz-maker-input" });
      const input = row.createEl("input", { type: "text", attr: { placeholder: "Type the correction" } });
      row.createEl("button", { text: "Check" }).addEventListener("click", () => show(gradeQuizMakerQuestion(question, input.value)));
    } else {
      const choices = card.createDiv({ cls: "qt-quiz-maker-choices" });
      const buttons = [];
      for (const choice of question.choices) {
        const button = choices.createEl("button", { cls: "qt-quiz-maker-choice", text: `${choice.letter}. ${choice.text}` });
        buttons.push(button);
        button.addEventListener("click", () => {
          for (const entry of buttons) entry.disabled = true;
          show(gradeQuizMakerQuestion(question, choice.letter));
        });
      }
    }
  }
  return parsed;
}

module.exports = {
  ASSERTION_ANSWERS,
  TYPES,
  TYPE_LABELS,
  gradeQuizMakerQuestion,
  normalizeQuizMakerSettings,
  normalizeType,
  parseQuizMakerBlock,
  renderQuizMakerBlock,
};
