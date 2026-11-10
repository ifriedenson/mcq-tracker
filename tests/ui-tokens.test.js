"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("the design token layer defines every foundation family", () => {
  for (const prefix of [
    "--qt-type-",
    "--qt-space-",
    "--qt-radius-",
    "--qt-shadow-",
    "--qt-duration-",
    "--qt-ease-",
  ]) {
    assert.match(css, new RegExp(prefix), `${prefix} tokens are present`);
  }
  assert.match(css, /--qt-type-2xs:/);
  assert.match(css, /--qt-type-5xl:/);
  assert.match(css, /--qt-space-16:/);
  assert.match(css, /--qt-radius-pill:/);
  assert.match(css, /--qt-shadow-3:/);
});

test("semantic and focus tokens resolve on the Obsidian theme body", () => {
  assert.match(css, /body \{[\s\S]*--qt-focus-outline: 2px solid var\(--interactive-accent\)/);
  assert.match(css, /body \{[\s\S]*--qt-focus-ring: 0 0 0 2px var\(--background-primary\)/);
  assert.match(css, /--qt-success-text: color-mix\(in srgb, var\(--color-green\)/);
  assert.match(css, /body\.theme-light \{[\s\S]*--qt-accent-fill: color-mix/);
  assert.match(css, /body\.theme-dark\.theme-dark \{[\s\S]*--qt-accent-fill: color-mix/);
});

test("reduced motion is expressed through tokens, not forced declarations", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /--qt-duration-base: 0ms/);
  assert.match(css, /--qt-iteration-loop: 1/);
  assert.doesNotMatch(css, /animation:[^;]*!important/);
});

test("the shared focus ring and narrow control rules stay in place", () => {
  assert.match(css, /\.qt-root\.qt-root :is\(button, \[role="button"\], summary, a, input, select, textarea\):focus-visible/);
  assert.match(css, /\.qt-ui\.qt-ui :is\(button, \[role="button"\], summary, a, input, select, textarea\):focus-visible/);
  assert.match(css, /\.qt-root summary,[\s\S]*min-height: 44px/);
  assert.match(css, /\.qt-screen \.qt-cards-filter \.qt-chips \{[\s\S]*flex-wrap: wrap/);
});

test("settings and calendar controls meet the 44px contract", () => {
  assert.match(css, /\.qt-settings-layout \.qt-settings-category,[\s\S]*min-height: 44px/);
  assert.match(css, /\.qt-settings-layout \.qt-settings-tabs \{[\s\S]*flex-wrap: wrap/);
  assert.match(css, /\.uni-calendar-container \.uni-nav-btn \{[\s\S]*min-height: 44px/);
  assert.match(css, /\.qt-settings-layout button,[\s\S]*min-height: 44px/);
});

test("the heatmap exposes data cells rather than hundreds of buttons", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "study-stats-view.js"), "utf8");
  assert.match(source, /grid\.setAttr\("role", "grid"\)/);
  assert.match(source, /column\.setAttr\("role", "row"\)/);
  assert.match(source, /role: "gridcell"/);
});
