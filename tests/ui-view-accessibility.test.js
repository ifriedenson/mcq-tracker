"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeDom } = require("./helpers/fake");

const root = path.join(__dirname, "..");
const { T } = load();
const source = (file) => fs.readFileSync(path.join(root, "src", file), "utf8");

test("every view and panel form control carries an accessible name", () => {
  const names = fs
    .readdirSync(path.join(root, "src"))
    .filter((name) => /(view|panel|dock|explorer|empty-state)\.js$/.test(name))
    .map((name) => path.join("src", name));
  names.push("src/view-helpers.js");

  const missing = [];
  for (const file of names) {
    const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!/createEl\("(input|select|textarea)"/.test(line)) return;
      const block = lines.slice(index, index + 7).join("\n");
      if (/aria-label|aria-labelledby|placeholder|type:\s*"(checkbox|file)"|\.type\s*=\s*"(checkbox|file)"|\.hidden\s*=\s*true/.test(block)) return;
      missing.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(missing, [], "visible view and panel controls are named");
});

test("the swept views keep the accessible names the review added", () => {
  const expected = [
    ["exam-view.js", [/aria-label": `Questions in section \$\{i \+ 1\}`/, /aria-label": `Minutes in section \$\{i \+ 1\}`/, /aria-label": "Pick questions"/, /aria-label": "Saved blueprint"/]],
    ["insights-view.js", [/aria-label": "Show mastery for"/]],
    ["today-view.js", [/aria-label": "Show mastery for"/]],
    ["local-events-view.js", [/aria-label": label/, /aria-label": "Category"/, /aria-label": "Colour"/, /aria-label": "Repeat"/, /aria-label": "Notes"/]],
    ["practice-view.js", [/aria-label": "Filter preset"/, /aria-label": "Pick questions"/, /aria-label": "Connection method"/, /aria-label": "Provider"/, /aria-label": "Session length"/, /aria-label": "Session length value"/]],
    ["reference-view.js", [/qt-ref-punnett-field[\s\S]{0,200}"aria-label": label/, /aria-label": "AP course"/, /aria-label": "Exam"/, /aria-label": "Target AP score"/]],
    ["study-workspace-view.js", [/aria-label": label/, /aria-label": SCORE_LABELS\[dimension\]/, /label: `Read sentence \$\{index \+ 1\} aloud`/]],
    ["view-helpers.js", [/aria-label": `Match item \$\{i \+ 1\}`/]],
  ];
  for (const [file, patterns] of expected) {
    const text = source(file);
    for (const pattern of patterns) assert.match(text, pattern, `${file} keeps ${pattern}`);
  }
});

test("the keyboard helper makes a non-button control focusable and activatable", () => {
  const dom = makeDom();
  const el = dom.root.createDiv({ cls: "qt-test-control" });
  let calls = 0;
  T.makeKeyboardClickable(el, () => calls++, { label: "Open day" });
  const own = el.__own;
  assert.equal(own.meta.attrs.role, "button");
  assert.equal(own.meta.attrs.tabindex, "0");
  assert.equal(own.meta.attrs["aria-label"], "Open day");

  own.handlers.find((handler) => handler.ev === "click").fn({});
  assert.equal(calls, 1, "a pointer click still activates");
  const key = (value) =>
    own.handlers.filter((handler) => handler.ev === "keydown").forEach((handler) => handler.fn({ key: value, preventDefault() {} }));
  key("Enter");
  assert.equal(calls, 2, "Enter activates");
  key(" ");
  assert.equal(calls, 3, "Space activates");
  key("Tab");
  assert.equal(calls, 3, "Tab is left to move focus");
});

test("view links keep their link role while becoming keyboard operable", () => {
  const dom = makeDom();
  const link = dom.root.createEl("a", { text: "Open source" });
  T.makeKeyboardClickable(link, () => {}, { role: "link" });
  assert.equal(link.__own.meta.attrs.role, "link");
  assert.equal(link.__own.meta.attrs.tabindex, "0");
});

test("the audited views use the keyboard helper on their custom controls", () => {
  const expected = [
    ["local-events-view.js", 3],
    ["review-calendar-view.js", 3],
    ["study-stats-view.js", 1],
    ["study-workspace-view.js", 2],
    ["insights-view.js", 3],
    ["practice-view.js", 1],
  ];
  for (const [file, count] of expected) {
    const text = source(file);
    assert.match(text, /require\("\.\/view-helpers"\)/, `${file} imports the shared helper`);
    assert.equal((text.match(/makeKeyboardClickable\(/g) || []).length, count, `${file} keeps ${count} keyboard controls`);
  }
});
