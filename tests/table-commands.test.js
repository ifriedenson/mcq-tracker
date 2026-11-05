"use strict";
/*
 * The Advanced Tables parity surface: source-editor commands (navigation,
 * format, insert above/left, escape), the CSV dialog with its header switch,
 * and the docked controls panel. The engine helpers are exercised directly;
 * the plugin paths run through a fake editor so a write can be read back.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
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
  assert.deepEqual(header.table.rows[0], ["", ""], "a new row above row 0 becomes the header");
  assert.deepEqual(header.table.rows[1], ["Term", "Meaning"]);

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

test("next cell walks the row, wraps to the next row and then asks for a new row", () => {
  const first = editor.nextCellTarget(NOTE, 2, 2);
  assert.deepEqual({ line: first.line, ch: first.ch }, { line: 2, ch: 9 });
  const wrapped = editor.nextCellTarget(NOTE, 2, 13);
  assert.equal(wrapped.line, 4, "the delimiter row is skipped");
  assert.equal(wrapped.ch, 2);
  const end = editor.nextCellTarget(NOTE, 5, 13);
  assert.equal(end.append, true, "the last cell asks for one more row");
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
