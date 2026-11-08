"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../src/review-sidebar-model");

const snapshot = {
  today: "2026-11-08",
  notes: [
    { path: "A.md", title: "Alpha", status: "due", due: "2026-11-06", isNew: false, set: "Course", minutes: 4 },
    { path: "B.md", title: "Beta", status: "due", due: "2026-11-08", isNew: true, set: "Course", minutes: 2 },
    { path: "C.md", title: "Gamma", status: "upcoming", due: "2026-11-10", isNew: false, set: "Course", minutes: 3 },
    { path: "D.md", title: "Delta", status: "upcoming", due: "2026-12-20", isNew: false, set: "Course", minutes: 5 },
  ],
};

const queue = {
  all: [
    { path: "A.md", title: "Alpha", dueDate: "2026-11-06", isNew: false, priority: "high" },
    { path: "B.md", title: "Beta", dueDate: "2026-11-08", isNew: true, priority: "normal" },
  ],
};

test("sidebar groups overdue, today and upcoming while hiding the distant future", () => {
  const result = model.buildReviewSidebar(snapshot, queue, { settings: { upcomingDays: 14 }, today: "2026-11-08" });
  assert.deepEqual(result.groups.map((group) => group.label), ["Overdue", "Today", "2026-11-10"]);
  assert.equal(result.counts.overdue, 1);
  assert.equal(result.counts.due, 1);
  assert.equal(result.counts.upcoming, 1);
});

test("filters and sorts are applied to the same rows", () => {
  const due = model.buildReviewSidebar(snapshot, queue, { settings: { filter: "due", sort: "title" }, today: "2026-11-08" });
  assert.deepEqual(due.rows.map((row) => row.title), ["Beta"]);
  const upcoming = model.buildReviewSidebar(snapshot, queue, { settings: { filter: "upcoming" }, today: "2026-11-08" });
  assert.deepEqual(upcoming.rows.map((row) => row.title), ["Gamma"]);
});

test("time override can add to or replace the estimate", () => {
  assert.equal(model.timeTarget(10, { overrideHours: 1, overrideMinutes: 5, overrideMode: "add" }), 75);
  assert.equal(model.timeTarget(10, { overrideHours: 1, overrideMinutes: 5, overrideMode: "replace" }), 65);
  assert.equal(model.normalizeReviewSidebarSettings({ overrideHours: 99, overrideMinutes: 99 }).overrideHours, 24);
});

test("adjacent navigation wraps both ways", () => {
  const rows = [{ path: "A.md" }, { path: "B.md" }, { path: "C.md" }];
  assert.equal(model.adjacentPath(rows, "B.md", "next"), "C.md");
  assert.equal(model.adjacentPath(rows, "A.md", "previous"), "C.md");
  assert.equal(model.adjacentPath(rows, "missing.md", "next"), "A.md");
});

test("workload labels are compact and stable", () => {
  assert.equal(model.workloadLabel(0), "no work");
  assert.equal(model.workloadLabel(42), "42 min");
  assert.equal(model.workloadLabel(60), "1 h");
  assert.equal(model.workloadLabel(95), "1 h 35 min");
});
