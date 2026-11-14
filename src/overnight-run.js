"use strict";
/*
 * An overnight run is the morning-proof journal of a 100-file import: which
 * source files were queued, what each one wrote, where the checks stand.
 * The journal lives in device-local storage (paths belong to this vault),
 * so a reload, a crash or a killed server resumes by skipping finished files
 * instead of importing them twice — and Undo removes exactly what the run
 * wrote, nothing else.
 */
const { localDate, str } = require("./util");

const OVERNIGHT_RUNS_KEY = "mcq-tracker-overnight-runs";
const MAX_OVERNIGHT_RUNS = 10;
const RUN_FILE_STATUSES = ["pending", "writing", "done", "error", "skipped"];

function cleanRunFile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sourcePath = str(raw.sourcePath).trim();
  if (!sourcePath) return null;
  const status = RUN_FILE_STATUSES.includes(raw.status) ? raw.status : "pending";
  const strings = (value) => [...new Set((Array.isArray(value) ? value : []).map((p) => str(p).trim()).filter(Boolean))];
  const checks = raw.checks && typeof raw.checks === "object" ? raw.checks : {};
  const num = (value) => Math.max(0, Math.round(Number(value) || 0));
  return {
    sourcePath,
    hash: str(raw.hash),
    status,
    notes: strings(raw.notes),
    copies: strings(raw.copies),
    pictures: strings(raw.pictures),
    error: str(raw.error),
    writeMs: num(raw.writeMs),
    checkMs: num(raw.checkMs),
    checks: { matched: num(checks.matched), mismatched: num(checks.mismatched), errored: num(checks.errored) },
  };
}

let overnightRunCounter = 0;

function makeOvernightRun(files) {
  const list = (Array.isArray(files) ? files : []).map(cleanRunFile).filter(Boolean);
  overnightRunCounter += 1;
  const stamp = Date.now().toString(36);
  return {
    id: "night-" + stamp + "-" + overnightRunCounter.toString(36) + "-" + list.length,
    startedAt: Date.now(),
    date: localDate(),
    status: list.length ? "writing" : "empty",
    files: list,
  };
}

function normalizeOvernightRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  const files = (Array.isArray(raw.files) ? raw.files : []).map(cleanRunFile).filter(Boolean);
  const id = str(raw.id).trim();
  if (!id || !files.length) return null;
  return {
    id,
    startedAt: Math.max(0, Number(raw.startedAt) || 0),
    date: str(raw.date) || localDate(),
    status: str(raw.status) || "writing",
    files,
  };
}

function normalizeOvernightRuns(raw) {
  return (Array.isArray(raw) ? raw : []).map(normalizeOvernightRun).filter(Boolean).slice(0, MAX_OVERNIGHT_RUNS);
}

function pendingRunFiles(run) {
  if (!run || !Array.isArray(run.files)) return [];
  return run.files.filter((file) => file.status === "pending" || file.status === "error");
}

/** Same source path with the same bytes and a finished entry: do not import twice. */
function runFileDone(run, sourcePath, hash) {
  if (!run || !Array.isArray(run.files)) return false;
  const want = str(sourcePath).trim();
  return run.files.some(
    (file) => file.sourcePath === want && file.status === "done" && (str(hash) === "" || str(file.hash) === "" || file.hash === str(hash))
  );
}

function markRunFile(run, sourcePath, patch) {
  if (!run || !Array.isArray(run.files)) return null;
  const want = str(sourcePath).trim();
  const file = run.files.find((entry) => entry.sourcePath === want);
  if (!file) return null;
  const next = cleanRunFile({ ...file, ...(patch && typeof patch === "object" ? patch : {}) });
  if (!next) return null;
  Object.assign(file, next);
  return file;
}

/** Every path the run wrote: notes, source copies and captured pictures. Undo removes exactly these. */
function runNotePaths(run) {
  if (!run || !Array.isArray(run.files)) return [];
  const out = [];
  for (const file of run.files) {
    for (const path of [...(file.notes || []), ...(file.copies || []), ...(file.pictures || [])]) {
      if (path && !out.includes(path)) out.push(path);
    }
  }
  return out;
}

function runTotals(run) {
  const totals = { files: 0, done: 0, notes: 0, matched: 0, mismatched: 0, errored: 0 };
  if (!run || !Array.isArray(run.files)) return totals;
  totals.files = run.files.length;
  for (const file of run.files) {
    if (file.status === "done") totals.done++;
    totals.notes += (file.notes || []).length;
    totals.matched += Number(file.checks && file.checks.matched) || 0;
    totals.mismatched += Number(file.checks && file.checks.mismatched) || 0;
    totals.errored += Number(file.checks && file.checks.errored) || 0;
  }
  return totals;
}

function loadOvernightRuns(app) {
  try {
    return normalizeOvernightRuns(app && typeof app.loadLocalStorage === "function" ? app.loadLocalStorage(OVERNIGHT_RUNS_KEY) : null);
  } catch (e) {
    return [];
  }
}

function storeOvernightRun(app, run) {
  const clean = normalizeOvernightRun(run);
  if (!clean || !app || typeof app.saveLocalStorage !== "function") return null;
  const kept = [clean, ...loadOvernightRuns(app).filter((entry) => entry.id !== clean.id)].slice(0, MAX_OVERNIGHT_RUNS);
  try {
    app.saveLocalStorage(OVERNIGHT_RUNS_KEY, kept);
  } catch (e) {
    return null;
  }
  return clean;
}

function latestOvernightRun(app) {
  return loadOvernightRuns(app)[0] || null;
}

function unfinishedOvernightRun(app) {
  return loadOvernightRuns(app).find((run) => run.status !== "finished" && run.status !== "undone" && pendingRunFiles(run).length > 0) || null;
}

/** Identify source bytes for resume: size + mtime when the adapter offers it, else nothing (resume falls back to the path). */
async function sourceHash(app, path) {
  try {
    const adapter = app && app.vault && app.vault.adapter;
    if (!adapter || typeof adapter.stat !== "function") return "";
    const info = await adapter.stat(path);
    if (!info || (info.size == null && info.mtime == null)) return "";
    return `${info.size == null ? "" : info.size}:${info.mtime == null ? "" : info.mtime}`;
  } catch (e) {
    return "";
  }
}

module.exports = {
  OVERNIGHT_RUNS_KEY,
  MAX_OVERNIGHT_RUNS,
  makeOvernightRun,
  normalizeOvernightRun,
  normalizeOvernightRuns,
  pendingRunFiles,
  runFileDone,
  markRunFile,
  runNotePaths,
  runTotals,
  loadOvernightRuns,
  storeOvernightRun,
  latestOvernightRun,
  unfinishedOvernightRun,
  sourceHash,
};
