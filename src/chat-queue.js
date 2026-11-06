"use strict";
/*
 * Pending study-agent messages. A queue is an ordered list of plain strings,
 * stored with the conversation that owns it. This module only normalizes and
 * edits the list; ChatPanel owns delivery and AgentView owns persistence.
 */

const MAX_QUEUE = 20;
const MAX_QUEUE_CHARS = 8000;

function normalizeQueue(value) {
  const rows = [];
  for (const item of Array.isArray(value) ? value : []) {
    const text = String(item && typeof item === "object" ? item.text : item)
      .trim()
      .slice(0, MAX_QUEUE_CHARS);
    if (!text) continue;
    rows.push(text);
    if (rows.length >= MAX_QUEUE) break;
  }
  return rows;
}

function enqueue(queue, text) {
  const value = String(text === undefined || text === null ? "" : text)
    .trim()
    .slice(0, MAX_QUEUE_CHARS);
  const rows = normalizeQueue(queue);
  if (!value || rows.length >= MAX_QUEUE) return rows;
  rows.push(value);
  return rows;
}

function removeAt(queue, index) {
  const rows = normalizeQueue(queue);
  const at = Number(index);
  if (!Number.isInteger(at) || at < 0 || at >= rows.length) return rows;
  rows.splice(at, 1);
  return rows;
}

module.exports = {
  MAX_QUEUE,
  MAX_QUEUE_CHARS,
  enqueue,
  normalizeQueue,
  removeAt,
};
