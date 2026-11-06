"use strict";
/*
 * `/compact`: fold older chat turns into one bounded, locally generated summary.
 *
 * No provider is called. The summary is deterministic, the newest turns stay
 * byte-for-byte verbatim, and the result is checked against the same local token
 * budget the composer footer uses. When the recent turns alone are already over
 * the budget, nothing is changed and the caller gets a plain reason.
 */
const { str } = require("./util");
const chatBudget = require("./chat-budget");

const DEFAULT_KEEP_RECENT = 4;
const MIN_MESSAGES_TO_COMPACT = 6;
const MAX_SUMMARY_CHARS = 2400;
const MAX_SUMMARY_LINE = 180;
const COMPACT_TARGET_RATIO = 0.7;

function normalizeMessages(value) {
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const role = raw && (raw.role === "user" || raw.role === "assistant") ? raw.role : "";
    const content = str(raw && raw.content).trim();
    if (!role || !content) continue;
    out.push({ role, content });
  }
  return out;
}

function oneLine(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

/** Nearest older turns are kept first; the oldest are named only by a count. */
function summarizeOld(messages) {
  const lines = [];
  let chars = 0;
  let omitted = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const prefix = message.role === "user" ? "Learner" : "Tutor";
    let line = `${prefix}: ${oneLine(message.content)}`;
    if (line.length > MAX_SUMMARY_LINE) line = `${line.slice(0, MAX_SUMMARY_LINE - 1).trimEnd()}…`;
    if (chars + line.length + 1 > MAX_SUMMARY_CHARS) {
      omitted = i + 1;
      break;
    }
    lines.push(line);
    chars += line.length + 1;
  }
  lines.reverse();
  return {
    text: omitted ? `(Earlier messages omitted: ${omitted})\n${lines.join("\n")}` : lines.join("\n"),
    omitted,
  };
}

function conversationTokens(messages) {
  return chatBudget.budgetState([
    { label: "conversation", text: messages.map((message) => `${message.role}: ${message.content}`).join("\n\n") },
  ]).tokens;
}

function compactMessages(value, options) {
  const opts = options || {};
  const limit = Math.max(1, Math.floor(Number(opts.limit) || chatBudget.CONTEXT_BUDGET_TOKENS));
  const ratio = Number(opts.targetRatio);
  const target = Math.max(1, Math.floor(limit * (Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? ratio : COMPACT_TARGET_RATIO)));
  const messages = normalizeMessages(value);
  const beforeTokens = conversationTokens(messages);
  const base = { messages, limit, target, beforeTokens, tokens: beforeTokens };
  if (messages.length < MIN_MESSAGES_TO_COMPACT) {
    return {
      ...base,
      ok: false,
      reason: `This chat has only ${messages.length} messages; there is nothing old enough to compact.`,
    };
  }
  if (beforeTokens <= target) {
    return {
      ...base,
      ok: false,
      reason: `This chat is already about ${beforeTokens} tokens, under the ${target}-token compaction target; there is nothing worth folding.`,
    };
  }
  const requestedKeep = Math.max(2, Math.floor(Number(opts.keepRecent) || DEFAULT_KEEP_RECENT));
  const maxKeep = Math.min(requestedKeep, messages.length - 2);
  let lastTokens = beforeTokens;
  for (let keep = maxKeep; keep >= 2; keep -= 1) {
    let cut = messages.length - keep;
    while (cut < messages.length && messages[cut].role !== "user") cut += 1;
    if (cut <= 0 || cut >= messages.length) continue;
    const recent = messages.slice(cut);
    const summary = summarizeOld(messages.slice(0, cut));
    if (!summary.text) continue;
    const replacement = [
      {
        role: "user",
        content: `[Earlier conversation summary — compacted locally]\n\n${summary.text}\n\nContinue from this summary; the recent messages below are verbatim.`,
      },
      { role: "assistant", content: "Understood. I will continue from that summary and the recent messages." },
      ...recent,
    ];
    const tokens = conversationTokens(replacement);
    lastTokens = tokens;
    if (tokens <= target || (recent.length <= 2 && tokens <= limit)) {
      return {
        ok: true,
        messages: replacement,
        beforeTokens,
        tokens,
        limit,
        target,
        kept: recent.length,
        removed: cut,
        summaryChars: summary.text.length,
        omitted: summary.omitted,
      };
    }
  }
  return {
    ...base,
    tokens: lastTokens,
    ok: false,
    reason:
      "The most recent turns alone are still over the local chat budget, so nothing was compacted. Shorten or remove recent messages first.",
  };
}

module.exports = {
  COMPACT_TARGET_RATIO,
  DEFAULT_KEEP_RECENT,
  MAX_SUMMARY_CHARS,
  MAX_SUMMARY_LINE,
  MIN_MESSAGES_TO_COMPACT,
  compactMessages,
  conversationTokens,
  normalizeMessages,
  summarizeOld,
};
