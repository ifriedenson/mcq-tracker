"use strict";
/*
 * Compile the local lecture log into one study note: overview, key concepts,
 * a vocabulary table and one section per lecture. This is the non-audio part of
 * Lecture Transcriber's "many lectures into one study note" workflow (MIT).
 * The implementation is original; no audio and no network request is involved.
 */
const { str } = require("./util");
const { dayValue } = require("./study-tools");

const MAX_LECTURES = 300;
const MAX_CONCEPTS = 40;
const MAX_TITLE = 160;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enabledValue(value) {
  if (value === false) return false;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return true;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function normalizeLectureCompilerSettings(value) {
  const source = asObject(value);
  return {
    enabled: enabledValue(value),
    folder: str(source.folder).trim().replace(/^\/+|\/+$/g, "").slice(0, 400) || "Lecture notes",
    includeOverview: source.includeOverview !== false,
    includeConcepts: source.includeConcepts !== false,
    includeVocabulary: source.includeVocabulary !== false,
    includeSections: source.includeSections !== false,
  };
}

/** Split a lecture's free-text topics into individual entries. */
function parseTopicList(topics) {
  return str(topics)
    .split(/\n|;|·|,(?![^(]*\))/)
    .map((entry) => entry.replace(/^[-*+]\s+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 60);
}

/** `Term: definition` becomes a vocabulary row; plain topics stay concepts. */
function splitConcept(entry) {
  const text = str(entry).trim();
  const match = text.match(/^([^:]{2,80}?):\s*(.{2,})$/) || text.match(/^([^:]{2,80}?)\s+[–—-]\s+(.{2,})$/);
  if (!match) return { term: text, detail: "" };
  return { term: match[1].trim(), detail: match[2].trim() };
}

function normalizeLectureRow(value) {
  const source = asObject(value);
  const course = str(source.course).trim().slice(0, MAX_TITLE);
  const title = str(source.title).trim().slice(0, MAX_TITLE);
  const date = dayValue(source.date);
  if (!course || !title || !date) return null;
  return { course, title, date, topics: str(source.topics) };
}

function uniqueInOrder(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = str(value).trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

function markdownCell(text) {
  return str(text).replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function safeFileTitle(title) {
  const cleaned = str(title).replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim();
  return (cleaned || "Lecture notes").slice(0, 120);
}

/**
 * Compile lectures into one Markdown study note. Returns null when no valid
 * lecture remains, so the caller can show a real message instead of an empty
 * note. The output is deterministic: stable ordering and no timestamps.
 */
function compileLectureNote(lectures, options) {
  const settings = normalizeLectureCompilerSettings(options);
  const list = (Array.isArray(lectures) ? lectures : [])
    .map(normalizeLectureRow)
    .filter(Boolean)
    .slice(0, MAX_LECTURES)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  if (!list.length) return null;

  const courses = uniqueInOrder(list.map((lecture) => lecture.course));
  const conceptCounts = new Map();
  const vocabulary = new Map();
  for (const lecture of list) {
    for (const entry of parseTopicList(lecture.topics)) {
      const { term, detail } = splitConcept(entry);
      if (!term) continue;
      const key = term.toLowerCase();
      conceptCounts.set(key, { term, count: (conceptCounts.get(key) || { count: 0 }).count + 1 });
      if (detail && !vocabulary.has(key)) vocabulary.set(key, { term, detail, source: `${lecture.date} — ${lecture.title}` });
    }
  }
  const concepts = [...conceptCounts.values()]
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, MAX_CONCEPTS);
  const vocabRows = [...vocabulary.values()].sort((a, b) => a.term.localeCompare(b.term));
  const range = { from: list[0].date, to: list[list.length - 1].date };
  const title = courses.length === 1 ? `${courses[0]} lecture notes` : "Lecture notes";

  const lines = ["---", "source: mcq-tracker", `lectures: ${list.length}`, `courses: [${courses.join(", ")}]`, "---", `# ${title}`, ""];

  if (settings.includeOverview) {
    lines.push("## Overview", "");
    lines.push(`- Lectures: ${list.length} (${range.from} to ${range.to})`);
    lines.push(`- Courses: ${courses.join(", ")}`);
    lines.push(`- Key concepts: ${concepts.length}`);
    if (vocabRows.length) lines.push(`- Vocabulary entries: ${vocabRows.length}`);
    lines.push("");
  }

  if (settings.includeConcepts && concepts.length) {
    lines.push("## Key concepts", "");
    for (const concept of concepts) {
      lines.push(concept.count > 1 ? `- **${concept.term}** — covered in ${concept.count} lectures` : `- ${concept.term}`);
    }
    lines.push("");
  }

  if (settings.includeVocabulary && vocabRows.length) {
    lines.push("## Vocabulary", "");
    lines.push("| Term | Definition | Lecture |");
    lines.push("| --- | --- | --- |");
    for (const row of vocabRows) {
      lines.push(`| ${markdownCell(row.term)} | ${markdownCell(row.detail)} | ${markdownCell(row.source)} |`);
    }
    lines.push("");
  }

  if (settings.includeSections) {
    lines.push("## Lectures", "");
    for (const lecture of list) {
      lines.push(`### ${lecture.date} — ${lecture.title}`, "");
      lines.push(`Course: ${lecture.course}`);
      const topics = parseTopicList(lecture.topics);
      if (topics.length) {
        lines.push("", "Topics:");
        for (const topic of topics) lines.push(`- ${topic}`);
      }
      lines.push("");
    }
  }

  const markdown = `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  return {
    markdown,
    title,
    fileTitle: safeFileTitle(`${title} ${range.to}`),
    folder: settings.folder,
    stats: {
      lectures: list.length,
      courses: courses.length,
      concepts: concepts.length,
      vocabulary: vocabRows.length,
      from: range.from,
      to: range.to,
    },
  };
}

module.exports = {
  MAX_LECTURES,
  compileLectureNote,
  normalizeLectureCompilerSettings,
  parseTopicList,
  safeFileTitle,
  splitConcept,
};
