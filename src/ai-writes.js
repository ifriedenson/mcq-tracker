"use strict";
/*
 * A device-local journal of notes written by an AI generation flow.
 *
 * The journal stores paths, not note contents, so Undo can remove exactly the
 * files the learner confirmed. It is kept in local storage rather than
 * data.json: paths belong to this vault, and a synced list could point at
 * files another device does not have. Old records are capped so the journal
 * cannot grow forever.
 */
const { localDate, str } = require("./util");

const AI_WRITE_STORAGE_KEY = "mcq-tracker-ai-writes";
const MAX_AI_WRITES = 20;

function cleanPaths(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((path) => str(path).trim()).filter(Boolean))];
}

function normalizeAiWrites(value) {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  for (const record of list) {
    if (!record || typeof record !== "object") continue;
    const paths = cleanPaths(record.paths);
    if (!paths.length) continue;
    out.push({
      id: str(record.id) || `ai-${out.length}`,
      date: str(record.date) || localDate(),
      kind: record.kind === "questions" ? "questions" : "cards",
      sourcePath: str(record.sourcePath),
      model: str(record.model),
      summary: str(record.summary),
      paths,
    });
    if (out.length >= MAX_AI_WRITES) break;
  }
  return out;
}

function makeAiWriteRecord(input) {
  const paths = cleanPaths(input && input.paths);
  if (!paths.length) return null;
  return {
    id: `ai-${Date.now().toString(36)}-${paths.length}`,
    date: localDate(),
    kind: input && input.kind === "questions" ? "questions" : "cards",
    sourcePath: str(input && input.sourcePath),
    model: str(input && input.model),
    summary: str(input && input.summary),
    paths,
  };
}

function appendAiWrite(list, record) {
  if (!record) return normalizeAiWrites(list);
  return [record, ...normalizeAiWrites(list)].slice(0, MAX_AI_WRITES);
}

function latestAiWrite(list) {
  return normalizeAiWrites(list)[0] || null;
}

module.exports = {
  AI_WRITE_STORAGE_KEY,
  MAX_AI_WRITES,
  appendAiWrite,
  latestAiWrite,
  makeAiWriteRecord,
  normalizeAiWrites,
};
