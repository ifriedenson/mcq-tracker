"use strict";
const { str } = require("./util");
const { FILTER_FIELDS } = require("./constants");

function isDue(fm, today) {
  return Number(fm.attempts) > 0 && !!fm.next_review && str(fm.next_review).slice(0, 10) <= today;
}

const MODE_PRED = {
  smart: () => true,
  random: () => true,
  due: (fm, today) => isDue(fm, today),
  unseen: (fm) => !Number(fm.attempts),
  missed: (fm) => fm.result === "incorrect",
  flagged: (fm) => fm.flagged === true,
};

function weightOf(fm, today) {
  let w = 1;
  if (isDue(fm, today)) w = 5;
  else if (!Number(fm.attempts)) w = 4;
  else if (fm.result === "incorrect") w = 3;
  if (fm.flagged === true) w *= 2;
  return w;
}

/** A filter holds a list of accepted values per field (older versions stored a single string). */
function fvals(filters, k) {
  const v = filters ? filters[k] : undefined;
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).map(str).filter(Boolean);
}

/** Every folder a note sits in, outermost first: "A/B/c.md" gives ["A", "A/B"]. Picking "A" therefore also finds notes in its sub folders. A note in the vault root is in "/". */
function folderChain(path) {
  const parts = str(path).split("/").slice(0, -1);
  if (!parts.length) return ["/"]; // a note saved directly in the vault root
  const out = [];
  for (let i = 0; i < parts.length; i++) out.push(parts.slice(0, i + 1).join("/"));
  return out;
}

/** How a folder is shown on a filter button: relative to the question folder when it is inside it. */
function folderLabel(path, root) {
  if (path === "/") return "(vault root)";
  const r = str(root).trim().replace(/^\/+|\/+$/g, "");
  return r && path.startsWith(r + "/") ? path.slice(r.length + 1) : path;
}

/** A note's own values for a field (a list property counts as several values). The folder field comes from the note's path. */
function noteVals(fm, k, path) {
  if (k === "folder") return folderChain(path);
  const v = fm ? fm[k] : undefined;
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).map(str).filter(Boolean);
}

function hasFilters(f) {
  return FILTER_FIELDS.some(([k]) => fvals(f, k).length);
}

function cloneFilters(f) {
  const o = {};
  for (const [k] of FILTER_FIELDS) {
    const v = fvals(f, k);
    if (v.length) o[k] = v.slice();
  }
  return o;
}

/** Within one field the chosen values are OR; every field that has a choice must match (AND). */
function matchFilters(fm, filters, skip, path) {
  for (const [k] of FILTER_FIELDS) {
    if (k === skip) continue;
    const want = fvals(filters, k);
    if (!want.length) continue;
    const have = noteVals(fm, k, path);
    if (!want.some((w) => have.includes(w))) return false;
  }
  return true;
}

/** Several filter sets are OR'd together; empty sets are ignored; no sets at all means everything. */
function matchSets(fm, sets, path) {
  const act = (sets || []).filter(hasFilters);
  if (!act.length) return true;
  return act.some((f) => matchFilters(fm, f, undefined, path));
}

function filterOptions(questions, filters, field) {
  return filterOptionCounts(questions, filters, field).map((o) => o.value);
}

/** Same as filterOptions but with how many notes each value holds (with the other fields' choices applied). */
function filterOptionCounts(questions, filters, field) {
  const counts = new Map();
  for (const q of questions) {
    const path = q.file && q.file.path;
    if (!matchFilters(q.fm, filters, field, path)) continue;
    for (const v of noteVals(q.fm, field, path)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

/* ---- folders that were renamed or moved */

function renameFolderPath(v, oldPath, newPath) {
  if (v === oldPath) return newPath;
  if (v.startsWith(oldPath + "/")) return newPath + v.slice(oldPath.length);
  return v;
}

/** Keeps saved filters, presets and folder settings pointing at a folder that was renamed or moved. Returns true if anything changed. */
function renameFolderInSettings(st, oldPath, newPath) {
  let changed = false;
  const fix = (f) => {
    if (!f || !Array.isArray(f.folder)) return;
    const next = f.folder.map((v) => renameFolderPath(v, oldPath, newPath));
    if (next.some((v, i) => v !== f.folder[i])) {
      f.folder = next;
      changed = true;
    }
  };
  fix(st.filters);
  (st.moreSets || []).forEach(fix);
  for (const pr of st.presets || []) {
    fix(pr.filters);
    (pr.moreSets || []).forEach(fix);
  }
  for (const k of ["questionFolder", "importFolder"]) {
    const cur = str(st[k]).replace(/^\/+|\/+$/g, "");
    if (!cur) continue;
    const next = renameFolderPath(cur, oldPath, newPath);
    if (next !== cur) {
      st[k] = next;
      changed = true;
    }
  }
  return changed;
}

/* ---- the PDF's own question id */

function officialIdOf(fm) {
  return str(fm && (fm.official_question_id || fm.source_question_id || fm.pdf_question_id || fm.original_id)).trim();
}

/** Map of official id -> note path, for notes outside `excludeFolder`. */
function indexOfficialIds(questions, excludeFolder) {
  const map = new Map();
  const skip = excludeFolder ? excludeFolder + "/" : null;
  for (const q of questions) {
    const id = officialIdOf(q.fm);
    if (!id || (skip && q.file.path.startsWith(skip)) || map.has(id)) continue;
    map.set(id, q.file.path);
  }
  return map;
}

/** Which of `items` ({path, id}) repeat an id already in the vault (`existing`) or earlier in the same list. */
function findDuplicateIds(items, existing) {
  const seen = new Map();
  const dupes = [];
  for (const it of items) {
    if (!it.id) continue;
    const other = existing.get(it.id) || seen.get(it.id);
    if (other) dupes.push({ path: it.path, id: it.id, other });
    else seen.set(it.id, it.path);
  }
  return dupes;
}

function pickQuestion(pool, mode, today, recent, rnd) {
  rnd = rnd || Math.random;
  let items = pool.filter((q) => (MODE_PRED[mode] || MODE_PRED.smart)(q.fm, today));
  if (!items.length) return null;
  const tiers = [recent || [], (recent || []).slice(-1), []];
  for (const ex of tiers) {
    const alt = items.filter((q) => !ex.includes(q.file.path));
    if (alt.length) {
      items = alt;
      break;
    }
  }
  const w = items.map((q) => (mode === "smart" ? weightOf(q.fm, today) : 1));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

module.exports = {
  isDue,
  MODE_PRED,
  weightOf,
  fvals,
  folderChain,
  folderLabel,
  noteVals,
  hasFilters,
  cloneFilters,
  matchFilters,
  matchSets,
  filterOptions,
  filterOptionCounts,
  renameFolderPath,
  renameFolderInSettings,
  officialIdOf,
  indexOfficialIds,
  findDuplicateIds,
  pickQuestion,
};
