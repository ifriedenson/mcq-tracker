"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

test("the shipped bundle has no Node filesystem, shell or OpenCode installer access", () => {
  const bundle = fs.readFileSync(path.join(root, "main.js"), "utf8");
  for (const name of ["fs", "child_process"]) {
    assert.equal(bundle.includes(`require("${name}")`), false, `bundle must not require ${name}`);
    assert.equal(bundle.includes(`require("node:${name}")`), false, `bundle must not require node:${name}`);
  }
  assert.equal(bundle.includes("opencode-manager"), false, "the auto-installer must not be bundled");
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
