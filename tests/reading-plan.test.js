"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const R = T.reading;

const PLAN = `title: Deep Work
author: Cal Newport
pages: 100
start: 2026-01-01
target: 2026-01-10
days: everyday
read: 0`;

test("reading plan: parses a book, its dates, reading days and declared progress", () => {
  const parsed = R.parseReadingPlan(PLAN);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.title, "Deep Work");
  assert.equal(parsed.author, "Cal Newport");
  assert.equal(parsed.pages, 100);
  assert.equal(parsed.start, "2026-01-01");
  assert.equal(parsed.target, "2026-01-10");
  assert.deepEqual(parsed.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(parsed.read, 0);
  assert.ok(parsed.id.startsWith("reading-"));
});

test("reading plan: an on-pace plan spreads pages across reading days", () => {
  const plan = R.planReading(R.parseReadingPlan(PLAN), { today: "2026-01-01", read: 0 });
  assert.equal(plan.ok, true);
  assert.equal(plan.status, "on-track");
  assert.equal(plan.daysLeft, 10);
  assert.equal(plan.schedule.length, 10);
  assert.deepEqual(plan.schedule.map((item) => item.pages), Array(10).fill(10));
  assert.equal(plan.todayChunk, 10);
  assert.equal(plan.behindBy, 0);
});

test("reading plan: missed pages are redistributed across the remaining days", () => {
  const parsed = R.parseReadingPlan(PLAN);
  const plan = R.planReading(parsed, { today: "2026-01-05", read: 20 });
  assert.equal(plan.status, "behind");
  assert.equal(plan.behindBy, 20);
  assert.equal(plan.daysLeft, 6);
  assert.deepEqual(plan.schedule.map((item) => item.pages), [14, 14, 13, 13, 13, 13]);
  assert.equal(plan.todayChunk, 14);
  assert.match(plan.schedule[0].date, /^2026-01-05$/);
});

test("reading plan: catching up clears the behind state and ahead stays distinct", () => {
  const parsed = R.parseReadingPlan(PLAN);
  const caughtUp = R.planReading(parsed, { today: "2026-01-05", read: 40 });
  assert.equal(caughtUp.status, "on-track");
  assert.equal(caughtUp.behindBy, 0);
  assert.equal(caughtUp.todayChunk, 10);

  const ahead = R.planReading(parsed, { today: "2026-01-05", read: 60 });
  assert.equal(ahead.status, "ahead");
  assert.equal(ahead.aheadBy, 20);
  assert.equal(ahead.todayChunk, 7);

  const complete = R.planReading(parsed, { today: "2026-01-05", read: 100 });
  assert.equal(complete.status, "complete");
  assert.deepEqual(complete.schedule, []);
  assert.equal(complete.todayChunk, 0);
});

test("reading plan: a passed target stops scheduling and a future start waits", () => {
  const parsed = R.parseReadingPlan(PLAN);
  const passed = R.planReading(parsed, { today: "2026-01-11", read: 50 });
  assert.equal(passed.status, "off-pace");
  assert.deepEqual(passed.schedule, []);
  assert.match(passed.issue, /^$/);

  const future = R.planReading(parsed, { today: "2025-12-31", read: 0 });
  assert.equal(future.status, "not-started");
  assert.equal(future.todayChunk, 0);
  assert.equal(future.nextDate, "2026-01-01");
  assert.equal(future.schedule.length, 10);
});

test("reading plan: weekdays, off days and non-reading days are respected", () => {
  const parsed = R.parseReadingPlan(`title: Weekday book
pages: 40
start: 2026-01-01
target: 2026-01-07
days: mon-fri
off: 2026-01-02
read: 0`);
  assert.equal(parsed.valid, true);
  const plan = R.planReading(parsed, { today: "2026-01-01", read: 0 });
  assert.deepEqual(plan.schedule.map((item) => item.date), ["2026-01-01", "2026-01-05", "2026-01-06", "2026-01-07"]);
  assert.deepEqual(plan.schedule.map((item) => item.pages), [10, 10, 10, 10]);

  const weekendOnly = R.planReading(
    R.parseReadingPlan(`title: Weekend book
pages: 20
start: 2026-01-05
target: 2026-01-06
days: weekends`),
    { today: "2026-01-05", read: 0 }
  );
  assert.equal(weekendOnly.ok, false);
  assert.match(weekendOnly.issue, /No reading days/);
});

test("reading plan: malformed fields report a specific problem instead of throwing", () => {
  const empty = R.parseReadingPlan("");
  assert.equal(empty.valid, false);
  assert.match(empty.issues.join(" "), /title/);
  assert.match(empty.issues.join(" "), /pages/);
  assert.match(empty.issues.join(" "), /start/);

  const bad = R.parseReadingPlan(`title: Bad
pages: 0
start: 2026-13-01
target: 2026-01-01
days: funday
off: 2026-02-30
read: 5`);
  assert.equal(bad.valid, false);
  assert.match(bad.issues.join(" "), /pages/);
  assert.match(bad.issues.join(" "), /start/);
  assert.match(bad.issues.join(" "), /funday/);
  assert.match(bad.issues.join(" "), /Off day/);

  const backwards = R.parseReadingPlan("title: Backwards\npages: 10\nstart: 2026-02-01\ntarget: 2026-01-01");
  assert.match(backwards.issues.join(" "), /start date must be on or before/);

  const overread = R.parseReadingPlan("title: Overread\npages: 10\nstart: 2026-01-01\ntarget: 2026-01-02\nread: 11");
  assert.match(overread.issues.join(" "), /read:/);
});

test("reading settings: stored progress is bounded and malformed values are ignored", () => {
  assert.deepEqual(R.normalizeReadingSettings({ progress: { a: 40, b: -1, c: "x", "": 3, d: 2_000_000 } }), {
    progress: { a: 40, d: R.MAX_PAGES },
  });
});

test("reading block: renders pace and persists logged progress across a restart", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reading = { progress: {} };
  assert.ok(plugin.codeBlocks["reading-plan"]);

  const dom = makeDom();
  await plugin.renderReadingPlanBlock(PLAN.replace("read: 0", "read: 20"), dom.root, { sourcePath: "Reading/Deep.md", today: "2026-01-05" });
  assert.ok(dom.texts().includes("Deep Work"));
  assert.ok(dom.texts().includes("Behind by 20 pages. The remaining 80 pages are redistributed across 6 reading days."));
  assert.ok(dom.texts().includes("Today: 14 pages."));
  assert.ok(dom.texts().includes("20 / 100 pages"));

  const input = dom.all.find((option) => option.meta.tag === "input" && option.classes.has("qt-reading-pages"));
  assert.ok(input);
  input.value = "20";
  await dom.click("Log pages");
  assert.equal(plugin.settings.reading.progress[Object.keys(plugin.settings.reading.progress)[0]], 40);
  assert.equal(plugin.saved.reading.progress[Object.keys(plugin.saved.reading.progress)[0]], 40);
  assert.ok(dom.texts().includes("40 / 100 pages"));

  const restarted = new QT(makeApp([]));
  restarted.saved = plugin.saved;
  await restarted.loadSettings();
  assert.deepEqual(restarted.settings.reading, plugin.settings.reading);
});

test("reading block: an empty or malformed block shows a useful message", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderReadingPlanBlock("", dom.root, { today: "2026-01-05" });
  assert.ok(dom.all.some((option) => option.classes.has("qt-reading-plan")));
  assert.ok(dom.texts().some((text) => /title|pages|start/.test(text)));
  assert.ok(dom.all.some((option) => option.classes.has("qt-reading-issue")));
});
