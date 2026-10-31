"use strict";
/*
 * SFC-style fenced cards. A block is a deck of typed cards: basic, reversed,
 * cloze, essay, worked solution, wrong-answer sprint and source-marked recall.
 * Everything is local and read-only: reveals and self-checks never create
 * attempts, history or scheduler writes.
 *
 *   ```sfc-cards
 *   Deck: Cell biology
 *   Type: basic
 *   Front: What is the powerhouse of the cell?
 *   Back: The mitochondrion.
 *   ---
 *   Type: cloze
 *   Text: The {{mitochondrion}} produces most of the cell's ATP.
 *   ---
 *   Type: essay
 *   Prompt: Explain how the sodium-potassium pump works.
 *   Criterion: Mentions ATP
 *   Criterion: Moves three sodium out and two potassium in
 *   Model: The pump hydrolyses ATP to move ions against their gradients.
 *   ---
 *   Type: worked
 *   Problem: Solve 2x + 3 = 11.
 *   Step: Subtract 3 from both sides: 2x = 8.
 *   Step: Divide both sides by 2: x = 4.
 *   Answer: x = 4
 *   ---
 *   Type: sprint
 *   Question: Which organelle produces most ATP?
 *   A. Mitochondrion
 *   B. Nucleus
 *   Answer: A
 *   Why: Oxidative phosphorylation happens in the inner membrane.
 *   ---
 *   Type: source
 *   Prompt: What does the passage say about osmosis?
 *   Answer: Water moves across a semi-permeable membrane.
 *   Source: Chapter 3, page 42
 *   ```
 */
const { str } = require("./util");

const TYPES = ["basic", "reversed", "cloze", "essay", "worked", "sprint", "source"];
const TYPE_LABELS = {
  basic: "Basic",
  reversed: "Reversed",
  cloze: "Cloze",
  essay: "Essay",
  worked: "Worked solution",
  sprint: "Wrong-answer sprint",
  source: "Source-marked recall",
};

function clean(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function normalizeSfcType(value) {
  const text = clean(value).toLowerCase();
  if (/reverse/.test(text)) return "reversed";
  if (/cloze|blank|fill/.test(text)) return "cloze";
  if (/essay|long\s*answer|rubric/.test(text)) return "essay";
  if (/worked|solution|step/.test(text)) return "worked";
  if (/sprint|wrong|multiple|choice/.test(text)) return "sprint";
  if (/source|passage|cite|recall/.test(text)) return "source";
  if (/basic|front|card/.test(text)) return "basic";
  return "";
}

function normalizeSfcCardsSettings(value) {
  return { enabled: !(value === false || (value && typeof value === "object" && value.enabled === false)) };
}

function clozeAnswers(text) {
  const out = [];
  const pattern = /\{\{(.+?)\}\}/g;
  let match;
  while ((match = pattern.exec(str(text))) !== null) {
    const answer = clean(match[1]);
    if (answer) out.push(answer);
  }
  return out;
}

function clozePrompt(text) {
  return str(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\{\{(.+?)\}\}/g, "[ ... ]")
    .trim();
}

function clozeRevealed(text) {
  return str(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\{\{(.+?)\}\}/g, (_, answer) => clean(answer))
    .trim();
}

function parseChoiceLine(line) {
  const match = clean(line).match(/^([A-H])\s*[.):]\s*(.*)$/i);
  if (!match) return null;
  return { letter: match[1].toUpperCase(), text: match[2].trim() };
}

/** Parse a whole deck. Malformed cards keep their issues for in-place display. */
function parseSfcCardsBlock(source) {
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

  let deck = "";
  const cards = [];
  for (const section of sections) {
    let type = "";
    let front = "";
    let back = "";
    let cloze = "";
    let prompt = "";
    let problem = "";
    let answer = "";
    let why = "";
    let sourceRef = "";
    let model = "";
    let last = "";
    const criteria = [];
    const steps = [];
    const choices = [];
    for (const raw of section) {
      const line = raw.trim();
      if (!line) continue;
      const deckLine = line.match(/^(?:deck|study\s*deck|title)\s*[:=]\s*(.*)$/i);
      if (deckLine && !front && !prompt && !cloze && !problem && !choices.length && !type) {
        deck = clean(deckLine[1]).slice(0, 160);
        continue;
      }
      const typeLine = line.match(/^type\s*[:=]\s*(.*)$/i);
      if (typeLine && !front && !prompt && !cloze && !problem && !choices.length) {
        type = normalizeSfcType(typeLine[1]);
        continue;
      }
      const frontLine = line.match(/^front\s*[:=]\s*(.*)$/i);
      if (frontLine) {
        front = frontLine[1].trim();
        last = "front";
        continue;
      }
      const backLine = line.match(/^back\s*[:=]\s*(.*)$/i);
      if (backLine) {
        back = backLine[1].trim();
        last = "back";
        continue;
      }
      const clozeLine = line.match(/^(?:text|cloze)\s*[:=]\s*(.*)$/i);
      if (clozeLine) {
        cloze = clozeLine[1].trim();
        last = "cloze";
        continue;
      }
      const criterionLine = line.match(/^(?:criterion|criteria|rubric)\s*[:=]\s*(.*)$/i);
      if (criterionLine) {
        const criterion = clean(criterionLine[1]);
        if (criterion) criteria.push(criterion);
        last = "criterion";
        continue;
      }
      const stepLine = line.match(/^step\s*[:=]\s*(.*)$/i);
      if (stepLine) {
        const step = clean(stepLine[1]);
        if (step) steps.push(step);
        last = "step";
        continue;
      }
      const problemLine = line.match(/^(?:problem|task)\s*[:=]\s*(.*)$/i);
      if (problemLine) {
        problem = problemLine[1].trim();
        last = "problem";
        continue;
      }
      const promptLine = line.match(/^(?:prompt|question)\s*[:=]\s*(.*)$/i);
      if (promptLine) {
        prompt = promptLine[1].trim();
        last = "prompt";
        continue;
      }
      const modelLine = line.match(/^(?:model(?:\s*answer)?|sample)\s*[:=]\s*(.*)$/i);
      if (modelLine) {
        model = modelLine[1].trim();
        last = "model";
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
        why = clean(whyLine[1]);
        last = "why";
        continue;
      }
      const sourceLine = line.match(/^(?:source|reference|cite)\s*[:=]\s*(.*)$/i);
      if (sourceLine) {
        sourceRef = clean(sourceLine[1]);
        last = "";
        continue;
      }
      const choice = parseChoiceLine(line);
      if (choice) {
        choices.push(choice);
        last = "";
        continue;
      }
      if (last === "front") front = `${front} ${line}`.trim();
      else if (last === "back") back = `${back} ${line}`.trim();
      else if (last === "cloze") cloze = `${cloze} ${line}`.trim();
      else if (last === "prompt") prompt = `${prompt} ${line}`.trim();
      else if (last === "problem") problem = `${problem} ${line}`.trim();
      else if (last === "answer") answer = `${answer} ${line}`.trim();
      else if (last === "model") model = `${model} ${line}`.trim();
      else if (last === "criterion") criteria[criteria.length - 1] = `${criteria[criteria.length - 1]} ${line}`.trim();
      else if (last === "step") steps[steps.length - 1] = `${steps[steps.length - 1]} ${line}`.trim();
      else if (last === "why") why = `${why} ${line}`.trim();
    }

    if (!type) {
      if (cloze && /\{\{.+?\}\}/.test(cloze)) type = "cloze";
      else if (problem) type = "worked";
      else if (choices.length) type = "sprint";
      else if (criteria.length) type = "essay";
      else if (prompt && (answer || sourceRef)) type = "source";
      else if (front || back) type = "basic";
    }

    const normalizedPrompt = clean(prompt || problem || front);
    if (!type && !normalizedPrompt && !clean(cloze)) continue;

    const issues = [];
    const blanks = clozeAnswers(cloze);
    let normalizedAnswer = answer;
    if (!type) {
      issues.push("Add a Type: basic, reversed, cloze, essay, worked, sprint or source line.");
    } else if (type === "basic" || type === "reversed") {
      if (!clean(front)) issues.push("Add a Front line.");
      if (!clean(back)) issues.push("Add a Back line.");
    } else if (type === "cloze") {
      if (!clean(cloze)) issues.push("Cloze cards need a Text line.");
      else if (!blanks.length) issues.push("Cloze cards need at least one {{blank}}.");
    } else if (type === "essay") {
      if (!normalizedPrompt) issues.push("Essay cards need a Prompt line.");
      if (!criteria.length) issues.push("Essay cards need at least one Criterion line.");
    } else if (type === "worked") {
      if (!clean(problem)) issues.push("Worked solutions need a Problem line.");
      if (!steps.length) issues.push("Worked solutions need at least one Step line.");
    } else if (type === "sprint") {
      if (!normalizedPrompt) issues.push("Sprint cards need a Question line.");
      if (choices.length < 2) issues.push("Sprint cards need at least two lettered choices.");
      const letter = clean(answer).toUpperCase().match(/^[A-H]/)?.[0] || "";
      const byText = choices.find((choice) => clean(choice.text).toLowerCase() === clean(answer).toLowerCase());
      normalizedAnswer = byText ? byText.letter : choices.some((choice) => choice.letter === letter) ? letter : "";
      if (!normalizedAnswer) issues.push("Sprint answers need the letter of a listed choice.");
    } else if (type === "source") {
      if (!normalizedPrompt) issues.push("Source cards need a Prompt line.");
      if (!clean(answer)) issues.push("Source cards need an Answer line.");
    }

    cards.push({
      type,
      front: clean(front),
      back: clean(back),
      cloze: str(cloze).replace(/\r\n?/g, "\n").trim(),
      prompt: normalizedPrompt,
      problem: clean(problem),
      answer: normalizedAnswer,
      why: clean(why),
      source: clean(sourceRef),
      model: clean(model),
      criteria,
      steps,
      choices: choices.filter((choice) => clean(choice.text)),
      blanks,
      valid: issues.length === 0,
      issues,
    });
  }

  const blockIssues = cards.length ? [] : ["Add at least one card separated by ---."];
  return {
    deck: deck || "SFC deck",
    cards,
    count: cards.length,
    types: Array.from(new Set(cards.filter((card) => card.valid).map((card) => card.type))),
    issues: blockIssues.concat(cards.flatMap((card, index) => card.issues.map((issue) => `Card ${index + 1}: ${issue}`))),
  };
}

function gradeSfcCard(card, response) {
  const c = card || {};
  if (c.type !== "sprint") return { correct: null, key: "", feedback: c.why || "", type: c.type || "" };
  const picked = clean(response).toUpperCase().match(/^[A-H]/)?.[0] || "";
  return {
    correct: !!c.answer && picked === c.answer,
    key: c.answer,
    feedback: c.why,
    type: c.type,
  };
}

function revealSfcCard(card) {
  const c = card || {};
  if (c.type === "basic") return c.back;
  if (c.type === "reversed") return c.front;
  if (c.type === "cloze") return clozeRevealed(c.cloze);
  if (c.type === "essay") return c.model || c.criteria.join("; ");
  if (c.type === "worked") return c.answer || c.steps[c.steps.length - 1] || "";
  if (c.type === "source") return c.answer;
  return "";
}

function renderSfcCardsBlock(plugin, source, el) {
  const parsed = parseSfcCardsBlock(source);
  const box = el.createDiv({ cls: "qt-sfc-cards" });
  box.createDiv({ cls: "qt-sfc-cards-title", text: `SFC Cards · ${parsed.deck}` });
  box.createDiv({
    cls: "qt-sfc-cards-meta",
    text: `${parsed.count} card${parsed.count === 1 ? "" : "s"} · ${parsed.types.length} type${parsed.types.length === 1 ? "" : "s"} · local preview · no attempts recorded`,
  });
  for (const issue of parsed.issues.slice(0, 8)) box.createDiv({ cls: "qt-sfc-cards-issue", text: issue });

  for (const [index, card] of parsed.cards.entries()) {
    if (!card.valid) continue;
    const cardEl = box.createDiv({ cls: "qt-sfc-cards-card" });
    cardEl.createDiv({ cls: "qt-sfc-cards-type", text: `${index + 1}. ${TYPE_LABELS[card.type] || card.type}` });
    let frontText = "";
    if (card.type === "basic") frontText = card.front;
    else if (card.type === "reversed") frontText = card.back;
    else if (card.type === "cloze") frontText = clozePrompt(card.cloze);
    else if (card.type === "worked") frontText = card.problem;
    else frontText = card.prompt;
    cardEl.createDiv({ cls: "qt-sfc-cards-prompt", text: frontText });
    if (card.source) cardEl.createDiv({ cls: "qt-sfc-cards-source", text: `Source: ${card.source}` });

    const feedback = cardEl.createDiv({ cls: "qt-sfc-cards-feedback" });
    const verdict = (text, state) => {
      feedback.empty();
      feedback.toggleClass("is-correct", state === true);
      feedback.toggleClass("is-wrong", state === false);
      feedback.createDiv({ cls: "qt-sfc-cards-verdict", text });
      if (card.why) feedback.createDiv({ cls: "qt-hint", text: card.why });
    };

    if (card.type === "sprint") {
      const choices = cardEl.createDiv({ cls: "qt-sfc-cards-choices" });
      const buttons = [];
      for (const choice of card.choices) {
        const button = choices.createEl("button", { cls: "qt-sfc-cards-choice", text: `${choice.letter}. ${choice.text}` });
        buttons.push(button);
        button.addEventListener("click", () => {
          for (const entry of buttons) entry.disabled = true;
          const graded = gradeSfcCard(card, choice.letter);
          verdict(graded.correct ? "Correct" : `Not quite. Answer: ${graded.key}`, graded.correct);
        });
      }
    } else if (card.type === "essay") {
      const list = cardEl.createDiv({ cls: "qt-sfc-cards-criteria" });
      for (const criterion of card.criteria) list.createDiv({ cls: "qt-sfc-cards-criterion", text: `• ${criterion}` });
      if (card.model) cardEl.createDiv({ cls: "qt-sfc-cards-model", text: card.model });
      const row = cardEl.createDiv({ cls: "qt-sfc-cards-selfcheck" });
      row.createEl("button", { text: "Covered it" }).addEventListener("click", () => verdict("Self-checked: covered", true));
      row.createEl("button", { text: "Needs work" }).addEventListener("click", () => verdict("Self-checked: needs work", false));
    } else if (card.type === "worked") {
      const steps = cardEl.createDiv({ cls: "qt-sfc-cards-steps" });
      let shown = 0;
      const next = cardEl.createEl("button", { cls: "qt-sfc-cards-next", text: "Show next step" });
      next.addEventListener("click", () => {
        if (shown >= card.steps.length) return;
        steps.createDiv({ cls: "qt-sfc-cards-step", text: card.steps[shown] });
        shown += 1;
        if (shown >= card.steps.length) {
          next.disabled = true;
          if (card.answer) verdict(`Answer: ${card.answer}`, true);
        }
      });
    } else {
      const reveal = cardEl.createEl("button", { cls: "qt-sfc-cards-reveal", text: card.type === "cloze" ? "Reveal blanks" : "Reveal" });
      reveal.addEventListener("click", () => {
        reveal.disabled = true;
        feedback.createDiv({ cls: "qt-sfc-cards-answer", text: revealSfcCard(card) || "No answer was written." });
      });
    }
  }
  return parsed;
}

module.exports = {
  TYPES,
  TYPE_LABELS,
  clozeAnswers,
  clozePrompt,
  clozeRevealed,
  gradeSfcCard,
  normalizeSfcCardsSettings,
  normalizeSfcType,
  parseSfcCardsBlock,
  renderSfcCardsBlock,
  revealSfcCard,
};
