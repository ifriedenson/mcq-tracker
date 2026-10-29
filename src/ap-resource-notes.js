"use strict";
/*
 * Note-backed AP resources.
 *
 * A saved resource is a small Markdown note with a course, optional unit,
 * resource type, official URL and checked-on date. The note stores no AP
 * content: it points at the official page and records when the link was last
 * checked. Course and unit tags make the note easy to find with Dataview or
 * Obsidian search.
 */
const { localDate, str } = require("./util");
const { AP_RESOURCE_COURSES } = require("./ap-resources");

const AP_RESOURCE_NOTE_TYPE = "ap_resource";
const AP_RESOURCE_FOLDER = "AP resources";
const STALE_RESOURCE_DAYS = 180;

function normalizeDate(value) {
  const text = str(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayValue(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(date));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysSince(date, now) {
  const from = dayValue(date);
  if (from === null) return null;
  const target = now instanceof Date ? now : new Date(now || Date.now());
  if (Number.isNaN(target.getTime())) return null;
  const to = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.floor((to - from) / 86400000));
}

function isStale(checkedOn, now, maxDays) {
  const age = daysSince(checkedOn, now || new Date());
  if (age === null) return true;
  return age > (Number.isFinite(Number(maxDays)) ? Number(maxDays) : STALE_RESOURCE_DAYS);
}

function yamlScalar(value) {
  const text = str(value);
  if (text === "") return '""';
  if (/^[A-Za-z0-9_./:-]+$/.test(text) && !/^(true|false|null|-?\d+(\.\d+)?)$/i.test(text)) return text;
  return JSON.stringify(text);
}

function safeFilePart(value) {
  return str(value)
    .replace(/[\\/:*?"<>|#^\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function tagPart(value) {
  return str(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function noteTags(course, unit) {
  const tags = ["ap", tagPart(course.id)];
  const unitTag = tagPart(unit);
  if (unitTag) tags.push(/^unit-/.test(unitTag) ? unitTag : `unit-${unitTag}`);
  return [...new Set(tags.filter(Boolean))];
}

function resourceNoteFrontmatter(course, resource, unit, checkedOn) {
  return {
    type: AP_RESOURCE_NOTE_TYPE,
    ap_course: course.id,
    course: course.name,
    unit: str(unit).trim(),
    resource_type: resource.type,
    source_url: resource.url,
    checked_on: normalizeDate(checkedOn) || localDate(),
    official: true,
    tags: noteTags(course, unit),
  };
}

/** Bind a saved resource to one calendar exam without touching its link. */
function attachFrontmatter(fm, exam) {
  return {
    ...(fm || {}),
    exam_uid: str(exam && exam.uid),
    exam_date: str(exam && (exam.dateKey || exam.date)),
    exam_title: str(exam && (exam.summary || exam.title)),
  };
}

/** The local date and start time that identify one computed study block. */
function studySlotStamp(slot) {
  const start = slot && slot.start instanceof Date ? slot.start : new Date(slot && slot.start);
  if (Number.isNaN(start.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    subject: str(slot && slot.subject).trim(),
  };
}

/** Bind a resource to the free period starting at a given date and time. */
function attachStudySlotFrontmatter(fm, slot) {
  const stamp = studySlotStamp(slot);
  if (!stamp) return { ...(fm || {}) };
  return {
    ...(fm || {}),
    study_slot_date: stamp.date,
    study_slot_start: stamp.start,
    study_slot_subject: stamp.subject,
  };
}

/** True when the note is bound to this exact study block. */
function isAttachedToStudySlot(entry, slot) {
  const stamp = studySlotStamp(slot);
  if (!stamp || !entry) return false;
  return entry.studySlotDate === stamp.date && entry.studySlotStart === stamp.start;
}

/** Remove a study-block binding without touching the exam binding or link. */
function detachStudySlotFrontmatter(fm) {
  const next = { ...(fm || {}) };
  delete next.study_slot_date;
  delete next.study_slot_start;
  delete next.study_slot_subject;
  return next;
}

/** Remove the exam binding without touching the resource's course or link. */
function detachFrontmatter(fm) {
  const next = { ...(fm || {}) };
  delete next.exam_uid;
  delete next.exam_date;
  delete next.exam_title;
  return next;
}

/** Build a link-only resource note. The body never contains AP material. */
function buildApResourceNote(course, resource, unit, checkedOn) {
  if (!course || !resource || !resource.url) return null;
  const fm = resourceNoteFrontmatter(course, resource, unit, checkedOn);
  const path = `${AP_RESOURCE_FOLDER}/${safeFilePart(course.name)}/${safeFilePart(resource.title) || "Resource"}.md`;
  const lines = [];
  lines.push("---");
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) lines.push(`${key}: [${value.map(yamlScalar).join(", ")}]`);
    else if (typeof value === "boolean" || typeof value === "number") lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${yamlScalar(value)}`);
  }
  lines.push("---", "");
  lines.push(`# ${resource.title}`, "");
  lines.push("> An official AP resource link. This note is an index card, not a copy of the page.");
  lines.push("");
  lines.push(`- **Course:** ${course.name}`);
  lines.push(`- **Unit:** ${fm.unit || "Not specified"}`);
  lines.push(`- **Type:** ${resource.type}`);
  lines.push(`- **Link:** ${resource.url}`);
  lines.push(`- **Last checked:** ${fm.checked_on}`);
  lines.push("");
  lines.push("## Why this is here");
  lines.push("");
  lines.push(resource.description);
  lines.push("");
  lines.push("## Review checklist");
  lines.push("");
  lines.push("- [ ] Open the official page and confirm it still exists.");
  lines.push("- [ ] Check the exam year and scoring details against your course.");
  lines.push("- [ ] Update `checked_on` when you verify the link.");
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("Add your own summary or a link to related class notes here. Do not paste copyrighted AP prompts or rubrics into the vault.");
  lines.push("");
  return { path, title: resource.title, text: lines.join("\n"), frontmatter: fm, entry: entryFromFrontmatter(fm, path) };
}

function uniqueApResourcePath(note, exists) {
  const has = typeof exists === "function" ? exists : () => false;
  if (!has(note.path)) return note.path;
  const base = note.path.replace(/\.md$/i, "");
  let n = 2;
  while (has(`${base} ${n}.md`)) n++;
  return `${base} ${n}.md`;
}

function normalizeUrl(value) {
  const text = str(value).trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch (e) {
    return text.replace(/\/$/, "");
  }
}

function entryFromFrontmatter(fm, path, now) {
  if (!fm || fm.type !== AP_RESOURCE_NOTE_TYPE) return null;
  const courseId = str(fm.ap_course);
  const course = AP_RESOURCE_COURSES.find((item) => item.id === courseId) || AP_RESOURCE_COURSES[0];
  const checkedOn = normalizeDate(fm.checked_on);
  const ageDays = daysSince(checkedOn, now || new Date());
  return {
    path: str(path),
    courseId: course.id,
    course: str(fm.course) || course.name,
    unit: str(fm.unit).trim(),
    resourceType: str(fm.resource_type) || "resource",
    sourceUrl: str(fm.source_url),
    checkedOn,
    ageDays,
    stale: isStale(checkedOn, now || new Date()),
    examUid: str(fm.exam_uid),
    examDate: str(fm.exam_date),
    examTitle: str(fm.exam_title),
    studySlotDate: str(fm.study_slot_date),
    studySlotStart: str(fm.study_slot_start),
    studySlotSubject: str(fm.study_slot_subject),
  };
}

function sortApResourceNotes(entries) {
  return (entries || [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => Number(b.stale) - Number(a.stale) || String(a.course).localeCompare(String(b.course)) || String(a.path).localeCompare(String(b.path)));
}

function findApResourceNote(entries, url) {
  const wanted = normalizeUrl(url);
  return (entries || []).find((entry) => normalizeUrl(entry.sourceUrl) === wanted) || null;
}

function markCheckedFrontmatter(fm, checkedOn) {
  return { ...(fm || {}), checked_on: normalizeDate(checkedOn) || localDate() };
}

module.exports = {
  AP_RESOURCE_FOLDER,
  AP_RESOURCE_NOTE_TYPE,
  STALE_RESOURCE_DAYS,
  attachFrontmatter,
  attachStudySlotFrontmatter,
  buildApResourceNote,
  daysSince,
  detachFrontmatter,
  detachStudySlotFrontmatter,
  isAttachedToStudySlot,
  studySlotStamp,
  entryFromFrontmatter,
  findApResourceNote,
  isStale,
  markCheckedFrontmatter,
  normalizeUrl,
  noteTags,
  sortApResourceNotes,
  uniqueApResourcePath,
};
