#!/usr/bin/env node
"use strict";
/*
 * The doc checks gate every release through `npm run check`, but nothing
 * checked the checkers: a regression in a slug, a cell split or a version
 * parser fails silent, as a check that passes when it should not. These
 * pin the parsing each check depends on, plus the honesty of the two
 * allowlists (EXEMPT and REMOVED) in both directions.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sectionsOf, EXEMPT } = require("../scripts/check-section-refs");
const { slug, LINK, EXTERNAL, HEADING } = require("../scripts/check-doc-links");
const { CITED_PATH, REMOVED } = require("../scripts/check-doc-paths");
const { cellsOf, DELIMITER_CELL } = require("../scripts/check-markdown-tables");
const { newestOf, parseAgentsLine, parseChangelogLine } = require("../scripts/check-release-log");
const { ROOT, markdownFiles } = require("../scripts/lib/doc-files");

test("sectionsOf reads headings, bold leads and letter parts", () => {
  const found = sectionsOf([
    "## 3. Source plugin map",
    "**5.16.1 Title** and more",
    "## C. Decided against",
    "a body line naming §3.9.6 must not invent a section",
  ].join("\n"));
  assert.ok(found.has("3"));
  assert.ok(found.has("5.16.1"));
  assert.ok(found.has("C"));
  assert.ok(!found.has("3.9.6"));
});

test("every EXEMPT file still exists", () => {
  for (const name of Object.keys(EXEMPT)) {
    assert.ok(fs.existsSync(path.join(ROOT, name)), name + " is exempt but gone");
    assert.match(EXEMPT[name], /./, "exempt without a reason");
  }
});

test("slug follows GitHub anchors", () => {
  assert.equal(slug("A. What is shipped"), "a-what-is-shipped");
  assert.equal(slug("`mcq-quiz` blocks"), "mcq-quiz-blocks");
  // Punctuation drops out, so an em dash leaves a double hyphen — the same
  // string GitHub produces, which is what the link check compares against.
  assert.equal(slug("Decided against — do not re-propose"), "decided-against--do-not-re-propose");
});

test("HEADING captures the title for slugging", () => {
  const match = HEADING.exec("### 5.16 Math, chemistry, and physics  — **M–L**");
  assert.ok(match);
  assert.equal(slug(match[1]), "516-math-chemistry-and-physics---ml");
});

test("LINK captures relative targets with one paren level", () => {
  const line = "see [spec](../ap-frq-grader-spec.md) and [w](https://en.wikipedia.org/wiki/X_(y))";
  const targets = [...line.matchAll(LINK)].map((match) => match[1]);
  assert.deepEqual(targets, ["../ap-frq-grader-spec.md", "https://en.wikipedia.org/wiki/X_(y)"]);
});

test("EXTERNAL leaves only repository-relative targets", () => {
  assert.ok(EXTERNAL.test("https://example.com/x.md"));
  assert.ok(EXTERNAL.test("mailto:a@b.c"));
  assert.ok(EXTERNAL.test("obsidian://open?vault=x"));
  assert.ok(!EXTERNAL.test("../docs/plan-decisions.md"));
  assert.ok(!EXTERNAL.test("#a-what-is-shipped"));
});

test("CITED_PATH matches owned extensions, not foreign trees", () => {
  const hits = (line) => [...line.matchAll(CITED_PATH)].map((match) => match[1]);
  assert.deepEqual(hits("see `src/study-stats.js` and `tests/helpers/x.test.js`"),
    ["src/study-stats.js", "tests/helpers/x.test.js"]);
  assert.deepEqual(hits("the plugin's `src/main.ts` layout"), []);
  assert.deepEqual(hits("src/study-stats.js without backticks"), []);
});

test("every REMOVED entry is still gone and still cited", () => {
  const bodies = markdownFiles(ROOT).map((file) => fs.readFileSync(file, "utf8"));
  for (const [name, reason] of REMOVED) {
    assert.ok(!fs.existsSync(path.join(ROOT, name)), name + " is back; drop the REMOVED entry");
    assert.ok(reason.length > 10, name + " needs a reason, not a note");
    assert.ok(bodies.some((body) => body.includes("`" + name + "`")),
      name + " is cited nowhere; drop the REMOVED entry");
  }
});

test("cellsOf counts cells, not pipes inside code or escapes", () => {
  assert.deepEqual(cellsOf("| A | B |"), ["A", "B"]);
  assert.deepEqual(cellsOf("| `a|b` | C |"), ["``", "C"]);
  assert.deepEqual(cellsOf("| a\\|b | C |"), ["a\u0000b", "C"]);
  assert.equal(cellsOf("not a row"), null);
  assert.deepEqual(cellsOf("| --- |"), ["---"], "delimiter cells still split; the caller tells them apart");
});

test("DELIMITER_CELL accepts aligned colons, rejects prose", () => {
  assert.ok(DELIMITER_CELL.test(" --- "));
  assert.ok(DELIMITER_CELL.test(":---:"));
  assert.ok(!DELIMITER_CELL.test(" Verdict "));
});

test("every check script is wired into npm run check", () => {
  const check = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts.check;
  const wired = new Set(
    [...check.matchAll(/node (scripts\/[a-z-]+\.js)/g)].map((match) => match[1])
  );
  for (const file of fs.readdirSync(path.join(ROOT, "scripts"))) {
    if (!file.startsWith("check-") || !file.endsWith(".js")) continue;
    assert.ok(wired.has("scripts/" + file), file + " runs nothing; wire it into scripts.check");
  }
});

test("the markdown walkers share one helper", () => {
  for (const name of ["check-section-refs.js", "check-doc-links.js", "check-doc-paths.js", "check-markdown-tables.js"]) {
    const source = fs.readFileSync(path.join(ROOT, "scripts", name), "utf8");
    assert.ok(source.includes("lib/doc-files"), name + " drifted off the shared walker");
  }
});

test("every EXEMPT file still needs its exemption", () => {
  for (const name of Object.keys(EXEMPT)) {
    const body = fs.readFileSync(path.join(ROOT, name), "utf8");
    assert.ok(/§\s*(\d|[A-C])/.test(body), name + " carries no § refs; drop the exemption");
  }
});

test("every release note names its own version up top", () => {
  const dir = path.join(ROOT, "docs", "release-notes");
  let notes = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!/^\d+\.\d+\.\d+\.md$/.test(file)) continue;
    notes += 1;
    const head = fs.readFileSync(path.join(dir, file), "utf8").split("\n").slice(0, 3).join("\n");
    assert.ok(head.includes(file.slice(0, -3)), file + " does not name its own version in its first lines");
  }
  assert.ok(notes > 200, "expected the full notes history, found only " + notes);
});

test("every §11 gate points at a row that exists", () => {
  const text = fs.readFileSync(path.join(ROOT, "plan.md"), "utf8");
  const slice = (start, end) => {
    const from = text.indexOf(start);
    const to = text.indexOf(end, from);
    return text.slice(from, to < 0 ? text.length : to);
  };
  const owners = new Set(
    [...slice("### Owner decisions applied", "### Other product").matchAll(/^\| (\d+) \|/gm)]
      .map((match) => match[1])
  );
  const items = new Set(
    [...slice("### Mission open questions", "### Decision queue").matchAll(/^(\d+)\. /gm)]
      .map((match) => match[1])
  );
  const eleven = slice("## 11. Decisions", "## 12. Link index");
  const ids = new Set([...eleven.matchAll(/\*\*([DOE]\d+)\*\*/g)].map((match) => match[1]));
  const failures = [];
  for (const match of text.matchAll(/§11 (?:decision (\d+)|item (\d+)|([DOE]\d+(?:[–-][A-Z]*(\d+))?))/g)) {
    if (match[1] && !owners.has(match[1])) failures.push("§11 decision " + match[1] + " names no owner-decision row");
    if (match[2] && !items.has(match[2])) failures.push("§11 item " + match[2] + " names no mission item");
    if (match[3]) {
      const ends = [match[3].match(/^[DOE]\d+/)[0]];
      if (match[4]) ends.push(match[3][0] + match[4]);
      for (const id of ends) {
        if (!ids.has(id)) failures.push("§11 " + match[3] + " names no gate row (" + id + " missing)");
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("§11 gate ids are unique headers", () => {
  const text = fs.readFileSync(path.join(ROOT, "plan.md"), "utf8");
  const eleven = text.slice(text.indexOf("## 11. Decisions"), text.indexOf("## 12. Link index"));
  const seen = new Map();
  for (const match of eleven.matchAll(/\*\*([DOE]\d+)\*\*/g)) {
    seen.set(match[1], (seen.get(match[1]) || 0) + 1);
  }
  assert.deepEqual([...seen].filter(([, count]) => count > 1), []);
  assert.ok(seen.size >= 30, "expected the full D/O/E gate set, found " + seen.size);
});

test("every §3.9.6 gate-table row carries a §11 gate", () => {
  const text = fs.readFileSync(path.join(ROOT, "plan.md"), "utf8");
  const table = text.slice(text.indexOf("### 3.9.6 Gate table"), text.indexOf("### 3.9.7"));
  const rows = table.split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Blocked") && !/^\|[\s\-: |]+\|$/.test(line));
  assert.ok(rows.length > 10, "expected the full gate table, found " + rows.length + " rows");
  for (const row of rows) {
    assert.ok(row.includes("§11"), "gate row with no §11 owner pointer: " + row.slice(0, 80));
  }
});

test("every check script states its failure mode up top", () => {
  for (const file of fs.readdirSync(path.join(ROOT, "scripts"))) {
    if (!file.startsWith("check-") || !file.endsWith(".js")) continue;
    const head = fs.readFileSync(path.join(ROOT, "scripts", file), "utf8").split("\n").slice(0, 12).join("\n");
    assert.ok(/fail|instead|silent|wrong|stale|rot|proactive|1\.\d+/i.test(head),
      file + " states no failure mode in its header; say what breaks without it");
  }
});

test("newestOf compares numerically, not lexically", () => {
  assert.equal(newestOf(["1.307.9", "1.307.31", "1.307.10"]), "1.307.31");
});

test("release-log parsers read the newest-entry formats", () => {
  assert.deepEqual(parseAgentsLine("**1.307.31 release (Nov 20, 2026):** text"),
    { version: "1.307.31", date: "2026-11-20" });
  assert.deepEqual(parseAgentsLine("**1.168.0 release (Nov 6, 2026):** text"),
    { version: "1.168.0", date: "2026-11-06" });
  assert.equal(parseAgentsLine("Notes: docs/release-notes/1.307.31.md."), null);
  assert.deepEqual(parseChangelogLine("## 1.307.31 - 2026-11-20"),
    { version: "1.307.31", date: "2026-11-20" });
  assert.equal(parseChangelogLine("## 1.307.31"), null);
});
