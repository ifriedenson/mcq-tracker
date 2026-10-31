"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

function blockAt(marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `missing ${marker}`);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${marker}`);
}

test("laptop layout: the 701-1100 px container query covers the cramped views", () => {
  const laptop = blockAt("@container (min-width: 701px) and (max-width: 1100px)");
  for (const selector of [
    ".qt-split",
    ".qt-pane",
    ".qt-ins-row",
    ".qt-ref-tabs",
    ".qt-ref-canvas",
    ".qt-assignment-task-actions",
  ]) {
    assert.ok(laptop.includes(selector), `${selector} is not in the laptop container query`);
  }
  assert.match(laptop, /grid-template-rows: minmax\(0, 42%\)/, "the exam panes stack at laptop widths");
});

test("laptop layout: dashboard stats use deliberate laptop columns", () => {
  const mid = blockAt("@container (min-width: 701px) and (max-width: 899px)");
  assert.match(mid, /\.qt-dash-stats \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
  const wide = blockAt("@container (min-width: 900px) and (max-width: 1100px)");
  assert.match(wide, /\.qt-dash-stats \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/);
});

test("laptop layout: card, reference and assignment rows can wrap", () => {
  assert.match(css, /\.qt-cards-tools \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.qt-ref-tabs \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.qt-assignment-task \{[^}]*flex-wrap: wrap/);
  assert.doesNotMatch(css, /\.qt-assignment-task-title \{[^}]*white-space: nowrap/);
});
