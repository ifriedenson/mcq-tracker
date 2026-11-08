"use strict";
let obsidianNormalizePath = null;
/**
 * Obsidian's path normalizer, loaded on first use so pure modules can import
 * these helpers in plain Node tests without the app runtime.
 */
function normalizeVaultPath(path) {
  if (!obsidianNormalizePath) obsidianNormalizePath = require("obsidian").normalizePath;
  return obsidianNormalizePath(path);
}

/* ------------------------------------------------------------ pure helpers */

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDateTime = (d) => `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDateTimeSec = (d) => `${fmtDateTime(d)}:${pad(d.getSeconds())}`;
const addDays = (d, n) => {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
};
const fmtClock = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
const str = (v) => (v === undefined || v === null ? "" : String(v));

/** Numeric clamp that keeps fractions; bounds are expected in `min <= max` order. */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
/** Numeric clamp for whole counters, rounding before the bounds are applied. */
const clampInt = (value, low, high) => Math.max(low, Math.min(high, Math.round(value)));

/** Plain text from a possibly missing value; no trimming or truncation. */
const textValue = (value) => (value === null || value === undefined ? "" : String(value));

/** Trimmed, CRLF-normalized text capped at `max` characters (uncapped when omitted). */
const boundedText = (value, max) => str(value).replace(/\r\n?/g, "\n").trim().slice(0, max);

/** Path form used by write guards: slashes normalized, edge whitespace and slashes removed. */
function normalizePath(value) {
  return str(value).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape the five HTML-significant characters, apostrophe included. */
const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/**
 * First free vault path for `folder/name.ext`, counting `name 2.ext`, `name 3.ext`…
 * Shared by callers whose naming rule is just the path-illegal characters replaced
 * with `-`; modules with their own sanitizer keep a documented local helper.
 */
function uniquePath(vault, folder, name, extension, fallback) {
  const ext = extension || "md";
  const safe = str(name).replace(/[\\/:*?"<>|]/g, "-").trim() || fallback || "Note";
  let path = normalizeVaultPath(`${folder}/${safe}.${ext}`);
  let n = 2;
  while (vault.getAbstractFileByPath(path)) {
    path = normalizeVaultPath(`${folder}/${safe} ${n}.${ext}`);
    n++;
  }
  return path;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtMB = (n) => `${Math.round(n / 1048576)} MB`;

/** Small, stable content hash for cache signatures. */
function hashString(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

async function ensureFolder(app, folder) {
  const clean = normalizeVaultPath(str(folder).trim() || "/");
  if (clean === "/" || clean === "") return "";
  let cur = "";
  for (const part of clean.split("/").filter(Boolean)) {
    cur = cur ? `${cur}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(cur)) await app.vault.createFolder(cur);
  }
  return cur;
}

function localDate(value) {
  const d = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  return fmtDate(d);
}

module.exports = {
  pad,
  fmtDate,
  fmtDateTime,
  fmtDateTimeSec,
  addDays,
  fmtClock,
  str,
  clamp,
  clampInt,
  textValue,
  boundedText,
  normalizePath,
  escapeHtml,
  uniquePath,
  sleep,
  fmtMB,
  hashString,
  ensureFolder,
  localDate,
};
