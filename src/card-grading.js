"use strict";
/*
 * Deterministic grading for typed flashcard answers.
 *
 * This is deliberately local and provider-free. It handles exact/normalized
 * matches, accepted variants, small typos, simple numbers and partial keyword
 * coverage; an AI fallback can be layered on top later without changing this
 * contract.
 */

const ANSWER_MODES = ["flip", "type", "speak"];
const GRADING_STRICTNESS = ["strict", "standard", "lenient"];
const ARTICLES = new Set([
  "a", "an", "the",
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  "le", "les", "l'", "der", "die", "das", "ein", "eine",
]);
const STOP_WORDS = new Set([
  ...ARTICLES,
  "is", "are", "was", "were", "be", "been", "being",
  "of", "to", "in", "on", "for", "with", "and", "or",
  "that", "this", "it", "as", "at", "by", "from",
]);

function normalizeAnswerMode(value, fallback) {
  const mode = String(value == null ? "" : value).trim().toLowerCase();
  if (ANSWER_MODES.includes(mode)) return mode;
  return fallback === undefined ? "flip" : fallback;
}

function normalizeStrictness(value, fallback) {
  const level = String(value == null ? "" : value).trim().toLowerCase();
  if (GRADING_STRICTNESS.includes(level)) return level;
  return fallback === undefined ? "standard" : fallback;
}

/** Trim Markdown decoration so a card's stored answer can be compared as text. */
function plainText(value) {
  return String(value == null ? "" : value)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, " ")
    .replace(/^\s*[-+]\s+/gm, " ");
}

function normalized(value, strictness) {
  const level = normalizeStrictness(strictness);
  let text = plainText(value).normalize("NFKC").trim().toLowerCase();
  text = text.replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"');
  if (level !== "strict") text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  text = text.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
  if (level !== "strict") {
    const words = text.split(" ").filter(Boolean);
    while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
    text = words.join(" ");
  }
  return text;
}

function contentTokens(value, strictness) {
  return normalized(value, strictness || "standard")
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word));
}

function parseVariants(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value == null ? "" : value)
    .split(/\s*(?:\||;|\n)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function fuzzyLimit(length, strictness) {
  const level = normalizeStrictness(strictness);
  if (level === "strict" || length <= 4) return 0;
  if (level === "lenient") return length <= 8 ? 2 : length <= 20 ? 3 : 4;
  return length <= 8 ? 1 : length <= 20 ? 2 : 3;
}

function numberIn(value) {
  const text = plainText(value).replace(/,/g, "").replace(/[−–—]/g, "-");
  const scientific = text.match(/(-?\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*10\s*\^?\s*([+-]?\d+)/i);
  if (scientific) return Number(scientific[1]) * Math.pow(10, Number(scientific[2]));
  const match = text.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  return match ? Number(match[0]) : null;
}

function numericMatch(expected, typed, strictness) {
  const a = numberIn(expected);
  const b = numberIn(typed);
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  const expectedWords = normalized(expected, strictness)
    .replace(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi, " ")
    .replace(/\b(?:x|times|10)\b/g, " ")
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word));
  const typedText = normalized(typed, strictness);
  if (expectedWords.length && !expectedWords.every((word) => typedText.includes(word))) return false;
  const level = normalizeStrictness(strictness);
  const tolerance = level === "strict" ? 1e-9 : level === "lenient" ? 0.02 : 0.005;
  return Math.abs(a - b) <= Math.max(tolerance, Math.abs(a) * tolerance);
}

function result(verdict, reason, matchedBy, confidence, extra) {
  const suggestedGrade = verdict === "correct" ? "good" : verdict === "partial" ? "hard" : "again";
  return {
    verdict,
    suggestedGrade,
    reason,
    matchedBy,
    confidence,
    ...(extra || {}),
  };
}

/**
 * Grade one typed answer.
 *
 * @param {string} expected the stored answer
 * @param {string} typed the learner's answer
 * @param {{strictness?: string, variants?: string[]|string, tolerance?: number}} options
 */
function gradeTypedAnswer(expected, typed, options) {
  const opts = options || {};
  const strictness = normalizeStrictness(opts.strictness);
  const expectedText = String(expected == null ? "" : expected).trim();
  const typedText = String(typed == null ? "" : typed).trim();
  if (!typedText) return result("incorrect", "Type or dictate an answer first.", "empty", 0);
  if (!expectedText) return result("incorrect", "This card has no stored answer to compare with.", "missing-key", 0);

  const candidates = [expectedText, ...parseVariants(opts.variants)];
  if (expectedText.includes(" · ")) candidates.push(...expectedText.split(/\s*·\s*/).filter(Boolean));
  const typedNorm = normalized(typedText, strictness);

  for (const candidate of candidates) {
    if (!candidate || normalized(candidate, strictness) !== typedNorm) continue;
    return result(
      "correct",
      candidate === expectedText ? "Exact match." : "Matched an accepted answer.",
      candidate === expectedText ? "exact" : "variant",
      1
    );
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (numericMatch(candidate, typedText, strictness)) {
      return result("correct", "Matched numerically.", "numeric", 0.9);
    }
  }

  let best = { distance: Infinity, candidate: "" };
  for (const candidate of candidates) {
    const candidateNorm = normalized(candidate, strictness);
    const distance = editDistance(candidateNorm, typedNorm);
    if (distance < best.distance) best = { distance, candidate: candidateNorm };
  }
  const limit = fuzzyLimit(best.candidate.length, strictness);
  if (limit > 0 && best.distance <= limit && best.distance / Math.max(1, best.candidate.length) <= 0.34) {
    return result("correct", "A small spelling difference; treated as correct.", "typo", 0.7);
  }

  const expectedTokens = contentTokens(expectedText, strictness);
  const typedTokens = new Set(contentTokens(typedText, strictness));
  const missing = expectedTokens.filter((token) => !typedTokens.has(token));
  const coverage = expectedTokens.length ? (expectedTokens.length - missing.length) / expectedTokens.length : 0;
  const partialAt = strictness === "lenient" ? 0.4 : strictness === "strict" ? 0.9 : 0.6;
  if (coverage >= partialAt && expectedTokens.length) {
    return result(
      "partial",
      missing.length ? `Partly there. Missing: ${missing.join(", ")}.` : "The key idea is there, but the wording differs.",
      "tokens",
      coverage,
      { missing }
    );
  }

  return result(
    "incorrect",
    missing.length ? `Not enough of the answer. Missing: ${missing.join(", ")}.` : "That does not match the stored answer.",
    "none",
    Math.max(0, coverage)
  );
}

module.exports = {
  ANSWER_MODES,
  GRADING_STRICTNESS,
  normalizeAnswerMode,
  normalizeStrictness,
  plainText,
  normalized,
  contentTokens,
  parseVariants,
  editDistance,
  gradeTypedAnswer,
};
