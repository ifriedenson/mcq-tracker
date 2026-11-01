"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const source = (file) => fs.readFileSync(path.join(root, "src", file), "utf8");

test("workflow views opt into the shared screen shell", () => {
  for (const file of [
    "cards-view.js",
    "assignments-view.js",
    "insights-view.js",
    "reference-view.js",
    "study-tools-view.js",
    "study-workspace-view.js",
    "study-stats-view.js",
    "review-calendar-view.js",
    "local-events-view.js",
    "pomodoro-view.js",
  ]) {
    assert.match(source(file), /qt-wrap[^"]*qt-screen/, `${file} does not use qt-screen`);
  }
});

test("Practice, Calendar and the timed test keep their dedicated layouts", () => {
  for (const file of ["practice-view.js", "calendar-view.js", "exam-view.js"]) {
    assert.doesNotMatch(source(file), /qt-screen/, `${file} should not inherit the workflow shell`);
  }
});

test("the shared shell responds to pane width and mobile mode", () => {
  assert.match(css, /\.qt-wrap\.qt-screen \{[^}]*container-name: qt-screen/s);
  assert.match(css, /@container qt-screen \(max-width: 760px\)/);
  assert.match(css, /@container qt-screen \(max-width: 460px\)/);
  assert.match(css, /body\.is-mobile \.qt-screen/);
});

test("workflow views share toolbars, tabs and compact summaries", () => {
  assert.match(css, /\.qt-screen \.qt-toolbar/);
  assert.match(css, /\.qt-screen \.qt-tabbar/);
  assert.match(css, /\.qt-screen \.qt-segmented/);
  assert.match(css, /\.qt-screen \.qt-summary-strip/);
  assert.match(css, /\.qt-screen \.qt-screen-head h2/);
  assert.match(css, /\.qt-screen \.qt-cards-stats > span/);
  assert.match(css, /\.qt-screen \.qt-study-card/);
  assert.match(css, /\.qt-screen \.qt-ref-tabs/);
});

test("settings navigation stays usable in a narrow pane", () => {
  assert.match(css, /\.qt-settings-modules,\s*\.qt-settings-tabs \{[^}]*flex-wrap: nowrap/s);
  assert.match(css, /\.qt-settings-modules,\s*\.qt-settings-tabs \{[^}]*overflow-x: auto/s);
});
