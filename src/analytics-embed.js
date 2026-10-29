"use strict";
const { fmtPct } = require("./stats");
const { fmtClock } = require("./util");
const { BREAKDOWN_FIELDS, FIELD_LABELS } = require("./analytics");

const DASHBOARD_METRICS = ["overview", "stats", "heatmap", "calibration", "retention", "weak", "grades", "courses", "exam"];
const ALIASES = {
  overview: "overview",
  dashboard: "overview",
  all: "overview",
  stats: "stats",
  summary: "stats",
  heatmap: "heatmap",
  activity: "heatmap",
  calibration: "calibration",
  confidence: "calibration",
  retention: "retention",
  retain: "retention",
  trend: "retention",
  weak: "weak",
  skills: "weak",
  grade: "grades",
  grades: "grades",
  courses: "courses",
  course: "courses",
  exam: "exam",
  exams: "exam",
};

const LABELS = {
  overview: "Study dashboard",
  stats: "Study stats",
  heatmap: "Study heatmap",
  calibration: "Confidence calibration",
  retention: "Retention trend",
  weak: "Weak spots",
  grades: "Grade snapshot",
  courses: "Study time by course",
  exam: "Next exam",
};

/** Read a `mcq-dashboard` block. Unknown metrics fall back to the overview. */
function parseDashboardBlock(source) {
  const opts = { metric: "overview", weeks: 12, course: "", field: "skill", title: "" };
  for (const line of String(source || "").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "metric") opts.metric = ALIASES[value.toLowerCase()] || "overview";
    else if (key === "weeks") {
      const n = Math.round(Number(value));
      if (Number.isFinite(n)) opts.weeks = Math.max(1, Math.min(26, n));
    } else if (key === "course") opts.course = value;
    else if (key === "field") opts.field = BREAKDOWN_FIELDS.includes(value.toLowerCase()) ? value.toLowerCase() : "skill";
    else if (key === "title") opts.title = value;
  }
  return opts;
}

function heading(container, text) {
  container.createEl("h3", { cls: "qt-today-section", text });
}

function tile(container, label, value, hint) {
  const box = container.createDiv({ cls: "qt-dash-stat" });
  box.createDiv({ cls: "qt-dash-value", text: value });
  box.createDiv({ cls: "qt-dash-label", text: label });
  if (hint) box.createDiv({ cls: "qt-hint", text: hint });
}

function renderStats(container, data) {
  const o = data.overall;
  const tiles = container.createDiv({ cls: "qt-dash-stats" });
  tile(tiles, "Attempts", String(o.attempts), `${o.seen} of ${o.notes} questions tried`);
  tile(tiles, "Accuracy", fmtPct(o.accuracy), o.attempts ? `${fmtClock(Math.round(o.avgSeconds))} per question` : "No attempts yet");
  tile(tiles, "Study today", `${data.study.todayMinutes} min`, `${data.study.streak} day streak`);
  tile(tiles, "Cards due", String(data.cardStats.due), `${data.cardStats.total} cards in decks`);
}

function renderHeatmap(container, data) {
  const days = data.heatmap.flatMap((week) => week.days);
  const active = days.filter((day) => !day.future && (day.minutes || day.attempts)).length;
  const minutes = days.reduce((n, day) => n + day.minutes, 0);
  heading(container, "Study heatmap");
  container.createDiv({
    cls: "qt-hint",
    text: `Last ${data.heatmap.length} weeks · ${active} active day${active === 1 ? "" : "s"} · ${minutes} logged minute${minutes === 1 ? "" : "s"}`,
  });
  const heat = container.createDiv({ cls: "qt-dash-heat" });
  for (const week of data.heatmap) {
    const column = heat.createDiv({ cls: "qt-dash-week" });
    for (const day of week.days) {
      const cell = column.createDiv({ cls: `qt-dash-day is-level-${day.level}${day.future ? " is-future" : ""}` });
      cell.setAttr("title", `${day.date}: ${day.minutes} study min · ${day.attempts} attempt${day.attempts === 1 ? "" : "s"}`);
      cell.setAttr("aria-label", `${day.date}: ${day.minutes} study minutes, ${day.attempts} attempts`);
    }
  }
  const legend = container.createDiv({ cls: "qt-dash-legend" });
  legend.createSpan({ cls: "qt-hint", text: "Less" });
  for (let i = 0; i < 5; i++) legend.createSpan({ cls: `qt-dash-day is-level-${i}` });
  legend.createSpan({ cls: "qt-hint", text: "More" });
}

function renderCalibration(container, data) {
  heading(container, "Confidence calibration");
  const calibration = data.calibration;
  if (!calibration || !calibration.total) {
    container.createDiv({ cls: "qt-hint", text: "No confidence ratings yet. Rate how sure you are when you answer." });
    return;
  }
  const list = container.createDiv({ cls: "qt-ins-list" });
  for (const bucket of calibration.buckets) {
    const line = list.createDiv({ cls: "qt-ins-row qt-cal-row" });
    const main = line.createDiv({ cls: "qt-ins-main" });
    main.createDiv({ cls: "qt-ins-name", text: bucket.label });
    main.createDiv({ cls: "qt-hint", text: `${bucket.attempts} attempt${bucket.attempts === 1 ? "" : "s"} at this level` });
    const meter = line.createDiv({ cls: "qt-ins-meter" });
    const band = bucket.accuracy === null ? "" : bucket.accuracy < 0.6 ? "is-low" : bucket.accuracy < 0.8 ? "is-mid" : "is-high";
    meter.createDiv({ cls: "qt-meter-track" }).createDiv({ cls: `qt-meter-fill ${band}` }).setCssProps({ "--qt-pct": `${Math.round((bucket.accuracy || 0) * 100)}%` });
    line.createSpan({ cls: "qt-ins-pct", text: fmtPct(bucket.accuracy) });
  }
  container.createDiv({ cls: "qt-hint", text: "Bars show how often you were right when you chose each confidence level." });
}

function renderRetention(container, data) {
  heading(container, "Retention trend");
  const retention = data.retention;
  if (!retention || !retention.attempts) {
    container.createDiv({ cls: "qt-hint", text: "No repeat attempts yet. Retention shows up after you revisit a question." });
    return;
  }
  const chart = container.createDiv({ cls: "qt-trend" });
  for (const week of retention.weeks) {
    const column = chart.createDiv({ cls: "qt-trend-col" });
    column.setAttr("title", week.attempts ? `${week.start}: ${fmtPct(week.accuracy)} of ${week.attempts} review attempts` : `${week.start}: no review attempts`);
    const bar = column.createDiv({ cls: "qt-trend-bar" });
    const band = week.accuracy === null ? "" : week.accuracy < 0.6 ? "is-low" : week.accuracy < 0.8 ? "is-mid" : "is-high";
    bar.createDiv({ cls: `qt-meter-fill ${band}` }).setCssProps({ "--qt-pct": `${Math.round((week.accuracy || 0) * 100)}%` });
    column.createDiv({ cls: "qt-hint qt-trend-lab", text: week.accuracy === null ? "" : fmtPct(week.accuracy) });
  }
  container.createDiv({
    cls: "qt-hint",
    text: `${fmtPct(retention.accuracy)} over ${retention.attempts} review attempt${retention.attempts === 1 ? "" : "s"}. The first try on each question is excluded.`,
  });
}

function renderBreakdown(container, data, hooks) {
  const field = data.field || "skill";
  heading(container, data.fieldLabel || FIELD_LABELS[field] || "Weak spots");
  const rows = (data.breakdown || data.skills || []).filter((row) => row.accuracy !== null).slice(0, 5);
  if (!rows.length) {
    container.createDiv({ cls: "qt-hint", text: `No attempted ${field} values yet.` });
    return;
  }
  const list = container.createDiv({ cls: "qt-ins-list" });
  for (const row of rows) {
    const line = list.createDiv({ cls: "qt-ins-row" });
    const main = line.createDiv({ cls: "qt-ins-main" });
    main.createDiv({ cls: "qt-ins-name", text: row.value });
    main.createDiv({ cls: "qt-hint", text: `${row.attempts} attempt${row.attempts === 1 ? "" : "s"} · ${row.notes} note${row.notes === 1 ? "" : "s"}` });
    const meter = line.createDiv({ cls: "qt-ins-meter" });
    const band = row.accuracy < 0.6 ? "is-low" : row.accuracy < 0.8 ? "is-mid" : "is-high";
    meter.createDiv({ cls: "qt-meter-track" }).createDiv({ cls: `qt-meter-fill ${band}` }).setCssProps({ "--qt-pct": `${Math.round(row.accuracy * 100)}%` });
    meter.createSpan({ cls: "qt-ins-pct", text: fmtPct(row.accuracy) });
    if (hooks && hooks.onPractice) {
      line.createEl("button", { text: "Practice" }).addEventListener("click", () => hooks.onPractice(field, row.value));
    }
  }
}

function renderGrade(container, data) {
  heading(container, "Grade snapshot");
  const grades = data.grades;
  if (!grades || !grades.overall.attempts) {
    container.createDiv({ cls: "qt-hint", text: "No practice grade yet. Answer a question to start the snapshot." });
    return;
  }
  const box = container.createDiv({ cls: "qt-dash-exam qt-grade-snapshot" });
  box.createDiv({ cls: "qt-dash-value", text: grades.overall.grade });
  box.createDiv({ cls: "qt-today-meta", text: `${fmtPct(grades.overall.accuracy)} practice accuracy · ${grades.overall.attempts} attempts` });
  box.createDiv({ cls: "qt-hint", text: "Based on practice accuracy, not assignment or transcript grades." });
  for (const row of grades.courses) {
    const line = box.createDiv({ cls: "qt-grade-row" });
    line.createSpan({ cls: "qt-ins-name", text: row.course });
    line.createSpan({ cls: "qt-hint", text: `${fmtPct(row.accuracy)} · ${row.attempts} attempts` });
    line.createSpan({ cls: "qt-dash-value", text: row.grade });
  }
}

function renderCourses(container, data) {
  heading(container, "Study time by course");
  if (!data.byCourse.length) {
    container.createDiv({ cls: "qt-hint", text: "Log a focus session or some study time to see course totals." });
    return;
  }
  const list = container.createDiv({ cls: "qt-ins-list" });
  const max = Math.max(...data.byCourse.map(([, minutes]) => minutes), 1);
  for (const [course, minutes] of data.byCourse) {
    const line = list.createDiv({ cls: "qt-ins-row qt-dash-course" });
    const main = line.createDiv({ cls: "qt-ins-main" });
    main.createDiv({ cls: "qt-ins-name", text: course });
    main.createDiv({ cls: "qt-hint", text: `${minutes} minute${minutes === 1 ? "" : "s"}` });
    const meter = line.createDiv({ cls: "qt-ins-meter" });
    meter.createDiv({ cls: "qt-meter-track" }).createDiv({ cls: "qt-meter-fill is-high" }).setCssProps({ "--qt-pct": `${Math.round((minutes / max) * 100)}%` });
  }
}

function renderExam(container, data) {
  heading(container, "Next exam");
  if (!data.plan) {
    container.createDiv({ cls: "qt-hint", text: "No upcoming exam matches a course in this dashboard." });
    return;
  }
  const plan = data.plan;
  const box = container.createDiv({ cls: "qt-dash-exam" });
  box.createDiv({ cls: "qt-today-kicker", text: plan.daysLeft === 0 ? "Exam today" : `${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"} away` });
  box.createDiv({ cls: "qt-today-title", text: plan.course });
  box.createDiv({ cls: "qt-today-meta", text: `Readiness ${plan.readiness}% · ${plan.due} due · ${plan.fresh} new · ${plan.cardsDue} cards` });
}

/** Draw one embed. `data` is the output of buildDashboard plus an optional `plan`. */
function renderDashboardEmbed(container, data, options, hooks) {
  const opts = options || {};
  const metric = DASHBOARD_METRICS.includes(opts.metric) ? opts.metric : "overview";
  const course = String(data.course || opts.course || "").trim();
  const title = String(opts.title || "").trim() || `${LABELS[metric]}${course ? ` · ${course}` : ""}`;
  container.createDiv({ cls: "qt-dash-embed-title", text: title });

  const days = data.heatmap.flatMap((week) => week.days);
  const minutes = days.reduce((n, day) => n + day.minutes, 0);
  const hasActivity = data.overall.notes || data.cardStats.total || minutes;
  if (!hasActivity && !(metric === "exam" && data.plan)) {
    container.createDiv({
      cls: "qt-empty",
      text: course ? `No study activity for ${course} yet.` : "No study activity yet.",
    });
    return;
  }

  const show = (id) => metric === "overview" || metric === id;
  if (show("stats")) renderStats(container, data);
  if (show("heatmap")) renderHeatmap(container, data);
  if (show("calibration")) renderCalibration(container, data);
  if (show("retention")) renderRetention(container, data);
  if (show("grades")) renderGrade(container, data);
  if (show("weak")) renderBreakdown(container, data, hooks);
  if (show("courses")) renderCourses(container, data);
  if (show("exam")) renderExam(container, data);
}

module.exports = {
  DASHBOARD_METRICS,
  LABELS,
  parseDashboardBlock,
  renderBreakdown,
  renderCalibration,
  renderDashboardEmbed,
  renderGrade,
  renderRetention,
};
