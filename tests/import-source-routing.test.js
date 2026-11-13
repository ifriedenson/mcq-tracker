"use strict";
/*
 * Two ways into the importer: a device File (read through arrayBuffer) and a
 * file already in the vault (read through the vault by path). Passing a vault
 * TFile used to reach the device reader and fail with the raw runtime string
 * "opts.file.arrayBuffer is not a function".
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();

async function boot() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("a vault file passed to the importer is read by path, not as a device file", async () => {
  const { app, plugin } = await boot();
  const file = { path: "Papers/Unit A.pdf", name: "Unit A.pdf", basename: "Unit A", extension: "pdf" };
  app.vault.getAbstractFileByPath = (path) => (path === file.path ? file : null);
  const modal = new T.PdfImportModal(app, plugin, { file });
  assert.equal(modal.vaultDoc, "Papers/Unit A.pdf", "the vault path carries the file");
  assert.equal(modal.file, null, "nothing is handed to the device reader");
  assert.deepEqual(modal.files, [], "a vault pick is not a device batch");
});

test("a device file keeps its own path through the importer", async () => {
  const { app, plugin } = await boot();
  const file = { name: "Unit B.pdf", size: 10, arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer };
  const modal = new T.PdfImportModal(app, plugin, { file });
  assert.equal(modal.vaultDoc, "", "a device file is not treated as a vault path");
  assert.equal(modal.file, file);
});

test("a file with no bytes explains how to pick it again instead of a runtime string", async () => {
  const { readDocumentSource } = require("../src/document-source");
  await assert.rejects(
    () => readDocumentSource(makeApp([]), { file: { name: "Unit A.pdf" } }),
    /has to be chosen from this device again/,
    "the message names the fix"
  );
  const source = await readDocumentSource(makeApp([]), {
    file: { name: "Unit A.pdf", arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer },
  });
  assert.equal(source.device, true, "a real device file still reads normally");
});
