"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const C = T.taskChips;

function fakeText(text) {
  return { nodeType: 3, textContent: text, parentNode: null, nextSibling: null };
}

function fakeDoc() {
  const doc = {
    created: [],
    createElement(tag) {
      const chip = {
        tag,
        attrs: {},
        textContent: "",
        handlers: {},
        setAttribute(name, value) {
          this.attrs[name] = value;
        },
        addEventListener(event, fn) {
          this.handlers[event] = fn;
        },
      };
      doc.created.push(chip);
      return chip;
    },
  };
  return doc;
}

function fakeLi(doc, ...texts) {
  const li = {
    nodeType: 1,
    tagName: "LI",
    childNodes: [],
    parentNode: null,
    ownerDocument: doc,
    inserted: [],
    insertBefore(node, next) {
      this.inserted.push({ node, next: next || null });
    },
  };
  let prev = null;
  for (const text of texts) {
    const node = fakeText(text);
    node.parentNode = li;
    if (prev) prev.nextSibling = node;
    prev = node;
    li.childNodes.push(node);
  }
  return li;
}

function fakeList(doc, ...lis) {
  return { nodeType: 1, tagName: "UL", children: lis, childNodes: lis, ownerDocument: doc };
}

test("task chips: lines split into a title and ordered chip tokens", () => {
  const parsed = C.parseTaskLine("- [ ] Drill cells 📅 2026-11-19 ⏰ 15:00 ⏫ 🔁 every week");
  assert.equal(parsed.due, "2026-11-19");
  assert.equal(parsed.time, "15:00");
  assert.equal(parsed.repeat, "week");
  assert.equal(parsed.priority, "high");
  assert.equal(parsed.title, "- [ ] Drill cells");
  assert.deepEqual(
    parsed.tokens.map((token) => token.field),
    ["due", "time", "priority", "repeat"]
  );
  const plain = C.parseTaskLine("- [ ] Just read");
  assert.deepEqual(plain.tokens, []);
  assert.equal(C.chipLabel("due", "2026-11-19"), "Due Nov 19");
  assert.equal(C.chipLabel("priority", ""), "High priority");
  assert.equal(C.chipLabel("repeat", "week"), "Repeats weekly");
  assert.equal(C.formatChipDate("not-a-date"), "not-a-date");
});

test("task chips: edits rewrite only the touched token", () => {
  assert.equal(C.applyChipEdit("Drill 📅 2026-11-01", { field: "due", value: "2026-11-19" }), "Drill 📅 2026-11-19");
  assert.equal(C.applyChipEdit("Drill", { field: "due", value: "2026-11-19" }), "Drill 📅 2026-11-19");
  assert.equal(C.applyChipEdit("Drill", { field: "due", value: "garbage" }), "Drill");
  assert.equal(C.applyChipEdit("Drill", { field: "priority", value: "high" }), "Drill ⏫");
  assert.equal(C.applyChipEdit("Drill ⏫", { field: "priority", value: "high" }), "Drill ⏫");
  assert.equal(C.applyChipEdit("Drill ⏫ cells", { field: "priority", value: "" }), "Drill cells");
  assert.equal(C.applyChipEdit("Drill", { field: "unknown", value: "x" }), "Drill");
});

test("task chips: trailing token runs become chips, mid-line tokens stay text", () => {
  const doc = fakeDoc();
  const li = fakeLi(doc, "Drill cells 📅 2026-11-19 ⏫");
  const calls = [];
  assert.equal(C.decorateTaskLine(li, { onDate: () => calls.push("date"), onPriority: () => calls.push("priority") }), true);
  assert.equal(li.childNodes[0].textContent, "Drill cells ");
  assert.equal(li.inserted.length, 2);
  assert.equal(li.inserted[0].node.attrs.class, "qt-task-chip is-due");
  assert.equal(li.inserted[0].node.textContent, "Due Nov 19");
  assert.equal(li.inserted[1].node.attrs.class, "qt-task-chip is-priority");
  li.inserted[0].node.handlers.click();
  li.inserted[1].node.handlers.click();
  assert.deepEqual(calls, ["date", "priority"]);
  const mid = fakeLi(doc, "📅 2026-11-19 review these notes");
  assert.equal(C.decorateTaskLine(mid, {}), false, "tokens followed by prose are not chips");
  assert.equal(mid.inserted.length, 0);
  const plain = fakeLi(doc, "Just read the chapter");
  assert.equal(C.decorateTaskLine(plain, {}), false);
});

test("task chips: a list decorates every row and strides line numbers", () => {
  const doc = fakeDoc();
  const seen = [];
  const list = fakeList(doc, fakeLi(doc, "Drill 📅 2026-11-19"), fakeLi(doc, "Plain row"), fakeLi(doc, "Read ⏫"));
  assert.equal(C.decorateTaskList(list, { startLine: 10, onDate: (line) => seen.push(["date", line]), onPriority: (line) => seen.push(["priority", line]) }), 3);
  assert.equal(list.children[0].inserted.length, 1);
  assert.equal(list.children[1].inserted.length, 0);
  list.children[0].inserted[0].node.handlers.click();
  list.children[2].inserted[0].node.handlers.click();
  assert.deepEqual(seen, [
    ["date", 11],
    ["priority", 13],
  ]);
  assert.equal(C.decorateTaskList({ tagName: "DIV", children: [] }, { startLine: 0 }), 0);
  assert.equal(T.taskChipDateModal.TaskChipDateModal.name, "TaskChipDateModal");
});

test("plugin: chip edits rewrite one line and priority steps without a dialog", async () => {
  const app = makeApp([{ path: "tasks.md", text: "- [ ] Drill cells 📅 2026-11-01\n- [ ] Read ⏫\n" }]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(await plugin.applyTaskChipEdit("tasks.md", 1, { field: "due", value: "2026-11-19" }), true);
  assert.ok(app.vault.getAbstractFileByPath("tasks.md").text.includes("📅 2026-11-19"));
  assert.equal(await plugin.applyTaskChipEdit("tasks.md", 1, { field: "due", value: "2026-11-19" }), false, "no change, no write");
  assert.equal(await plugin.applyTaskChipEdit("tasks.md", 99, { field: "due", value: "2026-11-19" }), false);
  await plugin.stepTaskChipPriority("tasks.md", 2);
  assert.ok(!app.vault.getAbstractFileByPath("tasks.md").text.includes("⏫"), "priority stepped down");
  await plugin.stepTaskChipPriority("tasks.md", 2);
  assert.ok(app.vault.getAbstractFileByPath("tasks.md").text.includes("⏫"), "priority stepped back up");
});

test("plugin: the chip postprocessor only touches task modules", async () => {
  const app = makeApp([{ path: "note.md", text: "- [ ] Drill 📅 2026-11-19\n" }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.decorateTaskChips({ querySelectorAll: () => [], children: [] }, { sourcePath: "note.md", getSectionInfo: () => ({ lineStart: 0 }) });
  assert.ok(app.vault.getAbstractFileByPath("note.md").text.includes("📅"), "decoration never edits the note");
  plugin.settings.studyTasks = { enabled: false, tasks: [], mirrorNote: "" };
  plugin.decorateTaskChips(null, null);
  assert.ok(typeof T.TaskListView === "function", "the list view ships with the chips enabled");
});
