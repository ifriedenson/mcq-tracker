"use strict";
/**
 * `docs/capability-inventory.md` is generated from the built bundle: one row per
 * module group, one row per registered command, and an explicit list of gaps.
 *
 * This test re-derives all of it. Deleting a function, renaming a group, adding
 * or removing a command, or dropping the test that cites a capability all fail
 * here, so the inventory cannot drift away from the code it describes.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ROOT = path.join(__dirname, "..");
const doc = fs.readFileSync(path.join(ROOT, "docs", "capability-inventory.md"), "utf8");
const testFiles = fs.readdirSync(path.join(ROOT, "tests")).filter((f) => f.endsWith(".test.js")).sort();
const testText = Object.fromEntries(testFiles.map((f) => [f, fs.readFileSync(path.join(ROOT, "tests", f), "utf8")]));
const cites = (group) => testFiles.filter((f) => testText[f].includes("T." + group));

/** The lines of one `## ` section, stopping at the next heading. */
function section(heading) {
  const lines = doc.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  assert.notEqual(start, -1, `docs/capability-inventory.md has a ${heading} section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function tableCells(line) {
  return line.replace(/^\|\s*/, "").replace(/\s*\|$/, "").split(" | ").map((cell) => cell.trim());
}

function backticked(cell) {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

const moduleRows = section("## Modules").split("\n").filter((line) => line.startsWith("| `"));
const commandRows = section("## Commands").split("\n").filter((line) => line.startsWith("| `"));
const gapText = section(doc.match(/^## Gaps \(\d+ groups, \d+ commands\)$/m) ? doc.match(/^## Gaps .*$/m)[0] : "## Gaps");

test("the inventory lists every module group with its real export count", () => {
  const groups = Object.keys(T).sort();
  const listed = moduleRows.map((line) => backticked(tableCells(line)[0])[0]);
  assert.deepEqual(listed, groups, "the module table lists exactly the bundle's groups, in order");
  for (const line of moduleRows) {
    const [group, count] = tableCells(line);
    const name = backticked(group)[0];
    const exports = T[name] && (typeof T[name] === "object" || typeof T[name] === "function") ? Object.keys(T[name]).length : 0;
    assert.equal(Number(count), exports, `T.${name} still has ${exports} exports`);
  }
});

test("every module row names exactly the tests that cite that group", () => {
  for (const line of moduleRows) {
    const [group, , tests] = tableCells(line);
    const name = backticked(group)[0];
    const listed = backticked(tests).map((entry) => entry.replace(/^tests\//, ""));
    assert.deepEqual(listed, cites(name), `the row for T.${name} lists the tests that mention it`);
  }
});

test("every command row names a registered command whose callback is real", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const ids = plugin.commands.map((command) => command.id);
  const listed = commandRows.map((line) => backticked(tableCells(line)[0])[0]);
  assert.deepEqual(listed, ids, "the command table lists exactly the registered commands, in registration order");
  for (const command of plugin.commands) {
    assert.equal(typeof command.name, "string", `${command.id} has a name`);
    assert.ok(command.name.trim(), `${command.id} has a non-empty name`);
    assert.ok(
      typeof command.callback === "function" || typeof command.checkCallback === "function",
      `${command.id} has a callback or a checkCallback`
    );
    const source = String(command.callback || command.checkCallback);
    const called = source.match(/this\.([A-Za-z0-9_]+)\(/);
    if (called) assert.equal(typeof plugin[called[1]], "function", `${command.id} calls this.${called[1]}, which exists`);
  }
});

test("the gaps section lists exactly the groups and commands with no citing test", () => {
  const uncitedGroups = Object.keys(T).sort().filter((group) => !cites(group).length);
  const uncitedCommands = commandRows
    .map((line) => tableCells(line))
    .filter((cell) => cell[3] === "—")
    .map((cell) => backticked(cell[0])[0]);
  const listedGroups = [...gapText.matchAll(/^- module `([^`]+)`/gm)].map((m) => m[1]).sort();
  const listedCommands = [...gapText.matchAll(/^- command `([^`]+)`/gm)].map((m) => m[1]);
  assert.deepEqual(listedGroups, uncitedGroups, "every group without a citing test is listed as a gap");
  assert.deepEqual(listedCommands, uncitedCommands, "every command without a citing test is listed as a gap");
  const header = doc.match(/^## Gaps \((\d+) groups, (\d+) commands\)$/m);
  assert.ok(header, "the gaps heading carries its counts");
  assert.equal(Number(header[1]), uncitedGroups.length, "the group gap count matches");
  assert.equal(Number(header[2]), uncitedCommands.length, "the command gap count matches");
});

test("the summary counts match the tables", () => {
  const summary = doc.match(/\*\*Modules:\*\* (\d+) groups, (\d+) exports\. \*\*Commands:\*\* (\d+)\./);
  assert.ok(summary, "the summary line records the group, export and command counts");
  assert.equal(Number(summary[1]), Object.keys(T).length, "the group count matches the bundle");
  assert.equal(
    Number(summary[2]),
    Object.values(T).reduce((sum, group) => sum + (group && (typeof group === "object" || typeof group === "function") ? Object.keys(group).length : 0), 0),
    "the export count matches the bundle"
  );
  assert.equal(Number(summary[3]), commandRows.length, "the command count matches the table");
});
