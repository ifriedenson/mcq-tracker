"use strict";
/*
 * LearnKit interoperability.
 *
 * LearnKit keeps flashcards as pipe-delimited blocks inside ordinary notes:
 *
 *   T | France |
 *   Q | What is the capital of France? |
 *   A | Paris |
 *   G | Geography |
 *
 * It also accepts single-line quick cards (`question::answer`,
 * `question:::answer` and `cloze::...`). This module reads both forms and
 * writes the block form back out. LearnKit adds its own `^learnkit-…` anchors
 * when the note is synced, so anchors are ignored on import.
 */
const { hashString, str } = require("./util");

const CARD_START = new Set(["Q", "CQ", "MCQ", "RQ", "OQ", "HQ"]);
const FIELD_KEYS = new Set(["T", "Q", "A", "I", "G", "M", "CQ", "MCQ", "RQ", "OQ", "HQ", "O"]);
const FIELD_RE = /^([A-Za-z]{1,3}|[1-9]\d{0,2})\s*\|(.*)$/;

const lower = (value) => str(value).trim().toLowerCase();

function fieldStart(line) {
  const match = FIELD_RE.exec(str(line));
  if (!match) return null;
  const key = match[1].toUpperCase();
  if (!FIELD_KEYS.has(key) && !/^[1-9]\d{0,2}$/.test(key)) return null;
  return { key, rest: match[2] };
}

/** Reads pipe fields, including values whose closing pipe is on its own line. */
function parseFields(text) {
  const body = str(text).replace(/\r\n?/g, "\n").replace(/^---\n[\s\S]*?\n---\n?/, "");
  const lines = body.split("\n");
  const fields = [];
  for (let i = 0; i < lines.length; i++) {
    const start = fieldStart(lines[i]);
    if (!start) continue;
    const rest = start.rest;
    let value;
    if (/[|]\s*$/.test(rest)) {
      value = rest.replace(/[|]\s*$/, "");
    } else {
      const parts = [rest];
      for (i++; i < lines.length; i++) {
        if (/[|]\s*$/.test(lines[i])) {
          parts.push(lines[i].replace(/[|]\s*$/, ""));
          break;
        }
        parts.push(lines[i]);
      }
      value = parts.join("\n");
    }
    fields.push({ key: start.key, value: value.replace(/^\s/, "").trim() });
  }
  return fields;
}

function splitVariants(value, separator) {
  return str(value)
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** LearnKit's `:::` pairs variants in order; `::` makes every combination. */
function comboPairs(front, back) {
  if (front.includes(":::") || back.includes(":::")) {
    const left = splitVariants(front, ":::");
    const right = splitVariants(back, ":::");
    const pairs = [];
    const count = Math.min(left.length || 1, right.length || 1);
    for (let i = 0; i < count; i++) pairs.push([left[i] || front, right[i] || back]);
    return { pairs, mismatched: Math.max(left.length, right.length) - count };
  }
  if (!front.includes("::") && !back.includes("::")) return { pairs: [[front, back]], mismatched: 0 };
  const left = splitVariants(front, "::");
  const right = splitVariants(back, "::");
  const pairs = [];
  for (const a of left.length ? left : [front]) {
    for (const b of right.length ? right : [back]) pairs.push([a, b]);
  }
  return { pairs, mismatched: 0 };
}

function groupsOf(meta, extras) {
  return [...meta, ...extras]
    .filter((field) => field.key === "G")
    .map((field) => field.value.trim())
    .filter(Boolean);
}

function extraOf(meta, extras, key) {
  const field = [...meta, ...extras].find((item) => item.key === key);
  return field ? field.value.trim() : "";
}

function makeCard(fields, options, cardType, front, back, notes) {
  const opts = options || {};
  const groups = groupsOf(fields.meta, fields.extras);
  const deck = groups[0] || str(opts.deck).trim() || "Imported";
  const title = extraOf(fields.meta, fields.extras, "T");
  return {
    kind: "card",
    cardType,
    deck,
    front,
    back,
    title,
    notes,
    tags: groups,
    importSource: opts.sourcePath || "LearnKit",
    importFormat: "learnkit",
    importKey: `learnkit:${hashString([opts.sourcePath || "", cardType, deck, title, front, back].join("|"))}`,
  };
}

/** Turns one assembled block into zero or more card payloads. */
function cardFromBlock(block, options, warnings) {
  const opts = options || {};
  const start = block.start;
  const source = opts.sourcePath || "LearnKit";
  const meta = block.meta || [];
  const extras = block.extras || [];
  const notes = extraOf(meta, extras, "I");
  const title = extraOf(meta, extras, "T");
  const fields = { meta, extras };

  if (start.key === "HQ") return { skipped: 1, reason: `${source}: hotspot card "${title || start.value}" was skipped because hotspot regions are not imported` };

  if (start.key === "OQ") {
    const steps = extras
      .filter((field) => /^\d+$/.test(field.key))
      .sort((a, b) => Number(a.key) - Number(b.key))
      .map((field, index) => `${index + 1}. ${field.value}`)
      .filter((line) => !/^\d+\.\s*$/.test(line));
    if (steps.length < 2) return { skipped: 1, reason: `${source}: ordered question "${start.value}" needs at least two steps` };
    warnings.push("Ordered questions are imported as basic cards with the correct order on the back.");
    return { cards: [makeCard(fields, opts, "basic", start.value, steps.join("\n"), notes)] };
  }

  if (start.key === "CQ") {
    if (!/\{\{c\d*::[\s\S]+?\}\}/.test(start.value)) {
      return { skipped: 1, reason: `${source}: cloze card "${title || start.value}" has no {{c1::…}} deletion` };
    }
    return { cards: [makeCard(fields, opts, "cloze", start.value, "", notes)] };
  }

  if (start.key === "MCQ") {
    const correct = extras.filter((field) => field.key === "A").map((field) => field.value.trim()).filter(Boolean);
    const wrong = extras.filter((field) => field.key === "O").map((field) => field.value.trim()).filter(Boolean);
    if (!correct.length || !wrong.length) {
      return { skipped: 1, reason: `${source}: multiple-choice card "${title || start.value}" needs at least one correct and one wrong option` };
    }
    const choices = [...correct, ...wrong];
    const card = makeCard(fields, opts, "basic", start.value, correct.join(" · "), notes);
    card.choices = choices;
    card.correctChoices = correct.map((_value, index) => index + 1);
    card.questionSet = "learnkit";
    return { cards: [card] };
  }

  const answer = extras
    .filter((field) => field.key === "A")
    .map((field) => field.value.trim())
    .filter(Boolean)
    .join("\n");
  if (!start.value || !answer) {
    return { skipped: 1, reason: `${source}: "${title || start.value || "card"}" is missing its question or answer` };
  }
  const cardType = start.key === "RQ" ? "reversed" : "basic";
  const combos = comboPairs(start.value, answer);
  if (combos.mismatched) warnings.push(`A combo card in ${source} had a different number of ::: variants; the extra ones were skipped.`);
  return { cards: combos.pairs.map(([front, back]) => makeCard(fields, opts, cardType, front, back, notes)) };
}

/** Auto-numbers bare `{{token}}` / `{{token::hint}}` cloze tokens from a quick card. */
function normalizeQuickCloze(text) {
  let next = 0;
  return str(text).replace(/\{\{([\s\S]+?)\}\}/g, (_match, inner) => {
    if (/^c\d+::/.test(inner)) return `{{${inner}}}`;
    next++;
    const split = inner.split("::");
    const answer = str(split[0]).trim();
    const hint = str(split.slice(1).join("::")).trim();
    return `{{c${next}::${answer}${hint ? `::${hint}` : ""}}}`;
  });
}

function quickCards(text, options, warnings) {
  const opts = options || {};
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  const cards = [];
  let fenced = false;
  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (!line || /^\s/.test(line) || /^#{1,6}\s/.test(line) || /^>/.test(line)) continue;
    if (fieldStart(line)) continue;
    const cloze = /^(?:cloze|cq)::(.+)$/i.exec(line);
    if (cloze) {
      cards.push({
        kind: "card",
        cardType: "cloze",
        deck: str(opts.deck).trim() || "Imported",
        front: normalizeQuickCloze(cloze[1]).trim(),
        back: "",
        title: "",
        notes: "",
        tags: [],
        importSource: opts.sourcePath || "LearnKit",
        importFormat: "learnkit",
        importKey: "",
      });
      continue;
    }
    const visible = line.replace(/\{\{[\s\S]*?\}\}/g, "");
    if (visible.includes(":::")) {
      const at = line.indexOf(":::");
      const front = line.slice(0, at).trim();
      const back = line.slice(at + 3).trim();
      if (!front || !back) continue;
      cards.push({
        kind: "card",
        cardType: "reversed",
        deck: str(opts.deck).trim() || "Imported",
        front,
        back,
        title: "",
        notes: "",
        tags: [],
        importSource: opts.sourcePath || "LearnKit",
        importFormat: "learnkit",
        importKey: "",
      });
      continue;
    }
    if (visible.includes("::")) {
      const at = line.indexOf("::");
      const front = line.slice(0, at).trim();
      const back = line.slice(at + 2).trim();
      if (!front || !back) continue;
      cards.push({
        kind: "card",
        cardType: "basic",
        deck: str(opts.deck).trim() || "Imported",
        front,
        back,
        title: "",
        notes: "",
        tags: [],
        importSource: opts.sourcePath || "LearnKit",
        importFormat: "learnkit",
        importKey: "",
      });
    }
  }
  if (warnings && cards.length) warnings.push("Quick cards were expanded to normal cards on import.");
  return cards;
}

function learnKitCardKey(card) {
  return `learnkit:${hashString([card.importSource || "", card.cardType, card.deck, card.title || "", card.front, card.back].join("|"))}`;
}

/**
 * Reads a LearnKit note. Returns the same shape as the other card importers,
 * with unsupported hotspot/ordered details reported instead of guessed.
 */
function parseLearnKit(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "LearnKit");
  const warnings = [];
  const skippedDetails = [];
  const fields = parseFields(text);
  const blocks = [];
  let current = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const field of fields) {
    if (field.key === "Q" && current && current.start && current.start.key === "HQ") {
      current.extras.push(field);
      continue;
    }
    if (CARD_START.has(field.key)) {
      if (current && current.start) flush();
      if (!current) current = { meta: [], extras: [], start: null };
      current.start = field;
      continue;
    }
    if (field.key === "T") {
      if (current && current.start) flush();
      if (!current) current = { meta: [], extras: [], start: null };
      current.meta.push(field);
      continue;
    }
    if (!current) current = { meta: [], extras: [], start: null };
    current.extras.push(field);
  }
  flush();

  const cards = [];
  let skipped = 0;
  for (const block of blocks) {
    if (!block.start) continue;
    const result = cardFromBlock(block, opts, warnings);
    if (result.cards) cards.push(...result.cards);
    if (result.skipped) {
      skipped += result.skipped;
      skippedDetails.push({ reason: result.reason });
    }
  }

  const quick = quickCards(text, opts, warnings);
  for (const card of quick) {
    card.importKey = learnKitCardKey(card);
    cards.push(card);
  }
  // A quick card and a pipe card can describe the same fact; keep both, but do
  // not report a file with no cards as an error.
  return { cards, skipped, errors: [], warnings, skippedDetails, source, format: "learnkit" };
}

function oneLineField(value) {
  return str(value).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>").trim();
}

function fieldLine(key, value) {
  const text = oneLineField(value);
  return `${key} | ${text} |`;
}

function choiceRow(record) {
  const fm = (record && record.fm) || {};
  const raw = [];
  for (let n = 1; n <= 8; n++) {
    const value = str(fm[`choice_${n}`]).trim();
    if (value) raw.push(value);
  }
  if (!raw.length && Array.isArray(fm.choices)) {
    for (const value of fm.choices) if (str(value).trim()) raw.push(str(value).trim());
  }
  if (!raw.length) return null;
  const indexes = str(fm.correct_choices)
    .split(/[,\s]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= raw.length);
  return { choices: raw, correct: indexes.length ? [...new Set(indexes)] : [1] };
}

/** Writes LearnKit's block format; each card becomes one block, grouped by deck. */
function cardsToLearnKit(cards) {
  const blocks = [];
  for (const record of Array.isArray(cards) ? cards : []) {
    const fm = (record && record.fm) || {};
    const body = (record && record.body) || {};
    const cardType = lower(body.cardType || fm.card_type);
    const front = str(body.rawFront || body.front).trim();
    const back = str(body.back).trim();
    if (!front) continue;
    const title = str(fm.card_title || (record.file && record.file.basename)).trim();
    const lines = [];
    if (title) lines.push(fieldLine("T", title));
    const quiz = choiceRow(record);
    if (cardType === "cloze") {
      lines.push(fieldLine("CQ", front));
    } else if (quiz) {
      lines.push(fieldLine("MCQ", front));
      for (const at of quiz.correct) lines.push(fieldLine("A", quiz.choices[at - 1]));
      for (let i = 0; i < quiz.choices.length; i++) if (!quiz.correct.includes(i + 1)) lines.push(fieldLine("O", quiz.choices[i]));
      if (back) lines.push(fieldLine("I", back));
    } else if (cardType === "reversed") {
      lines.push(fieldLine("RQ", front));
      if (back) lines.push(fieldLine("A", back));
    } else {
      lines.push(fieldLine("Q", front));
      if (back) lines.push(fieldLine("A", back));
    }
    const tags = Array.isArray(fm.tags) ? fm.tags : str(fm.tags).split(/[,;]+/);
    const groups = [str(fm.deck).trim(), ...tags.map((tag) => str(tag).trim())].filter(Boolean);
    for (const group of [...new Set(groups)]) lines.push(fieldLine("G", group));
    blocks.push(lines.join("\n"));
  }
  if (!blocks.length) return "";
  return [
    "# LearnKit cards",
    "",
    "Exported from MCQ Tracker. Open this note in a vault with LearnKit installed and run",
    '"Sync all flashcards from the vault"; LearnKit adds its own anchors on sync.',
    "",
    blocks.join("\n\n"),
    "",
  ].join("\n");
}

function learnkitExportHint() {
  return "LearnKit: save the exported Markdown note in the vault, open it with LearnKit installed, and run Sync all flashcards from the vault. LearnKit adds its own anchors on sync; images and audio are not bundled.";
}

module.exports = {
  parseFields,
  parseLearnKit,
  cardsToLearnKit,
  learnkitExportHint,
  normalizeQuickCloze,
  comboPairs,
};
