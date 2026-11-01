"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const R = T.sessionReport;

test("a session report writes frontmatter, counts and item links", () => {
  const markdown = R.sessionReportMarkdown({
    date: "2026-11-01",
    status: { completed: 3, missed: ["B.md"], requeued: 1 },
    items: [
      { path: "Notes/A.md", title: "A", grade: "good" },
      { path: "Notes/B.md", title: "B", grade: "again" },
      { path: "Notes/C.md", title: "C", grade: "easy" },
    ],
  });
  assert.match(markdown, /^---\ntype: review_session_report\ndate: 2026-11-01/m);
  assert.match(markdown, /completed: 3/);
  assert.match(markdown, /missed: 1/);
  assert.match(markdown, /requeued: 1/);
  assert.match(markdown, /again: 1/);
  assert.match(markdown, /easy: 1/);
  assert.match(markdown, /\[\[Notes\/A\.md\|A\]\] — good/);
  assert.match(markdown, /# Review session — 2026-11-01/);
});

test("report filenames avoid overwriting an existing report", () => {
  assert.equal(R.reportPath("", "2026-11-01", []), "Review session 2026-11-01.md");
  assert.equal(
    R.reportPath("Reports", "2026-11-01", ["Reports/Review session 2026-11-01.md", "Reports/Review session 2026-11-01 2.md"]),
    "Reports/Review session 2026-11-01 3.md"
  );
});

test("session report settings are opt-in and clamp the folder", () => {
  assert.deepEqual(R.normalizeSessionReportSettings(undefined), { enabled: false, folder: "" });
  assert.deepEqual(R.normalizeSessionReportSettings({ enabled: true, folder: "/Reports/" }), { enabled: true, folder: "Reports" });
});

test("the plugin writes a report note from the dock log", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.noteReviewDock.reportEnabled = true;
  plugin.settings.noteReviewDock.reportFolder = "Reports";
  plugin.noteReviewDock = { session: null, log: [] };
  const result = await plugin.saveReviewSessionReport([{ path: "Notes/A.md", title: "A", grade: "good" }]);
  assert.equal(result.path, `Reports/Review session ${R.dayKey(new Date())}.md`);
  assert.ok(app.created.some((file) => file.path === result.path && /type: review_session_report/.test(file.text)));
});
