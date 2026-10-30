"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { scanTree } = require("../scripts/check-no-dynamic-code");

const SRC = path.join(__dirname, "..", "src");

test("no dynamic code: the shipped src tree is clean", () => {
  const result = scanTree(SRC);
  assert.ok(result.files > 100, `expected the whole source tree, scanned ${result.files} files`);
  assert.deepEqual(result.violations, []);
});

test("no dynamic code: a planted fixture is reported with path and line, decoys are ignored", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcq-guard-"));
  try {
    fs.writeFileSync(
      path.join(dir, "planted.js"),
      [
        'const a = eval("1");',
        'const b = new Function("return 1");',
        'const c = Function("return 1");',
        'setTimeout("x", 1);',
        "setInterval(`y`, 1);",
        "import(name);",
        "require(name);",
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(dir, "decoy.js"),
      [
        '// eval("x")',
        '/* new Function("x") setTimeout("x", 1) */',
        'const text = "require(name)";',
        "const tpl = `import(name)`;",
        "setTimeout(() => {}, 1);",
        'require("./local");',
        'import("./local");',
      ].join("\n")
    );
    const result = scanTree(dir);
    assert.equal(result.files, 2);
    const planted = result.violations.filter((hit) => hit.file.endsWith("planted.js"));
    assert.deepEqual([...new Set(planted.map((hit) => hit.line))], [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(result.violations.filter((hit) => hit.file.endsWith("decoy.js")), []);
    assert.ok(result.violations.every((hit) => hit.file && hit.line > 0 && hit.rule));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no dynamic code: an empty source tree fails loudly instead of passing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcq-guard-empty-"));
  try {
    assert.throws(() => scanTree(dir), /no JavaScript files/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
