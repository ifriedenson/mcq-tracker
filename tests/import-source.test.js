"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();

test("import modal reads a real text source through extensionOf and readDocumentPages", async () => {
  const bytes = Buffer.from("Question 1\nWhat is 2 + 2?\nA. 3\nB. 4\n\nAnswer: B\n");
  const modal = new T.PdfImportModal(
    { vault: {} },
    {
      settings: { importDefaults: {}, importOptions: {}, importFolder: "", questionFolder: "Questions" },
      backend: () => "api",
      refreshEmptyViews() {},
    },
    {}
  );
  modal.file = {
    name: "Sample questions.txt",
    async arrayBuffer() {
      return bytes;
    },
  };

  const src = await modal.readSource();
  assert.equal(src.ext, "txt");
  assert.equal(src.kind, "txt");
  assert.equal(src.name, "Sample questions");
  assert.equal(src.device, true);

  const read = await T.documents.readDocumentPages(src.buf, `${src.name}.${src.ext}`, "", () => {});
  assert.equal(read.kind, "txt");
  assert.equal(read.total, 1);
  assert.match(read.pages[0].text, /What is 2 \+ 2\?/);
});
