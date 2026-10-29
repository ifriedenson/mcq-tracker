"use strict";
/*
 * The Quizlet-style study skin is a presentation over the same MCQ notes.
 * It deliberately does not own a queue or a scheduler: the practice view
 * builds the queue from the normal filters, and these helpers turn a card
 * rating into the same attempt object that normal practice writes.
 */
const { str } = require("./util");

const STUDY_SKINS = ["off", "flip", "choice"];
const STUDY_SKIN_LABELS = {
  off: "Off",
  flip: "Flip cards",
  choice: "Choice cards",
};

function normalizeStudySkin(value) {
  const skin = str(value).trim().toLowerCase();
  return STUDY_SKINS.includes(skin) ? skin : "off";
}

function studySkinEnabled(settings) {
  return normalizeStudySkin(settings && settings.studySkin) !== "off";
}

/** Choice mode needs choices and a key; anything else falls back to a flip card. */
function resolveStudySkin(skin, card) {
  const requested = normalizeStudySkin(skin);
  if (requested !== "choice") return requested === "flip" ? "flip" : "off";
  const choices = card && card.sections && Array.isArray(card.sections.choices) ? card.sections.choices : [];
  const hasKey = !!(card && str(card.key).trim());
  const canChoose = !!card && card.mode === "mcq" && hasKey && choices.length > 0;
  return canChoose ? "choice" : "flip";
}

function studySeconds(startedAt, now) {
  const start = Number(startedAt) || 0;
  const end = Number(now) || Date.now();
  return Math.max(1, Math.round((end - start) / 1000));
}

/** A flip card is recall: Known counts as correct, Still learning as a miss. */
function studyAttemptForFlip(known, seconds) {
  const correct = known === true;
  return {
    correct,
    chosen: correct ? "known" : "still learning",
    conf: correct ? 3 : 0,
    seconds: Math.max(1, Math.round(Number(seconds) || 1)),
  };
}

/** A choice card records the selected letter exactly like normal practice. */
function studyAttemptForChoice(chosen, key, seconds, selfGraded) {
  const picked = str(chosen).trim();
  const correct = selfGraded ? picked === "correct" : !!picked && picked.toUpperCase() === str(key).trim().toUpperCase();
  return {
    correct,
    chosen: picked,
    conf: correct ? 2 : 0,
    seconds: Math.max(1, Math.round(Number(seconds) || 1)),
  };
}

function studyProgress(index, total) {
  const at = Math.max(0, Number(index) || 0) + 1;
  const count = Math.max(0, Number(total) || 0);
  return `${Math.min(at, count)} / ${count}`;
}

/* ---- session modes: Flashcards (default), Learn, Test and Match ---- */

const STUDY_MODES = ["cards", "learn", "test", "match"];
const STUDY_MODE_LABELS = {
  cards: "Flashcards",
  learn: "Learn",
  test: "Test",
  match: "Match",
};

function normalizeStudyMode(value) {
  const mode = str(value).trim().toLowerCase();
  return STUDY_MODES.includes(mode) ? mode : "cards";
}

function studyModeLabel(mode) {
  return STUDY_MODE_LABELS[normalizeStudyMode(mode)];
}

/** Learn brings a missed card back once, after at least one other card. */
function shouldRepeatStudyCard(mode, correct, alreadyRepeated) {
  return normalizeStudyMode(mode) === "learn" && correct !== true && alreadyRepeated !== true;
}

function clipStudyText(value, limit) {
  const text = str(value).replace(/\s+/g, " ").trim();
  const max = Math.max(1, Number(limit) || 120);
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** One matchable pair: the question prompt and its keyed answer. */
function matchPairForCard(card) {
  const path = str(card && card.file && card.file.path);
  const question = clipStudyText(card && card.sections && card.sections.question, 140);
  const key = str(card && card.key).trim();
  const choices = card && card.sections && Array.isArray(card.sections.choices) ? card.sections.choices : [];
  const hit = choices.find((choice) => str(choice && choice.letter).trim().toUpperCase() === key.toUpperCase());
  const back = clipStudyText(hit ? `${str(hit.letter).trim()}. ${hit.text}` : key, 140);
  if (!path || !question || !back) return null;
  return { id: path, path, front: question, back };
}

function buildMatchPairs(cards, limit) {
  const cap = Math.max(2, Math.min(6, Number(limit) || 6));
  const seen = new Set();
  const out = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const pair = matchPairForCard(card);
    if (!pair || seen.has(pair.id)) continue;
    seen.add(pair.id);
    out.push(pair);
    if (out.length >= cap) break;
  }
  return out;
}

function shufflePairs(pairs, rand) {
  const list = (Array.isArray(pairs) ? pairs : []).slice();
  const random = typeof rand === "function" ? rand : Math.random;
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

module.exports = {
  STUDY_SKINS,
  STUDY_SKIN_LABELS,
  STUDY_MODES,
  STUDY_MODE_LABELS,
  normalizeStudySkin,
  normalizeStudyMode,
  studyModeLabel,
  shouldRepeatStudyCard,
  clipStudyText,
  matchPairForCard,
  buildMatchPairs,
  shufflePairs,
  studySkinEnabled,
  resolveStudySkin,
  studySeconds,
  studyAttemptForFlip,
  studyAttemptForChoice,
  studyProgress,
};
