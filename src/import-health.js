"use strict";
/**
 * Import folder health. Pure: it compares the source path stamped on a note with
 * the paths the vault actually holds, so a moved or deleted PDF shows up as a
 * missing source instead of a silently orphaned question set.
 */
const { str } = require("./util");

/** Strip wiki brackets, an alias and surrounding slashes from a stamped source path. */
function cleanSourcePath(value) {
  let path = str(value).trim();
  if (path.startsWith("[[")) path = path.slice(2);
  if (path.endsWith("]]")) path = path.slice(0, -2);
  const pipe = path.indexOf("|");
  if (pipe >= 0) path = path.slice(0, pipe);
  return path.replace(/^\/+|\/+$/g, "").trim();
}

function sourceOf(fm) {
  const row = fm || {};
  return cleanSourcePath(row.source_pdf || row.source_document || row.source_note || row.source_file || "");
}

/**
 * auditImportHealth(items, exists)
 * - items: notes with `fm` (questions and cards)
 * - exists: (path) => boolean for the vault
 * Returns missing sources grouped by path, plus the notes that had no stamp at all.
 */
function auditImportHealth(items, exists) {
  const list = Array.isArray(items) ? items : [];
  const check = typeof exists === "function" ? exists : () => true;
  const bySource = new Map();
  let unstamped = 0;
  for (const item of list) {
    const fm = (item && item.fm) || {};
    const source = sourceOf(fm);
    const path = str(item && item.file && item.file.path);
    if (!source) {
      unstamped += 1;
      continue;
    }
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source).push(path);
  }
  const missing = [];
  let healthy = 0;
  for (const [source, paths] of bySource) {
    if (check(source)) {
      healthy += paths.length;
      continue;
    }
    missing.push({ source, count: paths.length, paths: paths.slice(0, 20) });
  }
  missing.sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  return { missing, unstamped, healthy };
}

/** A one-line summary for a notice. */
function healthSummary(report) {
  const rows = Array.isArray(report && report.missing) ? report.missing : [];
  if (!rows.length) {
    return report && report.unstamped
      ? `Every linked source is present. ${report.unstamped} note${report.unstamped === 1 ? "" : "s"} ha${report.unstamped === 1 ? "s" : "ve"} no source file stamped.`
      : "Every linked source file is present.";
  }
  const notes = rows.reduce((sum, row) => sum + row.count, 0);
  return `${rows.length} source file${rows.length === 1 ? " is" : "s are"} missing, linked from ${notes} note${notes === 1 ? "" : "s"}.`;
}

module.exports = { auditImportHealth, cleanSourcePath, healthSummary, sourceOf };
