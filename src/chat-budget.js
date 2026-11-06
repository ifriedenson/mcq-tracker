"use strict";
/*
 * Local, estimated chat context budget.
 *
 * The provider sees the system prompt, the transcript, the current question and
 * any attached note text. This module estimates that cost at four characters per
 * token and refuses a request above a conservative local ceiling. It is a guard,
 * not a promise about a model's real context window or bill.
 */
const { str } = require("./util");

const CHARS_PER_TOKEN = 4;
const CONTEXT_BUDGET_TOKENS = 12000;
const WARN_RATIO = 0.8;

function estimateTokens(value) {
  return Math.ceil(str(value).length / CHARS_PER_TOKEN);
}

function formatTokenCount(value) {
  const number = Math.max(0, Math.floor(Number(value) || 0));
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * parts: [{ label, text }]. Returns the total, a per-part breakdown and one of
 * ok / warn / over. `over` is the only state that must refuse a request.
 */
function budgetState(parts, options) {
  const opts = options && typeof options === "object" ? options : {};
  const limit = Math.max(1, Math.floor(Number(opts.limit) || CONTEXT_BUDGET_TOKENS));
  const rows = [];
  let chars = 0;
  for (const part of Array.isArray(parts) ? parts : []) {
    const label = str(part && part.label).trim() || "context";
    const text = str(part && part.text);
    const partChars = text.length;
    chars += partChars;
    rows.push({ label, chars: partChars, tokens: estimateTokens(text) });
  }
  const tokens = Math.ceil(chars / CHARS_PER_TOKEN);
  const ratio = tokens / limit;
  const over = tokens > limit;
  const warn = !over && ratio >= WARN_RATIO;
  return {
    tokens,
    limit,
    chars,
    ratio,
    over,
    warn,
    level: over ? "over" : warn ? "warn" : "ok",
    parts: rows,
  };
}

module.exports = {
  CHARS_PER_TOKEN,
  CONTEXT_BUDGET_TOKENS,
  WARN_RATIO,
  budgetState,
  estimateTokens,
  formatTokenCount,
};
