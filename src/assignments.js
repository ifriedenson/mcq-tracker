"use strict";
/*
 * Assignments, weighted course grades and the credit-weighted GPA.
 *
 * Everything here is local and note-based. An assignment is an ordinary note
 * with `assignment: true`; its due date is also written as a Tasks line
 * (`- [ ] Essay 📅 2026-11-01`) so Tasks, Dataview and similar plugins can see
 * it. The frontmatter stays the source of truth for grades.
 */
const { addDays, fmtDate, localDate, str } = require("./util");
const { stringifyYaml } = require("obsidian");

const ASSIGNMENT_TYPES = [
  { id: "homework", label: "Homework", category: "homework" },
  { id: "quiz", label: "Quiz", category: "quiz" },
  { id: "test", label: "Test", category: "test" },
  { id: "exam", label: "Exam", category: "exam" },
  { id: "project", label: "Project or paper", category: "project" },
  { id: "other", label: "Other", category: "other" },
];

const ASSIGNMENT_CATEGORIES = [
  { id: "homework", label: "Homework", weight: 25 },
  { id: "quiz", label: "Quizzes", weight: 20 },
  { id: "test", label: "Tests", weight: 25 },
  { id: "exam", label: "Exams", weight: 20 },
  { id: "project", label: "Projects and papers", weight: 10 },
  { id: "other", label: "Other", weight: 0 },
];

const ASSIGNMENT_STATUSES = [
  { id: "todo", label: "To do" },
  { id: "in-progress", label: "In progress" },
  { id: "submitted", label: "Submitted" },
  { id: "graded", label: "Graded" },
  { id: "missing", label: "Missing" },
  { id: "excused", label: "Excused" },
];

const DEFAULT_ASSIGNMENT_SETTINGS = {
  enabled: true,
  folder: "Assignments",
  targetGrade: 90,
  finalWeight: 20,
  categories: ASSIGNMENT_CATEGORIES.map((c) => ({ ...c })),
  courses: [],
};

const TYPE_ALIASES = {
  assignment: "homework",
  hw: "homework",
  reading: "homework",
  worksheet: "homework",
  "problem-set": "homework",
  problemset: "homework",
  quiz: "quiz",
  check: "quiz",
  "check-in": "quiz",
  test: "test",
  midterm: "test",
  "mid-term": "test",
  exam: "exam",
  final: "exam",
  project: "project",
  paper: "project",
  essay: "project",
  lab: "project",
  report: "project",
};

const LETTER_POINTS = {
  "A+": 4.0, A: 4.0, "A-": 3.7,
  "B+": 3.3, B: 3.0, "B-": 2.7,
  "C+": 2.3, C: 2.0, "C-": 1.7,
  "D+": 1.3, D: 1.0, "D-": 0.7,
  F: 0,
};

const LETTER_PERCENT = {
  "A+": 98, A: 95, "A-": 90,
  "B+": 87, B: 83, "B-": 80,
  "C+": 77, C: 73, "C-": 70,
  "D+": 67, D: 63, "D-": 60,
  F: 50,
};

function num(value, fallback) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 10) / 10;
}

function normalizeDate(value) {
  const raw = str(value).trim();
  const iso = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const slash = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) return `${slash[1]}-${String(slash[2]).padStart(2, "0")}-${String(slash[3]).padStart(2, "0")}`;
  return "";
}

function dayDiff(from, to) {
  if (!from || !to) return null;
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

function normalizeStatus(value, checked) {
  const raw = str(value).trim().toLowerCase().replace(/\s+/g, "-");
  if (!raw) return checked ? "submitted" : "todo";
  if (raw === "done" || raw === "complete" || raw === "completed") return "submitted";
  if (raw === "not-started" || raw === "notstarted" || raw === "open") return "todo";
  if (raw === "in-progress" || raw === "inprogress" || raw === "doing") return "in-progress";
  if (ASSIGNMENT_STATUSES.some((s) => s.id === raw)) return raw;
  return checked ? "submitted" : "todo";
}

function statusLabel(status) {
  const row = ASSIGNMENT_STATUSES.find((s) => s.id === status);
  return row ? row.label : "To do";
}

function isDone(status) {
  return status === "submitted" || status === "graded" || status === "missing" || status === "excused";
}

function isOpen(status) {
  return status === "todo" || status === "in-progress";
}

function typeId(value) {
  const raw = str(value).trim().toLowerCase().replace(/\s+/g, "-");
  if (!raw) return "homework";
  if (ASSIGNMENT_TYPES.some((t) => t.id === raw)) return raw;
  return TYPE_ALIASES[raw] || "other";
}

function typeLabel(type) {
  const row = ASSIGNMENT_TYPES.find((t) => t.id === type);
  return row ? row.label : "Assignment";
}

function categoryFor(type, explicit) {
  const wanted = str(explicit).trim().toLowerCase();
  if (ASSIGNMENT_CATEGORIES.some((c) => c.id === wanted)) return wanted;
  const row = ASSIGNMENT_TYPES.find((t) => t.id === typeId(type));
  return row ? row.category : "other";
}

/** A Tasks-style line: `- [ ] Title 📅 2026-11-01`. */
function taskLineOf(text) {
  for (const line of str(text).split("\n")) {
    const m = line.match(/^\s*[-*+]\s*\[([ xX])\]\s+(.+?)\s*$/);
    if (m) {
      const due = dueFromTask(m[2]);
      return { checked: /x/i.test(m[1]), title: stripTaskMeta(m[2]), due, estimate: estimateFromTask(m[2]), raw: m[2].trim() };
    }
  }
  return null;
}

/** Tasks uses 📅 for due and ⏳ for scheduled. Due wins when both are present. */
function dueFromTask(line) {
  const raw = str(line);
  const due = raw.match(/📅\s*(\d{4}-\d{1,2}-\d{1,2})/u);
  if (due) return normalizeDate(due[1]);
  const scheduled = raw.match(/⏳\s*(\d{4}-\d{1,2}-\d{1,2})/u);
  return scheduled ? normalizeDate(scheduled[1]) : "";
}

/** Parse a Tasks estimate: 45, 45m, 1h, 1h 30m, 1.5h or 90 min. Returns minutes. */
function estimateMinutes(value) {
  if (typeof value === "number") return Number.isFinite(value) ? clamp(Math.round(value), 0, 10080) : 0;
  const raw = str(value).trim().toLowerCase();
  if (!raw) return 0;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return clamp(Math.round(Number(raw)), 0, 10080);
  let total = 0;
  let matched = false;
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)(?![a-z])/);
  const mins = raw.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)(?![a-z])/);
  if (hours) {
    total += Number(hours[1]) * 60;
    matched = true;
  }
  if (mins) {
    total += Number(mins[1]);
    matched = true;
  }
  return matched ? clamp(Math.round(total), 0, 10080) : 0;
}

/** Read the ⏱️ estimate from a Tasks line. */
function estimateFromTask(line) {
  const raw = str(line);
  const at = raw.search(/⏱\uFE0F?/u);
  if (at < 0) return 0;
  const tail = raw.slice(at).replace(/^⏱\uFE0F?\s*/u, "").split(/[📅⏳🛫🔁✅#]/u)[0];
  return estimateMinutes(tail);
}

function formatEstimate(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return "";
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (!hours) return String(mins) + "m";
  return mins ? String(hours) + "h " + String(mins) + "m" : String(hours) + "h";
}

function stripTaskMeta(line) {
  return str(line)
    .replace(/[📅⏳🛫🔁✅]\s*\d{4}-\d{1,2}-\d{1,2}/gu, "")
    .replace(/⏱\uFE0F?\s*[^📅⏳🛫🔁✅#]+/gu, "")
    .replace(/🔁\s*[^#]+/gu, "")
    .replace(/\s+#[^\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAssignmentNote(fm) {
  if (!fm || typeof fm !== "object") return false;
  return fm.assignment === true || str(fm.assignment).toLowerCase() === "true" || !!str(fm.assignment_id).trim();
}

function normalizeCategories(value) {
  const saved = Array.isArray(value) ? value : [];
  return ASSIGNMENT_CATEGORIES.map((def) => {
    const row = saved.find((x) => x && x.id === def.id);
    return { id: def.id, label: def.label, weight: clamp(num(row && row.weight, def.weight), 0, 100) };
  });
}

function normalizeCourses(value) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    const name = str(raw && raw.name).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      credits: clamp(num(raw.credits, 3), 0, 30),
      target: raw.target === null || raw.target === undefined || raw.target === "" ? null : clamp(num(raw.target, 90), 0, 100),
      finalWeight: raw.finalWeight === null || raw.finalWeight === undefined || raw.finalWeight === "" ? null : clamp(num(raw.finalWeight, 20), 0, 100),
    });
  }
  return out;
}

function normalizeAssignmentSettings(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    enabled: src.enabled !== false,
    folder: str(src.folder).trim() || DEFAULT_ASSIGNMENT_SETTINGS.folder,
    targetGrade: clamp(num(src.targetGrade, DEFAULT_ASSIGNMENT_SETTINGS.targetGrade), 0, 100),
    finalWeight: clamp(num(src.finalWeight, DEFAULT_ASSIGNMENT_SETTINGS.finalWeight), 0, 100),
    categories: normalizeCategories(src.categories),
    courses: normalizeCourses(src.courses),
  };
}

function courseConfig(settings, course) {
  const key = str(course).trim().toLowerCase();
  if (!key) return null;
  const row = (settings && settings.courses ? settings.courses : []).find((c) => str(c.name).trim().toLowerCase() === key);
  return row || null;
}

function courseTarget(settings, course) {
  const cfg = courseConfig(settings, course);
  return cfg && Number.isFinite(cfg.target) ? cfg.target : settings.targetGrade;
}

function courseFinalWeight(settings, course) {
  const cfg = courseConfig(settings, course);
  return cfg && Number.isFinite(cfg.finalWeight) ? cfg.finalWeight : settings.finalWeight;
}

function courseCredits(settings, course) {
  const cfg = courseConfig(settings, course);
  if (cfg && Number.isFinite(cfg.credits)) return cfg.credits;
  const key = str(course).trim().toLowerCase();
  const registered = settings && settings.registryCredits ? settings.registryCredits[key] : undefined;
  return Number.isFinite(registered) ? registered : 3;
}

function letterForPercent(percent) {
  if (percent === null || percent === undefined) return "-";
  const p = Number(percent);
  if (p >= 93) return "A";
  if (p >= 90) return "A-";
  if (p >= 87) return "B+";
  if (p >= 83) return "B";
  if (p >= 80) return "B-";
  if (p >= 77) return "C+";
  if (p >= 73) return "C";
  if (p >= 70) return "C-";
  if (p >= 67) return "D+";
  if (p >= 63) return "D";
  if (p >= 60) return "D-";
  return "F";
}

function gpaPointsFor(percent) {
  return LETTER_POINTS[letterForPercent(percent)] || 0;
}

function letterToPercent(value) {
  return LETTER_PERCENT[str(value).trim().toUpperCase()] || null;
}

/** The final score a course needs to reach its target. null when there is no current grade. */
function neededOnFinal(current, target, finalWeight) {
  if (current === null || current === undefined || str(current).trim() === "") return null;
  if (target === null || target === undefined || str(target).trim() === "") return null;
  if (finalWeight === null || finalWeight === undefined || str(finalWeight).trim() === "") return null;
  const c = Number(current);
  const t = Number(target);
  const f = Number(finalWeight);
  if (!Number.isFinite(c) || !Number.isFinite(t) || !Number.isFinite(f) || f <= 0 || f >= 100) return null;
  return Math.round(((t - c * (1 - f / 100)) / (f / 100)) * 10) / 10;
}

function scoreOf(fm) {
  const points = num(fm.points, num(fm.points_possible, 0));
  const earned = num(fm.score, num(fm.points_earned, num(fm.earned, null)));
  const direct = num(fm.percent, null);
  let percent = direct;
  if (percent === null && fm.grade !== undefined && fm.grade !== null && str(fm.grade).trim() !== "") {
    const grade = str(fm.grade).trim();
    percent = num(grade, null);
    if (percent === null) percent = letterToPercent(grade);
  }
  if (percent === null && earned !== null && points > 0) percent = (earned / points) * 100;
  return {
    points: points > 0 ? points : null,
    earned,
    percent: percent === null ? null : clamp(percent, 0, 100),
  };
}

function parseAssignment(file, fm, text, settings) {
  const source = fm && typeof fm === "object" ? fm : {};
  const task = taskLineOf(text);
  const explicitEstimate = source.estimate !== undefined && source.estimate !== null && str(source.estimate).trim() !== "" ? source.estimate : task && task.estimate;
  const estimate = estimateMinutes(explicitEstimate);
  const type = typeId(source.type || source.assignment_type);
  const status = normalizeStatus(source.status, task && task.checked);
  const due = normalizeDate(source.due || source.due_date || source.deadline || (task && task.due));
  const title = str(source.title || source.name).trim() || (task && task.title) || (file && file.basename) || "Assignment";
  const score = scoreOf(source);
  const graded = status === "missing" || (status !== "excused" && score.percent !== null);
  const percent = status === "missing" ? 0 : graded ? score.percent : null;
  return {
    id: str(source.assignment_id).trim() || (file && file.path) || title,
    file,
    title,
    course: str(source.course).trim(),
    type,
    typeLabel: typeLabel(type),
    category: categoryFor(type, source.category),
    due,
    estimate,
    weight: Math.max(0.01, num(source.weight, 1)),
    status,
    statusLabel: statusLabel(status),
    done: isDone(status),
    open: isOpen(status),
    graded: status !== "excused" && percent !== null,
    percent: status === "excused" ? null : percent,
    earned: score.earned,
    points: score.points,
    text: str(text),
    fm: source,
  };
}

function weightedAverage(rows, valueKey, weightKey) {
  let total = 0;
  let weight = 0;
  for (const row of rows) {
    const v = Number(row[valueKey]);
    const w = Math.max(0, Number(row[weightKey]) || 0);
    if (!Number.isFinite(v) || w <= 0) continue;
    total += v * w;
    weight += w;
  }
  return weight ? { value: total / weight, weight } : { value: null, weight: 0 };
}

function courseRow(settings, course, assignments) {
  const list = assignments.filter((a) => a.course && a.course.toLowerCase() === course.toLowerCase());
  const categories = settings.categories.map((cat) => {
    const rows = list.filter((a) => a.category === cat.id && a.status !== "excused");
    const graded = rows.filter((a) => a.percent !== null);
    const average = weightedAverage(
      graded.map((a) => ({ percent: a.percent, weight: a.weight })),
      "percent",
      "weight"
    );
    return {
      id: cat.id,
      label: cat.label,
      weight: cat.weight,
      percent: pct(average.value),
      assignments: rows.length,
      graded: graded.length,
    };
  });
  const counted = categories.filter((c) => c.percent !== null && c.weight > 0);
  let current = null;
  if (counted.length) {
    const average = weightedAverage(counted.map((c) => ({ percent: c.percent, weight: c.weight })), "percent", "weight");
    current = pct(average.value);
  } else {
    // A course can use assignments without category weights. In that case the
    // assignment weights are still meaningful, so use them as a fallback.
    const graded = list.filter((a) => a.percent !== null && a.status !== "excused");
    const average = weightedAverage(graded.map((a) => ({ percent: a.percent, weight: a.weight })), "percent", "weight");
    if (average.value !== null) current = pct(average.value);
  }
  const target = courseTarget(settings, course);
  const finalWeight = courseFinalWeight(settings, course);
  return {
    course,
    credits: courseCredits(settings, course),
    current,
    letter: letterForPercent(current),
    gpaPoints: current === null ? null : gpaPointsFor(current),
    target,
    finalWeight,
    neededFinal: current === null ? null : neededOnFinal(current, target, finalWeight),
    total: list.length,
    open: list.filter((a) => a.open).length,
    graded: list.filter((a) => a.percent !== null).length,
    categories,
  };
}

/** Estimated open work for today, tomorrow and the next N days. */
function workload(assignments, options) {
  const opts = options || {};
  const today = normalizeDate(opts.today) || localDate();
  const days = Math.max(0, num(opts.days, 7));
  const rows = (Array.isArray(assignments) ? assignments : []).filter((a) => a.open && a.due && a.estimate > 0);
  const byDay = new Map();
  let todayMinutes = 0;
  let tomorrowMinutes = 0;
  let weekMinutes = 0;
  let overdueMinutes = 0;
  for (const a of rows) {
    const diff = dayDiff(today, a.due);
    if (diff === null) continue;
    if (diff < 0) {
      overdueMinutes += a.estimate;
      continue;
    }
    if (diff === 0) todayMinutes += a.estimate;
    if (diff === 1) tomorrowMinutes += a.estimate;
    if (diff <= days) {
      weekMinutes += a.estimate;
      byDay.set(a.due, (byDay.get(a.due) || 0) + a.estimate);
    }
  }
  return {
    today,
    days,
    todayMinutes,
    tomorrowMinutes,
    weekMinutes,
    overdueMinutes,
    total: rows.reduce((sum, a) => sum + a.estimate, 0),
    byDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, minutes]) => ({ date, minutes })),
  };
}

function assignmentStats(assignments, settings, options) {
  const opts = options || {};
  const today = normalizeDate(opts.today) || localDate();
  const list = Array.isArray(assignments) ? assignments : [];
  const names = [];
  const seen = new Set();
  const add = (name) => {
    const clean = str(name).trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(clean);
  };
  for (const course of (settings && settings.courses) || []) add(course.name);
  for (const a of list) add(a.course);
  const courses = names.map((name) => courseRow(settings, name, list)).sort((a, b) => a.course.localeCompare(b.course, undefined, { numeric: true }));
  const gradedCourses = courses.filter((c) => c.current !== null && c.credits > 0);
  const creditTotal = gradedCourses.reduce((n, c) => n + c.credits, 0);
  const pointTotal = gradedCourses.reduce((n, c) => n + c.gpaPoints * c.credits, 0);
  const gpa = creditTotal ? Math.round((pointTotal / creditTotal) * 100) / 100 : null;
  const unweighted = gradedCourses.length
    ? Math.round((gradedCourses.reduce((n, c) => n + c.gpaPoints, 0) / gradedCourses.length) * 100) / 100
    : null;
  return {
    today,
    assignments: list,
    workload: workload(list, { today }),
    courses,
    gpa,
    unweightedGpa: unweighted,
    credits: creditTotal,
    gradedCourses: gradedCourses.length,
    summary: {
      total: list.length,
      open: list.filter((a) => a.open).length,
      overdue: list.filter((a) => a.open && a.due && a.due < today).length,
      dueToday: list.filter((a) => a.open && a.due === today).length,
      graded: list.filter((a) => a.percent !== null).length,
    },
  };
}

function dueState(assignment, today) {
  if (!assignment || !assignment.due) return { id: "no-date", label: "No date", days: null };
  const days = dayDiff(today, assignment.due);
  if (days === null) return { id: "no-date", label: assignment.due, days: null };
  if (days < 0) return { id: "overdue", label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, days };
  if (days === 0) return { id: "today", label: "Due today", days };
  if (days === 1) return { id: "soon", label: "Due tomorrow", days };
  if (days <= 7) return { id: "soon", label: `Due in ${days} days`, days };
  return { id: "upcoming", label: assignment.due, days };
}

function assignmentTasks(assignments, options) {
  const opts = options || {};
  const today = normalizeDate(opts.today) || localDate();
  const days = Math.max(0, num(opts.days, 14));
  return (Array.isArray(assignments) ? assignments : [])
    .filter((a) => a.open && a.due)
    .map((a) => ({ assignment: a, state: dueState(a, today) }))
    .filter((row) => row.state.id === "overdue" || row.state.id === "today" || (row.state.days !== null && row.state.days >= 0 && row.state.days <= days))
    .sort((a, b) => a.assignment.due.localeCompare(b.assignment.due) || a.assignment.title.localeCompare(b.assignment.title));
}

/** The mixed task card in Today: a review task first, then the nearest assignment deadlines. */
function buildDailyTasks(input) {
  const opts = input || {};
  const today = normalizeDate(opts.today) || localDate();
  const review = Math.max(0, num(opts.reviewCount, 0));
  const rows = [];
  if (review > 0) {
    rows.push({
      id: "review",
      kind: "review",
      title: `Review ${review} due item${review === 1 ? "" : "s"}`,
      meta: "Questions and cards due today",
      minutes: 5,
    });
  }
  for (const row of assignmentTasks(opts.assignments || [], { today, days: opts.days === undefined ? 7 : opts.days }).slice(0, opts.assignmentLimit === undefined ? 3 : opts.assignmentLimit)) {
    rows.push({
      id: `assignment-${row.assignment.id}`,
      kind: "assignment",
      title: row.assignment.title,
      meta: [row.assignment.course, row.state.label, row.assignment.estimate ? `~${formatEstimate(row.assignment.estimate)}` : ""].filter(Boolean).join(" · "),
      minutes: row.assignment.estimate || 0,
      assignment: row.assignment,
    });
  }
  return rows;
}

function assignmentId(now) {
  const date = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  return `a-${date.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function safeName(value) {
  return str(value)
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function taskMarkdown(title, due, estimate) {
  const clean = stripTaskMeta(safeName(title)) || "Assignment";
  const mins = estimateMinutes(estimate);
  return `- [ ] ${clean}${due ? ` 📅 ${due}` : ""}${mins ? ` ⏱️ ${formatEstimate(mins)}` : ""}`;
}

function assignmentMarkdown(data, now) {
  const opts = data || {};
  const date = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const title = safeName(opts.title) || "Assignment";
  const type = typeId(opts.type);
  const due = normalizeDate(opts.due);
  const estimate = estimateMinutes(opts.estimate);
  const status = normalizeStatus(opts.status, false);
  const fm = {
    assignment: true,
    assignment_id: str(opts.id).trim() || assignmentId(date),
    title,
    course: str(opts.course).trim(),
    type,
    category: categoryFor(type, opts.category),
    due,
    weight: Math.max(0.01, num(opts.weight, 1)),
    status,
    points: opts.points === undefined || opts.points === "" ? "" : num(opts.points, ""),
    score: opts.score === undefined || opts.score === "" ? "" : num(opts.score, ""),
    created: fmtDate(date),
  };
  if (estimate) fm.estimate = estimate;
  if (status === "submitted" || status === "graded") fm.submitted = fmtDate(date);
  return `---\n${stringifyYaml(fm)}---\n\n# ${title}\n\n${taskMarkdown(title, due, estimate)}\n\n## Notes\n\n`;
}

function updateTaskCheckbox(text, checked) {
  return str(text).replace(/^(\s*[-*+]\s*)\[([ xX])\]/m, `$1[${checked ? "x" : " "}]`);
}

function updateTaskTitle(text, title) {
  const clean = stripTaskMeta(safeName(title));
  if (!clean) return str(text);
  return str(text).replace(
    /^(\s*[-*+]\s+\[[ xX]\]\s+)(.*?)(?=\s*(?:📅|⏳|⏱)|\s*$)/m,
    `$1${clean}`
  );
}

function updateTaskDue(text, due) {
  const date = normalizeDate(due);
  return str(text).replace(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/m, (line, prefix, rest) => {
    const estimate = estimateFromTask(rest);
    const base = rest
      .replace(/\s*(?:📅|⏳)\s*\d{4}-\d{1,2}-\d{1,2}/gu, "")
      .replace(/\s*⏱\uFE0F?\s*[^📅⏳🛫🔁✅#]+/gu, "")
      .trim();
    return `${prefix}${base}${date ? ` 📅 ${date}` : ""}${estimate ? ` ⏱️ ${formatEstimate(estimate)}` : ""}`;
  });
}

function updateTaskEstimate(text, minutes) {
  const estimate = estimateMinutes(minutes);
  return str(text).replace(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/m, (line, prefix, rest) => {
    const base = rest.replace(/\s*⏱\uFE0F?\s*[^📅⏳🛫🔁✅#]+/gu, "").trim();
    return `${prefix}${base}${estimate ? ` ⏱️ ${formatEstimate(estimate)}` : ""}`;
  });
}

function statusAfterCheckbox(status, checked) {
  if (checked && isOpen(status)) return "submitted";
  if (!checked && (status === "submitted" || status === "graded")) return "todo";
  return status;
}

function uniquePath(settings, title, exists) {
  const folder = str(settings.folder).trim().replace(/^\/+|\/+$/g, "");
  const base = safeName(title) || "Assignment";
  const has = typeof exists === "function" ? exists : () => false;
  let candidate = `${folder ? folder + "/" : ""}${base}.md`;
  let n = 2;
  while (has(candidate)) {
    candidate = `${folder ? folder + "/" : ""}${base} ${n}.md`;
    n++;
  }
  return candidate;
}

module.exports = {
  ASSIGNMENT_TYPES,
  ASSIGNMENT_CATEGORIES,
  ASSIGNMENT_STATUSES,
  DEFAULT_ASSIGNMENT_SETTINGS,
  assignmentId,
  assignmentMarkdown,
  assignmentStats,
  assignmentTasks,
  buildDailyTasks,
  categoryFor,
  courseConfig,
  courseCredits,
  courseFinalWeight,
  courseTarget,
  dueFromTask,
  dueState,
  estimateFromTask,
  estimateMinutes,
  formatEstimate,
  gpaPointsFor,
  isAssignmentNote,
  isDone,
  isOpen,
  letterForPercent,
  letterToPercent,
  neededOnFinal,
  normalizeAssignmentSettings,
  normalizeDate,
  normalizeStatus,
  parseAssignment,
  safeName,
  scoreOf,
  statusAfterCheckbox,
  statusLabel,
  stripTaskMeta,
  taskLineOf,
  taskMarkdown,
  typeId,
  typeLabel,
  uniquePath,
  updateTaskCheckbox,
  updateTaskDue,
  updateTaskEstimate,
  updateTaskTitle,
  workload,
};
