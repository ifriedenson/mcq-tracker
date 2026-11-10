"use strict";
/*
 * One reader for the import modals: a device File or a vault path, always
 * returning the same source shape. Keeping this in one place means the PDF
 * branch, error wording and source metadata cannot drift between modals.
 */
const { TFile } = require("obsidian");
const { documentBaseName, documentKind, extensionOf, readDocumentPages } = require("./documents");
const { readPdfPages } = require("./pdf");

async function readDocumentSource(app, options) {
  const opts = options || {};
  if (opts.file) {
    const name = opts.file.name || "";
    if (opts.pdfOnly && !/\.pdf$/i.test(name)) throw new Error(opts.notPdfMessage || "Choose a PDF first.");
    return {
      buf: await opts.file.arrayBuffer(),
      name: documentBaseName(name),
      ext: extensionOf(name),
      kind: documentKind(name),
      device: true,
      path: "",
      file: opts.file,
    };
  }
  if (opts.vaultDoc) {
    const file = app.vault.getAbstractFileByPath(opts.vaultDoc);
    if (!(file instanceof TFile)) throw new Error(opts.missingMessage || "I couldn't find that file in your vault.");
    if (opts.pdfOnly && !/\.pdf$/i.test(file.path)) throw new Error(opts.notPdfMessage || "Choose a PDF first.");
    return {
      buf: await app.vault.readBinary(file),
      name: file.basename,
      ext: extensionOf(file.path),
      kind: documentKind(file.path),
      device: false,
      path: file.path,
      file: null,
    };
  }
  throw new Error(opts.emptyMessage || "Choose a file first.");
}

/** Read the selected pages with the PDF reader or the document reader. */
async function readPagesForSource(src, spec, progress, pdfOptions) {
  if (src.kind === "pdf") return readPdfPages(src.buf, spec, progress, pdfOptions);
  return readDocumentPages(src.buf, `${src.name}.${src.ext}`, spec, progress);
}

module.exports = { readDocumentSource, readPagesForSource };
