"use strict";
/*
 * Local timestamp bookmarks and chapters for audio attachments. This is the
 * non-recording part of Advanced Audio Recorder (MIT): the plugin stores the
 * timestamp and builds a copyable link, but never records, uploads or plays
 * audio itself. See NOTICES.md.
 */
const { clampInt, hashString, str } = require("./util");

const MAX_BOOKMARKS = 500;
const AUDIO_PATTERN = /\.(mp3|m4a|wav|ogg|oga|flac|aac|opus|webm|mp4)$/i;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enabledValue(value) {
  if (value === false) return false;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return true;
}

function normalizeAudioBookmarkSettings(value) {
  const source = asObject(value);
  const entries = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.entries) ? source.entries : []) {
    const entry = normalizeBookmark(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
    if (entries.length >= MAX_BOOKMARKS) break;
  }
  return { enabled: enabledValue(value), entries: entries.sort((a, b) => a.path.localeCompare(b.path) || a.at - b.at) };
}

function normalizeBookmark(value) {
  const source = asObject(value);
  const path = str(source.path).trim().replace(/^\/+/, "").slice(0, 500);
  if (!path || !AUDIO_PATTERN.test(path)) return null;
  const at = clampInt(Number(source.at) || 0, 0, 24 * 3600);
  return {
    id: str(source.id).trim().slice(0, 160) || `audio-${hashString([path, at, source.label || ""].join("|"))}`,
    path,
    at,
    label: str(source.label).replace(/\s+/g, " ").trim().slice(0, 160) || formatTimestamp(at),
    createdAt: Math.max(0, Math.round(Number(source.createdAt) || 0)),
  };
}

function isAudioPath(path) {
  return AUDIO_PATTERN.test(str(path).trim());
}

/** `1:23`, `01:23:45` or `83s` becomes seconds; invalid input returns -1. */
function parseTimestamp(value) {
  const text = str(value).trim();
  if (!text) return -1;
  if (/^\d+s$/i.test(text)) return clampInt(Number(text.slice(0, -1)), 0, 24 * 3600);
  const parts = text.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) return -1;
  if (parts.some((part) => !/^\d{1,3}$/.test(part))) return -1;
  const numbers = parts.map(Number);
  const seconds = numbers.length === 2
    ? numbers[0] * 60 + numbers[1]
    : numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
  if (numbers.length === 2 && numbers[1] > 59) return -1;
  if (numbers.length === 3 && (numbers[1] > 59 || numbers[2] > 59)) return -1;
  return clampInt(seconds, 0, 24 * 3600);
}

function formatTimestamp(seconds) {
  const total = clampInt(Number(seconds) || 0, 0, 24 * 3600);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function addAudioBookmark(input, now) {
  const source = asObject(input);
  const stamp = Math.max(0, Math.round(Number(now) || Date.now()));
  return normalizeBookmark({ ...source, createdAt: stamp });
}

/** Obsidian's media-fragment link, usable from any note. */
function bookmarkLink(bookmark) {
  const entry = normalizeBookmark(bookmark);
  if (!entry) return "";
  const base = entry.path.replace(/\.md$/i, "");
  return `[[${base}#t=${entry.at}|${entry.label}]]`;
}

/** Group bookmarks for one audio file into ordered chapters. */
function chaptersFor(entries, path) {
  const wanted = str(path).trim().toLowerCase();
  if (!wanted) return [];
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && str(entry.path).trim().toLowerCase() === wanted)
    .map(normalizeBookmark)
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)
    .map((entry, index) => ({ ...entry, chapter: index + 1, atLabel: formatTimestamp(entry.at) }));
}

/** All distinct audio paths that have at least one bookmark. */
function bookmarkPaths(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const path = str(entry && entry.path).trim();
    if (!path || seen.has(path.toLowerCase())) continue;
    seen.add(path.toLowerCase());
    out.push(path);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

module.exports = {
  MAX_BOOKMARKS,
  addAudioBookmark,
  bookmarkLink,
  bookmarkPaths,
  chaptersFor,
  formatTimestamp,
  isAudioPath,
  normalizeAudioBookmarkSettings,
  normalizeBookmark,
  parseTimestamp,
};
