"use strict";
/*
 * Recent Files model. Pure: paths in, rows out. The view supplies Obsidian's
 * recent list (or a vault fallback); this module only normalizes, filters,
 * pins and formats. It never reads a file or stores anything on disk.
 */
const { str } = require("./util");

const DEFAULT_RECENT_FILES = {
  enabled: true,
  limit: 25,
  pinned: [],
};

function normalizeRecentFiles(value) {
  const raw = value && typeof value === "object" ? value : {};
  const pinned = [];
  for (const item of Array.isArray(raw.pinned) ? raw.pinned : []) {
    const path = str(item).trim();
    if (path && !pinned.includes(path)) pinned.push(path);
    if (pinned.length >= 50) break;
  }
  return {
    enabled: raw.enabled !== false,
    limit: Math.max(5, Math.min(100, Math.round(Number(raw.limit) || DEFAULT_RECENT_FILES.limit))),
    pinned,
  };
}

function cleanPath(value) {
  return str(value).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function nameOf(path) {
  return cleanPath(path).split("/").pop() || "Untitled";
}

function folderOf(path) {
  const clean = cleanPath(path);
  const cut = clean.lastIndexOf("/");
  return cut < 0 ? "" : clean.slice(0, cut);
}

/** A short, stable age label; `then` and `now` are milliseconds. */
function relativeTime(then, now) {
  const past = Number(then);
  const current = Number(now);
  if (!Number.isFinite(past) || past <= 0 || !Number.isFinite(current)) return "";
  const seconds = Math.max(0, Math.round((current - past) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  const date = new Date(past);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * Feed `paths` in most-recent-first order. `info` maps a path to
 * `{ mtime, size }`; pinned paths are moved to the top in pin order.
 */
function recentRows(paths, info, options) {
  const opts = options || {};
  const settings = normalizeRecentFiles({ pinned: opts.pinned, limit: opts.limit });
  const meta = info && typeof info === "object" ? info : {};
  const seen = new Set();
  const rows = [];
  for (let index = 0; index < (Array.isArray(paths) ? paths : []).length; index++) {
    const path = cleanPath(paths[index]);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const entry = meta[path] || meta[path.replace(/\\/g, "/")] || {};
    rows.push({
      path,
      name: nameOf(path),
      folder: folderOf(path),
      mtime: Number(entry.mtime) || 0,
      size: Number(entry.size) || 0,
      pinned: false,
      index,
      relative: relativeTime(entry.mtime, opts.now === undefined ? Date.now() : opts.now),
    });
  }
  const pinOrder = new Map(settings.pinned.map((path, index) => [path, index]));
  for (const row of rows) {
    if (pinOrder.has(row.path)) {
      row.pinned = true;
      row.pinIndex = pinOrder.get(row.path);
    }
  }
  rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned) return a.pinIndex - b.pinIndex;
    return a.index - b.index;
  });
  return rows.slice(0, settings.limit);
}

function togglePinned(pinned, path, limit) {
  const clean = cleanPath(path);
  const current = normalizeRecentFiles({ pinned, limit }).pinned;
  if (!clean) return current;
  if (current.includes(clean)) return current.filter((item) => item !== clean);
  return [clean, ...current].slice(0, 50);
}

function filterRecentRows(rows, query, pinnedOnly) {
  const needle = str(query).trim().toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (pinnedOnly && !row.pinned) return false;
    if (!needle) return true;
    return row.path.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle);
  });
}

module.exports = {
  DEFAULT_RECENT_FILES,
  normalizeRecentFiles,
  relativeTime,
  recentRows,
  togglePinned,
  filterRecentRows,
};
