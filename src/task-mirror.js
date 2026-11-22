"use strict";
/*
 * One-way mirror of local study tasks into a note. The plugin's data.json
 * stays the source of truth: this module only renders Tasks-compatible
 * checklist lines (`- [ ] Title 📅 2026-11-01 ⏰ 15:00 ⏫ 🔁 every week #tag`) so
 * search, backlinks, the graph and other plugins (Tasks, Smart Gantt,
 * Dataview) can see the work. Rewriting the note replaces everything the
 * mirror wrote; hand edits on task lines (date, tick, cancel) are read back
 * first, while hand edits on due-queue lines are overwritten.
 */
const { localDate, str } = require("./util");

const MIRROR_HEAD = "# Study tasks";
const MIRROR_FOOT = "Mirrored";
const MIRROR_LINE = /^\s*[-*+]\s+\[([ xX\-\/])\]\s+(.*)$/;

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

/**
 * Read one mirror checklist line back into task fields. Returns null for any
 * line that is not a task the mirror wrote: blank lines, headings, the footer,
 * and the `## Due today` queue (wikilink lines stay read-only and are never
 * mapped onto study tasks). A cancelled Tasks line (`- [-]`) reports
 * `cancelled: true` so the caller can drop the task.
 */
function parseMirrorTaskLine(line) {
  const hit = MIRROR_LINE.exec(str(line));
  if (!hit) return null;
  const box = hit[1];
  const rest = str(hit[2]);
  if (!rest.trim()) return null;
  // Due-queue rows link at a note; they belong to the review queue, not tasks.
  const hasOpenLink = rest.includes("[[");
  const hasCloseLink = rest.includes("]]");
  if (hasOpenLink && hasCloseLink) return null;
  const dueHit = /📅\s*(\d{4}-\d{2}-\d{2})/u.exec(rest);
  const timeHit = /⏰\s*(([01]\d|2[0-3]):[0-5]\d)/u.exec(rest);
  const due = dueHit && /^\d{4}-\d{2}-\d{2}$/.test(dueHit[1]) ? dueHit[1] : "";
  const time = timeHit ? timeHit[1] : "";
  let text = rest
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/gu, " ")
    .replace(/⏰\s*([01]\d|2[0-3]):[0-5]\d/gu, " ")
    .replace(/⏫/gu, " ")
    .replace(/🔁\s*every\s+day/gu, " ")
    .replace(/🔁\s*every\s+weekdays?/gu, " ")
    .replace(/🔁\s*every\s+week/gu, " ")
    .replace(/🔁/gu, " ")
    .replace(/(?:^|\s)#[^\s#][^\s]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // The writer appends ` · course`; the title is what precedes that tail.
  const bar = text.lastIndexOf(" · ");
  const title = (bar >= 0 ? text.slice(0, bar) : text).replace(/\s+/g, " ").trim();
  if (!title) return null;
  return {
    title,
    key: title.toLowerCase(),
    due,
    time,
    done: box === "x" || box === "X",
    cancelled: box === "-" || box === "/",
  };
}

/**
 * Apply hand edits found in a mirror note to the task store. Matches lines to
 * tasks by their mirrored title (first match wins); extra lines a hand added
 * are ignored and disappear on the next rewrite.
 *
 * - a changed (or removed) 📅 date reschedules the task, ⏰ rides along;
 * - `- [x]` completes, `- [ ]` on a done task reopens, `- [-]` cancels;
 * - a task line deleted from the note cancels the task, but only when the
 *   task was rendered by the last rewrite and the text still looks like the
 *   mirror (heading plus footer), so a stale, cleared or foreign note never
 *   wipes the store.
 */
function applyMirrorEdits(tasks, noteText, today, options) {
  const list = Array.isArray(tasks) ? tasks : [];
  const text = str(noteText);
  const opts = options && typeof options === "object" ? options : {};
  // Ids the last rewrite rendered. A task that was never rendered (added after
  // the note was last written) is kept even when its line is missing, so a
  // stale note read before the next rewrite cannot cancel fresh work. Without
  // a baseline — first run after a restart — absence deletes nothing.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(str(today)) ? str(today) : localDate();
  const empty = { tasks: list.map((task) => ({ ...task })), rescheduled: 0, cancelled: 0, completed: 0, reopened: 0 };
  if (!text.includes(MIRROR_HEAD)) return empty;
  const looksLikeMirror = text.includes(MIRROR_FOOT);
  const parsed = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const row = parseMirrorTaskLine(line);
    if (row) parsed.push(row);
  }
  const byKey = new Map();
  for (const task of list) {
    const key = mirrorTitle(task).toLowerCase();
    if (!key || byKey.has(key)) continue;
    byKey.set(key, task);
  }
  const seen = new Set();
  const dropped = new Set();
  const copies = new Map(list.map((task) => [task.id, { ...task }]));
  let rescheduled = 0;
  let cancelled = 0;
  let completed = 0;
  let reopened = 0;
  for (const row of parsed) {
    const source = byKey.get(row.key);
    if (!source || seen.has(source.id)) continue;
    seen.add(source.id);
    const task = copies.get(source.id);
    if (row.cancelled) {
      dropped.add(source.id);
      cancelled += 1;
      continue;
    }
    if (row.done && !task.done) {
      task.done = true;
      task.doneAt = day;
      completed += 1;
    } else if (!row.done && task.done) {
      task.done = false;
      task.doneAt = "";
      reopened += 1;
    }
    if (str(task.due) !== row.due || str(task.time) !== row.time) {
      task.due = row.due;
      task.time = row.time;
      rescheduled += 1;
    }
  }
  // A deleted line cancels its task, but only when the task was rendered last
  // time: absence without a baseline, or in a note that no longer looks like
  // the mirror, never wipes the store by accident.
  const baseline = Array.isArray(opts.renderedIds) ? new Set(opts.renderedIds) : opts.renderedIds instanceof Set ? opts.renderedIds : null;
  if (looksLikeMirror && baseline) {
    for (const task of list) {
      if (seen.has(task.id) || dropped.has(task.id)) continue;
      // A duplicate title shares its key with the first task; only the key
      // owner's absence cancels, the rest stay exactly as they were.
      const key = mirrorTitle(task).toLowerCase();
      if (key && byKey.get(key) === task && baseline.has(task.id)) {
        dropped.add(task.id);
        cancelled += 1;
      }
    }
  }
  // Store order is kept; the note order never reorders data.json.
  const out = [];
  for (const task of list) {
    if (dropped.has(task.id)) continue;
    out.push(copies.get(task.id));
  }
  return { tasks: out, rescheduled, cancelled, completed, reopened };
}

module.exports = {
  applyMirrorEdits,
  defaultMirrorPath,
  dueItemLine,
  linkTitle,
  mirrorMarkdown,
  mirrorTitle,
  parseMirrorTaskLine,
  studyTaskLine,
};
