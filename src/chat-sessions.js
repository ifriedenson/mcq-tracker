"use strict";
/*
 * Conversation library for the study agent.
 *
 * The active conversation lives in `settings.ai.studyChat` (the Direct API
 * transcript) as before. This module archives finished conversations and
 * presents the active one beside them, newest first. Every archive record owns
 * its messages, so resuming is a move out of the archive - not a copy - and no
 * entry is ever listed twice. Saving a chat as a note is a separate, explicit
 * action and never happens here.
 */
const { normalizeChatHistory } = require("./chat-history");
const { str } = require("./util");

const MAX_SESSIONS = 20;
const MAX_TITLE = 80;

function newChatId(now) {
  const stamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return `chat-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A short, single-line title from the first question. */
function titleFromMessages(messages, fallback) {
  const first = (Array.isArray(messages) ? messages : []).find((message) => message && message.role === "user" && str(message.content).trim());
  const line = str(first && first.content)
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return str(fallback).trim() || "New chat";
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}...` : line;
}

function normalizeSession(value) {
  const raw = value && typeof value === "object" ? value : {};
  const messages = normalizeChatHistory(raw.messages);
  const id = str(raw.id).trim();
  if (!id || !messages.length) return null;
  const updatedAt = Number(raw.updatedAt);
  return {
    id,
    title: str(raw.title).trim().slice(0, MAX_TITLE) || titleFromMessages(messages),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    messages,
    sessionId: str(raw.sessionId).trim(),
    notePath: str(raw.notePath).trim(),
  };
}

/** Newest first, one entry per id, at most MAX_SESSIONS. */
function normalizeSessions(value) {
  const seen = new Set();
  const rows = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const session = normalizeSession(raw);
    if (!session || seen.has(session.id)) continue;
    seen.add(session.id);
    rows.push(session);
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
  return rows.slice(0, MAX_SESSIONS);
}

/** Move a conversation into the archive, replacing an older copy of the same id. */
function archiveSession(sessions, record) {
  const session = normalizeSession(record);
  const rest = normalizeSessions(sessions).filter((item) => !session || item.id !== session.id);
  if (!session) return rest;
  return normalizeSessions([session, ...rest]);
}

function removeSession(sessions, id) {
  const key = str(id).trim();
  return normalizeSessions(sessions).filter((session) => session.id !== key);
}

function renameSession(sessions, id, title) {
  const key = str(id).trim();
  const next = str(title).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
  if (!key || !next) return normalizeSessions(sessions);
  return normalizeSessions(
    normalizeSessions(sessions).map((session) => (session.id === key ? { ...session, title: next, updatedAt: Date.now() } : session))
  );
}

/** Local time shown beside a title; the timestamp is stored as epoch ms. */
function formatWhen(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Rows for the panel. The active conversation is included while it has
 * messages; an archived row is never also the active row because resuming
 * removes it from the archive.
 */
function libraryRows(active, sessions, now) {
  const rows = [];
  const messages = normalizeChatHistory(active && active.messages);
  const activeId = str(active && active.id).trim();
  if (messages.length) {
    rows.push({
      id: activeId || "active",
      title: str(active && active.title).trim().slice(0, MAX_TITLE) || titleFromMessages(messages),
      updatedAt: Number(active && active.updatedAt) || Number(now) || 0,
      when: formatWhen(active && active.updatedAt),
      messages,
      active: true,
    });
  }
  for (const session of normalizeSessions(sessions)) {
    if (activeId && session.id === activeId) continue;
    rows.push({
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      when: formatWhen(session.updatedAt),
      messages: session.messages,
      active: false,
    });
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt || Number(b.active) - Number(a.active) || a.title.localeCompare(b.title));
  return rows;
}

module.exports = {
  MAX_SESSIONS,
  MAX_TITLE,
  archiveSession,
  formatWhen,
  libraryRows,
  newChatId,
  normalizeSession,
  normalizeSessions,
  removeSession,
  renameSession,
  titleFromMessages,
};
