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

test("hub tabs use the token layer and stay touch-sized without a hidden scroller", () => {
  assert.match(css, /\.qt-hub-tabs \{[\s\S]*flex-wrap: wrap/);
  assert.doesNotMatch(css, /\.qt-hub-tabs \{[\s\S]*overflow-x: auto/);
  assert.match(css, /\.qt-hub-tab \{[\s\S]*border-radius: var\(--qt-radius-sm\)/);
  assert.match(css, /\.qt-hub-tab \{[\s\S]*font-size: var\(--qt-type-sm\)/);
  assert.match(css, /\.qt-hub-tab \{[\s\S]*min-height: 32px/);
  assert.match(css, /\.qt-hub-tab \{[\s\S]*min-height: var\(--qt-touch-target\)/);
});

test("danger and success soft surfaces survive themes without their rgb channels", () => {
  assert.match(css, /--qt-danger-soft: rgba\(var\(--color-red-rgb, 255, 59, 48\)/);
  assert.match(css, /--qt-success-soft: rgba\(var\(--color-green-rgb, 52, 199, 89\)/);
});

test("the task row keeps its actions in one aligned column with a real hit target", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "task-list-view.js"), "utf8");
  assert.match(source, /const actions = row\.createDiv\(\{ cls: "qt-task-list-actions" \}\)/);
  assert.match(source, /const checkWrap = row\.createEl\("label", \{ cls: "qt-task-check-wrap" \}\)/);
  assert.equal((source.match(/actions\.createEl\("button"/g) || []).length, 2, "star and repeat sit in the actions column");
  assert.match(source, /actions\s*\.\s*createEl\("button", \{ text: "×"/);
  assert.match(css, /\.qt-task-list-actions \{[\s\S]*display: flex/);
  assert.match(css, /\.qt-task-list-actions button \{[\s\S]*min-height: 32px[\s\S]*min-width: 32px/);
  assert.match(css, /\.qt-task-check-wrap \{[\s\S]*height: 32px[\s\S]*width: 32px/);
  assert.match(css, /\.qt-task-list-add-button \{[\s\S]*grid-column: 1 \/ -1/);
  assert.match(css, /\.qt-task-list-date:focus,\s*\n\.qt-task-list-date:focus-visible,\s*\n\.qt-task-list-date:focus-within \{[\s\S]*outline: var\(--qt-focus-outline\)/);
  assert.match(css, /\.qt-task-list-date::-webkit-datetime-edit:focus[\s\S]*outline: none/);
  assert.match(css, /\.qt-notice-undo \{[\s\S]*min-height: 24px/);
  assert.match(css, /\.qt-notice-undo:hover \{[\s\S]*background: var\(--background-modifier-hover\)/);
  assert.match(css, /\.qt-notice-undo:focus-visible \{[\s\S]*outline: var\(--qt-focus-outline\)/);
  assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*\.qt-notice-undo \{[\s\S]*min-height: var\(--qt-touch-target\)/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.qt-task-list-add-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /\.qt-task-list-row\.is-done \{\s*opacity:/);
  assert.match(css, /\.qt-task-list-row\.is-done \.qt-task-list-title \{[\s\S]*color: var\(--text-normal\)/);
});

test("narrow exam surfaces wrap instead of bursting out of the pane", () => {
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.qt-exam-bar \{[\s\S]*flex-wrap: wrap/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.qt-exam-tool-label \{[\s\S]*display: none/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.qt-exam-foot \{[\s\S]*flex-wrap: wrap/);
});

test("dim-muted dark themes keep link and secondary text above AA", () => {
  assert.match(css, /body\.theme-dark \.qt-exam \.qt-choice-mark,[\s\S]*color: var\(--text-normal\)/);
  assert.match(css, /body\.theme-dark \{[\s\S]*--qt-link: color-mix\(in srgb, var\(--text-accent-hover/);
  assert.match(css, /body\.theme-dark \.qt-hint,[\s\S]*color: var\(--text-normal\)/);
  for (const cls of [".qt-label", ".qt-meta", ".qt-empty", ".qt-paused", ".qt-field label"]) {
    assert.ok(css.includes(`body.theme-dark ${cls}`), `${cls} borrows normal ink in dark`);
  }
  for (const cls of [
    ".qt-task-list-badge",
    ".qt-task-list-count",
    ".qt-task-list-hint",
    ".qt-task-list-empty",
    ".qt-task-pill",
  ]) {
    assert.ok(css.includes(`body.theme-dark ${cls}`), `${cls} borrows normal ink in dark`);
  }
  assert.match(
    css,
    /body\.theme-dark \.qt-task-pill\.is-overdue \{[\s\S]*color: color-mix\(in srgb, var\(--color-red\) 58%, var\(--text-normal\)\)/
  );
});
