"use strict";
/*
 * Blind answer verification.
 *
 * The checker sees the question and choices but never the stored answer or
 * explanation, so it cannot simply agree with the key. The returned letter is
 * compared with the key already in the note. Nothing is written here.
 */
const { str } = require("./util");

const VERIFICATION_MODES = ["mark", "drop"];

function normalizeVerificationMode(value) {
  return str(value).trim().toLowerCase() === "drop" ? "drop" : "mark";
}

function buildBlindVerificationPrompt(data) {
  const d = data || {};
  const choices = Array.isArray(d.choices) ? d.choices : [];
  return {
    system:
      "You are an independent exam answer checker. Solve the question yourself from the question and choices. " +
      "Do not assume any answer is correct and do not ask for the answer key. Return only JSON.",
    user: [
      "QUESTION:",
      str(d.question).trim(),
      "",
      "CHOICES:",
      ...choices.map((choice, index) => {
        const letter = str(choice && choice.letter ? choice.letter : "ABCDEFGH"[index]).trim().toUpperCase();
        const text = choice && choice.text !== undefined ? choice.text : choice;
        return `${letter}. ${str(text).trim()}`;
      }),
      "",
      'Return {"answer":"B","confidence":"high|medium|low","reason":"one short sentence"}.',
      "Use exactly one letter from A to the last choice.",
    ].join("\n"),
  };
}

/** Read the first usable letter answer from a model reply, tolerating fences and a short preface. */
function parseBlindVerification(reply) {
  const text = str(reply)
    .replace(/```(?:json|javascript|js)?/gi, "")
    .replace(/```/g, "")
    .trim();
  let answer = "";
  const json = /\{[\s\S]*\}/.exec(text);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]);
      answer = str(parsed && parsed.answer).trim().toUpperCase().slice(0, 1);
    } catch (e) {
      /* fall through to a plain letter */
    }
  }
  if (!/^[A-H]$/.test(answer)) {
    const match = /\b(?:answer|correct answer)\s*(?:is|:)?\s*([A-H])\b/i.exec(text);
    answer = match ? match[1].toUpperCase() : "";
  }
  const confidence = (/\b(high|medium|low)\b/i.exec(text) || [])[1];
  return { answer, confidence: confidence ? confidence.toLowerCase() : "", raw: text };
}

/** The properties recorded after a check. `verified` is false for a mismatch or an unfinished check. */
function verificationFields(verification) {
  const v = verification || {};
  const out = {
    verified: v.status === "match",
    verified_by: str(v.model).trim() || "AI",
    verified_on: str(v.date).trim(),
    verification: str(v.status).trim() || "unchecked",
  };
  if (str(v.answer).trim()) out.verified_answer = str(v.answer).trim().toUpperCase();
  return out;
}

/** A visible warning block for a disagreement or an unfinished check. */
function verificationBanner(verification) {
  const v = verification || {};
  if (v.status === "mismatch") {
    return (
      "> [!warning] Answer check failed\n" +
      `> An independent AI pass chose ${str(v.answer).trim() || "a different answer"}, but this note's answer is ${str(v.key).trim() || "not set"}. This note is marked for review.\n\n`
    );
  }
  if (v.status === "error") {
    return (
      "> [!warning] Answer check did not finish\n" +
      `> ${str(v.error).trim() || "The independent check could not complete."} This note has not been checked against a second answer.\n\n`
    );
  }
  return "";
}

/** Removes an earlier verification banner without touching an AI-generated notice. */
function stripVerificationBanner(text) {
  return str(text).replace(/^> \[!warning\] Answer check (?:failed|did not finish)[^\n]*(?:\n>[^\n]*)*\n*/m, "");
}

/** Places a verification banner directly after the YAML, replacing an older one. */
function addVerificationBanner(text, verification) {
  const clean = stripVerificationBanner(text);
  const banner = verificationBanner(verification);
  if (!banner) return clean;
  const front = /^---\n[\s\S]*?\n---\n*/.exec(clean);
  if (front) return clean.slice(0, front[0].length) + banner + clean.slice(front[0].length).replace(/^\n+/, "");
  return banner + clean;
}

module.exports = {
  VERIFICATION_MODES,
  addVerificationBanner,
  buildBlindVerificationPrompt,
  normalizeVerificationMode,
  parseBlindVerification,
  stripVerificationBanner,
  verificationBanner,
  verificationFields,
};
