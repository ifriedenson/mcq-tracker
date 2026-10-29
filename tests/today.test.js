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

test("today: explains when the MCQ module is off", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.mcqEnabled = false;
  view.render();
  assert.ok(dom.texts().some((t) => /MCQ Tracker is off/.test(t)));
});
