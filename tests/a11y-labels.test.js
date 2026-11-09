"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { auditSourceTree } = require("./helpers/a11y-audit");
const root = path.join(__dirname, "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function labelled(source, label) {
  return source.includes(`"aria-label": "${label}"`) || source.includes(`setAttribute("aria-label", "${label}")`);
}

test("shared field helpers pass the visible label to the control", () => {
  const workspace = read("src/study-workspace-view.js");
  for (const snippet of [
    'createEl("input", { cls: "qt-input", attr: { "aria-label": label } })',
    'createEl("textarea", { cls: "qt-study-bulk", attr: { "aria-label": label } })',
    'createEl("select", { cls: "dropdown", attr: { "aria-label": label } })',
  ]) {
    assert.ok(workspace.includes(snippet), `study workspace helper must label its control: ${snippet}`);
  }
  const tools = read("src/study-tools-view.js");
  assert.ok(
    tools.includes('createEl("input", { cls: "qt-input", attr: { "aria-label": label } })'),
    "the study tools field helper must label its input",
  );
});

test("workspace answer boxes and filters have accessible names", () => {
  const workspace = read("src/study-workspace-view.js");
  for (const name of [
    "Feynman explanation",
    "Deep Notes answer",
    "Search annotations",
    "Search vocabulary",
    "Search subjects",
    "Filter blocks by tag",
    "New task inside this block",
    "Search PDF annotations",
  ]) {
    assert.ok(labelled(workspace, name), `Study Workspace must expose the name "${name}"`);
  }
});

test("every form control, text-less button and dialog in src has an accessible name", () => {
  const audit = auditSourceTree(root);
  assert.ok(audit.files >= 300, `expected to scan the plugin source, scanned ${audit.files} files`);
  assert.deepEqual(audit.controls, [], "form controls must not rely on a placeholder for their name");
  assert.deepEqual(audit.buttons, [], "buttons without visible text must carry an accessible name");
  assert.ok(audit.dialogs >= 50, `expected to scan the modal classes, scanned ${audit.dialogs}`);
  assert.ok(audit.managedDialogFiles >= 50, `expected managed dialog files, scanned ${audit.managedDialogFiles}`);
  assert.deepEqual(audit.dialogGaps, [], "every dialog must use the shared naming base");
  assert.deepEqual(audit.dialogContainers, [], "custom dialog containers must carry an accessible name");
});

test("a dialog is named from its visible heading and keeps that name", () => {
  require("./helpers/load").load();
  const { describeDialog } = require("../src/a11y");
  const attrs = {};
  const heading = { id: "", textContent: "Review answers" };
  const container = {
    setAttribute(name, value) {
      attrs[name] = value;
    },
    removeAttribute(name) {
      delete attrs[name];
    },
  };
  const modal = { contentEl: { querySelector: () => heading }, modalEl: container };
  assert.equal(describeDialog(modal), "Review answers");
  assert.match(heading.id, /^qt-dialog-title-\d+$/);
  assert.equal(attrs["aria-labelledby"], heading.id);
  assert.equal(attrs.role, "dialog");
  assert.equal(attrs["aria-modal"], "true");
  const firstId = heading.id;
  assert.equal(describeDialog(modal), "Review answers");
  assert.equal(heading.id, firstId, "reopening must reuse the heading id");
});

test("a heading-less dialog keeps a written purpose name", () => {
  require("./helpers/load").load();
  const { describeDialog } = require("../src/a11y");
  const attrs = {};
  const container = {
    setAttribute(name, value) {
      attrs[name] = value;
    },
    removeAttribute(name) {
      delete attrs[name];
    },
  };
  const modal = {
    contentEl: { querySelector: () => null },
    modalEl: container,
    qtDialogLabel() {
      return "Attach a PDF";
    },
  };
  assert.equal(describeDialog(modal), "Attach a PDF");
  assert.equal(attrs["aria-label"], "Attach a PDF");
  assert.equal(attrs["aria-labelledby"], undefined);
  assert.equal(attrs.role, "dialog");
});

test("QtModal names its container when it opens", () => {
  require("./helpers/load").load();
  const { QtModal } = require("../src/a11y");
  const attrs = {};
  const heading = { id: "", textContent: "Import cards" };
  class DemoModal extends QtModal {
    onOpen() {}
  }
  const modal = new DemoModal({});
  modal.contentEl = { querySelector: () => heading };
  modal.modalEl = {
    setAttribute(name, value) {
      attrs[name] = value;
    },
    removeAttribute(name) {
      delete attrs[name];
    },
  };
  modal.open();
  assert.equal(attrs["aria-labelledby"], heading.id);
  assert.equal(attrs.role, "dialog");
  assert.equal(attrs["aria-modal"], "true");
});

test("representative dialogs keep their own names", () => {
  for (const file of ["src/card-modal.js", "src/frq-import-modal.js", "src/pdf-editor-modal.js", "src/chat-pdf-modal.js", "src/epub-reader-modal.js"]) {
    const source = read(file);
    assert.ok(/extends Qt(Modal|FuzzySuggestModal)/.test(source), `${file} must use the shared dialog base`);
  }
  assert.match(read("src/a11y.js"), /aria-labelledby/);
  assert.match(read("src/a11y.js"), /aria-modal/);
  assert.match(read("src/modals.js"), /return "Choose a question folder";/);
  assert.match(read("src/pdf-editor-modal.js"), /return "Choose an image";/);
  assert.match(read("src/chat-pdf-modal.js"), /return "Attach a PDF";/);
  assert.match(read("src/epub-reader-modal.js"), /return "EPUB reader";/);
  assert.ok(labelled(read("src/practice-view.js"), "Question actions"));
  assert.ok(labelled(read("src/practice-view.js"), "Question menu"));
  assert.ok(labelled(read("src/practice-view.js"), "Review actions"));
});

test("primary views and modals name their inputs", () => {
  const expected = [
    ["src/quick-ask-modal.js", "Quick Ask question"],
    ["src/agent-view.js", "Search your vault"],
    ["src/reading-view.js", "Pages read"],
    ["src/auto-anki-modal.js", "Deck for new cards"],
    ["src/chat-memory-modal.js", "New saved fact"],
    ["src/course-templates.js", "Note type"],
    ["src/exam-modal.js", "Topics"],
    ["src/cards-view.js", "Your answer"],
    ["src/frq-modal.js", "Sample answer"],
    ["src/card-archive.js", "Card archive JSON"],
    ["src/spaced-everything-modal.js", "Thought"],
    ["src/transcript-modal.js", "Question folder"],
    ["src/quiz-generator-modal.js", "Source folders"],
    ["src/card-generator-modal.js", "Separator"],
    ["src/document-cards.js", "Vault file"],
    ["src/ocr-modal.js", "OCR text"],
    ["src/chat-panel.js", "Message the Study agent"],
    ["src/card-modal.js", "Card front"],
    ["src/exam-view.js", "First question"],
    ["src/reference-view.js", "Search formulas"],
    ["src/quick-add-modal.js", "Pasted questions"],
    ["src/practice-view.js", "Notes for this question"],
    ["src/cards-import.js", "Import source"],
    ["src/image-occlusion-modal.js", "Masks, one per line"],
    ["src/study-status-modal.js", "Search study status"],
    ["src/table-csv-modal.js", "Include table headers"],
    ["src/pdf-editor-modal.js", "Burn annotations into the copy"],
  ];
  for (const [file, name] of expected) {
    assert.ok(labelled(read(file), name), `${file} must expose the name "${name}"`);
  }
});
