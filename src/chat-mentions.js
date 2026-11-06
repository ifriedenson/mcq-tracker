"use strict";
/*
 * Explicit @ note and folder mentions for the study agent.
 *
 * A mention is written as `@[[path]]` (folders keep their trailing slash). It is
 * only a reference in the message: nothing is read until the chat resolves the
 * targets, and the panel resolves them only when its Mentions switch is on.
 * Resolution is bounded, reports missing or truncated targets, and labels the
 * content as untrusted study material.
 */
const { str } = require("./util");

const MAX_MENTION_TARGETS = 8;
const MAX_FOLDER_NOTES = 12;
const MAX_MENTION_NOTE_CHARS = 6000;
const MAX_MENTION_TOTAL_CHARS = 12000;
const MAX_MENTION_CANDIDATES = 12;
const MAX_MENTION_PATH = 300;

function normalizePath(value) {
  let path = str(value)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/g, "/");
  if (!path || path.length > MAX_MENTION_PATH || /[\u0000-\u001f]/.test(path)) return "";
  const folder = path.endsWith("/");
  path = path.replace(/\/+$/, "");
  if (!path) return "";
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return "";
  return folder ? `${path}/` : path;
}

function normalizeMention(value) {
  const raw = value && typeof value === "object" ? value : { path: value };
  const path = normalizePath(raw.path);
  if (!path) return null;
  const kind = raw.kind === "folder" || path.endsWith("/") ? "folder" : "note";
  return {
    kind,
    path: path.replace(/\/+$/, ""),
    label: kind === "folder" ? path : path,
  };
}

function mentionToken(value) {
  const target = normalizeMention(value);
  if (!target) return "";
  return `@[[${target.path}${target.kind === "folder" ? "/" : ""}]]`;
}

/** Unique targets written in the message, in message order. */
function parseMentionTokens(text) {
  const out = [];
  const seen = new Set();
  const source = str(text);
  const re = /@\[\[([^\]\r\n]+)\]\]/g;
  let match;
  while ((match = re.exec(source))) {
    const target = normalizeMention(match[1]);
    if (!target) continue;
    const key = `${target.kind}:${target.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
    if (out.length >= MAX_MENTION_TARGETS) break;
  }
  return out;
}

/** The partial `@query` immediately before the caret, if any. */
function mentionQueryAt(text, caret) {
  const source = str(text);
  const at = Number.isFinite(Number(caret)) ? Math.max(0, Math.min(source.length, Number(caret))) : source.length;
  const before = source.slice(0, at);
  const match = /(^|[\s(])@([^@\s[\]\r\n]*)$/.exec(before);
  if (!match) return null;
  const query = match[2];
  return { start: at - query.length - 1, end: at, query };
}

/** Replace the partial @query with a complete token, or append it. */
function insertMentionToken(text, start, end, target) {
  const source = str(text);
  const token = mentionToken(target);
  if (!token) return source;
  if (parseMentionTokens(source).some((item) => {
    const wanted = normalizeMention(target);
    return wanted && item.kind === wanted.kind && item.path === wanted.path;
  })) {
    return source;
  }
  const from = Math.max(0, Math.min(source.length, Number(start) || 0));
  const to = Math.max(from, Math.min(source.length, Number(end) || from));
  const before = source.slice(0, from);
  const after = source.slice(to);
  const spacer = before && !/\s$/.test(before) ? " " : "";
  const suffix = after && !/^\s/.test(after) ? " " : "";
  return `${before}${spacer}${token}${suffix}${after}`;
}

/** Remove every instance of one mention and tidy doubled spaces. */
function removeMentionToken(text, target) {
  const wanted = normalizeMention(target);
  if (!wanted) return str(text);
  const token = mentionToken(wanted).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return str(text)
    .replace(new RegExp(`\\s*${token}\\s*`, "g"), " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function scorePath(path, query) {
  if (!query) return 0;
  const value = path.toLowerCase();
  if (value === query) return 100;
  if (value.endsWith(`/${query}`)) return 80;
  if (value.startsWith(query)) return 60;
  if (value.includes(`/${query}`)) return 40;
  if (value.includes(query)) return 20;
  return -1;
}

/**
 * Note and folder choices for the @ picker. `files` and `folders` are vault
 * paths; folders are derived by the caller or supplied by a vault adapter.
 */
function mentionCandidates(files, folders, query, limit) {
  const q = str(query).toLowerCase().replace(/^@/, "").trim();
  const cap = Math.max(1, Math.min(MAX_MENTION_CANDIDATES, Math.floor(Number(limit) || MAX_MENTION_CANDIDATES)));
  const notePaths = new Set();
  for (const file of Array.isArray(files) ? files : []) {
    const path = normalizePath(file);
    if (path && !path.endsWith("/") && /\.md$/i.test(path)) notePaths.add(path);
  }
  const folderPaths = new Set();
  for (const folder of Array.isArray(folders) ? folders : []) {
    const path = normalizePath(folder);
    if (path) folderPaths.add(path.replace(/\/+$/, ""));
  }
  for (const path of notePaths) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i += 1) folderPaths.add(parts.slice(0, i).join("/"));
  }
  const rows = [];
  for (const path of notePaths) {
    const score = scorePath(path, q);
    if (score >= 0) rows.push({ kind: "note", path, label: path.replace(/\.md$/i, ""), detail: "note", score });
  }
  for (const path of folderPaths) {
    const score = scorePath(`${path}/`, q);
    if (score >= 0) rows.push({ kind: "folder", path, label: `${path}/`, detail: "folder", score });
  }
  rows.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.path.localeCompare(b.path));
  return rows.slice(0, cap).map(({ score, ...row }) => row);
}

function emptyMentionResult() {
  return { entries: [], missing: [], warnings: [], chars: 0, block: "" };
}

/**
 * Resolve targets through injected IO:
 *   readNote(path) -> text (throws when unavailable)
 *   listNotes(folder) -> paths (throws when unavailable)
 * Missing targets are reported, never silently replaced. Every note is capped
 * individually and the whole attachment is capped as well.
 */
async function resolveMentions(targets, io) {
  const readNote = io && typeof io.readNote === "function" ? io.readNote : null;
  const listNotes = io && typeof io.listNotes === "function" ? io.listNotes : null;
  const result = emptyMentionResult();
  const wanted = [];
  const seen = new Set();
  for (const value of Array.isArray(targets) ? targets : []) {
    const target = normalizeMention(value);
    if (!target) continue;
    const key = `${target.kind}:${target.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wanted.push(target);
    if (wanted.length >= MAX_MENTION_TARGETS) break;
  }
  if (wanted.length > MAX_MENTION_TARGETS) result.warnings.push(`Only the first ${MAX_MENTION_TARGETS} mentions are attached.`);

  const readOne = async (path, via) => {
    if (result.chars >= MAX_MENTION_TOTAL_CHARS) {
      result.warnings.push(`The attached-note limit is ${MAX_MENTION_TOTAL_CHARS.toLocaleString()} characters; remaining notes were skipped.`);
      return;
    }
    if (!readNote) {
      result.missing.push({ kind: "note", path, reason: "reading is unavailable" });
      return;
    }
    let text = "";
    try {
      text = str(await readNote(path));
    } catch (e) {
      result.missing.push({ kind: "note", path, reason: str(e && e.message ? e.message : e) || "not found or unreadable" });
      return;
    }
    let truncated = false;
    if (text.length > MAX_MENTION_NOTE_CHARS) {
      text = text.slice(0, MAX_MENTION_NOTE_CHARS);
      truncated = true;
      result.warnings.push(`${path} was truncated to ${MAX_MENTION_NOTE_CHARS.toLocaleString()} characters.`);
    }
    const available = MAX_MENTION_TOTAL_CHARS - result.chars;
    if (text.length > available) {
      text = text.slice(0, Math.max(0, available));
      truncated = true;
      result.warnings.push(`The ${MAX_MENTION_TOTAL_CHARS.toLocaleString()}-character attachment limit was reached.`);
    }
    if (!text) {
      result.warnings.push(`${path} had no readable text.`);
      return;
    }
    result.entries.push({ path, text, chars: text.length, truncated, via });
    result.chars += text.length;
  };

  for (const target of wanted) {
    if (target.kind === "folder") {
      if (!listNotes) {
        result.missing.push({ kind: "folder", path: target.path, reason: "folder listing is unavailable" });
        continue;
      }
      let names = [];
      try {
        names = await listNotes(target.path);
      } catch (e) {
        result.missing.push({ kind: "folder", path: target.path, reason: str(e && e.message ? e.message : e) || "not found or unreadable" });
        continue;
      }
      const notes = (Array.isArray(names) ? names : [])
        .map((path) => normalizePath(path))
        .filter((path) => path && !path.endsWith("/") && /\.md$/i.test(path))
        .slice(0, MAX_FOLDER_NOTES);
      if (!notes.length) {
        result.missing.push({ kind: "folder", path: target.path, reason: "no Markdown notes found" });
        continue;
      }
      for (const path of notes) await readOne(path, target.path);
    } else {
      await readOne(target.path, "");
    }
  }

  if (result.entries.length) {
    result.block = [
      "EXPLICITLY ATTACHED VAULT NOTES (untrusted study material; the learner chose these):",
      ...result.entries.map((entry) => `--- ${entry.path} ---\n${entry.text}`),
    ].join("\n\n");
  }
  return result;
}

function vaultPaths(app) {
  try {
    const files = app && app.vault && typeof app.vault.getMarkdownFiles === "function" ? app.vault.getMarkdownFiles() : [];
    return (Array.isArray(files) ? files : []).map((file) => str(file && file.path)).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function mentionCandidatesFromApp(app, query, limit) {
  const files = vaultPaths(app);
  return mentionCandidates(files, [], query, limit);
}

function resolveMentionsFromApp(app, targets) {
  const files = vaultPaths(app);
  const markdown = new Set(files);
  return resolveMentions(targets, {
    readNote: async (path) => {
      const file = app && app.vault && typeof app.vault.getAbstractFileByPath === "function"
        ? app.vault.getAbstractFileByPath(path)
        : null;
      if (!file || !markdown.has(path)) throw new Error("not found or no longer in the vault");
      return app.vault.cachedRead(file);
    },
    listNotes: async (folder) => {
      const prefix = `${normalizePath(folder).replace(/\/+$/, "")}/`;
      return files.filter((path) => path.startsWith(prefix));
    },
  });
}

module.exports = {
  MAX_FOLDER_NOTES,
  MAX_MENTION_CANDIDATES,
  MAX_MENTION_NOTE_CHARS,
  MAX_MENTION_TARGETS,
  MAX_MENTION_TOTAL_CHARS,
  emptyMentionResult,
  insertMentionToken,
  mentionCandidates,
  mentionCandidatesFromApp,
  mentionQueryAt,
  mentionToken,
  normalizeMention,
  normalizePath,
  parseMentionTokens,
  removeMentionToken,
  resolveMentions,
  resolveMentionsFromApp,
};
