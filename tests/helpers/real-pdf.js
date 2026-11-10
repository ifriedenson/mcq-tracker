"use strict";
/*
 * Real PDFs for the import tests: pdf-lib writes the bytes and the reader below
 * parses those bytes again, so the importer runs against an actual PDF text
 * layer instead of a hand-fed item list. Obsidian still supplies its own PDF.js
 * at runtime; this adapter stands in for that library only.
 */
const { PDFDocument, PDFName, PDFRawStream, PDFRef, StandardFonts, decodePDFRawStream } = require("../../vendor/pdf-lib.js");

const FONT_SIZE = 12;

// a valid 1x1 transparent PNG
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

/** The lines used by the readable sample: two numbered questions with choices. */
const TEXT_LINES = [
  "Question 1: What is 2 + 2?",
  "A. 3",
  "B. 4",
  "Question 2: Which gas do plants take in?",
  "A. Oxygen",
  "B. Carbon dioxide",
];

/** A real PDF that carries the sample text as a selectable text layer. */
async function textPdf(lines) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const list = Array.isArray(lines) && lines.length ? lines : TEXT_LINES;
  list.forEach((text, i) => {
    page.drawText(text, { x: 72, y: 720 - i * 24, size: FONT_SIZE, font });
  });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/** A real PDF whose page holds a picture and no text at all, like a scan. */
async function imageOnlyPdf() {
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(PNG_1X1);
  const page = doc.addPage([612, 792]);
  page.drawImage(image, { x: 72, y: 600, width: 200, height: 200 });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/* ---- reading the bytes back, in the shape pdf.js gives readPdfPages ---- */

function streamText(ctx, value) {
  const stream = value instanceof PDFRef ? ctx.lookup(value) : value;
  if (!stream) return "";
  if (Array.isArray(stream)) return stream.map((part) => streamText(ctx, part)).join("\n");
  if (typeof stream.asArray === "function") {
    return stream.asArray().map((part) => streamText(ctx, part)).join("\n");
  }
  if (stream instanceof PDFRawStream) {
    const filter = stream.dict && stream.dict.get(PDFName.of("Filter"));
    const filters = filter ? String(filter) : "";
    const bytes = filters && filters !== "null" ? decodePDFRawStream(stream).decode() : stream.contents;
    return Buffer.from(bytes || []).toString("latin1");
  }
  if (stream.contents) return Buffer.from(stream.contents).toString("latin1");
  return "";
}

function decodeLiteral(raw) {
  return String(raw)
    .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" }[c] || c))
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function decodeHex(raw) {
  const clean = String(raw).replace(/\s+/g, "");
  return Buffer.from(clean.length % 2 ? clean + "0" : clean, "hex").toString("latin1");
}

/**
 * Text items with a transform, the fields itemsToLines/textBoxes read. Each
 * drawText run is its own BT/ET block in a pdf-lib file, so the block's Tm gives
 * the line position and consecutive lines differ by their y.
 */
function textItems(content) {
  const items = [];
  for (const block of String(content).match(/BT[\s\S]*?ET/g) || []) {
    const token =
      /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm|\/([^\s/<>\[\]()]+)\s+(-?\d+(?:\.\d+)?)\s+Tf|<([0-9A-Fa-f\s]+)>\s*Tj|\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
    let at = [1, 0, 0, 1, 0, 0];
    let size = FONT_SIZE;
    let m;
    while ((m = token.exec(block))) {
      if (m[1] !== undefined) {
        at = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])];
      } else if (m[7] !== undefined) {
        size = Number(m[8]) || FONT_SIZE;
      } else {
        let str = "";
        if (m[9] !== undefined) str = decodeHex(m[9]);
        else if (m[10] !== undefined) str = decodeLiteral(m[10]);
        else if (m[11] !== undefined) {
          const inner = /<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\()])*)\)/g;
          let part;
          while ((part = inner.exec(m[11]))) str += part[1] !== undefined ? decodeHex(part[1]) : decodeLiteral(part[2]);
        }
        if (!str) continue;
        items.push({
          str,
          hasEOL: false,
          transform: at.slice(),
          width: str.length * size * 0.5,
          height: size,
        });
      }
    }
  }
  return items;
}

/**
 * A `loadPdfJs` provider shaped like Obsidian's: getDocument({data}).promise,
 * numPages, getPage(n), getTextContent().items, getViewport({scale}), destroy().
 * `failOn` makes the nth opened document reject, for a post-check failure test.
 */
function makePdfRuntime() {
  let opened = 0;
  let failOn = 0;
  return {
    get opened() {
      return opened;
    },
    failOn(n) {
      failOn = Number(n) || 0;
    },
    getDocument({ data }) {
      opened += 1;
      const call = opened;
      return {
        promise: (async () => {
          if (failOn && call === failOn) throw new Error("The PDF reader stopped.");
          const doc = await PDFDocument.load(data instanceof Uint8Array ? data : new Uint8Array(data));
          const pages = doc.getPages();
          return {
            numPages: pages.length,
            async getPage(n) {
              const page = pages[n - 1];
              if (!page) throw new Error(`There is no page ${n}.`);
              const size = page.getSize();
              const items = textItems(streamText(doc.context, page.node.Contents()));
              return {
                async getTextContent() {
                  return { items };
                },
                getViewport(options) {
                  const scale = Number(options && options.scale) || 1;
                  return { width: size.width, height: size.height, scale, transform: [scale, 0, 0, -scale, 0, size.height * scale] };
                },
              };
            },
            async destroy() {},
          };
        })(),
      };
    },
  };
}

/* ---- a vault that remembers what an import actually wrote ---- */

/**
 * `makeApp` plus the folder and adapter behaviour the importer uses: folder
 * lookup, createFolder, adapter list/read/write/remove/rmdir, and an ordered
 * op log. It never touches a real vault.
 */
function makeTrackedApp(notes) {
  const { makeApp } = require("./fake");
  const app = makeApp(notes || []);
  const dirs = new Set();
  const files = new Map();
  for (const f of app.files) files.set(f.path, f);
  const ops = [];
  const state = { app, dirs, files, ops, failCreate: null, failCreateBinary: null };
  const clean = (p) => String(p || "").replace(/^\/+|\/+$/g, "");

  const childrenOf = (dir) => {
    const prefix = dir ? `${dir}/` : "";
    const out = [];
    for (const f of files.values()) {
      if (!f.path.startsWith(prefix)) continue;
      if (!f.path.slice(prefix.length).includes("/")) out.push(f);
    }
    for (const d of dirs) {
      if (d === dir || !d.startsWith(prefix)) continue;
      if (!d.slice(prefix.length).includes("/")) out.push({ path: d, children: [] });
    }
    return out;
  };

  app.vault.getAbstractFileByPath = (path) => {
    const p = clean(path);
    if (files.has(p)) return files.get(p);
    if (dirs.has(p)) return { path: p, children: childrenOf(p) };
    return null;
  };

  const create = app.vault.create;
  app.vault.create = async (path, text) => {
    const p = clean(path);
    if (state.failCreate && state.failCreate(p)) {
      ops.push(["create-failed", p]);
      throw new Error("The disk is full.");
    }
    const f = await create.call(app.vault, p, text);
    files.set(p, f);
    ops.push(["create", p]);
    return f;
  };

  const createBinary = app.vault.createBinary;
  app.vault.createBinary = async (path, data) => {
    const p = clean(path);
    if (state.failCreateBinary && state.failCreateBinary(p)) {
      ops.push(["createBinary-failed", p]);
      throw new Error("The disk is full.");
    }
    const f = await createBinary.call(app.vault, p, data);
    files.set(p, f);
    ops.push(["createBinary", p]);
    return f;
  };

  app.vault.createFolder = async (path) => {
    const p = clean(path);
    dirs.add(p);
    ops.push(["mkdir", p]);
  };

  // The base app keeps its own file array; point every reader at the tracked one.
  app.vault.getFiles = () => [...files.values()];
  app.vault.getMarkdownFiles = () => [...files.values()].filter((f) => /\.md$/i.test(f.path));
  app.vault.getAllLoadedFiles = () => [...files.values()];

  app.vault.adapter = {
    async exists(path) {
      const p = clean(path);
      return files.has(p) || dirs.has(p);
    },
    async list(path) {
      const dir = clean(path);
      const prefix = dir ? `${dir}/` : "";
      const listedFiles = [];
      const listedFolders = [];
      for (const f of files.keys()) {
        if (f.startsWith(prefix) && !f.slice(prefix.length).includes("/")) listedFiles.push(f);
      }
      for (const d of dirs) {
        if (d !== dir && d.startsWith(prefix) && !d.slice(prefix.length).includes("/")) listedFolders.push(d);
      }
      ops.push(["list", dir]);
      return { files: listedFiles, folders: listedFolders };
    },
    async read(path) {
      const f = files.get(clean(path));
      if (!f) throw new Error(`There is no ${path}.`);
      return f.text || "";
    },
    async write(path, text) {
      const p = clean(path);
      const f = files.get(p);
      if (f) f.text = text;
      else {
        const made = { path: p, basename: p.replace(/^.*\//, "").replace(/\.[^.]+$/, ""), extension: p.replace(/^.*\./, ""), text, fm: {}, headings: [] };
        files.set(p, made);
        app.files.push(made);
      }
      ops.push(["write", p]);
    },
    async remove(path) {
      const p = clean(path);
      files.delete(p);
      const at = app.files.findIndex((f) => f.path === p);
      if (at >= 0) app.files.splice(at, 1);
      ops.push(["remove", p]);
    },
    async rmdir(path) {
      const p = clean(path);
      const prefix = `${p}/`;
      const hasChild = [...files.keys()].some((f) => f.startsWith(prefix)) || [...dirs].some((d) => d !== p && d.startsWith(prefix));
      if (hasChild) {
        ops.push(["rmdir-refused", p]);
        throw new Error(`The folder ${p} is not empty.`);
      }
      dirs.delete(p);
      ops.push(["rmdir", p]);
    },
  };

  return state;
}

module.exports = { FONT_SIZE, TEXT_LINES, imageOnlyPdf, makePdfRuntime, makeTrackedApp, textPdf };
