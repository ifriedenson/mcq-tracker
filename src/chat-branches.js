"use strict";
/*
 * Local transcript branching for the Study agent.
 *
 * Rewind truncates a conversation to before one user turn and returns that
 * turn's text for the composer. Fork copies the same prefix into a new saved
 * conversation, leaving the original untouched. Pure: no Obsidian API, no
 * provider call and no file write.
 */
const { str } = require("./util");

const MAX_TITLE = 80;
const MAX_TEXT = 20000;

function messageText(value) {
  const message = value && typeof value === "object" ? value : {};
  return str(message.content === undefined ? message.text : message.content).trim();
}

/** History indexes of the user turns that have text, in order. */
function userTurnIndexes(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  const indexes = [];
  for (let index = 0; index < rows.length; index += 1) {
    const message = rows[index];
    if (message && message.role === "user" && messageText(message)) indexes.push(index);
  }
  return indexes;
}

/** Map the nth displayed user turn to its history index, or -1. */
function indexForTurn(messages, turnNumber) {
  const indexes = userTurnIndexes(messages);
  const turn = Number(turnNumber);
  if (!Number.isInteger(turn) || turn < 0 || turn >= indexes.length) return -1;
  return indexes[turn];
}

/** The last user turn number, or -1 when there is no question. */
function lastTurnNumber(messages) {
  return userTurnIndexes(messages).length - 1;
}

function forkTitle(title) {
  const base = str(title).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE) || "Study agent chat";
  const suffix = " (fork)";
  return `${base.slice(0, MAX_TITLE - suffix.length).trimEnd()}${suffix}`;
}

/**
 * The common operation: keep every message before one user turn and return
 * that turn's text. The first turn has no prefix to keep, so it is refused.
 */
function branchPlan(messages, index) {
  const rows = Array.isArray(messages) ? messages : [];
  if (!rows.length) return { ok: false, reason: "no-messages", messages: [], text: "" };
  const at = Number(index);
  if (!Number.isInteger(at) || at < 0 || at >= rows.length) {
    return { ok: false, reason: "missing", messages: [], text: "" };
  }
  const target = rows[at];
  const text = messageText(target);
  if (!target || target.role !== "user" || !text) {
    return { ok: false, reason: "not-user", messages: [], text: "" };
  }
  const prefix = rows.slice(0, at);
  if (!prefix.length) return { ok: false, reason: "first", messages: [], text: "" };
  return { ok: true, reason: "", messages: prefix, text: text.slice(0, MAX_TEXT) };
}

function rewindPlan(messages, index) {
  return branchPlan(messages, index);
}

function forkPlan(messages, index, title) {
  const plan = branchPlan(messages, index);
  if (!plan.ok) return plan;
  return { ...plan, title: forkTitle(title) };
}

function reasonText(reason) {
  if (reason === "no-messages") return "There is no conversation to branch yet.";
  if (reason === "missing") return "That question is no longer in this transcript.";
  if (reason === "not-user") return "Rewind and fork start from a question, not a reply.";
  if (reason === "first") return "This is the first question. There is nothing before it to keep.";
  return "That conversation could not be branched.";
}

module.exports = {
  MAX_TEXT,
  MAX_TITLE,
  branchPlan,
  forkPlan,
  forkTitle,
  indexForTurn,
  lastTurnNumber,
  messageText,
  reasonText,
  rewindPlan,
  userTurnIndexes,
};
