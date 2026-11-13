"use strict";
/**
 * Regression tests for `scripts/check-no-dynamic-code.js`.
 *
 * The scanner masks comments and string/template text before matching, so it has
 * to know where a regex literal starts. It used to treat every `/` as division,
 * so a regex containing a backtick or a quote opened a string frame that swallowed
 * the code after it — `src/plugin.js` lost 83% of its characters, including both
 * `requestUrl` calls, and a sink in that span would not have been reported.
 *
 * These tests fail against that masker: the fixtures below place a sink directly
 * after a regex that spells a backtick or a quote, and `plugin.js` is required to
 * be scanned as code rather than as one long string.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { findViolations, maskCode, scanTree } = require("../scripts/check-no-dynamic-code");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

function codeCharacters(source) {
  const mask = maskCode(source);
  let covered = 0;
  for (let i = 0; i < source.length; i++) covered += mask[i];
  return covered;
}

function coveredRatio(source) {
  return codeCharacters(source) / source.length;
}

/** The mask value at the first character of `needle`, or -1 when it is missing. */
function maskAt(source, needle) {
  const index = source.indexOf(needle);
  if (index === -1) return -1;
  return maskCode(source)[index];
}

test("a regex holding a backtick cannot hide the code after it", () => {
  const source = 'const A = [\n  /x`y/g,\n  /z/,\n];\nconst total = eval(input);\n';
  const hits = findViolations("fixture.js", source);
  assert.equal(hits.length, 1, "the eval after the regex is reported");
  assert.equal(hits[0].rule, "eval");
  assert.equal(hits[0].line, 5, "and it is reported on its real line");
});

test("a regex holding a quote cannot hide a sink on its own line", () => {
  const source = 'const re = /[\'"]/; setTimeout("tick", 0);\n';
  const hits = findViolations("fixture.js", source);
  assert.deepEqual(hits.map((hit) => hit.rule), ["string timer"]);
});

test("a regex body still counts as code, so a sink spelled in one is reported", () => {
  const source = "const re = /eval(input)/;\n";
  const hits = findViolations("fixture.js", source);
  assert.equal(hits.length, 1, "regex bodies stay in the scanned surface");
  assert.equal(hits[0].rule, "eval");
});

test("division is not read as a regex", () => {
  const source = "const half = total / 2;\nconst ratio = a / b / c;\nconst x = eval(code);\n";
  const hits = findViolations("fixture.js", source);
  assert.deepEqual(hits.map((hit) => hit.rule), ["eval"], "the division lines add no hits and hide none");
});

test("src/plugin.js is scanned in full, including its requestUrl call", () => {
  const source = fs.readFileSync(path.join(SRC, "plugin.js"), "utf8");
  const mask = maskCode(source);
  const ratio = coveredRatio(source);
  assert.ok(ratio > 0.6, `plugin.js is masked as ${(ratio * 100).toFixed(1)}% code, not as one string`);
  const lines = source.split("\n");
  let offset = 0;
  let seen = 0;
  for (const line of lines) {
    if (/^\s*const\s[^=]*=\s*await\s+requestUrl\(/.test(line) || /\brequestUrl\s*\(/.test(line)) {
      const column = line.indexOf("requestUrl");
      if (column !== -1) {
        seen++;
        assert.equal(mask[offset + column], 1, `requestUrl on line ${seen} is code, not masked prose`);
      }
    }
    offset += line.length + 1;
  }
  assert.equal(seen, 1, "the calendar feed fetch is in the scanned surface");
});

test("no shipped source file is masked down to a fraction of itself", () => {
  const files = fs.readdirSync(SRC).filter((name) => name.endsWith(".js"));
  assert.ok(files.length > 250, `the scan still sees the whole tree (${files.length} files at the top level)`);
  for (const name of files) {
    const source = fs.readFileSync(path.join(SRC, name), "utf8");
    const ratio = coveredRatio(source);
    assert.ok(ratio > 0.15, `${name} is masked as ${(ratio * 100).toFixed(1)}% code`);
  }
});

test("the tree scan reports no dynamic code and covers every source file", () => {
  const result = scanTree(SRC);
  assert.ok(result.files > 250, `${result.files} files scanned`);
  assert.deepEqual(result.violations, [], "no eval, new Function, string timer or dynamic require/import");
  const template = "const a = `text ${value} more`;";
  assert.equal(maskCode(template)[template.indexOf("value")], 1, "template interpolations stay code");
});
