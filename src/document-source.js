"use strict";
/*
 * One reader for the import modals: a device File or a vault path, always
 * returning the same source shape. Keeping this in one place means the PDF
 * branch, error wording and source metadata cannot drift between modals.
 */
const { TFile } = require("obsidian");
const { documentBaseName, documentKind, extensionOf, readDocumentPages } = require("./documents");
const { readPdfPages } = require("./pdf");

const MAX_SOURCE_BYTES = 80 * 1024 * 1024;
const MAX_SOURCE_MB = Math.round(MAX_SOURCE_BYTES / 1048576);

function sourceSizeError() {
  return new Error(`That file is larger than ${MAX_SOURCE_MB} MB. Choose a smaller file or split it before importing.`);
}

function assertSourceSize(size) {
  if (Number(size) > MAX_SOURCE_BYTES) throw sourceSizeError();
}

async function readDocumentSource(app, options) {
  const opts = options || {};
  if (opts.file) {
    const name = opts.file.name || "";
    if (typeof opts.file.arrayBuffer !== "function") {
      throw new Error("That file has to be chosen from this device again. Files already in your vault are imported by path.");
    }
    if (opts.pdfOnly && !/\.pdf$/i.test(name)) throw new Error(opts.notPdfMessage || "Choose a PDF first.");
    assertSourceSize(opts.file.size);
    const buf = await opts.file.arrayBuffer();
    assertSourceSize(buf && buf.byteLength);
    return {
      buf,
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
    assertSourceSize(file.stat && file.stat.size);
    const buf = await app.vault.readBinary(file);
    assertSourceSize(buf && buf.byteLength);
    return {
      buf,
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
async function readPagesForSource(src, spec, progress, pdfOptions, password) {
  if (src.kind === "pdf") return readPdfPages(src.buf, spec, progress, pdfOptions, password);
  return readDocumentPages(src.buf, `${src.name}.${src.ext}`, spec, progress);
}

module.exports = { MAX_SOURCE_BYTES, MAX_SOURCE_MB, sourceSizeError, readDocumentSource, readPagesForSource };
