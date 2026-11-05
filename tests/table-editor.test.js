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
    ownerDocument: null,
    inserted: null,
    insertAdjacentElement(position, element) {
      this.inserted = { position, element };
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

function fakeToolbarDoc() {
  const createElement = (tag) => {
    const attrs = {};
    const listeners = {};
    const children = [];
    return {
      tagName: String(tag).toUpperCase(),
      attrs,
      listeners,
      children,
      className: "",
      textContent: "",
      appendChild(child) {
        children.push(child);
      },
      setAttribute(name, value) {
        attrs[name] = String(value);
      },
      getAttribute(name) {
        return attrs[name];
      },
      addEventListener(name, fn) {
        (listeners[name] = listeners[name] || []).push(fn);
      },
    };
  };
  return { createElement };
}

function fire(element, name, event) {
  for (const handler of element.listeners[name] || []) handler(event || {});
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
  const off = { enabled: false, bindTab: true, bindEnter: true, padCells: true, showRibbon: true };
  const on = { enabled: true, bindTab: true, bindEnter: true, padCells: true, showRibbon: true };
  assert.deepEqual(editor.normalizeTableEditorSettings(undefined), off);
  assert.deepEqual(editor.normalizeTableEditorSettings({ enabled: 1 }), off);
  assert.deepEqual(editor.normalizeTableEditorSettings({ enabled: true }), on);
  assert.deepEqual(editor.normalizeTableEditorSettings({ enabled: true, bindTab: false, bindEnter: false, padCells: false, showRibbon: false }), { enabled: true, bindTab: false, bindEnter: false, padCells: false, showRibbon: false });
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

test("row and column operations keep the table rectangular and aligned", () => {
  const source = "| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n";
  const table = editor.parseTables(source)[0];

  const addedRow = editor.updateTableStructure(source, 0, table, "row-insert-below", 1, 0);
  assert.equal(addedRow.ok, true);
  const rowTable = editor.parseTables(addedRow.text)[0];
  assert.equal(rowTable.rows.length, 4);
  assert.deepEqual(rowTable.rows[2], ["", "", ""]);
  assert.deepEqual(rowTable.align, ["left", "center", "right"]);
  assert.equal(rowTable.rows.every((row) => row.length === 3), true);

  const addedColumn = editor.updateTableStructure(source, 0, table, "column-insert-right", 1, 0);
  assert.equal(addedColumn.ok, true);
  const columnTable = editor.parseTables(addedColumn.text)[0];
  assert.deepEqual(columnTable.header, ["A", "", "B", "C"]);
  assert.deepEqual(columnTable.align, ["left", "none", "center", "right"]);
  assert.equal(columnTable.rows.every((row) => row.length === 4), true);
  assert.equal(editor.splitTableRow(addedColumn.replacement.split("\n")[1]).cells.length, 4);

  const removedRow = editor.updateTableStructure(addedRow.text, 0, rowTable, "row-delete", 2, 0);
  assert.equal(removedRow.ok, true);
  assert.equal(editor.parseTables(removedRow.text)[0].rows.length, 3);

  const removedColumn = editor.updateTableStructure(addedColumn.text, 0, columnTable, "column-delete", 1, 1);
  assert.equal(removedColumn.ok, true);
  assert.deepEqual(editor.parseTables(removedColumn.text)[0].header, ["A", "B", "C"]);

  const movedRow = editor.updateTableStructure(source, 0, table, "row-move-down", 1, 0);
  assert.equal(movedRow.ok, true);
  assert.deepEqual(editor.parseTables(movedRow.text)[0].rows.slice(1), [["4", "5", "6"], ["1", "2", "3"]]);

  const movedColumn = editor.updateTableStructure(source, 0, table, "column-move-right", 0, 0);
  assert.equal(movedColumn.ok, true);
  const movedTable = editor.parseTables(movedColumn.text)[0];
  assert.deepEqual(movedTable.header, ["B", "A", "C"]);
  assert.deepEqual(movedTable.align, ["center", "left", "right"]);
  assert.equal(movedColumn.text.includes("\r\n"), false);
});

test("structural actions preserve CRLF endings and refuse invalid boundaries", () => {
  const source = "| A | B |\r\n| --- | --- |\r\n| 1 | 2 |\r\n";
  const table = editor.parseTables(source)[0];
  const added = editor.updateTableStructure(source, 0, table, "row-insert-below", 1, 0);
  assert.equal(added.ok, true);
  assert.ok(added.text.includes("\r\n"));
  assert.equal(added.text.includes("\n\n"), false);

  assert.equal(editor.structureTable(table, "row-delete", 0, 0).reason, "header");
  assert.equal(editor.structureTable(table, "row-move-up", 0, 0).reason, "header");
  assert.equal(editor.structureTable(table, "row-move-up", 1, 0).reason, "boundary");
  assert.equal(editor.structureTable(table, "row-move-down", 1, 0).reason, "boundary");
  assert.equal(editor.structureTable(table, "column-move-left", 1, 0).reason, "boundary");
  assert.equal(editor.structureTable(table, "column-move-right", 1, 1).reason, "boundary");
  assert.equal(editor.structureTable(table, "row-delete", 9, 0).reason, "row");

  const oneColumn = editor.parseTables("| Only |\n| --- |\n| x |\n")[0];
  assert.equal(editor.structureTable(oneColumn, "column-delete", 1, 0).reason, "limit");
  assert.equal(editor.structureTable(table, "unknown", 1, 0).reason, "action");
});

test("the table toolbar commits the active cell before applying a structure action", async () => {
  const source = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  tableEl.ownerDocument = fakeToolbarDoc();
  const edits = [];
  const actions = [];
  const decorated = editor.decorateTable(tableEl, {
    table,
    commit: (row, column, value) => {
      edits.push({ row, column, value });
      return { ok: true };
    },
    structure: (action, row, column) => {
      actions.push({ action, row, column });
      return { ok: true };
    },
  });

  assert.ok(decorated.toolbar);
  assert.equal(tableEl.inserted.position, "afterend");
  assert.equal(decorated.toolbar.attrs.role, "toolbar");
  assert.equal(decorated.toolbar.attrs["aria-label"], "Table controls");
  assert.equal(decorated.toolbar.children.length, editor.TABLE_TOOLBAR_ACTIONS.length);
  assert.equal(decorated.toolbar.children[0].attrs["data-qt-table-action"], "row-insert-below");
  assert.equal(decorated.toolbar.children[0].attrs["aria-label"], "Insert row below");

  const cell = tableEl.rows[1].cells[0];
  fire(cell, "focus");
  cell.textContent = "Adenosine triphosphate";
  fire(decorated.toolbar.children[0], "click", { preventDefault() {} });
  await flush();
  await flush();

  assert.deepEqual(edits, [{ row: 1, column: 0, value: "Adenosine triphosphate" }]);
  assert.deepEqual(actions, [{ action: "row-insert-below", row: 1, column: 0 }]);
});

test("structural changes use the note write path and keep the source valid", async () => {
  const note = "Before\n\n| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n\nAfter";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const table = editor.parseTables(note)[0];

  const result = await plugin.updateTableStructure("note.md", 0, table, "column-insert-right", 1, 0);
  assert.equal(result.ok, true);
  assert.equal(app.modified && app.modified.length, 1);
  const saved = app.modified[0].text;
  const updated = editor.parseTables(saved)[0];
  assert.deepEqual(updated.header, ["Term", "", "Meaning"]);
  assert.deepEqual(updated.align, ["none", "none", "none"]);
  assert.equal(updated.rows.every((row) => row.length === 3), true);
  assert.match(saved, /\| ATP\s+\|\s+\| Energy\s+\|/);
});

test("cell formatting toggles on the source, escapes pipes and preserves the table shape", () => {
  const source = "| Term | Meaning |\r\n| :--- | ---: |\r\n| ATP | Energy |\r\n";
  const table = editor.parseTables(source)[0];
  for (const format of ["bold", "italic", "code", "strikethrough"]) {
    const on = editor.updateTableFormat(source, 0, table, 1, 0, format);
    assert.equal(on.ok, true);
    assert.ok(on.text.includes("\r\n"), `${format} keeps CRLF`);
    const formatted = editor.parseTables(on.text)[0];
    assert.deepEqual(formatted.align, ["left", "right"]);
    assert.equal(formatted.rows.every((row) => row.length === 2), true);
    const off = editor.updateTableFormat(on.text, 0, formatted, 1, 0, format);
    assert.equal(off.ok, true);
    assert.deepEqual(editor.parseTables(off.text)[0].rows[1], ["ATP", "Energy"], `${format} toggles back`);
  }

  const pipeSource = "| Term | Meaning |\n| --- | --- |\n| x \\| y | z |\n";
  const pipeTable = editor.parseTables(pipeSource)[0];
  const piped = editor.updateTableFormat(pipeSource, 0, pipeTable, 1, 0, "bold");
  assert.equal(piped.ok, true);
  assert.match(piped.text, /\*\*x \\\| y\*\*/);
  assert.equal(editor.parseTables(piped.text)[0].rows[1][0], "**x \\| y**");
});

test("formatting and alignment refuse empty cells, missing columns and bad values", () => {
  const source = "| A | B |\n| --- | --- |\n|  | x |\n";
  const table = editor.parseTables(source)[0];
  const empty = editor.updateTableFormat(source, 0, table, 1, 0, "bold");
  assert.equal(empty.reason, "empty");
  assert.match(empty.message, /no text to format/i);
  const missing = editor.updateTableFormat(source, 0, table, 1, 9, "bold");
  assert.equal(missing.reason, "column");
  assert.match(missing.message, /column is no longer available/i);
  assert.equal(editor.toggleCellFormat("ATP", "unknown").reason, "format");
  const missingAlign = editor.alignTableColumn(table, 9, "left");
  assert.equal(missingAlign.reason, "column");
  assert.match(missingAlign.message, /column is no longer available/i);
  const badAlign = editor.alignTableColumn(table, 1, "sideways");
  assert.equal(badAlign.reason, "alignment");
  assert.match(badAlign.message, /left, center, right or default/i);
  assert.equal(editor.formatTableCell(null, 0, 0, "bold").reason, "table");
});

test("column alignment updates the delimiter row for every supported value", () => {
  const source = "| A | B |\n| --- | --- |\n| 1 | 2 |\n";
  const table = editor.parseTables(source)[0];
  const expected = { left: ":---", center: ":---:", right: "---:", none: "---" };
  for (const alignment of ["left", "center", "right", "none"]) {
    const result = editor.updateTableAlignment(source, 0, table, 1, alignment);
    assert.equal(result.ok, true, alignment);
    const updated = editor.parseTables(result.text)[0];
    assert.equal(updated.align[1], alignment);
    const delimiter = editor.splitTableRow(result.replacement.split("\n")[1]);
    assert.equal(delimiter.cells[1], expected[alignment], alignment);
  }

  const crlfSource = "| A | B |\r\n| --- | --- |\r\n| 1 | 2 |\r\n";
  const crlf = editor.updateTableAlignment(crlfSource, 0, editor.parseTables(crlfSource)[0], 1, "center");
  assert.equal(crlf.ok, true);
  assert.ok(crlf.text.includes("\r\n"));
  assert.equal(editor.parseTables(crlf.text)[0].align[1], "center");
});

test("the table toolbar commits the active cell before formatting and alignment", async () => {
  const source = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  tableEl.ownerDocument = fakeToolbarDoc();
  const edits = [];
  const formats = [];
  const aligns = [];
  const decorated = editor.decorateTable(tableEl, {
    table,
    commit: (row, column, value) => {
      edits.push({ row, column, value });
      return { ok: true };
    },
    format: (value, row, column) => {
      formats.push({ value, row, column });
      return { ok: true };
    },
    align: (value, column) => {
      aligns.push({ value, column });
      return { ok: true };
    },
  });

  const button = (id) => decorated.toolbar.children.find((child) => child.attrs["data-qt-table-action"] === id);
  assert.ok(button("cell-bold"));
  assert.ok(button("column-align-center"));
  const cell = tableEl.rows[1].cells[0];
  fire(cell, "focus");
  cell.textContent = "Adenosine triphosphate";
  fire(button("cell-bold"), "click", { preventDefault() {} });
  await flush();
  await flush();
  assert.deepEqual(edits, [{ row: 1, column: 0, value: "Adenosine triphosphate" }]);
  assert.deepEqual(formats, [{ value: "bold", row: 1, column: 0 }]);

  fire(button("column-align-center"), "click", { preventDefault() {} });
  await flush();
  await flush();
  assert.deepEqual(aligns, [{ value: "center", column: 0 }]);
});

test("formatting and alignment go through the note write path", async () => {
  const note = "Before\n\n| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n\nAfter";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const table = editor.parseTables(note)[0];

  const bold = await plugin.updateTableCellFormat("note.md", 0, table, "bold", 1, 0);
  assert.equal(bold.ok, true);
  let saved = app.modified[0].text;
  let updated = editor.parseTables(saved)[0];
  assert.equal(updated.rows[1][0], "**ATP**");
  assert.equal(updated.rows.every((row) => row.length === 2), true);

  const italic = await plugin.updateTableCellFormat("note.md", 0, updated, "italic", 1, 0);
  assert.equal(italic.ok, true);
  saved = app.modified[1].text;
  updated = editor.parseTables(saved)[0];
  assert.equal(updated.rows[1][0], "***ATP***");

  const centered = await plugin.updateTableAlignment("note.md", 0, updated, "center", 1);
  assert.equal(centered.ok, true);
  saved = app.modified[2].text;
  updated = editor.parseTables(saved)[0];
  assert.equal(updated.align[1], "center");
  assert.equal(updated.rows[1][0], "***ATP***");
  const delimiter = editor.splitTableRow(saved.split("\n")[3]);
  assert.match(delimiter.cells[1], /^:-{3,}:$/);
});


test("TBLFM formulas calculate totals, shares and chained values", () => {
  const source = [
    "| Item | Grams | Share |",
    "| --- | --- | --- |",
    "| Whole Wheat Flour | 110 | |",
    "| Bread Flour | 748 | |",
    "| Warm Water | 691 | |",
    "| Salt | 18 | |",
    "| Starter | 40 | |",
    "| **Total Grams** | | |",
    "<!-- TBLFM: @>$2=sum(@I..@-1) -->",
    "<!-- TBLFM: @2..@>$3=($2/@>$2);%.2f -->",
  ].join("\n");
  const table = editor.parseTables(source)[0];
  const result = editor.updateTableFormulas(source, 0, table);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.ok(result.text.includes("<!-- TBLFM: @>$2=sum(@I..@-1) -->"), "formula comments are preserved");
  assert.ok(result.text.includes("<!-- TBLFM: @2..@>$3=($2/@>$2);%.2f -->"), "chained comments are preserved");
  const updated = editor.parseTables(result.text)[0];
  assert.deepEqual(updated.rows[1], ["Whole Wheat Flour", "110", "0.07"]);
  assert.deepEqual(updated.rows[6], ["**Total Grams**", "1607", "1.00"]);
  assert.equal(updated.rows.every((row) => row.length === 3), true);
});

test("TBLFM mean, relative references and CRLF survive evaluation", () => {
  const source = [
    "| Item | Value | Double |",
    "| --- | --- | --- |",
    "| A | 2 | |",
    "| B | 4 | |",
    "| Mean | | |",
    "<!-- TBLFM: @>$2=mean(@I$2..@-1$2) -->",
    "<!-- TBLFM: @2..@3$3=($2*2) -->",
  ].join("\r\n");
  const table = editor.parseTables(source)[0];
  const result = editor.updateTableFormulas(source, 0, table);
  assert.equal(result.ok, true);
  assert.ok(result.text.includes("\r\n"), "CRLF is preserved");
  const updated = editor.parseTables(result.text)[0];
  assert.deepEqual(updated.rows[1], ["A", "2", "4"]);
  assert.deepEqual(updated.rows[2], ["B", "4", "8"]);
  assert.deepEqual(updated.rows[3], ["Mean", "3", ""]);
});

test("TBLFM refuses missing, malformed and out-of-range formulas", () => {
  const plain = "| A |\n| --- |\n| 1 |\n";
  const plainResult = editor.updateTableFormulas(plain, 0, editor.parseTables(plain)[0]);
  assert.equal(plainResult.ok, false);
  assert.equal(plainResult.reason, "no-formulas");

  const badSource = "| A |\n| --- |\n| 1 |\n<!-- TBLFM: @9$1=1 -->\n";
  const bad = editor.updateTableFormulas(badSource, 0, editor.parseTables(badSource)[0]);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "formula");
  assert.match(bad.message, /outside the table/i);

  const malformedSource = "| A |\n| --- |\n| 1 |\n<!-- TBLFM: 1+1 -->\n";
  const malformed = editor.updateTableFormulas(malformedSource, 0, editor.parseTables(malformedSource)[0]);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.reason, "formula");
});

test("table CSV quotes safely, unescapes pipes and protects spreadsheet formulas", () => {
  const source = [
    "| Name | Note |",
    "| --- | --- |",
    "| =SUM(A1:A2) | x, y |",
    "| quote | say \"hi\" |",
    "| x \\| y | z |",
  ].join("\n");
  const result = editor.tableCsvAt(source, 0, editor.parseTables(source)[0]);
  assert.equal(result.ok, true);
  assert.equal(
    result.csv,
    "Name,Note\n'=SUM(A1:A2),\"x, y\"\nquote,\"say \"\"hi\"\"\"\nx | y,z\n"
  );
});

test("TBLFM updates use the note write path", async () => {
  const note = "Before\n\n| Item | Grams |\n| --- | --- |\n| A | 2 |\n| B | 3 |\n| Total | |\n<!-- TBLFM: @>$2=sum(@I..@-1) -->\n\nAfter";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const table = editor.parseTables(note)[0];
  const result = await plugin.updateTableFormulas("note.md", 0, table);
  assert.equal(result.ok, true);
  assert.equal(app.modified && app.modified.length, 1);
  const saved = app.modified[0].text;
  assert.ok(saved.includes("<!-- TBLFM: @>$2=sum(@I..@-1) -->"));
  assert.deepEqual(editor.parseTables(saved)[0].rows[3], ["Total", "5"]);
});

test("CSV export copies the table without changing the note", async () => {
  const note = "| Name | Value |\n| --- | --- |\n| A | 1 |\n";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const table = editor.parseTables(note)[0];
  let copied = "";
  const hadNavigator = Object.prototype.hasOwnProperty.call(globalThis, "navigator");
  const previous = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (value) => { copied = value; } } },
  });
  try {
    const result = await plugin.exportTableCsv("note.md", 0, table);
    assert.equal(result.ok, true);
    assert.equal(copied, "Name,Value\nA,1\n");
    assert.equal(app.modified, undefined, "export never writes the note");
  } finally {
    if (hadNavigator) Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
    else delete globalThis.navigator;
  }
});

test("the table toolbar exposes formula and CSV actions and commits before each", async () => {
  const source = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  tableEl.ownerDocument = fakeToolbarDoc();
  const calls = [];
  const decorated = editor.decorateTable(tableEl, {
    table,
    commit: () => { calls.push("commit"); return { ok: true }; },
    formula: () => { calls.push("formula"); return { ok: true }; },
    exportCsv: () => { calls.push("csv"); return { ok: true }; },
  });
  const button = (id) => decorated.toolbar.children.find((child) => child.attrs["data-qt-table-action"] === id);
  assert.ok(button("table-formulas"));
  assert.ok(button("table-csv"));
  const cell = tableEl.rows[1].cells[0];
  fire(cell, "focus");
  cell.textContent = "Adenosine triphosphate";
  fire(button("table-formulas"), "click", { preventDefault() {} });
  await flush();
  await flush();
  fire(button("table-csv"), "click", { preventDefault() {} });
  await flush();
  await flush();
  assert.deepEqual(calls, ["commit", "formula", "csv"]);
});


test("table sorting orders numeric body rows ascending and descending", () => {
  const source = "| Name | Score |\n| --- | --- |\n| B | 10 |\n| A | 2 |\n| C | 1 |\n";
  const table = editor.parseTables(source)[0];
  const ascending = editor.updateTableSort(source, 0, table, 1, "asc");
  assert.equal(ascending.ok, true);
  assert.equal(ascending.changed, true);
  let updated = editor.parseTables(ascending.text)[0];
  assert.deepEqual(updated.header, ["Name", "Score"]);
  assert.deepEqual(updated.rows.slice(1), [["C", "1"], ["A", "2"], ["B", "10"]]);

  const descending = editor.updateTableSort(ascending.text, 0, updated, 1, "desc");
  assert.equal(descending.ok, true);
  updated = editor.parseTables(descending.text)[0];
  assert.deepEqual(updated.rows.slice(1), [["B", "10"], ["A", "2"], ["C", "1"]]);
});

test("table sorting orders text case-insensitively and keeps ties stable", () => {
  const textSource = "| Name | Fruit |\n| --- | --- |\n| 1 | banana |\n| 2 | Apple |\n| 3 | cherry |\n";
  const textTable = editor.parseTables(textSource)[0];
  const textAsc = editor.updateTableSort(textSource, 0, textTable, 1, "asc");
  assert.deepEqual(editor.parseTables(textAsc.text)[0].rows.slice(1).map((row) => row[1]), ["Apple", "banana", "cherry"]);
  const textDesc = editor.updateTableSort(textAsc.text, 0, editor.parseTables(textAsc.text)[0], 1, "desc");
  assert.deepEqual(editor.parseTables(textDesc.text)[0].rows.slice(1).map((row) => row[1]), ["cherry", "banana", "Apple"]);

  const tieSource = "| Name | Score |\n| --- | --- |\n| A | 2 |\n| B | 1 |\n| C | 2 |\n| D | 1 |\n| E | |\n";
  const tieTable = editor.parseTables(tieSource)[0];
  const tieAsc = editor.updateTableSort(tieSource, 0, tieTable, 1, "asc");
  assert.deepEqual(editor.parseTables(tieAsc.text)[0].rows.slice(1).map((row) => row[0]), ["E", "B", "D", "A", "C"], "upstream treats the blank cell as the smallest value");
  const tieDesc = editor.updateTableSort(tieSource, 0, tieTable, 1, "desc");
  assert.deepEqual(editor.parseTables(tieDesc.text)[0].rows.slice(1).map((row) => row[0]), ["A", "C", "B", "D", "E"]);
});

test("sorting preserves CRLF and TBLFM comments immediately after the table", () => {
  const source = [
    "| Name | Score |",
    "| --- | --- |",
    "| B | 10 |",
    "| A | 2 |",
    "<!-- TBLFM: @>$2=sum(@I..@-1) -->",
  ].join("\r\n");
  const table = editor.parseTables(source)[0];
  const result = editor.updateTableSort(source, 0, table, 1, "asc");
  assert.equal(result.ok, true);
  assert.ok(result.text.includes("\r\n"), "CRLF is preserved");
  assert.equal(result.text.includes("\n\n"), false);
  const updated = editor.parseTables(result.text)[0];
  const lines = result.text.split("\r\n");
  assert.equal(lines[updated.end + 1], "<!-- TBLFM: @>$2=sum(@I..@-1) -->", "the formula stays attached");
  assert.deepEqual(updated.rows.slice(1), [["A", "2"], ["B", "10"]]);
});

test("sorting refuses a header-only table, an empty column and bad requests", () => {
  const headerOnly = "| Name | Score |\n| --- | --- |\n";
  const headerTable = editor.parseTables(headerOnly)[0];
  assert.equal(editor.sortTable(headerTable, 1, "asc").reason, "no-rows");
  assert.equal(editor.updateTableSort(headerOnly, 0, headerTable, 1, "asc").reason, "no-rows");

  const emptyColumn = "| Name | Score |\n| --- | --- |\n| A | |\n| B | |\n";
  const emptyTable = editor.parseTables(emptyColumn)[0];
  assert.equal(editor.sortTable(emptyTable, 1, "asc").reason, "empty");
  assert.equal(editor.sortTable(emptyTable, 9, "asc").reason, "column");
  assert.equal(editor.sortTable(emptyTable, 1, "sideways").reason, "direction");
  assert.equal(editor.sortTable(null, 1, "asc").reason, "table");
});

test("table sorting writes the sorted content through the note path", async () => {
  const note = "Before\n\n| Name | Score |\n| --- | --- |\n| A | 2 |\n| B | 10 |\n<!-- TBLFM: @>$2=sum(@I..@-1) -->\n\nAfter";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const table = editor.parseTables(note)[0];
  const result = await plugin.updateTableSort("note.md", 0, table, "desc", 1);
  assert.equal(result.ok, true);
  assert.equal(app.modified && app.modified.length, 1);
  const saved = app.modified[0].text;
  assert.match(saved, /\| B\s+\| 10\s+\|/);
  assert.ok(saved.includes("<!-- TBLFM: @>$2=sum(@I..@-1) -->"));
  assert.deepEqual(editor.parseTables(saved)[0].rows.slice(1), [["B", "10"], ["A", "2"]]);
});

test("the table toolbar sorts the active column and refuses without a selected cell", async () => {
  const source = "| Term | Score |\n| --- | --- |\n| ATP | 2 |\n| DNA | 10 |\n";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Term", "Score"], [["ATP", "2"], ["DNA", "10"]]);
  tableEl.ownerDocument = fakeToolbarDoc();
  const calls = [];
  const decorated = editor.decorateTable(tableEl, {
    table,
    commit: () => { calls.push("commit"); return { ok: true }; },
    sort: (direction, column) => { calls.push(`sort:${direction}:${column}`); return { ok: true }; },
  });
  const button = (id) => decorated.toolbar.children.find((child) => child.attrs["data-qt-table-action"] === id);
  assert.ok(button("table-sort-asc"));
  assert.ok(button("table-sort-desc"));
  const cell = tableEl.rows[1].cells[1];
  fire(cell, "focus");
  cell.textContent = "3";
  fire(button("table-sort-desc"), "click", { preventDefault() {} });
  await flush();
  await flush();
  assert.deepEqual(calls, ["commit", "sort:desc:1"]);

  const errors = [];
  const secondTable = fakeTable(["Term", "Score"], [["ATP", "2"], ["DNA", "10"]]);
  secondTable.ownerDocument = fakeToolbarDoc();
  const second = editor.decorateTable(secondTable, {
    table,
    sort: () => { throw new Error("should not run"); },
    onError: (message) => errors.push(message),
  });
  const sortButton = second.toolbar.children.find((child) => child.attrs["data-qt-table-action"] === "table-sort-asc");
  fire(sortButton, "click", { preventDefault() {} });
  await flush();
  assert.match(errors[0] || "", /Select a table cell/);
});


test("CSV and TSV paste parsing keeps quoted commas, quotes and tabs inside one cell", () => {
  const csv = editor.parseDelimitedTable('Name,Note\r\nA,"x, y"\r\nB,"say ""hi"""\r\n');
  assert.equal(csv.ok, true);
  assert.equal(csv.delimiter, "csv");
  assert.deepEqual(csv.rows, [["Name", "Note"], ["A", "x, y"], ["B", 'say "hi"']]);

  const tsv = editor.parseDelimitedTable("Name\tNote\nA\tx | y\n");
  assert.equal(tsv.ok, true);
  assert.equal(tsv.delimiter, "tsv");
  assert.deepEqual(tsv.rows, [["Name", "Note"], ["A", "x | y"]]);

  assert.equal(editor.parseDelimitedTable("   ").reason, "empty");
  assert.equal(editor.parseDelimitedTable('A,"B').reason, "quote");
});

test("CSV import appends rows through the table write path and escapes pipes", () => {
  const source = "| Name | Score |\r\n| :--- | ---: |\r\n| A | 1 |\r\n";
  const table = editor.parseTables(source)[0];
  const result = editor.updateTableCsvImport(source, 0, table, 'B,2\nC,"x | y"\n', "append");
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.imported, 2);
  assert.ok(result.text.includes("\r\n"), "CRLF is preserved");
  assert.equal(result.text.includes("\n\n"), false);
  const updated = editor.parseTables(result.text)[0];
  assert.deepEqual(updated.align, ["left", "right"]);
  assert.deepEqual(updated.rows, [["Name", "Score"], ["A", "1"], ["B", "2"], ["C", "x \\| y"]]);
  assert.equal(updated.rows.every((row) => row.length === 2), true);

  const same = editor.updateTableCsvImport(result.text, 0, updated, "A,1\nB,2\nC,x | y\n", "replace");
  assert.equal(same.ok, true);
  assert.equal(same.changed, false, "replacing rows with identical data reports no change");
  assert.deepEqual(editor.parseTables(same.text)[0].rows, updated.rows);
});

test("CSV import into an empty table takes its header and width from the paste", () => {
  const source = "|  |  |\n| --- | --- |\n";
  const table = editor.parseTables(source)[0];
  const result = editor.updateTableCsvImport(source, 0, table, "Term,Definition,Source\nATP,Energy,Cell\n", "replace");
  assert.equal(result.ok, true);
  assert.equal(result.delimiter, "csv");
  const updated = editor.parseTables(result.text)[0];
  assert.deepEqual(updated.header, ["Term", "Definition", "Source"]);
  assert.deepEqual(updated.rows, [["Term", "Definition", "Source"], ["ATP", "Energy", "Cell"]]);
  assert.deepEqual(updated.align, ["none", "none", "none"]);
  assert.equal(updated.rows.every((row) => row.length === 3), true);
});

test("replacing the rows swaps the body and keeps the header and alignment", () => {
  const source = "| Term | Meaning |\n| :--- | ---: |\n| ATP | Energy |\n| DNA | Code |\n";
  const table = editor.parseTables(source)[0];
  const result = editor.updateTableCsvImport(source, 0, table, "ATP\tEnergy currency\n", "replace");
  assert.equal(result.ok, true);
  const updated = editor.parseTables(result.text)[0];
  assert.deepEqual(updated.rows, [["Term", "Meaning"], ["ATP", "Energy currency"]]);
  assert.deepEqual(updated.align, ["left", "right"]);
  assert.equal(result.delimiter, "tsv");
});

test("import refuses wider data, a full table, an over-long cell and a missing table", () => {
  const source = "| A | B |\n| --- | --- |\n| 1 | 2 |\n";
  const table = editor.parseTables(source)[0];
  assert.equal(editor.importTableData(table, "1,2,3", { mode: "append" }).reason, "columns");
  assert.match(editor.importTableData(table, "1,2,3", { mode: "append" }).message, /2 columns.*3/);
  assert.equal(editor.importTableData(table, "", { mode: "append" }).reason, "empty");
  assert.equal(editor.importTableData(table, "1,2", { mode: "sideways" }).reason, "mode");
  assert.equal(editor.importTableData(null, "1", { mode: "append" }).reason, "table");

  const tooLong = "x".repeat(editor.MAX_CELL_LENGTH + 1);
  const long = editor.importTableData(table, `1,${tooLong}`, { mode: "append" });
  assert.equal(long.reason, "limit");
  assert.match(long.message, new RegExp(String(editor.MAX_CELL_LENGTH)));

  const full = "| A | B |\n| --- | --- |\n" + "| 1 | 2 |\n".repeat(editor.MAX_TABLE_ROWS - 1);
  const fullTable = editor.parseTables(full)[0];
  assert.equal(fullTable.rows.length, editor.MAX_TABLE_ROWS);
  const overRows = editor.importTableData(fullTable, "3,4", { mode: "append" });
  assert.equal(overRows.reason, "limit");
  assert.match(overRows.message, new RegExp(String(editor.MAX_TABLE_ROWS)));

  const widePaste = Array.from({ length: editor.MAX_TABLE_COLUMNS + 1 }, () => "v").join(",");
  assert.equal(editor.importTableData(table, widePaste, { mode: "append" }).reason, "limit");
  assert.equal(editor.updateTableCsvImport("No table here.\n", 0, null, "1,2", "append").reason, "not-found");
});

test("transpose swaps rows and columns and toggles back", () => {
  const source = "| Name | Q1 | Q2 |\r\n| --- | --- | --- |\r\n| A | 1 | 2 |\r\n| B | 3 | 4 |\r\n";
  const table = editor.parseTables(source)[0];
  const once = editor.updateTableTranspose(source, 0, table);
  assert.equal(once.ok, true);
  assert.ok(once.text.includes("\r\n"), "CRLF is preserved");
  const transposed = editor.parseTables(once.text)[0];
  assert.deepEqual(transposed.header, ["Name", "A", "B"]);
  assert.deepEqual(transposed.rows, [["Name", "A", "B"], ["Q1", "1", "3"], ["Q2", "2", "4"]]);
  assert.deepEqual(transposed.align, ["none", "none", "none"]);
  assert.equal(transposed.rows.every((row) => row.length === 3), true);
  const delimiter = editor.splitTableRow(once.replacement.split(/\r?\n/)[1]);
  assert.equal(delimiter.cells.length, 3, "the delimiter row matches the new column count");

  const twice = editor.updateTableTranspose(once.text, 0, transposed);
  assert.equal(twice.ok, true);
  const restored = editor.parseTables(twice.text)[0];
  assert.deepEqual(restored.header, ["Name", "Q1", "Q2"]);
  assert.deepEqual(restored.rows, [["Name", "Q1", "Q2"], ["A", "1", "2"], ["B", "3", "4"]]);
  assert.equal(restored.rows.every((row) => row.length === 3), true);
});

test("transpose refuses a header-only table and one past the column limit", () => {
  const headerOnly = "| A | B |\n| --- | --- |\n";
  const headerTable = editor.parseTables(headerOnly)[0];
  const empty = editor.transposeTable(headerTable);
  assert.equal(empty.reason, "no-rows");
  assert.match(empty.message, /at least one body row/);
  assert.equal(editor.updateTableTranspose(headerOnly, 0, headerTable).reason, "no-rows");

  const tall = "| A | B |\n| --- | --- |\n"
    + Array.from({ length: editor.MAX_TABLE_COLUMNS }, (_, index) => `| ${index} | x |`).join("\n") + "\n";
  const tallTable = editor.parseTables(tall)[0];
  assert.equal(tallTable.rows.length, editor.MAX_TABLE_COLUMNS + 1);
  const over = editor.transposeTable(tallTable);
  assert.equal(over.reason, "limit");
  assert.match(over.message, new RegExp(String(editor.MAX_TABLE_COLUMNS)));
  assert.equal(editor.transposeTable(null).reason, "table");
});

test("the header toggle moves row 0 between the header and the body without losing text", () => {
  const source = "| Term | Meaning |\r\n| --- | --- |\r\n| ATP | Energy |\r\n| DNA | Code |\r\n";
  const table = editor.parseTables(source)[0];
  const off = editor.updateTableHeader(source, 0, table);
  assert.equal(off.ok, true);
  assert.equal(off.header, "off");
  assert.ok(off.text.includes("\r\n"), "CRLF is preserved");
  const blank = editor.parseTables(off.text)[0];
  assert.deepEqual(blank.header, ["", ""]);
  assert.deepEqual(blank.rows, [["", ""], ["Term", "Meaning"], ["ATP", "Energy"], ["DNA", "Code"]]);
  assert.equal(editor.headerRowState(blank), "off");

  const on = editor.updateTableHeader(off.text, 0, blank);
  assert.equal(on.ok, true);
  assert.equal(on.header, "on");
  const restored = editor.parseTables(on.text)[0];
  assert.deepEqual(restored.rows, [["Term", "Meaning"], ["ATP", "Energy"], ["DNA", "Code"]]);
  assert.equal(editor.headerRowState(restored), "on");
});

test("the header toggle refuses when there is nowhere to move and counts name the table", () => {
  const blankOnly = "|  |  |\n| --- | --- |\n";
  const blankTable = editor.parseTables(blankOnly)[0];
  const nowhere = editor.toggleHeaderRow(blankTable);
  assert.equal(nowhere.reason, "no-rows");
  assert.match(nowhere.message, /no body row/);
  assert.equal(editor.updateTableHeader(blankOnly, 0, blankTable).reason, "no-rows");

  const full = "| A | B |\n| --- | --- |\n" + "| 1 | 2 |\n".repeat(editor.MAX_TABLE_ROWS - 1);
  const fullTable = editor.parseTables(full)[0];
  assert.equal(editor.toggleHeaderRow(fullTable).reason, "limit");
  assert.equal(editor.toggleHeaderRow(null).reason, "table");

  const source = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const counts = editor.tableCounts(editor.parseTables(source)[0]);
  assert.deepEqual(counts, {
    ok: true,
    rows: 2,
    bodyRows: 1,
    columns: 2,
    header: "on",
    label: "2 columns, 1 body row, header row on",
  });
  assert.equal(editor.tableCounts(null).reason, "table");
});

test("the toolbar exposes import, transpose, header and count actions", async () => {
  const source = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Term", "Meaning"], [["ATP", "Energy"]]);
  tableEl.ownerDocument = fakeToolbarDoc();
  const calls = [];
  const decorated = editor.decorateTable(tableEl, {
    table,
    commit: () => { calls.push("commit"); return { ok: true }; },
    importData: (mode) => { calls.push(`import:${mode}`); return { ok: true }; },
    transpose: () => { calls.push("transpose"); return { ok: true }; },
    toggleHeader: () => { calls.push("header"); return { ok: true }; },
    counts: () => { calls.push("counts"); return { ok: true }; },
  });
  const button = (id) => decorated.toolbar.children.find((child) => child.attrs["data-qt-table-action"] === id);
  for (const id of ["table-import-append", "table-import-replace", "table-transpose", "table-header", "table-counts"]) {
    assert.ok(button(id), `the toolbar has a ${id} button`);
  }
  assert.equal(editor.TABLE_IMPORT_ACTIONS.length, 2);
  assert.equal(editor.TABLE_DATA_ACTIONS.length, 3);

  const cell = tableEl.rows[1].cells[0];
  fire(cell, "focus");
  cell.textContent = "Adenosine triphosphate";
  fire(button("table-import-replace"), "click", { preventDefault() {} });
  await flush();
  await flush();
  fire(button("table-transpose"), "click", { preventDefault() {} });
  await flush();
  await flush();
  fire(button("table-header"), "click", { preventDefault() {} });
  await flush();
  await flush();
  fire(button("table-counts"), "click", { preventDefault() {} });
  await flush();
  await flush();
  assert.deepEqual(calls, ["commit", "import:replace", "transpose", "header", "counts"]);
});

test("clipboard import, transpose and the header toggle write through the note path", async () => {
  const note = "Before\n\n| Name | Q1 |\n| --- | --- |\n| A | 1 |\n\nAfter";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const table = editor.parseTables(note)[0];
  const hadNavigator = Object.prototype.hasOwnProperty.call(globalThis, "navigator");
  const previous = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { readText: async () => "B,2\n" } },
  });
  try {
    const imported = await plugin.importTableCsv("note.md", 0, table, "append");
    assert.equal(imported.ok, true);
    assert.equal(app.modified && app.modified.length, 1);
    let updated = editor.parseTables(app.modified[0].text)[0];
    assert.deepEqual(updated.rows.slice(1), [["A", "1"], ["B", "2"]]);

    const transposed = await plugin.updateTableTranspose("note.md", 0, updated);
    assert.equal(transposed.ok, true);
    updated = editor.parseTables(app.modified[1].text)[0];
    assert.deepEqual(updated.header, ["Name", "A", "B"]);
    assert.deepEqual(updated.rows.slice(1), [["Q1", "1", "2"]]);

    const header = await plugin.updateTableHeader("note.md", 0, updated);
    assert.equal(header.ok, true);
    updated = editor.parseTables(app.modified[2].text)[0];
    assert.equal(editor.headerRowState(updated), "off");
    assert.deepEqual(updated.header, ["", "", ""]);
    assert.ok(app.modified[2].text.startsWith(note.split("| Name")[0]), "the note around the table is untouched");
  } finally {
    if (hadNavigator) Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
    else delete globalThis.navigator;
  }

  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  try {
    const refused = await plugin.importTableCsv("note.md", 0, table, "append");
    assert.equal(refused.reason, "clipboard");
    assert.equal(app.modified.length, 3, "a refused import never writes");
  } finally {
    if (hadNavigator) Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
    else delete globalThis.navigator;
  }
});

test("the size readout reports the table without writing", async () => {
  const note = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n";
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.tableEditor = { enabled: true };
  const counts = plugin.reportTableCounts(editor.parseTables(note)[0]);
  assert.equal(counts.ok, true);
  assert.equal(counts.label, "2 columns, 2 body rows, header row on");
  assert.equal(app.modified, undefined, "the readout never writes");
  assert.equal(plugin.reportTableCounts(null).ok, false);
});


/* ---- merged cells (^ join left, " join up) and upstream blank ordering ---- */

test("merge markers report the spans they draw and the cells they hide", () => {
  const source = "| Wide | ^ | Narrow |\n| --- | --- | --- |\n| a | b | c |\n| d | \" | e |";
  const table = editor.parseTables(source)[0];
  const merges = editor.tableMerges(table);
  assert.equal(merges.ok, true);
  const wide = merges.spans.find((span) => span.row === 0 && span.column === 0);
  assert.equal(wide.colspan, 2, "the header cell spans two columns");
  const down = merges.spans.find((span) => span.row === 1 && span.column === 1);
  assert.equal(down.rowspan, 2, "the body cell spans two rows");
  assert.deepEqual(merges.hidden, [{ row: 0, column: 1 }, { row: 2, column: 1 }]);

  const formatted = editor.renderTable(table).join("\n");
  assert.match(formatted, /\| Wide\s+\| \^\s+\|/, "formatting keeps the marker");
  assert.deepEqual(editor.tableMerges(editor.parseTables(formatted)[0]), merges, "the layout round-trips");
});

test("a merge with nothing to join refuses instead of guessing", () => {
  const edge = editor.parseTables("| ^ | b |\n| --- | --- |\n| 1 | 2 |")[0];
  assert.equal(editor.tableMerges(edge).reason, "merge");
  const header = editor.parseTables("| a | \" |\n| --- | --- |\n| 1 | 2 |")[0];
  assert.equal(editor.tableMerges(header).reason, "merge", "the header row has nothing above it");
  assert.equal(editor.tableMerges(null).ok, false);
});

test("the reading-view table applies the span and hides the merged-away cell", () => {
  const source = "| Wide | ^ | Narrow |\n| --- | --- | --- |\n| a | b | c |\n| d | \" | e |";
  const table = editor.parseTables(source)[0];
  const tableEl = fakeTable(["Wide", "^", "Narrow"], [["a", "b", "c"], ["d", "\"", "e"]]);
  const decorated = editor.decorateTable(tableEl, { table, commit: () => ({ ok: true }) });
  assert.ok(decorated);
  assert.equal(tableEl.rows[0].cells[0].getAttribute("colspan"), "2");
  assert.equal(tableEl.rows[0].cells[1].getAttribute("data-qt-table-merged"), "on");
  assert.equal(tableEl.rows[0].cells[1].getAttribute("contenteditable"), "false", "a merged-away cell is not editable");
  assert.equal(tableEl.rows[1].cells[1].getAttribute("rowspan"), "2");
});

test("sorting puts blank cells first ascending and last descending, as upstream does", () => {
  const source = "| Name | Score |\n| --- | --- |\n| A | 2 |\n| B | |\n| C | 1 |";
  const table = editor.parseTables(source)[0];
  const asc = editor.updateTableSort(source, 0, table, 1, "asc");
  assert.deepEqual(editor.parseTables(asc.text)[0].rows.slice(1).map((row) => row[0]), ["B", "C", "A"]);
  const desc = editor.updateTableSort(asc.text, 0, editor.parseTables(asc.text)[0], 1, "desc");
  assert.deepEqual(editor.parseTables(desc.text)[0].rows.slice(1).map((row) => row[0]), ["A", "C", "B"]);
});

test("CSV export can join cells with tabs, as upstream does", () => {
  const table = editor.parseTables("| A | B |\n| --- | --- |\n| 1 | x,y |\n| 2 | say \"hi\" |")[0];
  const tabs = editor.tableCsvFromTable(table, { delimiter: "\t" });
  assert.equal(tabs.ok, true);
  assert.equal(tabs.delimiter, "\t");
  assert.equal(tabs.csv, "A\tB\n1\tx,y\n2\t\"say \"\"hi\"\"\"\n", "a comma needs no quoting, a quote does");
  const comma = editor.tableCsvFromTable(table);
  assert.equal(comma.csv.split("\n")[1], "1,\"x,y\"");
  const noHeader = editor.tableCsvFromTable(table, { header: false, delimiter: "\t" });
  assert.equal(noHeader.csv.split("\n")[0], "1\tx,y");
});
