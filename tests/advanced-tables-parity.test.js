"use strict";
/*
 * Proves the pinned upstream audit is complete and true. Every row in
 * docs/installed-plugin-parity.md must cite the upstream symbol it derives from,
 * name code that exists in this repo, and cite a test that exists and carries
 * that name. A missing row, a renamed function or a deleted test fails here.
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
const HEADING = "## Advanced Tables: upstream audit (pinned)";
const SHA = "1a222399690f1d014d4bc95bf9ccf162ee5d7c75";
const start = doc.indexOf(HEADING);
assert.notEqual(start, -1, "the parity doc carries the pinned upstream audit");
const section = doc.slice(start);
assert.ok(section.includes(SHA), "the audit names the audited commit");

const block = (from, to) => {
  const a = section.indexOf(from);
  assert.notEqual(a, -1, `${from} exists`);
  const b = to ? section.indexOf(to, a) : section.length;
  assert.notEqual(b, -1, `${to} follows ${from}`);
  return section.slice(a, b);
};
const cells = (line) => line.split("|").slice(1, -1).map((cell) => cell.trim());
const rowsIn = (text) =>
  text.split("\n").filter((line) => line.startsWith("| `") || line.startsWith("| **")).map(cells);
const ticks = (value) => [...String(value).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const files = (value) => ticks(value).filter((token) => token.endsWith(".js"));
const functions = (value) =>
  ticks(value).filter((token) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token) && !token.endsWith(".js") && !token.endsWith(".ts"));
const italic = (value) => {
  const match = String(value).match(/\*([^*]+)\*/);
  return match ? match[1] : "";
};
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const testNames = (rel) => [...read(rel).matchAll(/\btest\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);

const commandRows = rowsIn(block("### Commands", "### Settings"));
const settingRows = rowsIn(block("### Settings", "### Behaviours"));
const behaviourRows = rowsIn(block("### Behaviours", "### Exceptions"));

const UPSTREAM_COMMANDS = [
  "next-row", "next-cell", "previous-cell", "format-table", "format-all-tables",
  "insert-column", "insert-row", "escape-table", "left-align-column",
  "center-align-column", "right-align-column", "move-column-left",
  "move-column-right", "move-row-up", "move-row-down", "delete-column",
  "delete-row", "sort-rows-ascending", "sort-rows-descending", "transpose",
  "evaluate-formulas", "table-control-bar",
];
const UPSTREAM_SETTINGS = ["formatType", "showRibbonIcon", "bindEnter", "bindTab"];

test("the audit enumerates all 22 upstream commands, each registered here", async () => {
  assert.equal(commandRows.length, UPSTREAM_COMMANDS.length, "one row per upstream command");
  assert.deepEqual(commandRows.map((row) => ticks(row[0])[0]).sort(), UPSTREAM_COMMANDS.slice().sort());

  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const registered = plugin.commands.map((command) => command.id);
  for (const row of commandRows) {
    const upstream = ticks(row[0])[0];
    const ours = ticks(row[3])[0];
    assert.ok(registered.includes(ours), `${upstream} maps to the registered command ${ours}`);
    assert.ok(ticks(row[2]).includes(upstream), `${upstream} cites the upstream id in src/main.ts`);
    assert.ok(/src\/main\.ts/.test(row[2]), `${upstream} names the upstream registration file`);
    assert.ok(/lib\/table-editor\.js|lib\/formatter\.js|src\/table-editor\.ts|src\/table-controls-view\.ts/.test(row[2]), `${upstream} names the upstream handler`);
  }
});

test("every audited command names implementing code and an existing test", () => {
  for (const row of commandRows) {
    const upstream = ticks(row[0])[0];
    const impl = files(row[4]);
    assert.ok(impl.length > 0, `${upstream} names its implementing file`);
    const implText = impl.map(read).join("\n");
    for (const name of functions(row[4])) {
      assert.ok(implText.includes(name), `${upstream}: ${name} exists in ${impl.join(", ")}`);
    }
    const testFile = files(row[5])[0];
    assert.ok(testNames(testFile).includes(italic(row[5])), `${upstream}: "${italic(row[5])}" exists in ${testFile}`);
  }
});

test("the four settings cite src/settings.ts and map to real fields", () => {
  assert.equal(settingRows.length, UPSTREAM_SETTINGS.length);
  assert.deepEqual(settingRows.map((row) => ticks(row[0])[0]).sort(), UPSTREAM_SETTINGS.slice().sort());
  const settingsText = read("src/table-editor.js");
  for (const row of settingRows) {
    const upstream = ticks(row[0])[0];
    const ours = ticks(row[3])[0];
    assert.match(row[2], /src\/settings\.ts/, `${upstream} cites src/settings.ts`);
    assert.ok(settingsText.includes(ours + ":"), `${upstream} maps to the real setting "${ours}"`);
    assert.ok(testNames(files(row[5])[0]).includes(italic(row[5])), `${upstream} cites an existing test`);
  }
});

test("every behaviour row cites its upstream symbol and an existing test", () => {
  assert.ok(behaviourRows.length >= 20, `the audit enumerates the behaviours (${behaviourRows.length} rows)`);
  for (const row of behaviourRows) {
    const label = row[0];
    const upstreamSource = row[1];
    if (!/upstream: none/.test(upstreamSource)) {
      assert.ok(/lib\/|src\//.test(upstreamSource), `${label} names the upstream source file`);
      assert.ok(ticks(upstreamSource).length > 0, `${label} names the upstream symbol`);
    }
    const impl = files(row[2]);
    assert.ok(impl.length > 0, `${label} names its implementing file`);
    const implText = impl.map(read).join("\n");
    for (const name of functions(row[2])) {
      assert.ok(implText.includes(name), `${label}: ${name} exists in ${impl.join(", ")}`);
    }
    assert.ok(testNames(files(row[3])[0]).includes(italic(row[3])), `${label}: "${italic(row[3])}" exists in ${files(row[3])[0]}`);
  }
});

test("exceptions are explicit owner decisions with reasons, donation buttons among them", () => {
  const exceptions = block("### Exceptions and owner decisions").split("\n").filter((line) => /^- \*\*/.test(line));
  assert.ok(exceptions.length >= 3, "the audit lists its exceptions");
  assert.ok(exceptions.some((line) => /donation buttons/i.test(line)), "donation buttons stay an owner decision");
  for (const line of exceptions) {
    assert.match(line, /Owner decision\.$/, "every exception ends as an owner decision");
    assert.ok(line.length > 120, "and carries its reason");
  }
});
