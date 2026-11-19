"use strict";
/*
 * A persistent, per-message journal of applied OpenCode agent edits. The
 * in-memory `agentEditUndo` slot only ever held the last review and vanished
 * on reload, so any earlier message's edits were final; every applied review
 * is now journalled with its before/after text and can be undone on its own.
 * Device-local like the AI write journal: paths belong to this vault, and a
 * synced list could point at files another device does not have.
 */
const { localDate, str } = require("./util");

const AGENT_EDIT_STORAGE_KEY = "mcq-tracker-agent-edits";
const MAX_AGENT_EDIT_RECORDS = 10;
const MAX_CHANGES_PER_RECORD = 12;
const MAX_CHANGE_TEXT = 65536;

function capText(value) {
  const text = value === null || value === undefined ? null : String(value).replace(/\r\n?/g, "\n");
  if (text === null) return null;
  return text.length > MAX_CHANGE_TEXT ? text.slice(0, MAX_CHANGE_TEXT) : text;
}

function cleanChange(value) {
  const source = value && typeof value === "object" ? value : {};
  const path = str(source.path).trim();
  if (!path) return null;
  return {
    path,
    status: source.status === "added" || source.status === "deleted" ? source.status : "modified",
    before: capText(source.before === undefined ? null : source.before),
    after: capText(source.after === undefined ? null : source.after),
  };
}

function makeAgentEditRecord(input) {
  const source = input && typeof input === "object" ? input : {};
  const changes = [];
  for (const raw of Array.isArray(source.changes) ? source.changes : []) {
    const change = cleanChange(raw);
    if (!change) continue;
    changes.push(change);
    if (changes.length >= MAX_CHANGES_PER_RECORD) break;
  }
  if (!changes.length) return null;
  return {
    id: str(source.id).trim() || `ae-${Date.now().toString(36)}-${changes.length}`,
    date: str(source.date).trim() || localDate(),
    label: str(source.label).trim().slice(0, 160),
    changes,
  };
}

function normalizeAgentEditRecords(value) {
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const record = makeAgentEditRecord(raw);
    if (!record) continue;
    out.push(record);
    if (out.length >= MAX_AGENT_EDIT_RECORDS) break;
  }
  return out;
}

function appendAgentEditRecord(list, record) {
  if (!record) return normalizeAgentEditRecords(list);
  return [record, ...normalizeAgentEditRecords(list)].slice(0, MAX_AGENT_EDIT_RECORDS);
}

function latestAgentEditRecord(list) {
  return normalizeAgentEditRecords(list)[0] || null;
}

function findAgentEditRecord(list, id) {
  return normalizeAgentEditRecords(list).find((record) => record.id === str(id)) || null;
}

module.exports = {
  AGENT_EDIT_STORAGE_KEY,
  MAX_AGENT_EDIT_RECORDS,
  MAX_CHANGES_PER_RECORD,
  MAX_CHANGE_TEXT,
  appendAgentEditRecord,
  findAgentEditRecord,
  latestAgentEditRecord,
  makeAgentEditRecord,
  normalizeAgentEditRecords,
};
