"use strict";
/**
 * `docs/capability-inventory.md` is generated from the built bundle: one row per
 * module group, one row per registered command, and an explicit list of the groups
 * with no citing test.
 *
 * This test re-derives all of it. Deleting a function, renaming a group, adding or
 * removing a command, dropping the test that cites a capability, or changing a
 * README count or a settings heading all fail here, so the inventory and the
 * user-facing prose cannot drift away from the code they describe.
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
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
const testFiles = fs.readdirSync(path.join(ROOT, "tests")).filter((f) => f.endsWith(".test.js")).sort();
const testText = Object.fromEntries(testFiles.map((f) => [f, fs.readFileSync(path.join(ROOT, "tests", f), "utf8")]));

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

const cites = (group) => testFiles.filter((f) => testText[f].includes("T." + group));

/**
 * The only groups allowed to stay uncited. Each is an internal helper whose whole job
 * is to move bytes or talk to the filesystem, so a test cannot assert a user-visible
 * effect without re-implementing the boundary it wraps. A modal, dock, settings
 * renderer, panel or feature helper is never plumbing: the test below fails if any
 * group outside this list has no citing test, so advertising a feature without a
 * proving test cannot be papered over with a reason string.
 */
const PLUMBING = ["downloadFile", "extractArchive", "findBinaryIn"];

/** The callback a command row delegates to, read from the table itself. */
function commandCallback(id) {
  const row = commandRows.find((line) => backticked(tableCells(line)[0])[0] === id);
  return row ? backticked(tableCells(row)[2])[0] || "" : "";
}

/** A command is cited when a test names its id or the callback it delegates to. */
function commandCites(id) {
  const callback = commandCallback(id);
  return testFiles.filter((f) => testText[f].includes(id) || (callback && testText[f].includes(callback)));
}

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

test("every command row's cited tests exist and really mention the command", () => {
  for (const line of commandRows) {
    const [id, , , tests] = tableCells(line);
    const name = backticked(id)[0];
    const cited = backticked(tests);
    assert.ok(cited.length, `${name} names at least one test`);
    for (const entry of cited) {
      const file = entry.replace(/^tests\//, "");
      assert.ok(testFiles.includes(file), `${name} cites an existing test (${entry})`);
      const callback = commandCallback(name);
      assert.ok(
        testText[file].includes(name) || (callback && testText[file].includes(callback)),
        `${entry} mentions ${name} or its callback ${callback}`
      );
    }
  }
});

test("the gaps section lists exactly the uncited groups, each with a reason, and no uncited command", () => {
  const uncitedGroups = Object.keys(T).sort().filter((group) => !cites(group).length);
  const uncitedCommands = commandRows.map((line) => tableCells(line)).filter((cell) => !backticked(cell[3]).length).map((cell) => backticked(cell[0])[0]);
  const listedGroups = [...gapText.matchAll(/^- module `([^`]+)`/gm)].map((m) => m[1]).sort();
  const listedCommands = [...gapText.matchAll(/^- command `([^`]+)`/gm)].map((m) => m[1]);
  assert.deepEqual(listedGroups, uncitedGroups, "every group without a citing test is listed as a gap");
  assert.deepEqual(listedCommands, uncitedCommands, "every command without a citing test is listed as a gap");
  assert.deepEqual(uncitedCommands, [], "every command-palette command has a test that exercises it");
  for (const line of gapText.split("\n").filter((entry) => entry.startsWith("- module `"))) {
    assert.match(line, /` \(\d+ exports\) — plumbing: .+\.$/, "a listed group names why it is not separately tested");
  }
  const header = doc.match(/^## Gaps \((\d+) groups, (\d+) commands\)$/m);
  assert.ok(header, "the gaps heading carries its counts");
  assert.equal(Number(header[1]), uncitedGroups.length, "the group gap count matches");
  assert.equal(Number(header[2]), uncitedCommands.length, "the command gap count matches");
});

test("only the named internal helpers may stay uncited", () => {
  const uncited = Object.keys(T).sort().filter((group) => !cites(group).length);
  const unexpected = uncited.filter((group) => !PLUMBING.includes(group));
  assert.deepEqual(
    unexpected,
    [],
    `these groups back user-visible behaviour and need a test that constructs them: ${unexpected.join(", ")}`
  );
  const stale = PLUMBING.filter((group) => !uncited.includes(group));
  assert.deepEqual(stale, [], `these allowlisted helpers now have a citing test and must leave the allowlist: ${stale.join(", ")}`);
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

test("the README's Study Workspace count matches the tabs the view registers", () => {
  const view = fs.readFileSync(path.join(ROOT, "src", "study-workspace-view.js"), "utf8");
  const tabs = [...view.matchAll(/^\s*\{ id: "([a-zA-Z]+)", label:/gm)].map((m) => m[1]);
  assert.equal(tabs.length, 21, `the view registers ${tabs.length} tabs`);
  assert.ok(readme.includes("twenty-one independent modules"), "the README heading states the count");
  assert.ok(readme.includes("twenty-one local workflows"), "the README body states the count");
  assert.ok(!/twenty independent modules/.test(readme), "the stale count is gone");
  for (const label of ["Feynman", "Recall", "Time blocks", "Reading library", "Quiz index"]) {
    assert.ok(view.includes('label: "' + label + '"'), `the ${label} tab is registered`);
  }
});

test("the settings headings the README describes still exist in the settings code", () => {
  const settingsFiles = fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".js") && /settings/i.test(f));
  assert.ok(settingsFiles.length >= 3, `${settingsFiles.length} settings files`);
  const headings = new Set();
  for (const file of settingsFiles) {
    const text = fs.readFileSync(path.join(ROOT, "src", file), "utf8");
    for (const match of text.matchAll(/setName\("([^"]+)"\)\s*\.setHeading\(\)/g)) headings.add(match[1]);
  }
  assert.ok(headings.size >= 30, `${headings.size} headings are drawn`);
  const documented = [
    "Whole-note review",
    "Spaced Everything",
    "Daily quiz",
    "Simple quiz blocks",
    "Simple note quiz",
    "Decks",
    "AnkiConnect",
    "CouchDB sync",
    "Auto Anki",
    "Text2Anki",
  ];
  for (const name of documented) {
    assert.ok(headings.has(name), `the ${name} settings heading exists`);
    assert.ok(readme.includes(name), `the README still describes ${name}`);
  }
});
