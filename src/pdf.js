"use strict";
const { loadPdfJs } = require("obsidian");
const { pad, str } = require("./util");

/* ------------------------------------------------------------------- view */

/* ------------------------------------------------------------ PDF import (AI) */

function parsePageRange(spec, total) {
  const s = str(spec).trim();
  if (!s) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set();
  for (const part of s.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error(`I couldn't read the page range "${s}". Use something like 1-10 or 2,4,6-8.`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) if (p >= 1 && p <= total) set.add(p);
  }
  const out = [...set].sort((x, y) => x - y);    if (!out.length) throw new Error(`That page range has no pages (the document has ${total}).`);
  return out;
}

/** 2D matrix product, the same one pdf.js uses for [a b c d e f] transforms. */
function matMul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** Text lines with their vertical position (in the page picture's pixels), in reading order. */
function itemsToLines(items, viewport) {
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (!it || typeof it.str !== "string") continue;
    const y = it.transform && viewport ? matMul(viewport.transform, it.transform)[5] : null;
    if (!cur || (y !== null && cur.y !== null && Math.abs(y - cur.y) > 3)) {
      cur = { text: "", y };
      lines.push(cur);
    }
    cur.text += it.str;
    if (it.hasEOL) cur = null;
  }
  return lines.map((l) => ({ text: l.text.replace(/[ \t]+$/, ""), y: l.y })).filter((l) => l.text.trim());
}

/** Where each piece of text sits on the page picture, so figures can be told apart from text. */
function textBoxes(items, viewport) {
  const out = [];
  for (const it of items) {
    if (!it || typeof it.str !== "string" || !it.str.trim() || !it.transform) continue;
    const t = matMul(viewport.transform, it.transform);
    const w = (it.width || 0) * viewport.scale;
    const h = (it.height || 0) * viewport.scale;
    out.push({ x0: t[4], x1: t[4] + w, y0: t[5] - h, y1: t[5] + h * 0.25, s: it.str.trim() });
  }
  return out;
}

function figMarker(f) {
  return `[FIGURE page ${f.page}: ![[${f.path}]]${f.pagePath ? ` (the whole page: ![[${f.pagePath}]])` : ""}]`;
}

/** The page's text with a marker line where each figure sits. */
function pageText(lines, figs) {
  const out = [];
  const pending = [...figs].sort((a, b) => a.y0 - b.y0);
  for (const l of lines) {
    while (pending.length && l.y !== null && l.y >= pending[0].y0) out.push(figMarker(pending.shift()));
    out.push(l.text);
  }
  for (const f of pending) out.push(figMarker(f));
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Finds pictures, charts and diagrams on a rendered page: anything that is ink but not text.
 * data is RGBA pixels (W x H). boxes are the text boxes in the same pixel units. Returns pixel boxes.
 */
function detectFigures(data, W, H, boxes, scale) {
  const cell = Math.max(4, Math.round(3 * scale));
  const gw = Math.ceil(W / cell);
  const gh = Math.ceil(H / cell);
  const mask = new Uint8Array(W * H);
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x0 - 1));
    const x1 = Math.min(W, Math.ceil(b.x1 + 1));
    const y0 = Math.max(0, Math.floor(b.y0 - 1));
    const y1 = Math.min(H, Math.ceil(b.y1 + 1));
    for (let y = y0; y < y1; y++) mask.fill(1, y * W + x0, y * W + x1);
  }
  const ink = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) {
    const gy = (y / cell) | 0;
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 20) continue;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 235) ink[gy * gw + ((x / cell) | 0)] = 1;
    }
  }

  // group nearby ink into blobs
  const r = Math.max(2, Math.ceil((8 * scale) / cell));
  const seen = new Uint8Array(gw * gh);
  const comps = [];
  for (let s = 0; s < ink.length; s++) {
    if (!ink[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, n = 0;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % gw;
      const cy = (c / gw) | 0;
      n++;
      if (cx < minx) minx = cx;
      if (cx > maxx) maxx = cx;
      if (cy < miny) miny = cy;
      if (cy > maxy) maxy = cy;
      for (let dy = -r; dy <= r; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= gh) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= gw) continue;
          const k = ny * gw + nx;
          if (ink[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
    }
    comps.push({ x0: minx * cell, y0: miny * cell, x1: (maxx + 1) * cell, y1: (maxy + 1) * cell, n });
  }

  const minSide = 28 * scale;
  let figs = [];
  for (const c of comps) {
    const w = c.x1 - c.x0;
    const h = c.y1 - c.y0;
    if (w < minSide || h < minSide) continue; // specks, bullets, icons
    if ((w > 0.5 * W && h < 12 * scale) || (h > 0.5 * H && w < 12 * scale)) continue; // rules and borders
    if (c.y1 < 0.07 * H || c.y0 > 0.93 * H) continue; // logos in the header and footer
    if (w * h > 0.85 * W * H) continue; // a page frame
    if ((c.n * cell * cell) / (w * h) < 0.01) continue; // almost nothing in it
    let tArea = 0;
    for (const b of boxes) {
      const ox = Math.min(c.x1, b.x1) - Math.max(c.x0, b.x0);
      const oy = Math.min(c.y1, b.y1) - Math.max(c.y0, b.y0);
      if (ox > 0 && oy > 0) tArea += ox * oy;
    }
    if (tArea / (w * h) > 0.35) continue; // a shaded box that is mostly text
    figs.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
  }

  // take in axis labels and captions that sit on or right next to the figure
  const pad = 6 * scale;
  const reach = 20 * scale;
  for (const f of figs) {
    const g = { x0: f.x0 - pad, y0: f.y0 - pad, x1: f.x1 + pad, y1: f.y1 + pad };
    const near = { x0: f.x0 - reach, y0: f.y0 - reach, x1: f.x1 + reach, y1: f.y1 + reach };
    for (const b of boxes) {
      const area = (b.x1 - b.x0) * (b.y1 - b.y0);
      if (area <= 0) continue;
      const label = typeof b.s === "string" && b.s.length <= 24 && b.x1 - b.x0 < 0.3 * W; // a tick, a label, a legend entry
      const g2 = label ? near : g;
      const ox = Math.min(g2.x1, b.x1) - Math.max(g2.x0, b.x0);
      const oy = Math.min(g2.y1, b.y1) - Math.max(g2.y0, b.y0);
      if (ox > 0 && oy > 0 && (ox * oy) / area >= (label ? 0.5 : 0.6)) {
        f.x0 = Math.min(f.x0, b.x0);
        f.y0 = Math.min(f.y0, b.y0);
        f.x1 = Math.max(f.x1, b.x1);
        f.y1 = Math.max(f.y1, b.y1);
      }
    }
    const m = 4 * scale;
    f.x0 = Math.max(0, f.x0 - m);
    f.y0 = Math.max(0, f.y0 - m);
    f.x1 = Math.min(W, f.x1 + m);
    f.y1 = Math.min(H, f.y1 + m);
  }

  // merge boxes that overlap
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < figs.length; i++) {
      for (let j = i + 1; j < figs.length; j++) {
        const a = figs[i];
        const b = figs[j];
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
          figs[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          figs.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return figs.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0).slice(0, 8);
}

async function renderPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { canvas, ctx, viewport };
}

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("The picture couldn't be created."));
      resolve(await blob.arrayBuffer());
    }, "image/png");
  });
}

function cropToPng(canvas, box) {
  const w = Math.max(1, Math.ceil(box.x1 - box.x0));
  const h = Math.max(1, Math.ceil(box.y1 - box.y0));
  const c = activeDocument.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(canvas, box.x0, box.y0, w, h, 0, 0, w, h);
  return canvasToPng(c).finally(() => {
    c.width = 0;
  });
}

/**
 * Reads the chosen pages. When `cap` is given, every page is also drawn so pictures can be cut out
 * and saved: cap = { prefix, scale, pages, save(name, arrayBuffer) -> vault path }.
 */
async function readPdfPages(buf, spec, progress, cap) {
  if (typeof loadPdfJs !== "function") throw new Error("This version of Obsidian can't read PDFs from plugins.");
  const pdfjs = await loadPdfJs();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  } catch (e) {
    throw new Error("I couldn't open that PDF. It may be damaged or password protected.");
  }
  try {
    const wanted = parsePageRange(spec, doc.numPages);
    const pages = [];
    const warnings = [];
    let figCount = 0;
    for (let i = 0; i < wanted.length; i++) {
      const n = wanted[i];
      progress(`Reading page ${n} (${i + 1} of ${wanted.length})...`);
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      const pad2 = String(n).padStart(2, "0");
      let figs = [];
      let vp = page.getViewport({ scale: 1 });
      if (cap) {
        try {
          const { canvas, ctx, viewport } = await renderPage(page, cap.scale || 2);
          vp = viewport;
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = detectFigures(img.data, canvas.width, canvas.height, textBoxes(tc.items, viewport), viewport.scale);
          let pagePath = "";
          if (cap.pages) pagePath = await cap.save(`${cap.prefix}-p${pad2}.png`, await canvasToPng(canvas));
          let k = 0;
          for (const f of found) {
            k++;
            const path = await cap.save(`${cap.prefix}-p${pad2}-fig${k}.png`, await cropToPng(canvas, f));
            figs.push({ page: n, y0: f.y0, path, pagePath });
            figCount++;
          }
          canvas.width = 0;
        } catch (e) {
          warnings.push(`Page ${n}: couldn't capture pictures (${e && e.message ? e.message : e}).`);
        }
      }
      pages.push({ n, text: pageText(itemsToLines(tc.items, vp), figs), figs: figs.length });
    }
    return { pages, total: doc.numPages, warnings, figCount };
  } finally {
    try {
      await doc.destroy();
    } catch (e) {
      /* ignore */
    }
  }
}

/** Groups pages into batches; the last page of a batch is repeated at the start of the next so a split question is seen whole. */
function chunkPages(pages, maxChars, maxPages) {
  const real = pages.filter((p) => p.text.trim().length > 20);
  const chunks = [];
  let i = 0;
  while (i < real.length) {
    let chars = 0;
    let j = i;
    while (j < real.length && j - i < maxPages && (j === i || chars + real[j].text.length <= maxChars)) {
      chars += real[j].text.length;
      j++;
    }
    chunks.push(real.slice(i, j));
    if (j >= real.length) break;
    i = j > i + 1 ? j - 1 : j;
  }
  return chunks;
}

function chunkText(chunk) {
  return chunk.map((p) => `--- Page ${p.n} ---\n${p.text.trim()}`).join("\n\n");
}

function slugId(s) {
  return str(s).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "Q";
}

module.exports = {
  parsePageRange,
  matMul,
  itemsToLines,
  textBoxes,
  figMarker,
  pageText,
  detectFigures,
  renderPage,
  canvasToPng,
  cropToPng,
  readPdfPages,
  chunkPages,
  chunkText,
  slugId,
};
