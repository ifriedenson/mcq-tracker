"use strict";
/*
 * Answer keys that are not a single letter: true/false prompts and
 * select-all-that-apply questions.
 *
 * Everything here is pure text handling. It reads the key formats notes and
 * importers already use (`A`, `A, C`, `A/C`, `True`, `false`) and never guesses
 * a value it cannot recognise, so a malformed key falls back to self-grading.
 */
const { str } = require("./util");

const TRUE_WORDS = ["true", "t", "yes", "y", "1"];
const FALSE_WORDS = ["false", "f", "no", "n", "0"];

/** "A, C", "A/C", "A C", "A and C" and "AC" all read as a letter set. */
function parseChoiceSet(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) for (const letter of parseChoiceSet(item)) if (!out.includes(letter)) out.push(letter);
    return out;
  }
  const text = str(value).trim();
  if (!text) return [];
  const parts = text
    .split(/[,;\/&]|\band\b|\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !/^and$/i.test(part));
  if (parts.length && parts.every((part) => /^[A-Ha-h]$/.test(part))) {
    return [...new Set(parts.map((part) => part.toUpperCase()))].sort();
  }
  if (/^[A-Ha-h]{2,8}$/.test(text)) return [...new Set(text.toUpperCase().split(""))].sort();
  return [];
}

function formatChoiceSet(letters) {
  const list = Array.isArray(letters) ? letters : parseChoiceSet(letters);
  return [...new Set(list.map((l) => str(l).trim().toUpperCase()).filter((l) => /^[A-H]$/.test(l)))].sort().join(", ");
}

function isChoiceSetAnswer(value) {
  return parseChoiceSet(value).length > 1;
}

/** "True"/"False", or "" when the text is neither. */
function trueFalseWord(value) {
  const text = str(value)
    .trim()
    .replace(/[.!。]+$/, "")
    .toLowerCase();
  if (TRUE_WORDS.includes(text)) return "True";
  if (FALSE_WORDS.includes(text)) return "False";
  return "";
}

function isTrueFalseChoices(choices) {
  const list = Array.isArray(choices) ? choices : [];
  if (list.length !== 2) return false;
  const words = list.map((choice) => trueFalseWord(choice && choice.text));
  return !!words[0] && !!words[1] && words[0] !== words[1];
}

/**
 * Canonical True/False key. Accepts words (`true`, `T`, `yes`), and a letter
 * (`A`/`B`) mapped through the note's own choices when they are True/False.
 */
function normalizeTrueFalse(value, choices) {
  const direct = trueFalseWord(value);
  if (direct) return direct;
  const letters = parseChoiceSet(value);
  if (letters.length === 1) {
    const letter = letters[0];
    const list = Array.isArray(choices) ? choices : [];
    const hit = list.find((choice) => str(choice && choice.letter).trim().toUpperCase() === letter);
    const word = trueFalseWord(hit && hit.text);
    if (word) return word;
    if (!list.length && letter === "A") return "True";
    if (!list.length && letter === "B") return "False";
  }
  return "";
}

/** Display labels for the two buttons, keeping whatever wording the note uses. */
function trueFalseLabels(choices) {
  const list = Array.isArray(choices) ? choices : [];
  const label = (word) => {
    const hit = list.find((choice) => trueFalseWord(choice && choice.text) === word);
    return hit && str(hit.text).trim() ? str(hit.text).trim() : word;
  };
  return [
    { value: "True", label: label("True") },
    { value: "False", label: label("False") },
  ];
}

/** A key that keeps its declared type readable: canonical set or words. */
function normalizeAnswerKey(mode, key, choices) {
  if (mode === "tf") return normalizeTrueFalse(key, choices) || str(key).trim();
  if (mode === "multi") return formatChoiceSet(parseChoiceSet(key)) || str(key).trim();
  return str(key).trim();
}

function textTokens(value) {
  return String(value)
    .split(/[,;|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Set comparison for select-all. Letter keys compare as letters; a free-text
 * key compares as a comma-separated list, so "mitosis, meiosis" still works.
 */
function gradeChoiceSelection(key, chosen) {
  const keyLetters = parseChoiceSet(key);
  const chosenLetters = parseChoiceSet(chosen);
  const byLetter = keyLetters.length > 0;
  const expected = byLetter ? keyLetters : textTokens(key);
  const picked = byLetter ? chosenLetters : textTokens(chosen);
  const missing = expected.filter((item) => !picked.includes(item));
  const extra = picked.filter((item) => !expected.includes(item));
  const correct = expected.length > 0 && !missing.length && !extra.length;
  return {
    correct,
    keySet: expected,
    selected: picked,
    missing,
    extra,
    interpreted: byLetter ? picked.join(", ") : picked.join(", "),
  };
}

module.exports = {
  parseChoiceSet,
  formatChoiceSet,
  isChoiceSetAnswer,
  trueFalseWord,
  isTrueFalseChoices,
  normalizeTrueFalse,
  trueFalseLabels,
  normalizeAnswerKey,
  gradeChoiceSelection,
};
