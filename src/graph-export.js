"use strict";
/*
 * Export helpers for the Reference graph.
 *
 * Pure functions only: the view owns the canvas, the vault and the clipboard. `csvCell`,
 * `tableCsv`, `expressionsText`, `exportScale` and `exportFileName` are deterministic so the
 * rows and values that leave the block can be tested without a DOM or an Obsidian vault.
 */

/** One CSV field: quoted only when it contains a comma, a quote or a line break. */
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The data table as CSV. Exactly the strings the table holds are written, in table order;
 * a row whose cells are all blank is skipped, and an empty table returns "". Named
 * headers carry extra table columns; without them the historical x,y header is kept.
 */
function tableCsv(rows, headers) {
  const names = Array.isArray(headers) && headers.length ? headers.map(String) : ["x", "y"];
  const list = Array.isArray(rows) ? rows : [];
  const filled = list.filter((row) => row && names.some((name) => String(row[name] === undefined ? "" : row[name]).trim()));
  if (!filled.length) return "";
  const lines = [names.map(csvCell).join(",")];
  for (const row of filled) lines.push(names.map((name) => csvCell(row[name])).join(","));
  return lines.join("\n");
}

/** The non-blank expression rows' source text, one per line, in list order. */
function expressionsText(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => (row && typeof row.text === "string" ? row.text : ""))
    .filter((text) => text.trim())
    .join("\n");
}

/** The export scale: the device pixel ratio, bounded so a huge ratio cannot exhaust memory. */
function exportScale(ratio) {
  const value = Number(ratio);
  if (!Number.isFinite(value)) return 1;
  return Math.min(3, Math.max(1, value));
}

/** A collision-free name such as graph-20261102-220509.png; invalid dates fall back to "now". */
function exportFileName(prefix, when, extension) {
  const date = when instanceof Date && Number.isFinite(when.getTime()) ? when : new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${prefix}-${stamp}.${extension}`;
}

/** Whether anything was actually drawn: samples, segments, markers, polygons, regions or data. */
function hasDrawableContent(graph) {
  const rows = graph && Array.isArray(graph.rows) ? graph.rows : [];
  const drawn = rows.some(
    (row) =>
      (row.points && row.points.some((point) => point && point.y !== null && Number.isFinite(point.y))) ||
      (row.segments && row.segments.length > 0) ||
      (row.markers && row.markers.length > 0) ||
      (row.polygon && row.polygon.length > 0) ||
      row.region
  );
  const data = graph && Array.isArray(graph.data) ? graph.data.length : 0;
  const complexImage = graph && graph.complexImage && graph.complexImage.width > 0 && graph.complexImage.height > 0;
  return drawn || data > 0 || complexImage;
}

/**
 * PNG bytes from a canvas. Prefers toBlob and falls back to a data URL; every failure is a
 * plain Error with a sentence that can be shown to the reader, never a crash.
 */
function canvasPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas) {
      reject(new Error("No canvas is available on this device."));
      return;
    }
    if (typeof canvas.toBlob === "function") {
      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("The image could not be encoded on this device."));
            return;
          }
          if (typeof blob.arrayBuffer !== "function") {
            reject(new Error("The image could not be read on this device."));
            return;
          }
          blob.arrayBuffer().then(
            (buffer) => resolve(new Uint8Array(buffer)),
            () => reject(new Error("The image could not be read on this device."))
          );
        }, "image/png");
        return;
      } catch (e) {
        // fall through to the data URL
      }
    }
    if (typeof canvas.toDataURL === "function") {
      let data = "";
      try {
        data = String(canvas.toDataURL("image/png") || "");
      } catch (e) {
        reject(new Error("The image could not be encoded on this device."));
        return;
      }
      const match = /^data:image\/png;base64,(.*)$/.exec(data);
      if (!match || typeof atob !== "function") {
        reject(new Error("The image could not be encoded on this device."));
        return;
      }
      try {
        const binary = atob(match[1]);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        resolve(bytes);
      } catch (e) {
        reject(new Error("The image could not be read on this device."));
      }
      return;
    }
    reject(new Error("This device cannot encode a PNG."));
  });
}

module.exports = {
  csvCell,
  tableCsv,
  expressionsText,
  exportScale,
  exportFileName,
  hasDrawableContent,
  canvasPngBytes,
};
