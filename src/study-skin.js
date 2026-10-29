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

module.exports = {
  STUDY_SKINS,
  STUDY_SKIN_LABELS,
  normalizeStudySkin,
  studySkinEnabled,
  resolveStudySkin,
  studySeconds,
  studyAttemptForFlip,
  studyAttemptForChoice,
  studyProgress,
};
