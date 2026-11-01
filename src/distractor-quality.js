"use strict";
/*
 * Deterministic multiple-choice distractor checks.
 *
 * These rules catch defects that do not need a model: empty or duplicate
 * options, "all/none of the above" filler, a correct option repeated among the
 * distractors, and a correct option that is conspicuously longer than every
 * distractor. The caller decides whether a failed check is marked or dropped.
 */
const { str } = require("./util");
const { parseChoiceSet } = require("./answer-types");

const ALL_NONE = /^(?:all|none)\s+of\s+(?:the\s+)?(?:above|these|them)$/i;

function optionText(choice) {
  return str(choice && choice.text !== undefined ? choice.text : choice).replace(/\s+/g, " ").trim();
}

function normalizeOption(text) {
  return optionText(text)
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTrueFalsePair(choices) {
  if (choices.length !== 2) return false;
  const left = normalizeOption(choices[0]);
  const right = normalizeOption(choices[1]);
  return (left === "true" && right === "false") || (left === "false" && right === "true");
}

function correctIndexes(item, choices) {
  const letters = parseChoiceSet(item && item.answer);
  const indexes = letters
    .map((letter) => letter.charCodeAt(0) - 65)
    .filter((index) => index >= 0 && index < choices.length);
  if (indexes.length) return [...new Set(indexes)].sort((a, b) => a - b);
  const key = normalizeOption(item && item.answer);
  if (!key) return [];
  const index = choices.findIndex((choice) => normalizeOption(choice) === key);
  return index >= 0 ? [index] : [];
}

/**
 * Returns { ok, reasons }. Reasons are short user-facing phrases used by the
 * normal verification badge; the writer refuses the question whenever ok is
 * false, even when the verification setting is "mark".
 */
function checkDistractorQuality(item) {
  const data = item && typeof item === "object" ? item : {};
  const choices = (Array.isArray(data.choices) ? data.choices : []).map(optionText);
  if (!choices.length) return { ok: true, reasons: [] };
  if (choices.length < 2) return { ok: false, reasons: ["fewer than two choices"] };

  const reasons = [];
  if (choices.some((choice) => !choice)) reasons.push("an empty choice");
  if (isTrueFalsePair(choices)) return { ok: reasons.length === 0, reasons };

  const seen = new Map();
  for (const choice of choices) {
    const key = normalizeOption(choice);
    if (!key) continue;
    if (seen.has(key)) reasons.push(`duplicate choice "${choice}"`);
    else seen.set(key, choice);
  }

  for (const choice of choices) {
    if (ALL_NONE.test(choice)) reasons.push(`"${choice}" is not a real distractor`);
  }

  const keyed = correctIndexes(data, choices);
  if (keyed.length === 1 && choices.length >= 3) {
    const correct = choices[keyed[0]];
    const others = choices.filter((_, index) => index !== keyed[0]);
    const maxOther = Math.max(...others.map((choice) => choice.length));
    if (correct.length >= 50 && correct.length >= maxOther * 2 && correct.length - maxOther >= 30) {
      reasons.push("the correct choice is much longer than every distractor");
    }
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

module.exports = {
  ALL_NONE,
  checkDistractorQuality,
  correctIndexes,
  normalizeOption,
  optionText,
};
