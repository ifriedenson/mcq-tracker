"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

const NOTES = [
  { path: "Questions/due.md", fm: { attempts: 3, next_review: "2020-01-01", answer: "B" } },
  { path: "Questions/new.md", fm: { answer: "C" } },
  { path: "Questions/later.md", fm: { attempts: 2, next_review: "2099-01-01", answer: "A" } },
];

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

async function setup() {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.calls = [];
  plugin.startQuickPractice = async (opts) => plugin.calls.push(opts);
  plugin.activateQuickPractice = async () => {};
  plugin.activateView = async () => {};
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  return { app, plugin, dom, view };
}

test("today: shows due/new counts and starts a five-minute session with due questions", async () => {
  const { plugin, dom, view } = await setup();
  view.render();

  assert.ok(dom.texts().includes("Today"));
  assert.ok(dom.texts().includes("1 due · 1 new · 3 questions"));
  await dom.click("Start 5 minutes");

  const call = plugin.calls.at(-1);
  assert.equal(call.minutes, 5);
  assert.equal(call.mode, "due");
  assert.equal(call.pool.length, 1);
  assert.equal(call.pool[0].file.path, "Questions/due.md");
});

test("today: shows the selected mastery window and starts its band", async () => {
  const app = makeApp([
    { path: "Questions/recent.md", fm: { course: "Alpha", attempts: 1, correct_count: 1, history: [`${daysAgo(1)}|correct|10|A|1|`] } },
    { path: "Questions/old.md", fm: { course: "Alpha", attempts: 1, correct_count: 0, history: [`${daysAgo(13)}|incorrect|10|A|1|`] } },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.masteryScope = "Alpha";
  plugin.settings.masteryDays = 7;
  const started = [];
  plugin.practiceQuestionPool = async (pool, label) => started.push({ paths: pool.map((q) => q.file.path), label });
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("Question mastery · Last 7 days"));
  assert.ok(dom.texts().some((text) => /1 of 2 questions in Alpha tried in the last 7 days/.test(text)));
  assert.ok(dom.texts().includes("+1 mastered vs the previous 7 days."));
  const button = dom.all.find((el) => el.meta && el.meta.attrs && /^Practice 1 mastered question in Alpha from the last 7 days$/.test(String(el.meta.attrs["aria-label"] || "")));
  assert.ok(button, "the mastery band has a practice button");
  await button.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(started, [{ paths: ["Questions/recent.md"], label: "Mastered · Alpha · last 7 days" }]);

  await dom.click("Last 30 days");
  assert.equal(plugin.settings.masteryDays, 30);
  assert.equal(plugin.saved.masteryDays, 30);
  assert.ok(dom.texts().some((text) => /2 of 2 questions in Alpha tried in the last 30 days/.test(text)));
  assert.ok(dom.texts().includes("No earlier attempts in the previous 30 days to compare."));
});

test("today: hidden questions are not counted as due, new or available", async () => {
  const app = makeApp([{ path: "Questions/hidden.md", fm: { answer: "C", study_status: "excluded" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  let opened = 0;
  plugin.openStudyStatusManager = () => opened++;
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("0 due · 0 new · 0 questions · 1 hidden"));
  assert.ok(dom.texts().includes("All questions are hidden"));
  await dom.click("Manage hidden items");
  assert.equal(opened, 1);
});

test("today: falls back to all questions when none are due", async () => {
  const app = makeApp([{ path: "Questions/new.md", fm: { answer: "C" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.calls = [];
  plugin.startQuickPractice = async (opts) => plugin.calls.push(opts);
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("0 due · 1 new · 1 question"));
  await dom.click("Start 5 minutes");
  assert.equal(plugin.calls.at(-1).mode, "smart");
  assert.equal(plugin.calls.at(-1).pool.length, 1);
});

test("today: shows the next class and exam from an enabled calendar", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.calendar.enabled = true;
  const now = new Date();
  const classStart = new Date(now.getTime() + 60 * 60 * 1000);
  const classEnd = new Date(classStart.getTime() + 60 * 60 * 1000);
  const examStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 9, 0);
  const examEnd = new Date(examStart.getTime() + 2 * 60 * 60 * 1000);
  plugin.calendarEvents = () => [
    { uid: "class", summary: "Linear Algebra", description: "Room 204", allDay: false, dtstart: classStart, dtend: classEnd, dateKey: dayKey(classStart) },
    { uid: "exam", summary: "Calculus Final Exam", allDay: false, dtstart: examStart, dtend: examEnd, dateKey: dayKey(examStart) },
  ];
  view.render();

  const texts = dom.texts();
  assert.ok(texts.includes("Next up"));
  assert.ok(texts.includes("Next class"));
  assert.ok(texts.includes("Linear Algebra"));
  assert.ok(texts.includes("Next exam"));
  assert.ok(texts.some((t) => /Final Exam/.test(t)));
});

test("today: shows one due list when questions and cards are both due", async () => {
  const app = makeApp([
    ...NOTES,
    {
      path: "Cards/Biology/cell.md",
      noFm: true,
      fm: { card_id: "cell", item_type: "card", deck: "Biology", attempts: 1, next_review: "2020-01-02" },
      text: "## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life.",
    },
  ]);
  app.files[3].fm = { card_id: "cell", item_type: "card", deck: "Biology", attempts: 1, next_review: "2020-01-02" };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("Due across modules"));
  assert.ok(dom.texts().some((text) => /2 questions · 1 card due or new/.test(text)));
  assert.ok(dom.texts().includes("cell"));
  assert.ok(dom.texts().includes("Open due queue"));
});

test("today: pending typed answers are visible and can be retried", async () => {
  const app = makeApp([
    ...NOTES,
    {
      path: "Cards/Biology/cell.md",
      noFm: true,
      fm: { card_id: "cell", item_type: "card", deck: "Biology", attempts: 1, next_review: "2020-01-02" },
      text: "## Front\nPowerhouse of the cell\n\n## Back\nmitochondria",
    },
  ]);
  app.files[3].fm = { card_id: "cell", item_type: "card", deck: "Biology", attempts: 1, next_review: "2020-01-02" };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const card = plugin.getCards().find((c) => c.file.path === "Cards/Biology/cell.md");
  card.body = { front: "Powerhouse of the cell", back: "mitochondria" };
  plugin.queueCardGrade(card, "powerhouse", "standard");
  let flushed = 0;
  let reviewed = "";
  plugin.flushPendingCardGrades = async () => {
    flushed++;
    return { graded: 1, remaining: 0, disabled: false };
  };
  plugin.reviewCard = async (c) => (reviewed = c.file.path);

  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("Pending AI grade"));
  assert.ok(dom.texts().includes("Powerhouse of the cell"));
  assert.ok(dom.texts().includes("Grade pending"));
  await dom.click("Review");
  assert.equal(reviewed, "Cards/Biology/cell.md");
  await dom.click("Grade pending");
  assert.equal(flushed, 1);
});

test("today: shows a review task and the nearest assignment deadline", async () => {
  const today = dayKey(new Date());
  const app = makeApp([
    ...NOTES,
    {
      path: "Assignments/essay.md",
      fm: { assignment: true, assignment_id: "essay", title: "Essay draft", course: "Biology", type: "essay", due: today, status: "todo" },
      text: "---\nassignment: true\nassignment_id: essay\n---\n\n- [ ] Essay draft 📅 " + today + "\n",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  let opened = 0;
  plugin.activateAssignments = async () => opened++;
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  const texts = dom.texts();
  assert.ok(texts.includes("Tasks"));
  assert.ok(texts.includes("Review 1 due item"));
  assert.ok(texts.includes("Essay draft"));
  await dom.click("Open Assignments");
  assert.equal(opened, 1);
});

test("today: explains when the MCQ module is off", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.mcqEnabled = false;
  view.render();
  assert.ok(dom.texts().some((t) => /MCQ Tracker is off/.test(t)));
});

test("today: groups sections into a responsive dashboard grid", async () => {
  const { dom, view } = await setup();
  view.render();
  assert.ok(dom.all.some((el) => el.meta && el.meta.cls === "qt-today-header"));
  assert.ok(dom.all.some((el) => el.meta && el.meta.cls === "qt-today-grid"));
  assert.ok(dom.all.some((el) => el.meta && el.meta.cls === "qt-today-panel qt-today-panel-wide"));
  assert.ok(dom.all.some((el) => el.meta && el.meta.cls === "qt-today-panel"));
});

test("today: desktop CSS fills the pane and uses container-query breakpoints", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const viewSource = fs.readFileSync(path.join(__dirname, "..", "src", "today-view.js"), "utf8");
  assert.ok(viewSource.includes('addClass("qt-root-today")'), "the Today root carries the container-query class");
  const rule = (css.match(/\.qt-today \{[^}]*\}/) || [])[0] || "";
  assert.match(rule, /max-width:\s*none/);
  assert.match(rule, /width:\s*100%/);
  assert.match(rule, /min-height:\s*100%/);
  assert.match(rule, /margin:\s*0;/);

  const root = (css.match(/\.qt-root\.qt-root-today \{[^}]*\}/) || [])[0] || "";
  assert.match(root, /container-name:\s*qt-today/);
  assert.match(root, /container-type:\s*inline-size/);

  const grid = (css.match(/\.qt-today-grid \{[^}]*\}/) || [])[0] || "";
  assert.match(grid, /align-items:\s*stretch/);
  assert.match(grid, /grid-auto-rows:/);

  const blocks = [
    [700, 6],
    [1050, 4],
    [1400, 3],
  ];
  for (const [width, span] of blocks) {
    const start = css.indexOf(`@container qt-today (min-width: ${width}px)`);
    assert.ok(start > 0, `a ${width}px container breakpoint exists`);
    const block = css.slice(start, start + 400);
    assert.match(block, new RegExp(`grid-column:\\s*span ${span};`));
  }

  const single = css.indexOf("@container qt-today (max-width: 699.98px)");
  assert.ok(single > 0, "the single-column container breakpoint exists");
  assert.match(css.slice(single, single + 400), /grid-template-columns:\s*minmax\(0, 1fr\)/);

  const todayRules = [...css.matchAll(/\.qt-today(?:\.[\w-]+)?\s*\{[^}]*\}/g)].map((match) => match[0]);
  assert.ok(todayRules.length > 0);
  for (const todayRule of todayRules) {
    assert.doesNotMatch(todayRule, /max-width:\s*(?!none)\d/);
    assert.doesNotMatch(todayRule, /margin:\s*(0\s+)?auto/);
  }

  assert.ok(css.includes("@media (min-width: 1600px)"), "the window media query stays as a fallback");
});
