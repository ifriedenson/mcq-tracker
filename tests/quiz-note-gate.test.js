"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const Q = T.quizBlock;
const gate = T.quizNoteGate;

const BLOCK = `gated: true
Q: Which gas do plants take in?
A. Oxygen
B. Carbon dioxide
Answer: B

Q: Which organelle makes ATP?
A. Nucleus
B. Mitochondrion
Answer: B`;

test("quiz note gate: only complete supported interactive quizzes gate the note", () => {
  const parsed = Q.parseQuizBlock(BLOCK);
  assert.equal(gate.canGate(parsed, {}), true);
  assert.equal(gate.canGate({ ...parsed, mode: "static" }, {}), false);
  assert.equal(gate.canGate({ ...parsed, questions: [] }, {}), false);
  assert.equal(gate.canGate({ ...parsed, questions: [{ ...parsed.questions[0], valid: false }] }, {}), false);
  assert.equal(gate.canGate({ ...parsed, questions: [{ ...parsed.questions[0], type: "numeric" }] }, {}), false);
  assert.equal(
    gate.canGate({ ...parsed, questions: [{ ...parsed.questions[0], type: "numeric" }] }, { inlineQuizNumeric: true }),
    true
  );
});

test("quiz note gate: hides following note siblings and restores them when complete", () => {
  const root = { classes: new Set(["markdown-preview-view"]), parentElement: null, style: { display: "" } };
  const section = { classes: new Set(), parentElement: root, nextElementSibling: null, style: { display: "" } };
  const block = {
    classes: new Set(),
    parentElement: section,
    nextElementSibling: null,
    style: { display: "" },
    closest(selector) {
      if (selector.includes("markdown-embed")) return null;
      return selector.includes("markdown-preview-view") ? root : null;
    },
    createDiv(opts) {
      const panel = {
        cls: opts && opts.cls,
        children: [],
        style: { display: "" },
        createDiv(child) {
          const node = Object.assign({}, child, { setText(value) { this.text = value; } });
          this.children.push(node);
          return node;
        },
        remove() { this.removed = true; },
      };
      block.panel = panel;
      return panel;
    },
  };
  const afterBlock = { style: { display: "block" } };
  const afterSection = { style: { display: "grid" } };
  block.nextElementSibling = afterBlock;
  section.nextElementSibling = afterSection;

  const handle = gate.begin(block, 2);
  assert.ok(handle);
  assert.equal(afterBlock.style.display, "none");
  assert.equal(afterSection.style.display, "none");
  assert.equal(block.panel.children[1].text, "0 of 2 answered");

  handle.update(1);
  assert.equal(afterBlock.style.display, "none");
  assert.equal(block.panel.children[1].text, "1 of 2 answered");

  handle.update(2);
  assert.equal(afterBlock.style.display, "block");
  assert.equal(afterSection.style.display, "grid");
  assert.equal(block.panel.removed, true);
});
