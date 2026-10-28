"use strict";
const { normalizePath } = require("obsidian");

/* ------------------------------------------------------------ pure helpers */

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDateTime = (d) => `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d, n) => {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
};
const fmtClock = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
const str = (v) => (v === undefined || v === null ? "" : String(v));

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
  const clean = normalizePath(str(folder).trim() || "/");
  if (clean === "/" || clean === "") return "";
  let cur = "";
  for (const part of clean.split("/").filter(Boolean)) {
    cur = cur ? `${cur}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(cur)) await app.vault.createFolder(cur);
  }
  return cur;
}

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

module.exports = {
  pad,
  fmtDate,
  fmtDateTime,
  addDays,
  fmtClock,
  str,
  sleep,
  fmtMB,
  hashString,
  ensureFolder,
  localDate,
};
