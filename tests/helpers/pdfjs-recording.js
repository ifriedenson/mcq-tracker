"use strict";
/*
 * The real PDF.js text layer for the PDF fixtures in tests/fixtures.
 *
 * The recordings were captured from pdfjs-dist 4.10.38 (the same engine
 * Obsidian exposes as loadPdfJs) by reading the adjacent PDF bytes. This
 * helper only replays that captured Obsidian boundary; it does not parse or
 * extract text itself, so the test exercises the production readPdfPages path
 * in src/pdf.js.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const FIXTURES = path.join(__dirname, "..", "fixtures");
const RECORDINGS = require(path.join(FIXTURES, "pdfjs-recordings.json"));

function recording(name) {
  const value = RECORDINGS[name];
  if (!value) throw new Error(`No PDF.js recording named ${name}.`);
  return value;
}

function bytes(name) {
  return fs.readFileSync(path.join(FIXTURES, recording(name).file));
}

function sha256(data) {
  return crypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * A loadPdfJs provider that returns the captured PDF.js document objects for
 * these exact bytes. Any other bytes fail, so a test cannot silently use the
 * recording for a different PDF.
 */
function createRecordedPdfJs() {
  const calls = [];
  return {
    calls,
    getDocument({ data }) {
      const buffer = Buffer.from(data);
      const digest = sha256(buffer);
      const name = Object.keys(RECORDINGS).find((key) => RECORDINGS[key].sha256 === digest);
      if (!name) {
        return { promise: Promise.reject(new Error(`No PDF.js recording for ${digest}.`)) };
      }
      const record = RECORDINGS[name];
      calls.push({ name, file: record.file, sha256: digest });
      return {
        promise: Promise.resolve({
          numPages: record.numPages,
          async getPage(number) {
            const page = record.pages[number - 1];
            if (!page) throw new Error(`There is no page ${number}.`);
            return {
              async getTextContent() {
                return { items: clone(page.items) };
              },
              getViewport(options) {
                const scale = Number(options && options.scale) || 1;
                return {
                  width: page.viewport.width * scale,
                  height: page.viewport.height * scale,
                  scale,
                  transform: [scale, 0, 0, -scale, 0, page.viewport.height * scale],
                };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  };
}

module.exports = { bytes, createRecordedPdfJs, recording, sha256 };
