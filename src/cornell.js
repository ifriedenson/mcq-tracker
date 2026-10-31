"use strict";
/*
 * Cornell notes are ordinary fenced blocks:
 *
 *   ```cornell-note
 *   Title: Cell respiration
 *   Course: Biology
 *   Cue: What is glycolysis?
 *   Note: Splits glucose into pyruvate and produces ATP and NADH.
 *   Cue: Where does the Krebs cycle happen?
 *   Note: In the mitochondrial matrix.
 *   Summary: Respiration transfers energy from glucose to ATP.
 *   ```
 *
 * The block is read-only. Recall mode only hides notes in the current view.
 */
const { str } = require("./util");

function clean(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function parseCornellNote(source) {
  const title = [];
  const course = [];
  const summary = [];
  const cues = [];
  const issues = [];
  let current = null;
  let field = "";

  const append = (target, value) => {
    const text = clean(value);
    if (text) target.push(text);
  };

  for (const raw of str(source).replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const titleMatch = line.match(/^title\s*[:=]\s*(.*)$/i);
    if (titleMatch) {
      append(title, titleMatch[1]);
      field = "title";
      continue;
    }
    const courseMatch = line.match(/^course\s*[:=]\s*(.*)$/i);
    if (courseMatch) {
      append(course, courseMatch[1]);
      field = "course";
      continue;
    }
    const cueMatch = line.match(/^cue\s*[:=]\s*(.*)$/i);
    if (cueMatch) {
      current = { cue: [], note: [], margin: [] };
      cues.push(current);
      append(current.cue, cueMatch[1]);
      field = "cue";
      continue;
    }
    const noteMatch = line.match(/^(?:note|notes)\s*[:=]\s*(.*)$/i);
    if (noteMatch) {
      if (!current) {
        issues.push("Add a Cue: line before each Note: line.");
        field = "";
        continue;
      }
      append(current.note, noteMatch[1]);
      field = "note";
      continue;
    }
    const marginMatch = line.match(/^(?:margin|margin-note|aside)\s*[:=]\s*(.*)$/i);
    if (marginMatch) {
      if (!current) {
        issues.push("Add a Cue: line before each Margin: line.");
        field = "";
        continue;
      }
      append(current.margin, marginMatch[1]);
      field = "margin";
      continue;
    }
    const summaryMatch = line.match(/^summary\s*[:=]\s*(.*)$/i);
    if (summaryMatch) {
      append(summary, summaryMatch[1]);
      field = "summary";
      continue;
    }
    if (field === "title") append(title, line);
    else if (field === "course") append(course, line);
    else if (field === "summary") append(summary, line);
    else if (field === "cue" && current) append(current.cue, line);
    else if (field === "note" && current) append(current.note, line);
    else if (field === "margin" && current) append(current.margin, line);
    else issues.push(`Could not read "${line.slice(0, 60)}". Use Title, Course, Cue, Note, Margin or Summary.`);
  }

  const rows = cues.map((row, index) => {
    const cue = clean(row.cue.join(" "));
    const note = clean(row.note.join(" "));
    const margin = clean(row.margin.join(" "));
    if (!cue) issues.push(`Cue ${index + 1} is empty.`);
    if (!note) issues.push(`Cue ${index + 1} has no Note.`);
    return { cue, note, margin };
  });
  if (!rows.length) issues.push("Add at least one Cue: and Note: pair.");
  if (!title.length) issues.push("Add a Title: line.");

  return {
    title: clean(title.join(" ")),
    course: clean(course.join(" ")),
    summary: clean(summary.join(" ")),
    cues: rows,
    issues,
    valid: rows.length > 0 && rows.every((row) => row.cue && row.note) && title.length > 0 && issues.length === 0,
  };
}

function buildCornellBlockSource(input) {
  const data = input && typeof input === "object" ? input : {};
  const cues = Array.isArray(data.cues) ? data.cues : [];
  const lines = [`Title: ${clean(data.title) || "Untitled Cornell note"}`];
  if (clean(data.course)) lines.push(`Course: ${clean(data.course)}`);
  for (const row of cues) {
    if (!row || (!clean(row.cue) && !clean(row.note))) continue;
    lines.push(`Cue: ${clean(row.cue)}`);
    lines.push(`Note: ${clean(row.note)}`);
    if (clean(row.margin)) lines.push(`Margin: ${clean(row.margin)}`);
  }
  if (clean(data.summary)) lines.push(`Summary: ${clean(data.summary)}`);
  return lines.join("\n");
}

function cornellTemplate(title, course) {
  return buildCornellBlockSource({
    title: clean(title) || "Untitled Cornell note",
    course: clean(course),
    cues: [
      { cue: "What is the main idea?", note: "Write the answer here after class.", margin: "Add a key term or page number." },
      { cue: "What detail is easy to confuse?", note: "Add the distinction or example." },
    ],
    summary: "Summarise the note in two or three sentences.",
  });
}

function buildCornellNote(title, course, now) {
  const date = now instanceof Date ? now : new Date();
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const heading = clean(title) || "Untitled Cornell note";
  return [
    "---",
    "cornell: true",
    `title: ${JSON.stringify(heading)}`,
    `course: ${JSON.stringify(clean(course))}`,
    `created: ${day}`,
    "---",
    "",
    `# ${heading}`,
    "",
    "```cornell-note",
    cornellTemplate(heading, course),
    "```",
    "",
  ].join("\n");
}

/** Explicit key terms from `Key term:`, `Term:`, `Concept:`, `Definition:` or `See:` margin notes. */
function cornellHighlightTerms(margin) {
  const text = clean(margin);
  if (!text) return [];
  const terms = [];
  const pattern = /(?:^|[;,])\s*(?:key\s*term|term|concept|definition|see)\s*:\s*([^;,]+)/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const term = clean(match[1]).replace(/[.!?]+$/, "");
    if (term.length >= 2 && term.length <= 80) terms.push(term);
  }
  const seen = new Set();
  return terms.filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { buildCornellBlockSource, buildCornellNote, cornellHighlightTerms, cornellTemplate, parseCornellNote };
