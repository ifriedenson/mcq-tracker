"use strict";
/*
 * A local review-session report, the non-AI half of Spaceforge's session
 * summary. The docked review bar supplies the items it graded; this module
 * only formats Markdown and picks a filename. No second review store, provider
 * or network request is involved.
 */
const { str } = require("./util");

const MAX_ITEMS = 200;

function normalizeSessionReportSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: src.enabled === true,
    folder: str(src.folder).trim().replace(/^\/+|\/+$/g, ""),
  };
}

function dayKey(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const text = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    return text;
  }
  const text = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanTitle(value) {
  return str(value)
    .replace(/[[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sessionReportMarkdown(input) {
  const opts = input || {};
  const status = opts.status || {};
  const items = (Array.isArray(opts.items) ? opts.items : []).slice(0, MAX_ITEMS);
  const date = dayKey(opts.date) || dayKey(new Date());
  const counts = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const item of items) {
    const grade = str(item && item.grade).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, grade)) counts[grade]++;
  }
  const completed = Math.max(0, Number(status.completed) || (Array.isArray(opts.items) ? opts.items.length : 0));
  const missed = Array.isArray(status.missed) ? status.missed.length : 0;
  const requeued = Math.max(0, Number(status.requeued) || 0);
  const lines = [
    "---",
    "type: review_session_report",
    `date: ${date}`,
    `completed: ${completed}`,
    `missed: ${missed}`,
    `requeued: ${requeued}`,
    `again: ${counts.again}`,
    `hard: ${counts.hard}`,
    `good: ${counts.good}`,
    `easy: ${counts.easy}`,
    "---",
    "",
    `# Review session — ${date}`,
    "",
    `- Graded: ${completed}`,
    `- Missed: ${missed}`,
    `- Requeued: ${requeued}`,
    `- Again / Hard / Good / Easy: ${counts.again} / ${counts.hard} / ${counts.good} / ${counts.easy}`,
  ];
  if (items.length) {
    lines.push("", "## Items");
    for (const item of items) {
      const title = cleanTitle(item && (item.title || item.path)) || "Untitled";
      const path = str(item && item.path);
      const grade = str(item && item.grade).toLowerCase() || "graded";
      lines.push(path ? `- [[${path}|${title}]] — ${grade}` : `- ${title} — ${grade}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Pick the first free `Review session <date>.md` inside the folder. */
function reportPath(folder, date, existing) {
  const base = `Review session ${dayKey(date) || dayKey(new Date())}`;
  const root = str(folder).trim().replace(/^\/+|\/+$/g, "");
  const prefix = root ? `${root}/` : "";
  const taken = new Set((Array.isArray(existing) ? existing : []).map((path) => str(path)));
  let candidate = `${prefix}${base}.md`;
  let index = 2;
  while (taken.has(candidate)) candidate = `${prefix}${base} ${index++}.md`;
  return candidate;
}

module.exports = {
  MAX_ITEMS,
  dayKey,
  normalizeSessionReportSettings,
  reportPath,
  sessionReportMarkdown,
};
