"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

test("the shipped bundle carries the optional desktop OpenCode installer", () => {
  const bundle = fs.readFileSync(path.join(root, "main.js"), "utf8");
  // This is an accepted tradeoff: the installer needs direct desktop access,
  // which Obsidian reports as a warning.
  for (const name of ["fs", "child_process"]) {
    assert.ok(bundle.includes(`require("${name}")`), `bundle must carry the optional ${name} access`);
  }
  assert.ok(bundle.includes("OpenCodeManager"), "the OpenCode installer must be bundled");
  assert.ok(bundle.includes("Download and install"), "the setup action must be reachable");
  assert.equal(bundle.includes("JSXGraph"), false, "the withdrawn JSXGraph runtime must not be bundled");
  assert.equal(bundle.includes("jsxgraph-core"), false, "the vendored JSXGraph file must not be bundled");
});

test("styles avoid browser features the release scanner flags", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.equal(css.includes(":has("), false, "SAT layout must use sibling selectors, not :has");
  assert.equal(css.includes("column-gap"), false, "use the supported gap shorthand");
  assert.equal(/text-decoration\s*:/.test(css), false, "use text-decoration-line or a border");
});

test("styles avoid duplicate height declarations and !important", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.equal(css.includes("!important"), false);
  const blocks = css.match(/\.qt-wrap\.qt-mobile\s*\{[^}]*\}/g) || [];
  for (const block of blocks) {
    const heights = block.match(/[;{]\s*height\s*:/g) || [];
    assert.ok(heights.length <= 1, `duplicate height in ${block.slice(0, 80)}`);
  }
});
