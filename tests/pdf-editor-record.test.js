"use strict";
/**
 * The PDF editor record (`docs/pdf-editor-mission.md`) is the product source of
 * truth for that editor, so this test keeps it honest: every capability it
 * names must exist in the engine, every number it states must match the code's
 * own limits, and the editor must stay pure and offline as it claims.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const editor = require("../src/pdf-editor");
const history = require("../src/pdf-editor-history");

const root = path.join(__dirname, "..");
const record = fs.readFileSync(path.join(root, "docs", "pdf-editor-mission.md"), "utf8");

test("every editor capability the record records is exported by the engine", () => {
  const named = [
    "loadEditorDocument", "pageList", "rotatePage", "movePage", "deletePage", "duplicatePage",
    "addBlankPage", "insertPdfPages", "extractPdfPages", "splitPdf", "formFields", "setFieldValue",
    "flattenForm", "renameFormField", "deleteFormField", "addFormField", "flattenAnnotations",
    "savePdf", "editedPathFor", "addLink", "readLinks", "updateLink", "removeLinks", "readOutline",
    "setOutline", "addText", "addPageNumbers", "cropPages", "addImage", "addWatermark", "addShape",
    "resizePages", "setDocumentProperties",
  ];
  for (const name of named) {
    assert.equal(typeof editor[name], "function", `the record names ${name}, so the engine must export it`);
  }
});

test("the record's limits match the engine's own constants", () => {
  const source = fs.readFileSync(path.join(root, "src", "pdf-editor.js"), "utf8");
  const declared = (name) => {
    const match = source.match(new RegExp(`^const ${name} = ([^;]+);`, "m"));
    assert.ok(match, `src/pdf-editor.js still declares ${name}`);
    return Function(`"use strict"; return (${match[1]});`)();
  };
  const expected = {
    MAX_BYTES: 80 * 1024 * 1024,
    MAX_PAGES: 2000,
    MAX_INSERT_PAGES: 500,
    MAX_FORM_FIELDS: 500,
    MAX_FIELD_NAME: 60,
    MAX_FIELD_OPTIONS: 50,
    MAX_LINKS: 500,
    MAX_LINK_URL: 2000,
    MAX_LINK_BORDER: 24,
    MAX_LINK_DASH: 8,
    MAX_LINK_DASH_VALUE: 100,
    MAX_LINK_DASH_PHASE: 1000,
    MAX_LINK_NAME: 200,
    MAX_REMOTE_PAGE: 100000,
    MAX_OUTLINE: 200,
    MAX_OUTLINE_TITLE: 120,
    MAX_OUTLINE_DEPTH: 3,
    MAX_SPLIT_PARTS: 100,
    MAX_SHAPE_POINTS: 2000,
    MAX_PAGE_POINTS: 5000,
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(declared(name), value, `${name} is ${value} in the code`);
  }
  for (const name of ["MAX_BYTES", "MAX_PAGES", "MAX_FORM_FIELDS", "MAX_FIELD_NAME", "MAX_FIELD_OPTIONS"]) {
    assert.equal(editor[name], expected[name], `${name} is exported as ${expected[name]}`);
  }
  assert.equal(history.HISTORY_LIMIT, 20, "the history keeps the opened file plus 20 steps");
  assert.equal(history.HISTORY_BYTES, 96 * 1024 * 1024, "the history budget is 96 MB");
  assert.match(record, /last 20 steps within a 96 MB budget/, "the record states the history bounds");
  assert.match(record, /over-2000-page refusals/, "the record states the page limit");
  assert.match(record, /1–8 lengths/, "the record states the dash-length limit");
  assert.match(record, /0 to 1000/, "the record states the dash-phase limit");
});

test("the editor refuses what the record says it refuses", async () => {
  const empty = await editor.loadEditorDocument(new Uint8Array());
  assert.deepEqual([empty.ok, empty.reason], [false, "empty"]);
  const damaged = await editor.loadEditorDocument(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]));
  assert.equal(damaged.ok, false, "a damaged file is refused");
  assert.match(String(damaged.message), /could not be opened/, "the refusal explains itself");
  const source = fs.readFileSync(path.join(root, "src", "pdf-editor.js"), "utf8");
  for (const claim of ["hasXFA", "Remove its password first", "page tree is missing or damaged"]) {
    assert.ok(source.includes(claim), `the code still carries the ${claim} refusal`);
  }
  for (const gate of [
    "XFA forms", "Encrypted PDFs", "Rewording existing page text",
    "Link targets are written, not verified", "A dash phase is this editor's own encoding",
    "Hierarchical `parent.child` field names",
  ]) {
    assert.ok(record.includes(gate), `the record still names the remaining gate: ${gate}`);
  }
});

test("the editor stays pure, offline and free of dynamic code", () => {
  for (const file of ["pdf-editor.js", "pdf-editor-modal.js"]) {
    const text = fs.readFileSync(path.join(root, "src", file), "utf8");
    for (const forbidden of ["requestUrl(", "fetch(", "eval(", "new Function(", "innerHTML", "insertAdjacentHTML"]) {
      assert.equal(text.includes(forbidden), false, `${file} must not use ${forbidden}`);
    }
  }
});

test("every release the record lists has its notes and a shipped entry", () => {
  const versions = ["1.242.0", "1.243.0", "1.244.0", "1.245.0", "1.246.0", "1.247.0", "1.248.0", "1.249.0",
    "1.250.0", "1.251.0", "1.252.0", "1.253.0", "1.254.0", "1.255.0", "1.256.0"];
  for (const version of versions) {
    assert.ok(fs.existsSync(path.join(root, "docs", "release-notes", `${version}.md`)), `${version} has release notes`);
    assert.ok(record.includes(version), `the record names ${version}`);
  }
  assert.match(record, /docs\/release-notes\/1\.242\.0\.md` through `1\.256\.0\.md/);
});
