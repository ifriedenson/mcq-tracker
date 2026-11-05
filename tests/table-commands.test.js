"use strict";
/*
 * The Advanced Tables parity surface: source-editor commands (navigation,
 * format, insert above/left, escape), the CSV dialog with its header switch,
 * and the docked controls panel. The engine helpers are exercised directly;
 * the plugin paths run through a fake editor so a write can be read back.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const editor = T.tableEditor;
const { TableControlsView, TABLE_CONTROL_GROUPS } = T.tableControls;
const { TableCsvModal } = T.tableCsvModal;

const NOTE = "Intro\n\n| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n| ADP | Phosphate |\n\nEnd";

function fakeEditor(value, cursor) {
  let lines = String(value).split("\n");
  let position = { line: 0, ch: 0, ...(cursor || {}) };
  const handle = {
    ranges: [],
    getValue: () => lines.join("\n"),
    lineCount: () => lines.length,
    getLine: (line) => lines[line],
    getCursor: () => ({ ...position }),
    setCursor: (next) => {
      position = { line: next.line, ch: next.ch || 0 };
    },
    cursor: () => ({ ...position }),
    setValue(next) {
      lines = String(next).split("\n");
    },
    replaceRange(insert, from, to) {
      const end = to || from;
      handle.ranges.push({ insert, from, to: end });
      to = end;
      const before = lines.slice(0, from.line);
      const head = lines[from.line].slice(0, from.ch) + String(insert).split("\n")[0];
      const inserted = String(insert).split("\n").slice(1);
      const tail = lines[to.line].slice(to.ch);
      if (inserted.length) {
        inserted[inserted.length - 1] += tail;
        lines = before.concat([head], inserted, lines.slice(to.line + 1));
      } else {
        lines = before.concat([head + tail], lines.slice(to.line + 1));
      }
    },
  };
  return handle;
}

async function tablePlugin(note, cursor) {
  const app = makeApp([{ path: "note.md", text: note || NOTE }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files[0];
  const ed = fakeEditor(note || NOTE, cursor);
  app.workspace.activeEditor = { file, editor: ed };
  return { app, plugin, file, editor: ed };
}

/* ---- engine: structure ---- */

test("insert row above and insert column left keep the table rectangular", () => {
  const source = "| Term | Meaning |\n| :--- | ---: |\n| ATP | Energy |";
  const table = editor.parseTables(source)[0];
  const above = editor.structureTable(table, "row-insert-above", 1, 0);
  assert.equal(above.ok, true);
  assert.deepEqual(above.table.rows, [["Term", "Meaning"], ["", ""], ["ATP", "Energy"]]);
  assert.deepEqual(above.table.align, ["left", "right"]);

  const left = editor.structureTable(table, "column-insert-left", 1, 0);
  assert.equal(left.ok, true);
  assert.deepEqual(left.table.rows[0], ["", "Term", "Meaning"]);
  assert.deepEqual(left.table.align, ["none", "left", "right"]);
  assert.equal(left.table.rows.every((row) => row.length === 3), true);

  const header = editor.structureTable(table, "row-insert-above", 0, 0);
  assert.deepEqual(header.table.rows[0], ["Term", "Meaning"], "the header stays first, as upstream's insertRow keeps it");
  assert.deepEqual(header.table.rows[1], ["", ""], "a header-row insert becomes the first body row");
  assert.deepEqual(header.table.rows[2], ["ATP", "Energy"]);

  assert.equal(editor.structureTable(table, "row-insert-above", 9, 0).ok, false);
  assert.equal(editor.structureTable(table, "column-insert-left", 1, 9).ok, false);
});

/* ---- engine: cursor mapping ---- */

test("row cell spans ignore escaped pipes and code spans", () => {
  const spans = editor.rowCellSpans("| a \\| b | `x | y` | last |");
  assert.deepEqual(spans.map((span) => span.text), ["a \\| b", "`x | y`", "last"]);
  assert.equal(spans[0].start, 2);
  assert.equal(spans[1].start, "| a \\| b | ".length);
});

test("cellAtLine maps a cursor to its row and column, header included", () => {
  const header = editor.cellAtLine(NOTE, 2, 4);
  assert.equal(header.row, 0);
  assert.equal(header.column, 0);
  const second = editor.cellAtLine(NOTE, 2, 13);
  assert.equal(second.column, 1);
  const body = editor.cellAtLine(NOTE, 4, 8);
  assert.equal(body.row, 1);
  assert.equal(body.column, 1);
  assert.equal(editor.cellAtLine(NOTE, 9, 0), null, "a line outside the table has no cell");
});

test("next cell walks the row, adds a header column and wraps in the body", () => {
  const first = editor.nextCellTarget(NOTE, 2, 2);
  assert.deepEqual({ line: first.line, ch: first.ch }, { line: 2, ch: 9 });
  const headerEnd = editor.nextCellTarget(NOTE, 2, 13);
  assert.equal(headerEnd.addColumn, true, "tabbing past the last header cell adds a column");
  const wrapped = editor.nextCellTarget(NOTE, 4, 13);
  assert.equal(wrapped.line, 5, "the delimiter row is skipped");
  assert.equal(wrapped.ch, 2);
  const end = editor.nextCellTarget(NOTE, 5, 13);
  assert.equal(end.append, true, "the last body cell asks for one more row");
});

test("previous cell walks back and refuses in the first cell", () => {
  const back = editor.previousCellTarget(NOTE, 4, 13);
  assert.deepEqual({ line: back.line, ch: back.ch }, { line: 4, ch: 2 });
  const up = editor.previousCellTarget(NOTE, 4, 2);
  assert.equal(up.line, 2, "the header's last cell");
  const boundary = editor.previousCellTarget(NOTE, 2, 2);
  assert.equal(boundary.ok, false);
  assert.equal(boundary.reason, "boundary");
});

test("next row keeps the column and asks for a row at the end", () => {
  const same = editor.nextRowTarget(NOTE, 2, 13);
  assert.deepEqual({ line: same.line, ch: same.ch }, { line: 4, ch: 8 });
  const end = editor.nextRowTarget(NOTE, 5, 2);
  assert.equal(end.append, true);
  assert.equal(end.column, 0);
});

/* ---- engine: formatting, escape, append ---- */

test("escape lands after the table and asks for a blank line when text follows", () => {
  const blank = editor.escapeTableTarget(NOTE, 4);
  assert.equal(blank.insert, false);
  assert.equal(blank.line, 6);

  const tight = "| a | b |\n| --- | --- |\n| 1 | 2 |\nAfter";
  const needs = editor.escapeTableTarget(tight, 2);
  assert.equal(needs.insert, true);
  assert.equal(needs.line, 3);
  assert.equal(editor.escapeTableTarget("No table here", 0).ok, false);
});

test("appendTableRow adds one blank body row and reports where it sits", () => {
  const result = editor.appendTableRow(NOTE, 4);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.rowLine, 6);
  const updated = editor.parseTables(result.text)[0];
  assert.equal(updated.rows.length, 4);
  assert.deepEqual(updated.rows[3], ["", ""]);
  assert.deepEqual(updated.header, ["Term", "Meaning"]);
});

test("formatTableAt pads one table, reports no change twice and refuses outside a table", () => {
  const ragged = "Intro\n\n|A|Bee|\n|-|-|\n|1|2|\n\nEnd";
  const first = editor.formatTableAt(ragged, 2);
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.text.split("\n")[2], "| A   | Bee |");
  const second = editor.formatTableAt(first.text, 2);
  assert.equal(second.changed, false);
  assert.equal(editor.formatTableAt("no table", 0).ok, false);
});

test("formatAllTables formats every table and refuses a note without one", () => {
  const two = "|a|b|\n|-|-|\n|1|2|\n\nMiddle\n\n|c|d|\n|-|-|\n|3|4|";
  const result = editor.formatAllTables(two);
  assert.equal(result.ok, true);
  assert.equal(result.tables, 2);
  assert.equal(result.changed, true);
  assert.match(result.text, /\| a   \| b   \|/);
  assert.match(result.text, /Middle/);
  const parsed = editor.parseTables(result.text);
  assert.equal(parsed.length, 2);
  assert.equal(editor.formatAllTables("plain prose").reason, "none");
});

test("minimal formatting renders valid cells without padding", () => {
  const table = editor.parseTables("|A|Bee|\n|-|-|\n|1|2|")[0];
  const lines = editor.renderTable(table, { pad: false });
  assert.deepEqual(lines, ["| A | Bee |", "| --- | --- |", "| 1 | 2 |"]);
  assert.deepEqual(editor.renderTable(table), ["| A   | Bee |", "| --- | --- |", "| 1   | 2   |"]);
  assert.equal(editor.parseTables(lines.join("\n")).length, 1);
});

/* ---- engine: CSV ---- */

test("CSV export can leave the header row out", () => {
  const table = editor.parseTables("| A | B |\n| --- | --- |\n| 1 | 2 |")[0];
  const withHeader = editor.tableCsvFromTable(table);
  assert.equal(withHeader.csv, "A,B\n1,2\n");
  const without = editor.tableCsvFromTable(table, { header: false });
  assert.equal(without.csv, "1,2\n");
  assert.equal(without.header, false);

  const at = editor.tableCsvAt("| A | B |\n| --- | --- |\n| 1 | 2 |", 0, table, { header: false });
  assert.equal(at.csv, "1,2\n");
  assert.equal(at.header, false);
  assert.equal(editor.tableCsvFromTable(null).ok, false);
});

/* ---- plugin: commands and editor actions ---- */

test("every table command is registered and only offers itself inside a table", async () => {
  const { plugin, app } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const ids = plugin.commands.map((command) => command.id);
  for (const id of ["tables-insert-row-below", "tables-insert-column-right", "tables-move-row-down", "tables-move-column-left",
    "tables-next-cell", "tables-previous-cell", "tables-next-row", "tables-escape",
    "tables-format", "tables-format-all", "tables-insert-row-above", "tables-insert-column-left",
    "tables-delete-row", "tables-delete-column", "tables-move-row-up", "tables-move-column-right",
    "tables-align-left", "tables-align-center", "tables-align-right", "tables-align-default",
    "tables-sort-asc", "tables-sort-desc", "tables-transpose", "tables-formulas",
    "tables-export-csv", "tables-open-controls",
  ]) {
    assert.ok(ids.includes(id), `${id} is registered`);
  }
  const next = plugin.commands.find((command) => command.id === "tables-next-cell");
  assert.equal(next.checkCallback(true), true);
  app.workspace.activeEditor = null;
  assert.equal(next.checkCallback(true), false, "no editor, no command");
  assert.equal(plugin.activeTableContext(), null);
});

test("insert above, align and delete run through the editor", async () => {
  const { plugin, editor: ed } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  await plugin.runTableAction("insert-row-above");
  let parsed = editor.parseTables(ed.getValue())[0];
  assert.deepEqual(parsed.header, ["Term", "Meaning"]);
  assert.deepEqual(parsed.rows[1], ["", ""], "the blank row sits above the cursor's row");
  assert.equal(parsed.rows.length, 4);

  await plugin.runTableAction("align-center");
  parsed = editor.parseTables(ed.getValue())[0];
  assert.equal(parsed.align[0], "center");

  await plugin.runTableAction("delete-row");
  parsed = editor.parseTables(ed.getValue())[0];
  assert.equal(parsed.rows.length, 3);
});

test("next cell moves the cursor and adds a row at the end of the table", async () => {
  const { plugin, editor: ed } = await tablePlugin(NOTE, { line: 2, ch: 2 });
  const moved = await plugin.runTableAction("next-cell");
  assert.equal(moved.line, 2);
  assert.equal(ed.cursor().ch, 9);

  await tablePlugin(NOTE, { line: 5, ch: 13 }).then(async ({ plugin: p, editor: e }) => {
    const appended = await p.runTableAction("next-cell");
    assert.equal(appended.appended, true);
    assert.equal(e.cursor().line, 6, "the cursor lands on the new row");
    const parsed = editor.parseTables(e.getValue())[0];
    assert.equal(parsed.rows.length, 4);
    assert.deepEqual(parsed.rows[3], ["", ""]);
  });
});

test("escape leaves the table and inserts a blank line when needed", async () => {
  const spaced = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const left = await spaced.plugin.runTableAction("escape");
  assert.equal(left.ok, true);
  assert.equal(spaced.editor.cursor().line, 6);
  assert.equal(spaced.editor.cursor().ch, 0);

  const tightNote = "| a | b |\n| --- | --- |\n| 1 | 2 |\nAfter";
  const tight = await tablePlugin(tightNote, { line: 2, ch: 2 });
  await tight.plugin.runTableAction("escape");
  assert.equal(tight.editor.cursor().line, 3);
  assert.equal(tight.editor.getValue().split("\n")[3], "", "a blank line was inserted");
});

test("format and format-all write padded tables, and padding can be off", async () => {
  const ragged = "|A|Bee|\n|-|-|\n|1|2|";
  const { plugin, editor: ed } = await tablePlugin(ragged, { line: 1, ch: 1 });
  await plugin.runTableAction("format");
  assert.equal(ed.getValue().split("\n")[0], "| A   | Bee |");

  plugin.settings.tableEditor = { enabled: true, bindTab: true, bindEnter: true, padCells: false, showRibbon: true };
  await plugin.runTableAction("format");
  assert.equal(ed.getValue().split("\n")[0], "| A | Bee |", "weak formatting writes minimal cells");

  const two = "|a|b|\n|-|-|\n|1|2|\n\n|c|d|\n|-|-|\n|3|4|";
  const many = await tablePlugin(two, { line: 2, ch: 1 });
  await many.plugin.formatAllTablesInNote();
  assert.equal(many.editor.getValue().split("\n")[0], "| a   | b   |");
  assert.equal(many.editor.getValue().split("\n")[4], "| c   | d   |");
});

test("the CSV dialog copies with or without the header row", async () => {
  const { plugin } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const writes = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value) => writes.push(value) } } });
  const before = obsidian.modals.length;
  const opened = plugin.openTableCsv(editor.parseTables(NOTE)[0]);
  assert.equal(opened.ok, true);
  assert.equal(obsidian.modals.length, before + 1, "the dialog opens");

  const table = editor.parseTables(NOTE)[0];
  const modal = new TableCsvModal(plugin.app, table);
  modal.contentEl = makeDom().root;
  modal.onOpen();
  assert.equal(modal.csv(), "Term,Meaning\nATP,Energy\nADP,Phosphate\n");
  modal.includeHeader = false;
  assert.equal(modal.csv(), "ATP,Energy\nADP,Phosphate\n");
  await modal.copy();
  assert.equal(writes[writes.length - 1], "ATP,Energy\nADP,Phosphate\n");
  assert.equal(modal.copies, 1);
});

test("the docked panel draws every group and its buttons act on the table", async () => {
  const { plugin, editor: ed } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const dom = makeDom();
  const leaf = { app: plugin.app, containerEl: { children: [null, dom.root] } };
  const view = new TableControlsView(leaf, plugin);
  view.containerEl = { children: [null, dom.root] };
  assert.equal(view.getViewType(), "question-tracker-table-controls");
  view.draw();
  const texts = dom.texts();
  for (const group of TABLE_CONTROL_GROUPS) assert.ok(texts.includes(group.label), `${group.label} is drawn`);
  assert.ok(texts.some((value) => /In a table: 3 rows × 2 columns/.test(value)), "the status names the table");

  await dom.click("Delete column");
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  const parsed = editor.parseTables(ed.getValue())[0];
  assert.equal(parsed.columns, 1, "the panel's button deleted a column");
});

/* ---- source editor: Tab / Shift+Tab / Enter / Shift+Enter ---- */

function keyEvent(key, shiftKey, kind) {
  const inEditor = kind !== "outside";
  return {
    key,
    shiftKey: shiftKey === true,
    prevented: false,
    stopped: false,
    target: {
      closest(selector) {
        if (!inEditor) return null;
        if (selector === ".cm-editor") return {};
        if (selector === "td" || selector === "th") return kind === "cell" ? {} : null;
        return null;
      },
    },
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
}

async function keyPlugin(patch) {
  const harness = await tablePlugin(NOTE, { line: 4, ch: 0 });
  harness.plugin.settings.tableEditor = {
    ...editor.normalizeTableEditorSettings({ enabled: true }),
    ...(patch || {}),
  };
  return harness;
}

test("Tab moves to the next cell in the source editor", async () => {
  const { plugin, editor: ed } = await keyPlugin();
  const event = keyEvent("Tab");
  assert.equal(plugin.onTableEditorKeydown(event), true);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  const spans = editor.rowCellSpans(ed.getLine(4));
  assert.deepEqual(ed.getCursor(), { line: 4, ch: spans[1].start });
});

test("Shift+Tab moves to the previous cell and Enter to the next row", async () => {
  const { plugin, editor: ed } = await keyPlugin();
  const spans = editor.rowCellSpans(ed.getLine(4));
  ed.setCursor({ line: 4, ch: spans[1].start });
  const back = keyEvent("Tab", true);
  assert.equal(plugin.onTableEditorKeydown(back), true);
  assert.deepEqual(ed.getCursor(), { line: 4, ch: spans[0].start });
  const down = keyEvent("Enter");
  assert.equal(plugin.onTableEditorKeydown(down), true);
  const nextSpans = editor.rowCellSpans(ed.getLine(5));
  assert.deepEqual(ed.getCursor(), { line: 5, ch: nextSpans[0].start });
});

test("Shift+Enter moves up a row and escapes from the header row", async () => {
  const { plugin, editor: ed } = await keyPlugin();
  ed.setCursor({ line: 5, ch: 0 });
  const up = keyEvent("Enter", true);
  assert.equal(plugin.onTableEditorKeydown(up), true);
  assert.equal(ed.getCursor().line, 4);
  ed.setCursor({ line: 2, ch: 0 });
  const escape = keyEvent("Enter", true);
  assert.equal(plugin.onTableEditorKeydown(escape), true);
  assert.equal(escape.prevented, true);
  assert.equal(ed.getCursor().line, 6);
});

test("the Tab and Enter settings turn their keys off without touching the editor", async () => {
  const offTab = await keyPlugin({ bindTab: false });
  const tab = keyEvent("Tab");
  assert.equal(offTab.plugin.onTableEditorKeydown(tab), false);
  assert.equal(tab.prevented, false);
  assert.deepEqual(offTab.editor.getCursor(), { line: 4, ch: 0 });

  const offEnter = await keyPlugin({ bindEnter: false });
  const enter = keyEvent("Enter");
  assert.equal(offEnter.plugin.onTableEditorKeydown(enter), false);
  assert.equal(enter.prevented, false);
  assert.deepEqual(offEnter.editor.getCursor(), { line: 4, ch: 0 });
});

test("the module switch and a cursor outside a table leave the keys alone", async () => {
  const disabled = await keyPlugin({ enabled: false });
  const event = keyEvent("Tab");
  assert.equal(disabled.plugin.onTableEditorKeydown(event), false);
  assert.equal(event.prevented, false);

  const outside = await keyPlugin();
  outside.editor.setCursor({ line: 0, ch: 0 });
  const plain = keyEvent("Tab");
  assert.equal(outside.plugin.onTableEditorKeydown(plain), false);
  assert.equal(plain.prevented, false);
  assert.deepEqual(outside.editor.getCursor(), { line: 0, ch: 0 });
});

test("a rendered table cell or a target outside the editor is not handled here", async () => {
  const { plugin } = await keyPlugin();
  assert.equal(plugin.onTableEditorKeydown(keyEvent("Tab", false, "cell")), false);
  assert.equal(plugin.onTableEditorKeydown(keyEvent("Tab", false, "outside")), false);
});

test("navigation keeps the cursor on cells with escaped pipes and wide characters", () => {
  const piped = "| Name | Value |\n| --- | --- |\n| a \\| b | c |";
  const first = editor.nextCellTarget(piped, 2, 1);
  const spans = editor.rowCellSpans(piped.split("\n")[2]);
  assert.equal(first.ok, true);
  assert.equal(first.ch, spans[1].start);
  assert.equal(editor.previousCellTarget(piped, 2, first.ch).ch, spans[0].start);

  const wide = "| 名前 | 値 |\n| --- | --- |\n| あ | い |";
  const next = editor.nextCellTarget(wide, 2, 1);
  const wideSpans = editor.rowCellSpans(wide.split("\n")[2]);
  assert.equal(next.ok, true);
  assert.equal(next.ch, wideSpans[1].start);
  assert.equal(wide.split("\n")[2].slice(next.ch).trim(), "い |");
});

/* ---- building a table from a bare pipe, as upstream documents ---- */

test("a pipe line with no delimiter is a draft that Tab completes", () => {
  const draft = editor.tableDraftAtLine("| Term", 0);
  assert.equal(draft.columns, 1);
  const started = editor.startTable("| Term", 0);
  assert.equal(started.ok, true);
  assert.equal(started.changed, true);
  const parsed = editor.parseTables(started.text)[0];
  assert.deepEqual(parsed.rows[0], ["Term", ""], "the typed heading gets the next header cell");
  const spans = editor.rowCellSpans(started.text.split("\n")[0]);
  assert.equal(started.ch, spans[1].start, "the cursor lands in the new heading");
  assert.equal(started.rowLine, 0);
});

test("an empty pipe completes to a one-column table", () => {
  const started = editor.startTable("|", 0);
  assert.equal(started.ok, true);
  assert.equal(editor.parseTables(started.text)[0].columns, 1);
  assert.equal(started.column, 0);
  assert.equal(started.ch, editor.rowCellSpans(started.text.split("\n")[0])[0].start);
});

test("a finished table and plain text are not drafts", () => {
  assert.equal(editor.tableDraftAtLine(NOTE, 2), null);
  assert.equal(editor.tableDraftAtLine("No table here", 0), null);
  assert.equal(editor.startTable(NOTE, 2).ok, false);
  assert.equal(editor.startTable("| a |\n| --- |\n| 1 |", 1).ok, false);
});

test("addTableColumn adds a column at the right edge of every row", () => {
  const added = editor.addTableColumn(NOTE, 4);
  assert.equal(added.ok, true);
  const parsed = editor.parseTables(added.text)[0];
  assert.equal(parsed.columns, 3);
  assert.deepEqual(parsed.rows[0], ["Term", "Meaning", ""]);
  assert.deepEqual(parsed.rows[2], ["ADP", "Phosphate", ""]);
  assert.equal(added.rowLine, 2);
  const spans = editor.rowCellSpans(added.text.split("\n")[2]);
  assert.equal(added.ch, spans[2].start);
});

test("Tab on a bare pipe starts the table and moves into the next heading", async () => {
  const harness = await tablePlugin("| Term", { line: 0, ch: 6 });
  harness.plugin.settings.tableEditor = { ...editor.normalizeTableEditorSettings({ enabled: true }) };
  const event = keyEvent("Tab");
  assert.equal(harness.plugin.onTableEditorKeydown(event), true);
  assert.equal(event.prevented, true);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  const parsed = editor.parseTables(harness.editor.getValue())[0];
  assert.equal(parsed.columns, 2);
  assert.deepEqual(parsed.rows[0], ["Term", ""]);
  assert.equal(harness.editor.getCursor().line, 0);
});

test("Tab at the last header cell adds a column through the editor path", async () => {
  const { plugin, editor: ed } = await keyPlugin();
  const spans = editor.rowCellSpans(ed.getLine(2));
  ed.setCursor({ line: 2, ch: spans[1].start });
  const event = keyEvent("Tab");
  assert.equal(plugin.onTableEditorKeydown(event), true);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  const parsed = editor.parseTables(ed.getValue())[0];
  assert.equal(parsed.columns, 3);
  assert.deepEqual(parsed.rows[0], ["Term", "Meaning", ""]);
  assert.equal(ed.getCursor().line, 2);
});

test("the next-cell command starts a table from a bare pipe", async () => {
  const harness = await tablePlugin("| Term", { line: 0, ch: 0 });
  harness.plugin.settings.tableEditor = { ...editor.normalizeTableEditorSettings({ enabled: true }) };
  const result = await harness.plugin.runTableAction("next-cell");
  assert.equal(result.ok, true);
  assert.equal(editor.parseTables(harness.editor.getValue())[0].columns, 2);
});

/* ---- formatting a draft, as upstream's format command does ---- */

test("the format command completes a draft pipe table with one column", async () => {
  const harness = await tablePlugin("| Term", { line: 0, ch: 5 });
  harness.plugin.settings.tableEditor = { ...editor.normalizeTableEditorSettings({ enabled: true }) };
  const result = await harness.plugin.runTableAction("format");
  assert.equal(result.ok, true, "format completes the draft instead of refusing it");
  const text = harness.editor.getValue();
  const lines = text.split("\n");
  const parsed = editor.parseTables(text)[0];
  assert.equal(parsed.columns, 1, "the draft completes without gaining an empty column");
  assert.deepEqual(parsed.rows, [["Term"]]);
  assert.equal(lines.length, 2, "the delimiter row was written");
  assert.match(lines[1], /^\| -+ \|$/, "the second line is a delimiter row");
});

test("formatting a normal table leaves its rows, columns and text alone", async () => {
  const canonical = editor.renderTable(editor.parseTables(NOTE)[0]).join("\n");
  const harness = await tablePlugin(canonical, { line: 0, ch: 2 });
  harness.plugin.settings.tableEditor = { ...editor.normalizeTableEditorSettings({ enabled: true }) };
  const result = await harness.plugin.runTableAction("format");
  assert.equal(result.ok, true);
  assert.equal(result.changed, false, "an already formatted table is not rewritten");
  assert.equal(harness.editor.getValue(), canonical, "the text is byte-identical");
  const parsed = editor.parseTables(harness.editor.getValue())[0];
  assert.equal(parsed.columns, 2, "no column was added to a finished table");
  assert.equal(parsed.rows.length, 3, "no row was added either");
  assert.deepEqual(parsed.rows, [["Term", "Meaning"], ["ATP", "Energy"], ["ADP", "Phosphate"]]);
});

/* ---- controls panel: opening, the ribbon button, touch visibility ---- */

test("the controls command opens a right leaf and reveals the panel again", async () => {
  const { plugin, app } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const leaves = [];
  const revealed = [];
  const leaf = {
    state: null,
    setViewState: async (state) => {
      leaf.state = state;
      leaves.push(leaf);
    },
  };
  app.workspace.getLeavesOfType = (type) => leaves.filter((entry) => !entry.state || entry.state.type === type);
  app.workspace.getRightLeaf = () => leaf;
  app.workspace.revealLeaf = (shown) => revealed.push(shown);

  const command = plugin.commands.find((entry) => entry.id === "tables-open-controls");
  assert.ok(command, "the panel command is registered");
  assert.equal(typeof command.callback, "function", "the panel command needs no cursor in a table");
  const first = await command.callback();
  assert.equal(first, leaf, "the command hands back the new leaf");
  assert.equal(leaves.length, 1, "it creates one right leaf");
  assert.equal(leaf.state.type, "question-tracker-table-controls", "the leaf holds the table controls view");
  assert.equal(leaf.state.active, true);
  assert.deepEqual(revealed, [leaf], "the new panel is revealed");

  const again = await plugin.openTableControls();
  assert.equal(again, leaf, "an open panel is reused");
  assert.equal(leaves.length, 1, "a second press does not create another leaf");
  assert.equal(revealed.length, 2, "the existing panel is revealed again");

  app.workspace.getLeavesOfType = () => [];
  app.workspace.getRightLeaf = () => null;
  assert.equal(await plugin.openTableControls(), null, "no right leaf means no panel, not a crash");
});

test("the ribbon button follows the Advanced Tables settings", async () => {
  const { plugin } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const added = [];
  const removed = [];
  plugin.addRibbonIcon = (icon, title, onClick) => {
    const handle = { icon, title, onClick, remove: () => removed.push(title) };
    added.push(handle);
    return handle;
  };
  plugin._tableRibbon = null;
  plugin.settings.tableEditor = {
    ...editor.normalizeTableEditorSettings({ enabled: true }),
    bindTab: true,
    bindEnter: true,
    padCells: true,
    showRibbon: true,
  };
  let opened = 0;
  plugin.openTableControls = async () => {
    opened += 1;
    return null;
  };

  await plugin.onTableEditorToggled();
  assert.equal(added.length, 1, "enabling the module adds one ribbon button");
  assert.equal(added[0].icon, "table");
  assert.equal(added[0].title, "Advanced Tables: controls");
  assert.equal(plugin._tableRibbon, added[0], "the plugin keeps the button handle");
  await added[0].onClick();
  assert.equal(opened, 1, "the ribbon button opens the controls panel");

  plugin.settings.tableEditor = { ...plugin.settings.tableEditor, showRibbon: false };
  await plugin.onTableEditorToggled();
  assert.deepEqual(removed, ["Advanced Tables: controls"], "turning the setting off removes it");
  assert.equal(plugin._tableRibbon, null, "the stale handle is dropped");

  plugin.settings.tableEditor = { ...plugin.settings.tableEditor, enabled: false, showRibbon: true };
  await plugin.onTableEditorToggled();
  assert.equal(added.length, 1, "the module switch keeps the button off");
  assert.equal(removed.length, 1, "and does not remove it twice");
});

test("touch devices keep the reading-view toolbar visible without a hover", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const base = css.match(/(^|\n)\.qt-table-toolbar \{([^}]*)\}/);
  assert.ok(base, "the toolbar has a base rule");
  assert.match(base[2], /opacity:\s*0/, "it starts hidden on a pointer device");
  assert.match(base[2], /pointer-events:\s*none/);

  const media = css.match(/@media \(hover: none\) \{([\s\S]*?)\n\}/);
  assert.ok(media, "a hoverless media query exists");
  const touch = media[1].match(/\.qt-table-toolbar \{([^}]*)\}/);
  assert.ok(touch, "the hoverless query targets the toolbar");
  assert.match(touch[1], /opacity:\s*1/, "a touch device sees it with no hover");
  assert.match(touch[1], /pointer-events:\s*auto/, "and its buttons stay clickable");
});


/* ---- upstream extras: tab-delimited copy and the double-binding notice ---- */

test("the CSV dialog can copy tab-separated rows", async () => {
  const { plugin } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const writes = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value) => writes.push(value) } } });
  const modal = new TableCsvModal(plugin.app, editor.parseTables(NOTE)[0]);
  modal.contentEl = makeDom().root;
  modal.onOpen();
  assert.equal(modal.csv(), "Term,Meaning\nATP,Energy\nADP,Phosphate\n");
  modal.useTabs = true;
  const tsv = "Term\tMeaning\nATP\tEnergy\nADP\tPhosphate\n";
  assert.equal(modal.csv(), tsv);
  await modal.copy();
  assert.equal(writes[writes.length - 1], tsv, "the clipboard gets tabs");
});

test("the navigation commands warn when their key binding is also on", async () => {
  const { plugin } = await tablePlugin(NOTE, { line: 4, ch: 2 });
  const calls = [];
  const real = plugin.noticeDoubleBinding.bind(plugin);
  plugin.noticeDoubleBinding = (action) => {
    calls.push(action);
    return real(action);
  };
  plugin.commands.find((entry) => entry.id === "tables-next-cell").checkCallback(false);
  assert.deepEqual(calls, ["next-cell"], "the command path asks before it moves");

  plugin.settings.tableEditor = { ...editor.normalizeTableEditorSettings({ enabled: true }), bindTab: false, bindEnter: true };
  assert.equal(real("next-cell"), false, "no warning when Tab is not bound");
  assert.equal(real("previous-cell"), false);
  assert.equal(real("next-row"), true, "Enter is still bound");

  plugin.settings.tableEditor = { ...plugin.settings.tableEditor, bindEnter: false };
  assert.equal(real("next-row"), false);

  plugin.settings.tableEditor = { ...plugin.settings.tableEditor, bindTab: true, bindEnter: true };
  const platform = obsidian.Platform;
  const wasMobile = platform.isMobile;
  platform.isMobile = true;
  assert.equal(real("next-cell"), false, "mobile has no physical keys to double up");
  assert.equal(real("next-row"), false);
  platform.isMobile = wasMobile;
  assert.equal(real("next-cell"), true, "and the desktop warning comes back");
});

/* ---- every command action that had no direct plugin-path test ---- */

test("the remaining table commands change the table through the plugin path", async () => {
  const base = "| Name | Score |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n| C | 3 |";
  const cases = [
    ["insert-row-above", { line: 2, ch: 2 }, (table) => table.rows.length === 5],
    ["insert-row-below", { line: 2, ch: 2 }, (table) => table.rows.length === 5],
    ["insert-column-left", { line: 2, ch: 2 }, (table) => table.columns === 3],
    ["insert-column-right", { line: 2, ch: 2 }, (table) => table.columns === 3],
    ["delete-row", { line: 2, ch: 2 }, (table) => table.rows.length === 3],
    ["delete-column", { line: 2, ch: 2 }, (table) => table.columns === 1],
    ["move-row-up", { line: 3, ch: 2 }, (table) => table.rows[1][0] === "B"],
    ["move-row-down", { line: 2, ch: 2 }, (table) => table.rows[1][0] === "B"],
    ["move-column-left", { line: 2, ch: 8 }, (table) => table.header[0] === "Score"],
    ["move-column-right", { line: 2, ch: 2 }, (table) => table.header[0] === "Score"],
    ["align-left", { line: 2, ch: 2 }, (table) => table.align[0] === "left"],
    ["align-center", { line: 2, ch: 2 }, (table) => table.align[0] === "center"],
    ["align-right", { line: 2, ch: 2 }, (table) => table.align[0] === "right"],
    ["align-default", { line: 2, ch: 2 }, (table) => table.align[0] === "none", "| Name | Score |\n| :--- | :--- |\n| A | 1 |\n| B | 2 |\n| C | 3 |"],
    ["sort-asc", { line: 2, ch: 8 }, (table) => table.rows[1][1] === "1"],
    ["sort-desc", { line: 2, ch: 8 }, (table) => table.rows[1][1] === "3"],
    ["transpose", { line: 2, ch: 2 }, (table) => table.columns === 4],
  ];
  for (const [action, cursor, check, source] of cases) {
    const harness = await tablePlugin(source || base, cursor);
    const result = await harness.plugin.runTableAction(action);
    assert.notEqual(result && result.ok, false, `${action} is applied instead of refusing`);
    const table = editor.parseTables(harness.editor.getValue())[0];
    assert.ok(check(table), `${action} produced the documented table`);
  }
});
