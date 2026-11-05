"use strict";
/*
 * Audits this plugin against the real upstream repository, not against our own
 * docs: tgrosinger/advanced-tables-obsidian@1a222399690f1d014d4bc95bf9ccf162ee5d7c75
 * (0.23.2) with @tgrosinger/md-advanced-tables@3.11.0. Each test reproduces a
 * behaviour read out of that source, so a regression fails the suite.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const editor = T.tableEditor;
const NOTE = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n| ADP | Phosphate |";

function fakeEditor(value, cursor) {
  let lines = String(value).split("\n");
  let position = { line: 0, ch: 0, ...(cursor || {}) };
  return {
    getValue: () => lines.join("\n"),
    lineCount: () => lines.length,
    getLine: (line) => lines[line],
    getCursor: () => ({ ...position }),
    setCursor: (next) => { position = { line: next.line, ch: next.ch || 0 }; },
    cursor: () => ({ ...position }),
    setValue(next) { lines = String(next).split("\n"); },
    replaceRange(insert, from, to) {
      const end = to || from;
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
}

async function tablePlugin(note, cursor) {
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  const ed = fakeEditor(note, cursor);
  app.workspace.activeEditor = { file: app.files[0], editor: ed };
  return { app, plugin, editor: ed };
}

/* ---- sortRows: upstream decides numeric per column, strips Markdown, reverses on desc ---- */

test("sorting matches upstream: numeric columns by value, mixed columns as stripped text", () => {
  const numeric = editor.parseTables("| N | V |\n| --- | --- |\n| a | 10 |\n| b | 9 |\n| c | 2 |")[0];
  const byValue = editor.sortTable(numeric, 1, "asc");
  assert.deepEqual(byValue.table.rows.slice(1).map((row) => row[0]), ["c", "b", "a"], "2 < 9 < 10");

  const mixed = editor.parseTables("| N | V |\n| --- | --- |\n| x | 9 |\n| y | 10 |\n| z | abc |")[0];
  const asText = editor.sortTable(mixed, 1, "asc");
  assert.deepEqual(asText.table.rows.slice(1).map((row) => row[0]), ["y", "x", "z"], "one non-number makes the column text, so 10 sorts before 9");
});

test("sorting strips emphasis markers and compares case-sensitively like upstream", () => {
  const source = "| N | V |\n| --- | --- |\n| A | **b** |\n| B | a |\n| C | Banana |\n| D | apple |";
  const table = editor.parseTables(source)[0];
  const asc = editor.sortTable(table, 1, "asc");
  assert.deepEqual(asc.table.rows.slice(1).map((row) => row[0]), ["C", "B", "D", "A"], "Banana < a < apple < b and emphasis is stripped");
});

test("a descending sort reverses the ascending result, so ties flip and blanks trail", () => {
  const source = "| N | V |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n| C | 1 |\n| D | |";
  const table = editor.parseTables(source)[0];
  const asc = editor.sortTable(table, 1, "asc");
  assert.deepEqual(asc.table.rows.slice(1).map((row) => row[0]), ["D", "A", "C", "B"]);
  const desc = editor.sortTable(table, 1, "desc");
  assert.deepEqual(desc.table.rows.slice(1).map((row) => row[0]), ["B", "C", "A", "D"], "upstream calls .reverse() on the sorted body");
});

/* ---- exportCSV: upstream joins raw cell text with tabs, no quoting ---- */

test("tab export is upstream's raw tab join, while comma export keeps our quoting", () => {
  const table = editor.parseTables('| A | B |\n| --- | --- |\n| say "hi" | =1+1 |')[0];
  const tabs = editor.tableCsvFromTable(table, { delimiter: "\t" });
  assert.equal(tabs.csv, 'A\tB\nsay "hi"\t=1+1\n', "no quotes and no injection prefix, exactly row.join('\\t')");
  const comma = editor.tableCsvFromTable(table);
  assert.equal(comma.csv, 'A,B\n"say ""hi""",\'=1+1\n');
  const noHeader = editor.tableCsvFromTable(table, { header: false, delimiter: "\t" });
  assert.equal(noHeader.csv, 'say "hi"\t=1+1\n');
});

/* ---- acceptsTableEdit: a table under `-tx-` is left alone (upstream issue #133) ---- */

test("a table under a -tx- marker is not edited, as upstream's acceptsTableEdit does", () => {
  const blocked = "-tx-\n| A | B |\n| --- | --- |\n| 1 | 2 |";
  assert.equal(editor.tableAtLine(blocked, 1), null, "the commands do not see a table there");
  assert.equal(editor.formatTableAt(blocked, 1, {}).reason, "not-table");
  const all = editor.formatAllTables(blocked, {});
  assert.equal(all.ok, true);
  assert.equal(all.changed, false, "formatting every table leaves it untouched");
  assert.equal(all.skipped, 1);

  const free = "| A | B |\n| --- | --- |\n| 1 | 2 |";
  assert.ok(editor.tableAtLine(free, 1), "the same table without the marker is editable");
  assert.equal(editor.formatAllTables(free, {}).ok, true);
});

/* ---- insertRow: a header-row insert lands below the header ---- */

test("inserting a row above from the header lands under the header, as upstream's insertRow does", () => {
  const table = editor.parseTables("| H1 | H2 |\n| --- | --- |\n| a | b |")[0];
  const inserted = editor.structureTable(table, "row-insert-above", 0, 0);
  assert.equal(inserted.ok, true);
  assert.deepEqual(inserted.table.rows[0], ["H1", "H2"], "the header stays first");
  assert.deepEqual(inserted.table.rows[1], ["", ""], "the new row is the first body row");
  assert.deepEqual(inserted.table.rows[2], ["a", "b"]);
});

/* ---- evaluate-formulas: offered on the formula line, like cursorIsInTableFormula ---- */

test("the formula command is offered and works with the cursor on the TBLFM line", async () => {
  const note = [
    "| Item | Value |",
    "| --- | --- |",
    "| A | 2 |",
    "| B | 4 |",
    "| Total | |",
    "<!-- TBLFM: @>$2=sum(@I..@-1) -->",
  ].join("\n");
  const { plugin, editor: ed } = await tablePlugin(note, { line: 5, ch: 0 });
  const command = plugin.commands.find((entry) => entry.id === "tables-formulas");
  assert.equal(command.checkCallback(true), true, "upstream checks cursorIsInTableFormula too");
  await plugin.runTableAction("formulas");
  assert.match(ed.getValue(), /\| Total\s+\| 6\s+\|/, "the Total row is evaluated from the formula line");
});

/* ---- notices: upstream's exact strings, desktop only ---- */

test("the double-binding notices use upstream's exact wording and stay off on mobile", async () => {
  const { plugin } = await tablePlugin(NOTE, { line: 2, ch: 2 });
  const platform = obsidian.Platform;
  const wasMobile = platform.isMobile;
  platform.isMobile = false;
  obsidian.notices.length = 0;

  assert.equal(plugin.noticeDoubleBinding("next-cell"), true);
  assert.equal(obsidian.notices.at(-1), "Advanced Tables: Next cell also bound to tab. Possibly producing double actions. See Advanced Tables settings.");
  assert.equal(plugin.noticeDoubleBinding("previous-cell"), true);
  assert.equal(obsidian.notices.at(-1), "Advanced Tables: Previous cell also bound to shift+tab. Possibly producing double actions. See Advanced Tables settings.");
  assert.equal(plugin.noticeDoubleBinding("next-row"), true);
  assert.equal(obsidian.notices.at(-1), "Advanced Tables: Next row also bound to enter. Possibly producing double actions. See Advanced Tables settings.");

  const before = obsidian.notices.length;
  platform.isMobile = true;
  for (const action of ["next-cell", "previous-cell", "next-row"]) {
    assert.equal(plugin.noticeDoubleBinding(action), false);
  }
  assert.equal(obsidian.notices.length, before, "mobile has no physical keys to double up");
  platform.isMobile = wasMobile;

  plugin.settings.tableEditor = { ...editor.normalizeTableEditorSettings({ enabled: true }), bindTab: false };
  assert.equal(plugin.noticeDoubleBinding("next-cell"), false, "no warning when Tab is not bound");
});

/* ---- settings: upstream's four defaults, reproduced ---- */

test("the four upstream settings default exactly as settings.ts does", () => {
  const settings = editor.normalizeTableEditorSettings({});
  assert.equal(settings.padCells, true, "formatType defaults to NORMAL");
  assert.equal(settings.showRibbon, true, "showRibbonIcon defaults to true");
  assert.equal(settings.bindEnter, true, "bindEnter defaults to true");
  assert.equal(settings.bindTab, true, "bindTab defaults to true");
  assert.equal(editor.normalizeTableEditorSettings({ padCells: false }).padCells, false, "WEAK stays reachable");
});
