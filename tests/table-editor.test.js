"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const editor = T.tableEditor;
const STS = T.studyToolSettings;

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function fakeCell(value, tagName) {
  const listeners = {};
  const attrs = {};
  const classes = new Set();
  return {
    tagName: tagName || "TD",
    textContent: value,
    listeners,
    attrs,
    classes,
    focused: false,
    addEventListener(name, fn) {
      (listeners[name] = listeners[name] || []).push(fn);
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    getAttribute(name) {
      return attrs[name];
    },
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
  };
}

function fakeTable(header, body) {
  const rows = [header, ...body].map((values, row) => ({
    cells: values.map((value) => fakeCell(value, row === 0 ? "TH" : "TD")),
  }));
  const table = {
    rows,
    attrs: {},
    classes: new Set(),
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return this.attrs[name];
    },
    classList: {
      add: (...names) => names.forEach((name) => table.classes.add(name)),
      remove: (...names) => names.forEach((name) => table.classes.delete(name)),
      contains: (name) => table.classes.has(name),
    },
    querySelectorAll() {
      return [];
    },
    closest(selector) {
      return selector === ".markdown-preview-view" ? {} : null;
    },
  };
  return table;
}

function keydown(cell, key, options) {
  const event = {
    key,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...options,
  };
  for (const handler of cell.listeners.keydown || []) handler(event);
  return event;
}

function fakeEditor(value) {
  let lines = String(value).split("\n");
  const ranges = [];
  return {
    ranges,
    getValue: () => lines.join("\n"),
    lineCount: () => lines.length,
    getLine: (line) => (lines[line] === undefined ? "" : lines[line]),
    replaceRange(insert, from, to) {
      ranges.push({ insert, from, to });
      const next = lines.slice(0, from.line);
      next.push(...String(insert).split("\n"));
      next.push(...lines.slice(to.line + 1));
      lines = next;
    },
  };
}

test("table editor settings are opt-in and ignore loose truthy values", () => {
  assert.deepEqual(editor.normalizeTableEditorSettings(undefined), { enabled: false });
  assert.deepEqual(editor.normalizeTableEditorSettings({ enabled: 1 }), { enabled: false });
  assert.deepEqual(editor.normalizeTableEditorSettings({ enabled: true }), { enabled: true });
});

test("a committed cell escapes pipes and keeps the whole table aligned", () => {
  const source = "Before\r\n\r\n| Term | Definition |\r\n| :--- | ---: |\r\n| ATP | Energy |\r\n\r\nAfter";
  const table = editor.parseTables(source)[0];
  assert.equal(table.rows.length, 2);
  const result = editor.updateTableText(source, table.start, 1, 1, "Energy | work");

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.ok(result.text.includes("\r\n"), "the note's CRLF line endings are preserved");
  assert.match(result.text, /Energy \\\| work/);
  assert.equal(result.text.includes("Energy | work"), false, "the typed pipe is escaped in Markdown");

  const updated = editor.parseTables(result.text)[0];
  assert.deepEqual(updated.rows[1], ["ATP", "Energy \\| work"]);
  assert.equal(updated.align[1], "right");
  assert.equal(updated.rows.every((row) => row.length === 2), true, "no cell starts a new column");
  const renderedLines = result.replacement.split(/\r?\n/);
  const widths = renderedLines.map((line) => line.length);
  assert.equal(new Set(widths).size, 1, "every rendered line is padded to one width");
  const delimiter = editor.splitTableRow(renderedLines[1]);
  assert.equal(delimiter.cells.length, 2);
  assert.ok(delimiter.cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
});

test("narrow aligned columns still render a valid delimiter row", () => {
  const source = "| A | B | C |\n| :---: | :--- | ---: |\n| x | y | z |\n";
  const table = editor.parseTables(source)[0];
  const rendered = editor.renderTable(table);
  const delimiter = editor.splitTableRow(rendered[1]);
  assert.ok(delimiter.cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
  assert.deepEqual(delimiter.cells.map((cell) => editor.splitTableRow("| " + cell + " |").cells[0]), [":---:", ":---", "---:"]);
});

test("escaped pipes and code spans stay inside one source cell", () => {
  const row = editor.splitTableRow("| `A | B` | C \\| D | E |");
  assert.deepEqual(row.cells, ["`A | B`", "C \\| D", "E"]);
  const source = "| A | B |\n| --- | --- |\n| x \\| y | z |\n";
  const table = editor.parseTables(source)[0];
  assert.deepEqual(table.rows[1], ["x \\| y", "z"]);
  const result = editor.updateTableText(source, table.start, 1, 0, "x | y");
  assert.equal(editor.parseTables(result.text)[0].rows[1][0], "x \\| y");
});

test("table parsing skips fenced code and finds every real table", () => {
  const source = [
    "```md",
    "| Not | A table |",
    "| --- | --- |",
    "```",
    "",
    "| One | Two |",
    "| --- | --- |",
    "| a | b |",
    "",
    "| Three | Four |",
    "| --- | --- |",
    "| c | d |",
  ].join("\n");
  const tables = editor.parseTables(source);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables.map((table) => table.header), [["One", "Two"], ["Three", "Four"]]);
  assert.equal(editor.findTable(tables, ["Three", "Four"], 0).start, tables[1].start);
});

test("keyboard navigation moves across rows and stops at table boundaries", () => {
  assert.deepEqual(editor.navigateCell(0, 0, 2, 2, "Tab"), { ok: true, row: 0, column: 1, kind: "Tab" });
  assert.deepEqual(editor.navigateCell(0, 1, 2, 2, "Tab"), { ok: true, row: 1, column: 0, kind: "Tab" });
  assert.deepEqual(editor.navigateCell(1, 0, 2, 2, "Tab", true), { ok: true, row: 0, column: 1, kind: "Tab" });
  assert.deepEqual(editor.navigateCell(0, 0, 2, 2, "Enter"), { ok: true, row: 1, column: 0, kind: "Enter" });
  assert.deepEqual(editor.navigateCell(1, 0, 2, 2, "Enter", true), { ok: true, row: 0, column: 0, kind: "Enter" });
  assert.deepEqual(editor.navigateCell(0, 0, 2, 2, "ArrowRight", false, true), { ok: true, row: 0, column: 1, kind: "ArrowRight" });

  assert.deepEqual(editor.navigateCell(0, 0, 2, 2, "Tab", true), { ok: false, reason: "boundary", row: 0, column: 0 });
  assert.deepEqual(editor.navigateCell(1, 1, 2, 2, "Tab"), { ok: false, reason: "boundary", row: 1, column: 1 });
  assert.deepEqual(editor.navigateCell(1, 0, 2, 2, "Enter"), { ok: false, reason: "boundary", row: 1, column: 0 });
  assert.deepEqual(editor.navigateCell(0, 0, 2, 2, "ArrowUp", false, true), { ok: false, reason: "boundary", row: 0, column: 0 });
  assert.deepEqual(editor.navigateCell(0, 0, 2, 2, "ArrowRight"), { ok: false, reason: "ignored" });
});

test("decorated cells commit edits and Tab moves focus without wrapping", async () => {
  const source = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  const commits = [];
  const decorated = editor.decorateTable(tableEl, {
    table,
    commit: (row, column, value) => {
      commits.push({ row, column, value });
      return { ok: true };
    },
  });

  assert.ok(decorated);
  assert.equal(tableEl.getAttribute("data-qt-table-editor"), "on");
  const atp = tableEl.rows[1].cells[0];
  const energy = tableEl.rows[1].cells[1];
  assert.equal(atp.getAttribute("contenteditable"), "true");
  assert.equal(energy.getAttribute("contenteditable"), "true");

  keydown(atp, "Tab");
  assert.equal(energy.focused, true);
  assert.deepEqual(commits, [], "moving without an edit does not write");

  energy.textContent = "Energy released";
  energy.focused = false;
  atp.focused = false;
  const tab = keydown(energy, "Tab");
  assert.equal(tab.prevented, false, "Tab at the last cell leaves the table instead of wrapping");
  assert.equal(atp.focused, false, "focus does not jump back to the first cell");
  await flush();
  assert.deepEqual(commits, [{ row: 1, column: 1, value: "Energy released" }]);

  const header = tableEl.rows[0].cells[0];
  header.focused = false;
  const boundary = keydown(header, "Tab", { shiftKey: true });
  assert.equal(boundary.prevented, false, "Shift+Tab at the first cell leaves the table");
  assert.equal(header.focused, false);

  const plainArrow = keydown(atp, "ArrowRight");
  assert.equal(plainArrow.prevented, false);
  const altArrow = keydown(atp, "ArrowRight", { altKey: true });
  assert.equal(altArrow.prevented, true);
  assert.equal(energy.focused, true);
});

test("a blur commits the typed value through the note update", async () => {
  const source = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  const commits = [];
  editor.decorateTable(tableEl, {
    table,
    commit: (row, column, value) => {
      commits.push({ row, column, value });
      return { ok: true };
    },
  });
  const cell = tableEl.rows[1].cells[1];
  cell.textContent = "Energy currency";
  for (const handler of cell.listeners.blur || []) handler();
  await flush();
  assert.deepEqual(commits, [{ row: 1, column: 1, value: "Energy currency" }]);
});

test("the disabled module leaves rendered tables untouched", async () => {
  const note = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const plugin = new QT(makeApp([{ path: "note.md", text: note }]));
  await plugin.onload();
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  const wrapper = {
    closest: (selector) => (selector === ".markdown-preview-view" ? {} : null),
    querySelectorAll: () => [tableEl],
  };
  plugin.decorateTableEditor(wrapper, {
    sourcePath: "note.md",
    getSectionInfo: () => ({ text: note, lineStart: 0 }),
  });
  assert.equal(plugin.tableEditorEnabled(), false);
  assert.equal(tableEl.rows[1].cells[0].getAttribute("contenteditable"), undefined);
  assert.equal(tableEl.getAttribute("data-qt-table-editor"), undefined);

  const page = STS.STUDY_TOOL_SETTINGS_BY_ID["advanced-tables"].page;
  page.enable(plugin, true);
  assert.equal(plugin.tableEditorEnabled(), true);
  page.enable(plugin, false);
  assert.equal(plugin.tableEditorEnabled(), false);
});

test("the enabled postprocessor decorates cells and saves through vault.modify", async () => {
  const note = "Before\n\n| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n\nAfter";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  const wrapper = {
    closest: (selector) => (selector === ".markdown-preview-view" ? {} : null),
    querySelectorAll: () => [tableEl],
  };
  plugin.decorateTableEditor(wrapper, {
    sourcePath: "note.md",
    getSectionInfo: () => ({ text: note, lineStart: 0 }),
  });

  const cell = tableEl.rows[1].cells[1];
  assert.equal(cell.getAttribute("contenteditable"), "true");
  cell.textContent = "Energy | work";
  for (const handler of cell.listeners.blur || []) handler();
  await flush();

  assert.equal(app.modified && app.modified.length, 1);
  const saved = app.modified[0].text;
  assert.match(saved, /Energy \\\| work/);
  assert.equal(saved.includes("Energy | work"), false);
  const table = editor.parseTables(saved)[0];
  assert.deepEqual(table.rows[1], ["ATP", "Energy \\| work"]);
  assert.equal(table.rows.every((row) => row.length === 2), true);
});

test("an active Markdown editor is used instead of a disk read/modify race", async () => {
  const note = "Before\n\n| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const table = editor.parseTables(note)[0];
  const live = fakeEditor(note);
  app.workspace.activeEditor = { file: app.files[0], editor: live };

  const result = await plugin.updateTableCell("note.md", 0, table, 1, 0, "Adenosine triphosphate");
  assert.equal(result.ok, true);
  assert.equal(live.ranges.length, 1);
  assert.equal(app.modified, undefined, "the note is not written behind the live editor");
  const updated = editor.parseTables(live.getValue())[0];
  assert.deepEqual(updated.rows[1], ["Adenosine triphosphate", "Energy"]);
  assert.equal(updated.rows.every((row) => row.length === 2), true);
});
