"use strict";
/*
 * Local voice memos: name a recording, build its daily-note line and append it.
 * The audio is captured by the view with the device microphone; this module is
 * pure so naming, refusal and the note write stay testable. Nothing here
 * transcribes, uploads or talks to a speech provider.
 */
const { str } = require("./util");

const MEMO_FOLDER = "Recordings";
const MAX_LABEL = 200;
const MIME_EXTENSIONS = [
  { test: /audio\/mp4|audio\/m4a|audio\/aac/i, extension: "m4a" },
  { test: /audio\/ogg|audio\/opus/i, extension: "ogg" },
  { test: /audio\/wav|audio\/wave|audio\/x-wav/i, extension: "wav" },
  { test: /audio\/mpeg|audio\/mp3/i, extension: "mp3" },
  { test: /audio\/webm/i, extension: "webm" },
];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function safeFolder(value) {
  const clean = str(value).trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return "";
  if (clean.split("/").some((part) => part === ".." || !part)) return "";
  return clean;
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value === undefined ? Date.now() : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeVoiceMemoSettings(value) {
  const source = asObject(value);
  return {
    folder: safeFolder(source.folder) || MEMO_FOLDER,
    dailyNoteFolder: safeFolder(source.dailyNoteFolder),
  };
}

/** `m4a`, `webm`, `ogg`, `wav` or `mp3`; an unknown type falls back to webm. */
function memoExtension(mimeType) {
  const type = str(mimeType).trim().toLowerCase();
  const match = MIME_EXTENSIONS.find((entry) => entry.test.test(type));
  return match ? match.extension : "webm";
}

/** `2026-11-03` in local time, or "" for an unusable date. */
function dayKey(value) {
  const date = asDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `14:32` in local time, or "" for an unusable date. */
function memoTime(value) {
  const date = asDate(value);
  if (!date) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `2026-11-03 14-32-10`, the sortable stamp used by the file name. */
function memoStamp(value) {
  const date = asDate(value);
  if (!date) return "";
  return `${dayKey(date)} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

/** `Recordings/Voice 2026-11-03 14-32-10.webm`, or "" for an unsafe folder. */
function memoPath(folder, date, mimeType) {
  const clean = safeFolder(folder);
  const stamp = memoStamp(date);
  if (!clean || !stamp) return "";
  return `${clean}/Voice ${stamp}.${memoExtension(mimeType)}`;
}

function durationLabel(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return "";
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (!minutes) return `${rest} s`;
  if (!rest) return `${minutes} min`;
  return `${minutes} min ${rest} s`;
}

/** One `- HH:MM ![[path]] · 1 min 20 s · label` line, or "" without time/path. */
function memoEntry(input) {
  const source = asObject(input);
  const path = str(source.path).trim();
  const time = str(source.time).trim();
  if (!path || !time) return "";
  let line = `- ${time} ![[${path}]]`;
  const duration = durationLabel(source.seconds);
  if (duration) line += ` · ${duration}`;
  const label = str(source.label).replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
  if (label) line += ` · ${label}`;
  return line;
}

/** Append the line to a note body, keeping exactly one trailing newline. */
function appendMemoEntry(text, entry) {
  const line = str(entry).trim();
  if (!line) return str(text);
  const body = str(text).replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  return body ? `${body}\n${line}\n` : `${line}\n`;
}

module.exports = {
  MAX_LABEL,
  MEMO_FOLDER,
  appendMemoEntry,
  dayKey,
  durationLabel,
  memoEntry,
  memoExtension,
  memoPath,
  memoStamp,
  memoTime,
  normalizeVoiceMemoSettings,
  safeFolder,
};
