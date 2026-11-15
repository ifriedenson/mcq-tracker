"use strict";
/*
 * One-way mirror of local study tasks into a note. The plugin's data.json
 * stays the source of truth: this module only renders Tasks-compatible
 * checklist lines (`- [ ] Title 📅 2026-11-01 ⏰ 15:00 ⏫ 🔁 every week #tag`) so
 * search, backlinks, the graph and other plugins (Tasks, Smart Gantt,
 * Dataview) can see the work. Rewriting the note replaces everything the
 * mirror wrote; hand edits inside it are overwritten.
 */
const { localDate, str } = require("./util");

/** Clean a task title for a checklist line: one line, no emoji syntax. */
function mirrorTitle(task) {
  return str(task && task.title)
    .replace(/\s+/g, " ")
    .replace(/[📅⏳🛫🔁✅⏰]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** One checklist line for a task: `- [ ] Title 📅 2026-11-01 ⏰ 15:00 ⏫ 🔁 every week #tag`. */
function studyTaskLine(task) {
  const source = task && typeof task === "object" ? task : {};
  const title = mirrorTitle(source);
  if (!title) return "";
  const box = source.done === true ? "- [x]" : "- [ ]";
  const parts = [box, title];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str(source.due))) parts.push("📅", str(source.due));
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(str(source.time))) parts.push("⏰", str(source.time));
  if (str(source.priority).trim().toLowerCase() === "high") parts.push("⏫");
  if (source.repeat === "daily") parts.push("🔁", "every day");
  else if (source.repeat === "weekday") parts.push("🔁", "every weekday");
  else if (source.repeat === "weekly") parts.push("🔁", "every week");
  for (const tag of Array.isArray(source.tags) ? source.tags : []) {
    const clean = str(tag).trim();
    if (clean) parts.push(`#${clean}`);
  }
  // The course stays in plain words: it is context for the reader, not Tasks syntax.
  const course = str(source.course).trim();
  return course ? `${parts.join(" ")} · ${course}` : parts.join(" ");
}

/** A title safe inside a wikilink and on one checklist line. */
function linkTitle(text) {
  return str(text)
    .replace(/\s+/g, " ")
    .replace(/\|/g, "-")
    .replace(/\]/g, "")
    .replace(/\[\[/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One checklist line for a due-queue item (question, flashcard or vocabulary):
 * `- [ ] [[Questions/Enzymes|Enzymes]] 📅 2026-11-15 · Question · Biology`.
 * The link is what buys backlinks and the graph; the date is the day the item
 * is due, and an item that has never been reviewed is due today.
 */
function dueItemLine(row, today) {
  const source = row && typeof row === "object" ? row : {};
  const title = linkTitle(source.title);
  if (!title) return "";
  const path = str(source.path).trim();
  const label = path ? `[[${path}|${title}]]` : title;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(str(source.dueDate)) ? str(source.dueDate) : str(today);
  const parts = ["- [ ]", label];
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) parts.push("📅", day);
  // The queue's own meta can name the same course twice (deck and course).
  const meta = [...new Set(str(source.meta).split(" · ").map((bit) => bit.trim()).filter(Boolean))].join(" · ");
  return meta ? `${parts.join(" ")} · ${meta}` : parts.join(" ");
}

/**
 * The whole mirror note: open tasks first (high priority, then due),
 * done tasks after, plus a footer naming the one-way rule.
 */
function mirrorMarkdown(tasks, today, options) {
  const list = Array.isArray(tasks) ? tasks : [];
  const opts = options && typeof options === "object" ? options : {};
  // Due questions, cards and vocabulary: the other half of the study loop.
  const dueRows = Array.isArray(opts.dueItems) ? opts.dueItems : [];
  const day = /^\d{4}-\d{2}-\d{2}$/.test(str(today)) ? str(today) : localDate();
  const rank = (task) => [
    task.done === true ? 1 : 0,
    str(task.priority).trim().toLowerCase() === "high" ? 0 : 1,
    /^\d{4}-\d{2}-\d{2}$/.test(str(task.due)) ? `${str(task.due)} ${str(task.time)}` : "9999-12-31",
  ];
  const ordered = list
    .slice()
    .sort(
      (a, b) =>
        rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1] || (rank(a)[2] < rank(b)[2] ? -1 : rank(a)[2] > rank(b)[2] ? 1 : 0),
    );
  const open = ordered.filter((task) => task.done !== true);
  const done = ordered.filter((task) => task.done === true);
  const lines = ["# Study tasks", "", "_One-way mirror from MCQ Tracker — edits here are overwritten._", ""];
  if (!ordered.length) {
    lines.push("No tasks yet.");
  } else {
    for (const task of open) {
      const line = studyTaskLine(task);
      if (line) lines.push(line);
    }
    if (done.length) {
      lines.push("", "## Done");
      for (const task of done) {
        const line = studyTaskLine(task);
        if (line) lines.push(line);
      }
    }
  }
  const dueLines = [];
  for (const row of dueRows) {
    const line = dueItemLine(row, day);
    if (line) dueLines.push(line);
  }
  if (dueLines.length) {
    lines.push("", "## Due today");
    for (const line of dueLines) lines.push(line);
  }
  const dueText = dueLines.length ? ` · ${dueLines.length} due` : "";
  lines.push("", `_Mirrored ${day} · ${open.length} open · ${done.length} done${dueText}._`);
  return `${lines.join("\n")}\n`;
}

/** Default note path when the mirror setting is on but names no file. */
function defaultMirrorPath() {
  return "Study tasks.md";
}

module.exports = {
  defaultMirrorPath,
  dueItemLine,
  linkTitle,
  mirrorMarkdown,
  mirrorTitle,
  studyTaskLine,
};
