"use strict";
/*
 * Proves the parity report is complete and true rather than asserted. Every
 * upstream command id, setting and user-visible behaviour in
 * docs/installed-plugin-parity.md must name code that exists in this repo and a
 * test that exists and mentions it. A missing row, a renamed function or a
 * deleted test fails here.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ROOT = path.join(__dirname, "..");
const doc = fs.readFileSync(path.join(ROOT, "docs", "installed-plugin-parity.md"), "utf8");
const HEADING = "## Advanced Tables: the complete upstream surface";
const start = doc.indexOf(HEADING);
assert.notEqual(start, -1, "the parity doc carries the complete-upstream-surface section");
const section = doc.slice(start);
const rows = section.split("\n").filter((line) => line.startsWith("| `") || line.startsWith("| **"));
const cells = (line) => line.split("|").slice(1, -1).map((cell) => cell.trim());
const ticks = (value) => [...String(value).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const files = (value) => ticks(value).filter((token) => token.endsWith(".js"));
const functions = (value) => ticks(value).filter((token) => !token.endsWith(".js") && !token.includes("/"));
const italic = (value) => {
  const match = String(value).match(/\*([^*]+)\*/);
  return match ? match[1] : "";
};
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const testNames = (rel) => [...read(rel).matchAll(/\btest\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);

const commandRows = rows.map(cells).filter((row) => row.length === 5 && ticks(row[2])[0] && ticks(row[2])[0].startsWith("tables-"));
const settingRows = rows.map(cells).filter((row) => row.length === 5 && row[0].startsWith("`") && !ticks(row[2])[0].startsWith("tables-"));
const behaviourRows = rows.map(cells).filter((row) => row.length === 3 && row[0].startsWith("**"));

const UPSTREAM_COMMANDS = [
  "next-row", "next-cell", "previous-cell", "format-table", "format-all-tables",
  "insert-column", "insert-row", "escape-table", "left-align-column",
  "center-align-column", "right-align-column", "move-column-left",
  "move-column-right", "move-row-up", "move-row-down", "delete-column",
  "delete-row", "sort-rows-ascending", "sort-rows-descending", "transpose",
  "evaluate-formulas", "table-control-bar",
];
const UPSTREAM_SETTINGS = ["formatType", "showRibbonIcon", "bindEnter", "bindTab"];

test("the report enumerates all 22 upstream commands and each one is registered", async () => {
  assert.equal(commandRows.length, UPSTREAM_COMMANDS.length, "one row per upstream command");
  const listed = commandRows.map((row) => ticks(row[0])[0]);
  assert.deepEqual(listed.slice().sort(), UPSTREAM_COMMANDS.slice().sort(), "every upstream id appears once");

  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const registered = plugin.commands.map((command) => command.id);
  for (const row of commandRows) {
    const ours = ticks(row[2])[0];
    assert.ok(registered.includes(ours), `${ticks(row[0])[0]} maps to the registered command ${ours}`);
  }
});

test("every reported command names real code and a test that exists", () => {
  for (const row of commandRows) {
    const upstream = ticks(row[0])[0];
    const impl = files(row[3]);
    assert.ok(impl.length > 0, `${upstream} names its implementing file`);
    const implText = impl.map(read).join("\n");
    for (const name of functions(row[3])) {
      assert.ok(implText.includes(name), `${upstream}: ${name} exists in ${impl.join(", ")}`);
    }
    const testFile = files(row[4])[0];
    const name = italic(row[4]);
    assert.ok(name, `${upstream} cites a test name`);
    assert.ok(testNames(testFile).includes(name), `${upstream}: "${name}" exists in ${testFile}`);
  }
});

test("the four upstream settings are mapped to real fields", () => {
  assert.equal(settingRows.length, UPSTREAM_SETTINGS.length, "one row per upstream setting");
  const listed = settingRows.map((row) => ticks(row[0])[0]);
  assert.deepEqual(listed.slice().sort(), UPSTREAM_SETTINGS.slice().sort(), "every upstream setting appears once");
  const settingsText = read("src/table-editor.js");
  for (const row of settingRows) {
    const ours = ticks(row[2])[0];
    assert.ok(settingsText.includes(ours + ":"), `${ticks(row[0])[0]} maps to the real setting "${ours}"`);
    const testFile = files(row[4])[0];
    assert.ok(testNames(testFile).includes(italic(row[4])), `${ticks(row[0])[0]} cites an existing test`);
  }
});

test("every user-visible behaviour row cites real code and an existing test", () => {
  assert.ok(behaviourRows.length >= 15, `the report enumerates the behaviours (${behaviourRows.length} rows)`);
  for (const row of behaviourRows) {
    const label = row[0];
    const impl = files(row[1]);
    assert.ok(impl.length > 0, `${label} names its implementing file`);
    const implText = impl.map(read).join("\n");
    for (const name of functions(row[1])) {
      assert.ok(implText.includes(name), `${label}: ${name} exists in ${impl.join(", ")}`);
    }
    const testFile = files(row[2])[0];
    assert.ok(testNames(testFile).includes(italic(row[2])), `${label}: "${italic(row[2])}" exists in ${testFile}`);
  }
});

test("donation buttons are the only item left to the owner", () => {
  const owner = section.slice(section.indexOf("### Left to the owner"));
  const flagged = owner.split("\n").filter((line) => /^- \*\*/.test(line));
  assert.equal(flagged.length, 1, "exactly one owner-decision item remains");
  assert.match(flagged[0], /donation buttons/i, "and it is the donation buttons");
});
