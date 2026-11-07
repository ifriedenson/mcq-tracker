"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("every audited form control carries an accessible name", () => {
  const names = fs
    .readdirSync("src")
    .filter((name) => /modal.*\.js$/.test(name))
    .map((name) => path.join("src", name));
  names.push("src/modals.js", "src/calendar-view.js", "src/pdf-annotator-sidebar.js", "src/settings-tab.js");

  const missing = [];
  for (const file of names) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!/createEl\("(input|select|textarea)"/.test(line)) return;
      const block = lines.slice(index, index + 5).join("\n");
      if (/aria-label|aria-labelledby|placeholder|type:\s*"(checkbox|file)"|\.type\s*=\s*"(checkbox|file)"|\.hidden\s*=\s*true/.test(block)) return;
      missing.push(`${path.basename(file)}:${index + 1}`);
    });
  }
  assert.deepEqual(missing, [], "visible modal, PDF, calendar and settings controls are named");
});

test("the audited dialogs keep their specific accessible names", () => {
  const expected = [
    ["src/modals.js", /input\.setAttribute\("aria-label", this\.title \|\| "Name"\)/],
    ["src/assignments-modal.js", /input\.setAttribute\("aria-label", label\)/],
    ["src/assignments-modal.js", /due\.setAttribute\("aria-label", "Due date"\)/],
    ["src/frq-import-modal.js", /course\.setAttribute\("aria-label", "Course for this batch"\)/],
    ["src/pdf-ink-modal.js", /textEl\.setAttribute\("aria-label", "Annotation text"\)/],
    ["src/pdf-annotator-sidebar.js", /search\.setAttribute\("aria-label", "Search annotations"\)/],
    ["src/calendar-view.js", /select\.setAttribute\("aria-label", "Questions for this session"\)/],
  ];
  for (const [file, pattern] of expected) {
    assert.match(fs.readFileSync(file, "utf8"), pattern, `${file} keeps its control label`);
  }
});
