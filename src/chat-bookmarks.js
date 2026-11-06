"use strict";
/*
 * Message bookmarks for the study agent.
 *
 * A bookmark is stored on the conversation it belongs to, next to the existing
 * messages in settings.ai / chatSessions. It keeps the message index plus a
 * small role/content fingerprint, so reopening a conversation can find the
 * exact message even if the history was trimmed or another turn was inserted.
 * Links are plain Obsidian URIs handled by the plugin. Pure: no Obsidian API.
 */
const { str } = require("./util");

const MAX_BOOKMARKS = 100;
const MAX_PREVIEW = 140;
const MAX_LINK = 2400;
const MAX_CHAT_ID = 160;
const HASH_RE = /^[a-z0-9]{1,16}$/;

function roleOf(value) {
  return value === "user" ? "user" : "assistant";
}

function messageText(value) {
  const message = value && typeof value === "object" ? value : {};
  if (Array.isArray(message.texts)) return message.texts.map((text) => str(text)).join("\n\n").trim();
  return str(message.content === undefined ? message.text : message.content).trim();
}

/** A short stable fingerprint of the role and the exact stored message text. */
function hashMessage(role, content) {
  const text = `${roleOf(role)}\n${str(content).trim()}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36);
}

function previewText(content) {
  const text = str(content).replace(/\s+/g, " ").trim();
  return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW - 3).trimEnd()}...` : text;
}

/**
 * Build a bookmark for one displayed message. `value` may be a stored message
 * ({role, content}), a rendered turn ({role, texts}) or a plain content string.
 * `index` is the message's position in the conversation history.
 */
function makeBookmark(value, index, now) {
  const message = value && typeof value === "object" ? value : { content: value };
  const at = Number(index === undefined ? message.index : index);
  if (!Number.isFinite(at) || at < 0) return null;
  const role = roleOf(message.role);
  const content = messageText(message);
  if (!content) return null;
  return {
    index: Math.floor(at),
    role,
    hash: hashMessage(role, content),
    preview: previewText(content),
    createdAt: Number.isFinite(Number(now)) && Number(now) > 0 ? Number(now) : Date.now(),
  };
}

function normalizeBookmark(value, options) {
  const opts = options && typeof options === "object" ? options : {};
  if (!value || typeof value !== "object") return null;
  const index = Math.floor(Number(value.index === undefined ? value.messageIndex : value.index));
  if (!Number.isFinite(index) || index < 0) return null;
  const role = roleOf(value.role);
  const hash = str(value.hash).trim().toLowerCase();
  if (!HASH_RE.test(hash) && !(opts.allowMissingHash === true && !hash)) return null;
  const createdAt = Number(value.createdAt);
  return {
    index,
    role,
    hash,
    preview: previewText(value.preview || value.content || ""),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0,
  };
}

function bookmarkKey(value) {
  const bookmark = normalizeBookmark(value);
  return bookmark ? `${bookmark.index}:${bookmark.role}:${bookmark.hash}` : "";
}

/** Keep only valid bookmarks, one per message, newest last. */
function normalizeBookmarks(value) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const bookmark = normalizeBookmark(raw);
    if (!bookmark) continue;
    const key = bookmarkKey(bookmark);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(bookmark);
  }
  return out.slice(-MAX_BOOKMARKS);
}

function findBookmark(value, candidate) {
  const key = bookmarkKey(candidate);
  if (!key) return null;
  return normalizeBookmarks(value).find((bookmark) => bookmarkKey(bookmark) === key) || null;
}

function isBookmarked(value, candidate) {
  return !!findBookmark(value, candidate);
}

/** Add a bookmark, or remove it when this exact message is already saved. */
function toggleBookmark(value, candidate) {
  const rows = normalizeBookmarks(value);
  const bookmark = normalizeBookmark(candidate);
  if (!bookmark) return rows;
  const key = bookmarkKey(bookmark);
  const without = rows.filter((row) => bookmarkKey(row) !== key);
  if (without.length !== rows.length) return without;
  return [...rows, bookmark].slice(-MAX_BOOKMARKS);
}

/** Find the stored message, preferring the recorded index and then its fingerprint. */
function resolveBookmark(messages, value) {
  const bookmark = normalizeBookmark(value, { allowMissingHash: true });
  const rows = Array.isArray(messages) ? messages : [];
  if (!bookmark || !rows.length) return { ok: false, reason: "missing", index: -1, message: null };
  const matches = (message) => {
    const role = roleOf(message && message.role);
    if (bookmark.role !== role) return false;
    if (!bookmark.hash) return true;
    return hashMessage(role, messageText(message)) === bookmark.hash;
  };
  if (bookmark.index < rows.length && matches(rows[bookmark.index])) {
    return { ok: true, reason: "", index: bookmark.index, message: rows[bookmark.index] };
  }
  let best = -1;
  let distance = Infinity;
  for (let i = 0; i < rows.length; i += 1) {
    if (!matches(rows[i])) continue;
    const next = Math.abs(i - bookmark.index);
    if (next < distance) {
      best = i;
      distance = next;
    }
  }
  return best >= 0
    ? { ok: true, reason: "", index: best, message: rows[best] }
    : { ok: false, reason: "missing", index: -1, message: null };
}

/** A copyable URI that opens the owning conversation and focuses this message. */
function bookmarkLink(chatId, value) {
  const id = str(chatId).trim().slice(0, MAX_CHAT_ID);
  const bookmark = normalizeBookmark(value);
  if (!id || !bookmark) return "";
  const query = [
    `chat=${encodeURIComponent(id)}`,
    `message=${bookmark.index}`,
    `role=${bookmark.role}`,
    `hash=${bookmark.hash}`,
  ].join("&");
  return `obsidian://mcq-tracker-chat?${query}`;
}

/**
 * Parse our own chat URI, or an object supplied by Obsidian's protocol handler.
 * A missing hash is tolerated for old/manual links and falls back to the index.
 */
function parseBookmarkLink(value) {
  let params = null;
  if (value && typeof value === "object") {
    params = value;
  } else {
    const text = str(value).trim();
    if (!text || text.length > MAX_LINK) return null;
    const match = /^obsidian:\/\/mcq-tracker(?:-chat)?\/?\?(.+)$/i.exec(text);
    if (!match) return null;
    try {
      params = Object.fromEntries(new URLSearchParams(match[1]));
    } catch (e) {
      return null;
    }
  }
  if (!params || typeof params !== "object") return null;
  const chatId = str(params.chat === undefined ? params.chatId : params.chat).trim().slice(0, MAX_CHAT_ID);
  const rawIndex = params.message === undefined ? params.messageIndex : params.message;
  const index = Math.floor(Number(rawIndex));
  if (!chatId || !Number.isFinite(index) || index < 0) return null;
  const role = roleOf(params.role);
  const hash = str(params.hash).trim().toLowerCase();
  if (hash && !HASH_RE.test(hash)) return null;
  return {
    chatId,
    bookmark: {
      index,
      role,
      hash,
      preview: previewText(params.preview || ""),
      createdAt: 0,
    },
  };
}

module.exports = {
  HASH_RE,
  MAX_BOOKMARKS,
  MAX_LINK,
  MAX_PREVIEW,
  bookmarkKey,
  bookmarkLink,
  findBookmark,
  hashMessage,
  isBookmarked,
  makeBookmark,
  messageText,
  normalizeBookmark,
  normalizeBookmarks,
  parseBookmarkLink,
  previewText,
  resolveBookmark,
  toggleBookmark,
};
