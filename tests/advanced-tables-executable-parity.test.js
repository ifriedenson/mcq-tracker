"use strict";
/*
 * Executable Advanced Tables parity. Every upstream command, setting and named
 * behaviour is run against this plugin's own code, so the "superset" claim in
 * docs/installed-plugin-parity.md is a measurement, not a reading of the table.
 *
 * Upstream reference: tgrosinger/advanced-tables-obsidian at
 * 1a222399690f1d014d4bc95bf9ccf162ee5d7c75 (0.23.2), library
 * @tgrosinger/md-advanced-tables 3.11.0.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const engine = T.tableEditor;
const VIEW_TYPE = "question-tracker-table-controls";

const TABLE = "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |\n| ADP | Phosphate |";

function fakeEditor(value, cursor) {
  let lines = String(value).split("\n");
  let position = { line: 0, ch: 0, ...(cursor || {}) };
  const handle = {
    ranges: [],
    setValues: 0,
    getValue: () => lines.join("\n"),
    lineCount: () => lines.length,
    getLine: (line) => lines[line],
    getCursor: () => ({ ...position }),
    setCursor: (next) => {
      position = { line: next.line, ch: next.ch || 0 };
    },
    cursor: () => ({ ...position }),
    setValue(next) {
      handle.setValues += 1;
      lines = String(next).split("\n");
    },
    replaceRange(insert, from, to) {
      const end = to || from;
      handle.ranges.push({ insert, from, to: end });
      const before = lines.slice(0, from.line);
      const head = lines[from.line].slice(0, from.ch) + String(insert).split("\n")[0];
      const inserted = String(insert).split("\n").slice(1);
      const tail = lines[end.line].slice(end.ch);
      if (inserted.length) {
        inserted[inserted.length - 1] += tail;
        lines = before.concat([head], inserted, lines.slice(end.line + 1));
      } else {
        lines = before.concat([head + tail], lines.slice(end.line + 1));
      }
    },
  };
  return handle;
}

async function tablePlugin(note, cursor, settings) {
  const app = makeApp([{ path: "note.md", text: note }]);
  const plugin = new QT(app);
  await plugin.onload();
  // onload normalizes saved settings, so the module is switched on afterwards.
  plugin.settings.tableEditor = { ...engine.normalizeTableEditorSettings({ enabled: true }), ...(settings || {}) };
  const ed = fakeEditor(note, cursor);
  app.workspace.activeEditor = { file: app.files[0], editor: ed };
  return { app, plugin, editor: ed };
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

async function runCommand(plugin, id) {
  const entry = plugin.commands.find((command) => command.id === id);
  assert.ok(entry, `${id} is registered`);
  if (typeof entry.checkCallback === "function") {
    assert.equal(entry.checkCallback(true), true, `${id} is offered with the cursor in a table`);
    entry.checkCallback(false);
  } else {
    entry.callback();
  }
  await flush();
  return entry;
}

const parsed = (ed) => engine.parseTables(ed.getValue())[0];

/* ------------------------------------------------------------------ */
/* Commands: every upstream command runs here and does what it says.   */
/* ------------------------------------------------------------------ */

const COMMANDS = [
  {
    upstream: "next-cell",
    ours: "tables-next-cell",
    check: ({ editor: ed }) => {
      assert.deepEqual(ed.cursor(), { line: 0, ch: 9 });
      assert.equal(ed.ranges.length, 0, "moving the cursor is not an edit");
    },
  },
  {
    upstream: "previous-cell",
    ours: "tables-previous-cell",
    cursor: { line: 0, ch: 9 },
    check: ({ editor: ed }) => {
      assert.deepEqual(ed.cursor(), { line: 0, ch: 2 });
    },
  },
  {
    upstream: "next-row",
    ours: "tables-next-row",
    check: ({ editor: ed }) => {
      assert.deepEqual(ed.cursor(), { line: 2, ch: 2 });
    },
  },
  {
    upstream: "format-table",
    ours: "tables-format",
    note: "|A|Bee|\n|-|-|\n|1|2|",
    cursor: { line: 0, ch: 1 },
    check: ({ editor: ed }) => {
      assert.equal(ed.getValue().split("\n")[0], "| A   | Bee |");
      assert.equal(ed.ranges.length, 1, "one write for one command");
    },
  },
  {
    upstream: "format-all-tables",
    ours: "tables-format-all",
    note: "|a|b|\n|-|-|\n|1|2|\n\n|c|d|\n|-|-|\n|3|4|",
    cursor: { line: 2, ch: 1 },
    check: ({ editor: ed }) => {
      assert.equal(ed.getValue().split("\n")[0], "| a   | b   |");
      assert.equal(ed.getValue().split("\n")[4], "| c   | d   |");
      assert.equal(ed.setValues, 1);
    },
  },
  {
    upstream: "insert-column",
    ours: "tables-insert-column-right",
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).header, ["Term", "", "Meaning"]);
      assert.ok(parsed(ed).rows.every((row) => row.length === 3));
    },
  },
  {
    upstream: "insert-row",
    ours: "tables-insert-row-below",
    cursor: { line: 2, ch: 3 },
    check: ({ editor: ed }) => {
      const table = parsed(ed);
      assert.deepEqual(table.rows[1], ["ATP", "Energy"]);
      assert.deepEqual(table.rows[2], ["", ""], "the new row sits below the cursor's row");
      assert.deepEqual(table.rows[3], ["ADP", "Phosphate"]);
    },
  },
  {
    upstream: "escape-table",
    ours: "tables-escape",
    cursor: { line: 3, ch: 2 },
    check: ({ editor: ed }) => {
      assert.equal(ed.cursor().line, 4);
      assert.equal(ed.cursor().ch, 0);
    },
  },
  {
    upstream: "left-align-column",
    ours: "tables-align-left",
    check: ({ editor: ed }) => {
      assert.equal(parsed(ed).align[0], "left");
      assert.match(ed.getValue().split("\n")[1], /^\| :--- \|/);
    },
  },
  {
    upstream: "center-align-column",
    ours: "tables-align-center",
    check: ({ editor: ed }) => {
      assert.equal(parsed(ed).align[0], "center");
      assert.match(ed.getValue().split("\n")[1], /^\| :---: \|/);
    },
  },
  {
    upstream: "right-align-column",
    ours: "tables-align-right",
    check: ({ editor: ed }) => {
      assert.equal(parsed(ed).align[0], "right");
      assert.match(ed.getValue().split("\n")[1], /^\| ---: \|/);
    },
  },
  {
    upstream: "move-column-left",
    ours: "tables-move-column-left",
    cursor: { line: 0, ch: 9 },
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).header, ["Meaning", "Term"]);
      assert.deepEqual(parsed(ed).rows[1], ["Energy", "ATP"]);
    },
  },
  {
    upstream: "move-column-right",
    ours: "tables-move-column-right",
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).header, ["Meaning", "Term"]);
    },
  },
  {
    upstream: "move-row-up",
    ours: "tables-move-row-up",
    cursor: { line: 3, ch: 2 },
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).rows[1], ["ADP", "Phosphate"]);
      assert.deepEqual(parsed(ed).rows[2], ["ATP", "Energy"]);
    },
  },
  {
    upstream: "move-row-down",
    ours: "tables-move-row-down",
    cursor: { line: 2, ch: 2 },
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).rows[1], ["ADP", "Phosphate"]);
    },
  },
  {
    upstream: "delete-column",
    ours: "tables-delete-column",
    check: ({ editor: ed }) => {
      const table = parsed(ed);
      assert.deepEqual(table.header, ["Meaning"]);
      assert.deepEqual(table.rows.slice(1), [["Energy"], ["Phosphate"]]);
    },
  },
  {
    upstream: "delete-row",
    ours: "tables-delete-row",
    cursor: { line: 2, ch: 3 },
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).rows.slice(1), [["ADP", "Phosphate"]]);
    },
  },
  {
    upstream: "sort-rows-ascending",
    ours: "tables-sort-asc",
    note: "| N | V |\n| --- | --- |\n| a | 10 |\n| b | 9 |\n| c | 2 |",
    cursor: { line: 2, ch: 9 },
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).rows.slice(1).map((row) => row[0]), ["c", "b", "a"], "2 < 9 < 10");
    },
  },
  {
    upstream: "sort-rows-descending",
    ours: "tables-sort-desc",
    note: "| N | V |\n| --- | --- |\n| a | 10 |\n| b | 9 |\n| c | 2 |",
    cursor: { line: 2, ch: 9 },
    check: ({ editor: ed }) => {
      assert.deepEqual(parsed(ed).rows.slice(1).map((row) => row[0]), ["a", "b", "c"], "descending reverses the ascending body");
    },
  },
  {
    upstream: "transpose",
    ours: "tables-transpose",
    check: ({ editor: ed }) => {
      const table = parsed(ed);
      assert.deepEqual(table.header, ["Term", "ATP", "ADP"]);
      assert.deepEqual(table.rows.slice(1), [["Meaning", "Energy", "Phosphate"]]);
    },
  },
  {
    upstream: "evaluate-formulas",
    ours: "tables-formulas",
    note: "| Item | Value |\n| --- | --- |\n| A | 2 |\n| B | 4 |\n| Total | |\n<!-- TBLFM: @>$2=sum(@I..@-1) -->",
    cursor: { line: 5, ch: 0 },
    check: ({ editor: ed }) => {
      assert.match(ed.getValue(), /\| Total\s+\| 6\s+\|/);
      assert.equal(ed.ranges.length, 1);
    },
  },
  {
    upstream: "table-control-bar",
    ours: "tables-open-controls",
    cursor: { line: 0, ch: 2 },
    controlBar: true,
    check: ({ opened }) => {
      assert.equal(opened.length, 1, "the controls panel is opened for the active table");
      assert.equal(opened[0].type, VIEW_TYPE);
    },
  },
];

test("all 22 upstream commands run through this plugin's own code", async () => {
  assert.equal(COMMANDS.length, 22, "the upstream command set is covered one for one");
  for (const entry of COMMANDS) {
    const note = entry.note || TABLE;
    const cursor = entry.cursor || { line: 0, ch: 2 };
    const harness = await tablePlugin(note, cursor);
    const opened = [];
    if (entry.controlBar) {
      harness.app.workspace.getLeavesOfType = () => [];
      harness.app.workspace.getRightLeaf = () => ({ setViewState: async (state) => opened.push(state) });
      harness.app.workspace.revealLeaf = () => {};
    }
    await runCommand(harness.plugin, entry.ours);
    entry.check({ ...harness, opened });
    assert.ok(harness.editor.ranges.length <= 1, `${entry.upstream} writes at most once`);
  }
});

/* ------------------------------------------------------------------ */
/* Behaviours named in the audit, driven through the plugin.           */
/* ------------------------------------------------------------------ */

test("sorting: numeric intent per column, stripped text, case-sensitive, descending reversal", async () => {
  const mixed = "| N | V |\n| --- | --- |\n| x | 9 |\n| y | 10 |\n| z | abc |";
  const mixedHarness = await tablePlugin(mixed, { line: 2, ch: 9 });
  await runCommand(mixedHarness.plugin, "tables-sort-asc");
  assert.deepEqual(parsed(mixedHarness.editor).rows.slice(1).map((row) => row[0]), ["y", "x", "z"], "one non-number makes the column text");

  const caseNote = "| N | V |\n| --- | --- |\n| A | **b** |\n| B | a |\n| C | Banana |\n| D | apple |";
  const caseHarness = await tablePlugin(caseNote, { line: 2, ch: 9 });
  await runCommand(caseHarness.plugin, "tables-sort-asc");
  assert.deepEqual(parsed(caseHarness.editor).rows.slice(1).map((row) => row[0]), ["C", "B", "D", "A"], "Banana < a < apple < b");
});

test("raw tab CSV, the -tx- guard and header insert behave as upstream", async () => {
  const tabTable = engine.parseTables('| A | B |\n| --- | --- |\n| say "hi" | =1+1 |')[0];
  assert.equal(engine.tableCsvFromTable(tabTable, { delimiter: "\t" }).csv, 'A\tB\nsay "hi"\t=1+1\n');
  assert.equal(engine.tableCsvFromTable(tabTable, { header: false, delimiter: "\t" }).csv, 'say "hi"\t=1+1\n');

  const guarded = await tablePlugin("-tx-\n| A | B |\n| --- | --- |\n| 1 | 2 |", { line: 1, ch: 2 });
  const format = guarded.plugin.commands.find((command) => command.id === "tables-format");
  assert.equal(format.checkCallback(true), false, "the command is not offered on a -tx- table");
  obsidian.notices.length = 0;
  const refused = await guarded.plugin.runTableAction("format");
  assert.equal(refused.reason, "not-table");
  assert.equal(obsidian.notices.at(-1), "Put the cursor in a table first.");
  assert.equal(guarded.editor.ranges.length, 0, "nothing is written");

  const header = await tablePlugin(TABLE, { line: 0, ch: 2 });
  await runCommand(header.plugin, "tables-insert-row-above");
  const table = parsed(header.editor);
  assert.deepEqual(table.rows[0], ["Term", "Meaning"]);
  assert.deepEqual(table.rows[1], ["", ""], "a header insert lands below the header");
  assert.deepEqual(table.rows[2], ["ATP", "Energy"]);
});

test("weak formatting writes single-spaced cells", async () => {
  const tight = "|A|Bee|\n|-|-|\n|1|2|";
  const normal = await tablePlugin(tight, { line: 1, ch: 1 });
  await runCommand(normal.plugin, "tables-format");
  assert.equal(normal.editor.getValue().split("\n")[0], "| A   | Bee |", "NORMAL pads columns");

  const weak = await tablePlugin(tight, { line: 1, ch: 1 }, { padCells: false });
  await runCommand(weak.plugin, "tables-format");
  assert.equal(weak.editor.getValue().split("\n")[0], "| A | Bee |", "WEAK keeps single spaces");
});

test("the double-binding notices keep upstream's exact wording", async () => {
  const { plugin } = await tablePlugin(TABLE, { line: 0, ch: 2 });
  const entry = plugin.commands.find((command) => command.id === "tables-next-cell");
  obsidian.notices.length = 0;
  entry.checkCallback(false);
  assert.equal(obsidian.notices.at(-1), "Advanced Tables: Next cell also bound to tab. Possibly producing double actions. See Advanced Tables settings.");
  await flush();
  obsidian.notices.length = 0;
  plugin.settings.tableEditor = { ...plugin.tableEditorSettings(), bindTab: false };
  entry.checkCallback(false);
  assert.equal(obsidian.notices.length, 0, "no warning when the key is not bound");
  await flush();
});

test("the four upstream settings default as settings.ts does and change behaviour", async () => {
  const defaults = engine.normalizeTableEditorSettings({});
  assert.deepEqual(
    { padCells: defaults.padCells, showRibbon: defaults.showRibbon, bindEnter: defaults.bindEnter, bindTab: defaults.bindTab },
    { padCells: true, showRibbon: true, bindEnter: true, bindTab: true }
  );

  const harness = await tablePlugin(TABLE, { line: 0, ch: 2 });
  const ribbons = [];
  harness.plugin.addRibbonIcon = () => {
    const handle = { removed: false, remove() { this.removed = true; } };
    ribbons.push(handle);
    return handle;
  };
  harness.plugin.settings.tableEditor = { ...engine.normalizeTableEditorSettings({ enabled: true }), showRibbon: true };
  await harness.plugin.onTableEditorToggled();
  assert.equal(ribbons.length, 1, "showRibbon adds the ribbon button");
  harness.plugin.settings.tableEditor = { ...harness.plugin.tableEditorSettings(), showRibbon: false };
  await harness.plugin.onTableEditorToggled();
  assert.equal(ribbons[0].removed, true, "turning it off removes the button");
});

/* ------------------------------------------------------------------ */
/* Keyboard: one press, one edit, and what that means for upstream.     */
/* ------------------------------------------------------------------ */

function keyTarget() {
  const editorNode = { tag: "cm-editor" };
  const target = { closest: (selector) => (selector === ".cm-editor" ? editorNode : null) };
  return { target, editorNode };
}

function keyEvent(key, extra) {
  const { target } = keyTarget();
  return {
    type: "keydown",
    key,
    target,
    shiftKey: false,
    isComposing: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    ...(extra || {}),
  };
}

/** Registers the plugin with registerDomEvent wrapped, and returns its keydown listener. */
async function registeredHandler(settings) {
  const original = obsidian.Plugin.prototype.registerDomEvent;
  const calls = [];
  obsidian.Plugin.prototype.registerDomEvent = function (target, name, fn, options) {
    calls.push({ target, name, fn, options });
  };
  const harness = await tablePlugin(TABLE, { line: 3, ch: 10 }, settings);
  obsidian.Plugin.prototype.registerDomEvent = original;
  const keydown = calls.filter((call) => call.name === "keydown" && call.options === true);
  assert.equal(keydown.length, 1, "one capture-phase keydown listener");
  return { ...harness, handler: keydown[0].fn };
}

/**
 * Mirrors DOM propagation: document capture runs first; a listener on the
 * editor element only sees the event if capture did not stop propagation.
 * That is exactly upstream's position: its keymap is bound inside CodeMirror
 * (src/main.ts makeEditorExtension), below the document.
 */
function press(handler, event, upstreamKeymap) {
  const handled = handler(event) === true;
  if (!event.propagationStopped) upstreamKeymap(event);
  return handled;
}

test("one Tab or Enter in a table produces exactly one edit", async () => {
  const note = "| A | B |\n| --- | --- |\n| 1 | 2 |";
  const harness = await tablePlugin(note, { line: 2, ch: 6 });
  let upstream = 0;
  const tab = keyEvent("Tab");
  const handled = press(harness.plugin.onTableEditorKeydown.bind(harness.plugin), tab, () => { upstream += 1; });
  await flush();
  assert.equal(handled, true, "the plugin consumes Tab inside a table");
  assert.equal(tab.defaultPrevented, true);
  assert.equal(tab.propagationStopped, true);
  assert.equal(harness.editor.ranges.length, 1, "exactly one write, not two");
  assert.equal(upstream, 0, "the CodeMirror keymap never sees the key");
  assert.equal(harness.editor.getValue().split("\n").length, 4, "one row was appended");

  const enterHarness = await tablePlugin(note, { line: 2, ch: 3 });
  let enterUpstream = 0;
  const enter = keyEvent("Enter");
  const enterHandled = press(enterHarness.plugin.onTableEditorKeydown.bind(enterHarness.plugin), enter, () => { enterUpstream += 1; });
  await flush();
  assert.equal(enterHandled, true);
  assert.equal(enterHarness.editor.ranges.length, 1);
  assert.equal(enterUpstream, 0);
});

test("upstream's keymap cannot fire in addition because the keypress is consumed first", async () => {
  const { plugin, editor: ed, handler } = await registeredHandler();
  let upstream = 0;
  const first = keyEvent("Tab");
  assert.equal(press(handler, first, () => { upstream += 1; }), true);
  await flush();
  assert.equal(ed.ranges.length, 1);
  assert.equal(upstream, 0, "with our module on, upstream's keymap is not reached");

  plugin.settings.tableEditor = { ...plugin.tableEditorSettings(), enabled: false };
  const before = ed.ranges.length;
  const second = keyEvent("Tab");
  assert.equal(press(handler, second, () => { upstream += 1; }), false, "a disabled module leaves the key alone");
  assert.equal(second.propagationStopped, false);
  assert.equal(upstream, 1, "upstream's keymap would handle the key when ours is off");
  assert.equal(ed.ranges.length, before, "and our code wrote nothing");

  plugin.settings.tableEditor = { ...plugin.tableEditorSettings(), enabled: true, bindTab: false };
  const third = keyEvent("Tab");
  assert.equal(press(handler, third, () => { upstream += 1; }), false, "bindTab off leaves Tab alone");
  assert.equal(upstream, 2);
  assert.equal(ed.ranges.length, before);

  const outside = await tablePlugin("Text only", { line: 0, ch: 0 });
  const fourth = keyEvent("Tab");
  assert.equal(outside.plugin.onTableEditorKeydown(fourth), false, "outside a table the key is untouched");
  assert.equal(fourth.propagationStopped, false);
});

test("the command ids are namespaced, so upstream-keyed automation would not reach them", async () => {
  const { plugin } = await tablePlugin(TABLE, { line: 0, ch: 2 });
  const ids = plugin.commands.map((command) => command.id);
  for (const upstreamId of ["next-cell", "insert-row", "format-table", "delete-row", "transpose"]) {
    assert.equal(ids.includes(upstreamId), false, `upstream's ${upstreamId} id is not reused`);
  }
  assert.ok(ids.includes("tables-next-cell"));
});
