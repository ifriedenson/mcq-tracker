"use strict";
/*
 * The last two small mission items, pinned where they were thin: a task can be
 * made high priority from the add row (normal stays the default), high sorts
 * first without disturbing the order inside each group, and the relative date
 * spans ("in N days") cross month, year and leap-day boundaries next to the
 * times already shipped in 1.307.0.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const W = require("../src/study-workspace");
const TM = require("../src/task-mirror");
const TD = require("../src/task-dates");

/** Attribute as created (`attr`) or as set later (`setAttribute`). */
function attrOf(element, name) {
  const attrs = (element && element.meta && (element.meta.attrs || element.meta.attr)) || {};
  return attrs[name];
}

function byLabel(dom, label) {
  return dom.all
    .filter((o) => {
      const attrs = o.meta.attrs || o.meta.attr;
      return attrs && attrs["aria-label"] === label;
    })
    .pop();
}

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.TaskListView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  return { app, plugin, dom, view };
}

const click = async (element) => {
  for (const handler of element.handlers.filter((entry) => entry.ev === "click")) await handler.fn({});
};

const submit = async (dom, text) => {
  const input = byLabel(dom, "New task");
  input.value = text;
  const keydown = input.handlers.find((h) => h.ev === "keydown");
  await keydown.fn({ key: "Enter", preventDefault() {} });
};

/* ---- priority from the add row ----------------------------------------- */

test("task list: the add row can make the next task high priority, normal stays the default", async () => {
  const { plugin, dom, view } = await setup();
  const toggle = byLabel(dom, "Make the next task high priority");
  assert.ok(toggle, "the add row offers a priority toggle");
  assert.equal(attrOf(toggle, "aria-pressed"), "false", "off until pressed");

  await click(toggle);
  assert.equal(attrOf(toggle, "aria-pressed"), "true", "pressed state is announced");
  assert.equal(toggle.meta.text, "★ High");
  await submit(dom, "Review Biochem");

  const high = plugin.settings.studyTasks.tasks.find((task) => task.title === "Review Biochem");
  assert.equal(high.priority, "high", "the add path carries the flag into data.json");
  // A fresh list starts with the control off again, so normal is still the default.
  view.render();
  assert.equal(attrOf(byLabel(dom, "Make the next task high priority"), "aria-pressed"), "false");
  await submit(dom, "Read chapter");
  const normal = plugin.settings.studyTasks.tasks.find((task) => task.title === "Read chapter");
  assert.equal(normal.priority, "", "a task without the flag stays normal");
});

test("task list: a high task sorts above normal ones, and each group keeps its order", async () => {
  const { plugin, dom, view } = await setup();
  await plugin.addStudyTask({ title: "Normal first", due: "2026-11-20" });
  await plugin.addStudyTask({ title: "Normal second", due: "2026-11-18" });
  await plugin.addStudyTask({ title: "High later", priority: "high", due: "2026-12-01" });
  await plugin.addStudyTask({ title: "Normal third", due: "2026-11-19" });
  await plugin.addStudyTask({ title: "High sooner", priority: "high", due: "2026-11-25" });
  view.render();
  const texts = dom.texts();
  const at = (title) => texts.indexOf(title);
  assert.ok(at("High sooner") < at("High later"), "high tasks sort by due date among themselves");
  assert.ok(at("High later") < at("Normal second"), "every high task beats every normal one");
  assert.ok(at("Normal second") < at("Normal third") && at("Normal third") < at("Normal first"), "normal tasks keep their due order");
  // The model's own comparator agrees with the rendered list.
  const ordered = plugin.settings.studyTasks.tasks
    .filter((task) => !task.done)
    .slice()
    .sort(W.compareStudyTasks)
    .map((task) => task.title);
  assert.deepEqual(ordered, ["High sooner", "High later", "Normal second", "Normal third", "Normal first"]);
});

test("mirror: ⏫ marks high priority only, and a normal line is unchanged", () => {
  assert.equal(TM.studyTaskLine({ title: "Read", due: "2026-11-20" }), "- [ ] Read 📅 2026-11-20");
  assert.equal(TM.studyTaskLine({ title: "Read", due: "2026-11-20", priority: "normal" }), "- [ ] Read 📅 2026-11-20");
  assert.equal(TM.studyTaskLine({ title: "Read", due: "2026-11-20", priority: "high" }), "- [ ] Read 📅 2026-11-20 ⏫");
  const text = TM.mirrorMarkdown(
    [
      { title: "Normal", due: "2026-11-20" },
      { title: "High", due: "2026-11-21", priority: "high" },
    ],
    "2026-11-15",
  );
  const lines = text.split("\n").filter((line) => line.startsWith("- ["));
  assert.deepEqual(lines, ["- [ ] High 📅 2026-11-21 ⏫", "- [ ] Normal 📅 2026-11-20"]);
  assert.ok(!lines[1].includes("⏫"), "no marker invented for a normal task");
});

/* ---- relative spans at the edges --------------------------------------- */

const day = (y, m, d) => new Date(y, m - 1, d, 9, 0);

test("task dates: in N days crosses month, year and leap-day boundaries", () => {
  assert.equal(TD.parseTaskDate("in 3 days", day(2026, 11, 30)).date, "2026-12-03", "month end");
  assert.equal(TD.parseTaskDate("in 2 days", day(2026, 12, 30)).date, "2027-01-01", "year end");
  assert.equal(TD.parseTaskDate("in 1 day", day(2028, 2, 28)).date, "2028-02-29", "leap day");
  assert.equal(TD.parseTaskDate("in 1 day", day(2028, 2, 29)).date, "2028-03-01", "day after leap day");
  assert.equal(TD.parseTaskDate("in 1 week", day(2028, 2, 22)).date, "2028-02-29", "a week into leap day");
  assert.equal(TD.parseTaskDate("in 2 weeks", day(2026, 12, 21)).date, "2027-01-04", "weeks across the year");
});

test("quick add: a span and a time combine, and the date-only forms are untouched", () => {
  const ref = day(2026, 11, 29);
  assert.deepEqual(TD.extractTaskWhen("review in 3 days at 3pm", ref), {
    title: "review",
    due: "2026-12-02",
    time: "15:00",
  });
  assert.deepEqual(TD.extractTaskWhen("essay 3:30pm tomorrow", ref), {
    title: "essay",
    due: "2026-11-30",
    time: "15:30",
  });
  // Shipped grammar still resolves exactly as before.
  assert.deepEqual(TD.extractTaskWhen("essay tomorrow", ref), { title: "essay", due: "2026-11-30", time: "" });
  assert.deepEqual(TD.extractTaskWhen("drill Tuesday", ref), { title: "drill", due: "2026-12-01", time: "" });
  assert.deepEqual(TD.extractTaskWhen("review at 9am tomorrow", ref), {
    title: "review",
    due: "2026-11-30",
    time: "09:00",
  });
  assert.deepEqual(TD.extractTaskWhen("review at noon Friday", ref), { title: "review", due: "2026-12-04", time: "12:00" });
});

test("plugin: quick-add text sets the day and the time, and priority stays normal", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const soon = await plugin.addStudyTask({ title: "review in 3 days" });
  const inThree = new Date();
  inThree.setDate(inThree.getDate() + 3);
  const key = `${inThree.getFullYear()}-${String(inThree.getMonth() + 1).padStart(2, "0")}-${String(inThree.getDate()).padStart(2, "0")}`;
  assert.equal(soon.title, "review", "the span leaves the title");
  assert.equal(soon.due, key, "three days from today");
  assert.equal(soon.priority, "", "quick add does not invent a priority");

  const timed = await plugin.addStudyTask({ title: "drill at 3pm" });
  assert.equal(timed.title, "drill");
  assert.equal(timed.time, "15:00", "the time lands in the model");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(timed.due), "a clock time gets a day");
});
