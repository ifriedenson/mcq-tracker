"use strict";
/*
 * Weak-spot targeted generation.
 *
 * The prompt contains only a skill name, an optional course and the requested
 * format; it does not send question notes, answers or personal notes. The
 * learner still previews every item before anything is written, and confirmed
 * writes go through the existing AI write journal.
 */
const { computeStats, weakestRow } = require("./stats");
const { str } = require("./util");

const WEAK_SPOT_MIN_ATTEMPTS = 3;

function weakSpotRows(questions) {
  return computeStats(Array.isArray(questions) ? questions : [], "skill").filter((row) => row.accuracy !== null);
}

function pickWeakSpot(questions) {
  return weakestRow(weakSpotRows(questions), WEAK_SPOT_MIN_ATTEMPTS);
}

function buildWeakSpotPrompt(options) {
  const o = options || {};
  const kind = o.kind === "cards" ? "cards" : "questions";
  const count = Math.max(1, Math.min(20, Math.round(Number(o.count) || (kind === "cards" ? 8 : 5))));
  const skill = str(o.skill).trim() || "the weakest skill";
  const course = str(o.course).trim();
  const system =
    "You write original study material for a student. Use the named skill only. Do not copy an existing question or claim the source of an item. " +
    "Answers and explanations must be correct and self-contained.";
  if (kind === "cards") {
    return {
      system,
      user: [
        `Write ${count} flashcards for the skill: ${skill}.`,
        course ? `Course: ${course}` : "",
        "Return only a JSON object in this exact shape:",
        '{"cards":[{"front":"prompt or term","back":"answer or definition"}]}',
        "Keep each side short and unambiguous. Do not include a source note or file path.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  return {
    system,
    user: [
      `Write ${count} original multiple-choice questions for the skill: ${skill}.`,
      course ? `Course: ${course}` : "",
      "Return only a JSON object in this exact shape:",
      '{"questions":[{"question":"the question","choices":["choice A","choice B","choice C","choice D"],"answer":"B","explanation":"why B is right and the others are wrong"}]}',
      "Use exactly four choices and a single letter answer from A to D. Keep the explanation under 500 characters.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

module.exports = {
  WEAK_SPOT_MIN_ATTEMPTS,
  buildWeakSpotPrompt,
  pickWeakSpot,
  weakSpotRows,
};
