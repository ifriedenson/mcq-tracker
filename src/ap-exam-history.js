"use strict";
/*
 * Saved AP practice-exam notes.
 *
 * A saved result is an ordinary Markdown note with frontmatter. The calculator
 * writes it, and the history view reads those properties; no separate database
 * is needed and the learner can edit or delete the note like any other.
 */
const { localDate, str } = require("./util");
const { normalizeCutoffs, profileById } = require("./ap-score");

const AP_EXAM_TYPE = "ap_practice_exam";
const AP_EXAM_FOLDER = "AP practice exams";
const AP_EXAM_CURVE_SOURCE = "practice-defaults";

function numberText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10) / 10).replace(/\.0$/, "");
}

function yamlScalar(value) {
  const text = str(value);
  if (text === "") return '""';
  if (/^[A-Za-z0-9_./-]+$/.test(text) && !/^(true|false|null|-?\d+(\.\d+)?)$/i.test(text)) return text;
  return JSON.stringify(text);
}

function safeFilePart(value) {
  return str(value)
    .replace(/[\\/:*?"<>|#^[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function normalizeDate(value) {
  const text = str(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isApExamNote(fm) {
  if (!fm || typeof fm !== "object") return false;
  return fm.type === AP_EXAM_TYPE || fm.ap_practice_exam === true || fm.ap_practice_exam === "true";
}

function apExamFrontmatter(profile, result, cutoffs, takenOn) {
  const p = profile || (result && result.profile);
  if (!p || !result || result.complete !== true || !Number.isFinite(Number(result.composite))) return null;
  const date = normalizeDate(takenOn) || localDate();
  const c = normalizeCutoffs(cutoffs || result.cutoffs);
  const fm = {
    type: AP_EXAM_TYPE,
    ap_course: p.id,
    course: p.name,
    exam_year: p.year,
    taken_on: date,
    composite: Math.round(Number(result.composite) * 10) / 10,
    estimated_ap_score: Number(result.estimated),
    score_low: result.range ? Number(result.range[0]) : Number(result.estimated),
    score_high: result.range ? Number(result.range[1]) : Number(result.estimated),
    cut_score_5: Number(c[5]),
    cut_score_4: Number(c[4]),
    cut_score_3: Number(c[3]),
    cut_score_2: Number(c[2]),
    curve_source: AP_EXAM_CURVE_SOURCE,
  };
  // Keep free-response / written scores separate from the composite so a
  // learner can see whether the written half is improving across attempts.
  const written = result.sections.filter((section) => section.id !== "mcq" && section.complete && Number(section.max) > 0);
  if (written.length) {
    const earned = written.reduce((sum, section) => sum + Number(section.earned || 0), 0);
    const max = written.reduce((sum, section) => sum + Number(section.max || 0), 0);
    fm.frq_earned = Math.round(earned * 10) / 10;
    fm.frq_max = Math.round(max * 10) / 10;
    fm.frq_percent = max ? Math.round((earned / max) * 1000) / 10 : 0;
    for (const section of written) {
      fm[`frq_${section.id}_earned`] = Math.round(Number(section.earned || 0) * 10) / 10;
      fm[`frq_${section.id}_max`] = Math.round(Number(section.max || 0) * 10) / 10;
    }
  }
  return fm;
}

/** Build the note text and its frontmatter from a complete calculator result. */
function buildApExamNote(profile, result, cutoffs, takenOn) {
  const fm = apExamFrontmatter(profile, result, cutoffs, takenOn);
  if (!fm) return null;
  const range = fm.score_low === fm.score_high ? String(fm.estimated_ap_score) : `${fm.score_low}-${fm.score_high}`;
  const lines = [];
  lines.push("---");
  for (const [key, value] of Object.entries(fm)) lines.push(`${key}: ${typeof value === "number" ? value : yamlScalar(value)}`);
  lines.push("---", "");
  lines.push(`# AP practice exam: ${fm.course}`, "");
  lines.push("> Unofficial practice estimate. This is not a College Board score, and the cut scores are editable practice defaults.");
  lines.push("");
  lines.push(`- **Date:** ${fm.taken_on}`);
  lines.push(`- **Course:** ${fm.course} (${fm.exam_year})`);
  lines.push(`- **Composite:** ${numberText(fm.composite)}%`);
  lines.push(`- **Estimated score:** ${fm.estimated_ap_score} (likely band ${range})`);
  lines.push("");
  lines.push("## Sections");
  lines.push("");
  lines.push("| Section | Weight | Points | Percent |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const section of result.sections) {
    lines.push(`| ${section.label} | ${Math.round(Number(section.weight) * 100)}% | ${numberText(section.earned)} / ${numberText(section.max)} | ${numberText(section.percent)}% |`);
  }
  lines.push("");
  const written = result.sections.filter((section) => section.id !== "mcq" && Array.isArray(section.parts) && section.parts.some((part) => part.earned !== null));
  if (written.length) {
    lines.push("## Written scores");
    lines.push("");
    lines.push("| Section | Question | Earned / max |");
    lines.push("| --- | --- | ---: |");
    for (const section of written) {
      for (const part of section.parts) lines.push(`| ${section.label} | ${part.label} | ${part.earned === null ? "—" : numberText(part.earned)} / ${numberText(part.max)} |`);
    }
    lines.push("");
  }
  lines.push("## Practice cut scores");
  lines.push("");
  lines.push("| AP score | Minimum composite |");
  lines.push("| ---: | ---: |");
  for (const score of [5, 4, 3, 2]) lines.push(`| ${score} | ${numberText(fm[`cut_score_${score}`])}% |`);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("Add what to review before the next attempt.");
  lines.push("");

  const title = `${fm.taken_on} ${fm.course} ${numberText(fm.composite)}`;
  return {
    path: `${AP_EXAM_FOLDER}/${safeFilePart(title) || "AP practice exam"}.md`,
    title,
    text: lines.join("\n"),
    frontmatter: fm,
    entry: entryFromFrontmatter(fm, `${AP_EXAM_FOLDER}/${safeFilePart(title) || "AP practice exam"}.md`),
  };
}

/** Use a unique path so saving twice never overwrites an earlier attempt. */
function uniqueApExamPath(note, exists) {
  const has = typeof exists === "function" ? exists : () => false;
  if (!has(note.path)) return note.path;
  const base = note.path.replace(/\.md$/i, "");
  let n = 2;
  while (has(`${base} ${n}.md`)) n++;
  return `${base} ${n}.md`;
}

function entryFromFrontmatter(fm, path) {
  if (!isApExamNote(fm)) return null;
  const composite = Number(fm.composite);
  if (!Number.isFinite(composite)) return null;
  const profile = profileById(fm.ap_course);
  const date = normalizeDate(fm.taken_on);
  return {
    path: str(path),
    courseId: str(fm.ap_course) || profile.id,
    course: str(fm.course) || profile.name,
    examYear: str(fm.exam_year) || profile.year,
    takenOn: date,
    composite: Math.round(composite * 10) / 10,
    estimated: Number(fm.estimated_ap_score) || 0,
    low: Number(fm.score_low) || Number(fm.estimated_ap_score) || 0,
    high: Number(fm.score_high) || Number(fm.estimated_ap_score) || 0,
    frqEarned: Number.isFinite(Number(fm.frq_earned)) ? Number(fm.frq_earned) : null,
    frqMax: Number.isFinite(Number(fm.frq_max)) ? Number(fm.frq_max) : null,
    frqPercent: Number.isFinite(Number(fm.frq_percent)) ? Number(fm.frq_percent) : null,
  };
}

/** Newest first; an undated note goes last rather than disappearing. */
function sortApExamEntries(entries) {
  return (entries || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(b.takenOn || "").localeCompare(String(a.takenOn || "")) || String(a.path).localeCompare(String(b.path)));
}

function apExamTrend(entries) {
  const newest = sortApExamEntries(entries);
  const latest = newest[0] || null;
  const previous = newest[1] || null;
  const average = newest.length ? Math.round((newest.reduce((sum, item) => sum + item.composite, 0) / newest.length) * 10) / 10 : null;
  const delta = latest && previous ? Math.round((latest.composite - previous.composite) * 10) / 10 : null;
  const withFrq = newest.filter((item) => Number.isFinite(item.frqPercent) && Number(item.frqMax) > 0);
  const frqLatest = withFrq[0] || null;
  const frqPrevious = withFrq[1] || null;
  const frqAverage = withFrq.length ? Math.round((withFrq.reduce((sum, item) => sum + item.frqPercent, 0) / withFrq.length) * 10) / 10 : null;
  const frqDelta = frqLatest && frqPrevious ? Math.round((frqLatest.frqPercent - frqPrevious.frqPercent) * 10) / 10 : null;
  return {
    count: newest.length,
    latest,
    previous,
    average,
    delta,
    direction: delta === null ? "none" : delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    frqLatest,
    frqPrevious,
    frqAverage,
    frqDelta,
    frqDirection: frqDelta === null ? "none" : frqDelta > 0 ? "up" : frqDelta < 0 ? "down" : "flat",
  };
}

module.exports = {
  AP_EXAM_CURVE_SOURCE,
  AP_EXAM_FOLDER,
  AP_EXAM_TYPE,
  apExamFrontmatter,
  apExamTrend,
  buildApExamNote,
  entryFromFrontmatter,
  isApExamNote,
  normalizeDate,
  sortApExamEntries,
  uniqueApExamPath,
};
