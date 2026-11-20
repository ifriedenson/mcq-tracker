"use strict";
/**
 * Flashcard quality triage. Pure: it reads card objects and never writes a note.
 * Flags the four problems a self-made deck actually has — a duplicate front, a
 * front too long to recall, the answer printed in the question, and a cloze card
 * with a single deletion (which tests recognition, not recall).
 */
const { str } = require("./util");

const MAX_FRONT = 220;
const MIN_BACK_FOR_ECHO = 4;

/** Fold case, whitespace and punctuation so two fronts that read the same compare equal. */
function frontKey(text) {
  return str(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function clozeCount(front) {
  const matches = str(front).match(/\{\{c\d+::/gi);
  return matches ? matches.length : 0;
}

function frontOf(card) {
  const fm = (card && card.fm) || {};
  const body = (card && card.body) || {};
  return str(body.front || fm.front || fm.prompt || body.rawFront);
}

function backOf(card) {
  const fm = (card && card.fm) || {};
  const body = (card && card.body) || {};
  return str(body.back || fm.back || fm.answer || body.rawBack);
}

/** One row per flagged card, with the reasons that flagged it. */
function triageIssues(cards) {
  const list = Array.isArray(cards) ? cards : [];
  const byFront = new Map();
  for (const card of list) {
    const key = frontKey(frontOf(card));
    if (!key) continue;
    if (!byFront.has(key)) byFront.set(key, []);
    byFront.get(key).push(str(card && card.file && card.file.path));
  }
  const out = [];
  for (const card of list) {
    const fm = (card && card.fm) || {};
    const body = (card && card.body) || {};
    const front = frontOf(card);
    const back = backOf(card);
    const reasons = [];
    const key = frontKey(front);
    if (key && (byFront.get(key) || []).length > 1) {
      reasons.push({ code: "duplicate", label: "Same front as another flashcard" });
    }
    if (front.length > MAX_FRONT) {
      reasons.push({ code: "too-long", label: `Front is ${front.length} characters long` });
    }
    const echo = frontKey(back);
    if (echo.length >= MIN_BACK_FOR_ECHO && key.includes(echo)) {
      reasons.push({ code: "answer-in-question", label: "The answer appears in the front" });
    }
    const kind = str(fm.card_type || body.cardType).toLowerCase();
    if (kind === "cloze" && clozeCount(body.rawFront || front) <= 1) {
      reasons.push({ code: "single-cloze", label: "Only one cloze deletion" });
    }
    if (!reasons.length) continue;
    out.push({
      path: str(card && card.file && card.file.path),
      title: str(fm.card_title || (card && card.file && card.file.basename) || front).slice(0, 80),
      deck: str(fm.deck),
      reasons,
    });
  }
  return out;
}

/** Counts per reason code, for a one-line summary. */
function triageCounts(rows) {
  const counts = { duplicate: 0, "too-long": 0, "answer-in-question": 0, "single-cloze": 0 };
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const reason of row.reasons || []) {
      if (counts[reason.code] !== undefined) counts[reason.code] += 1;
    }
  }
  return counts;
}

module.exports = { MAX_FRONT, triageCounts, triageIssues };
