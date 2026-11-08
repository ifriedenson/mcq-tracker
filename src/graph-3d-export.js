"use strict";
/*
 * Printable sheet for the Reference 3D tab.
 *
 * The image is a PNG data URL produced from the existing canvas. This module
 * only escapes text and assembles the HTML; it has no DOM, Obsidian, network or
 * third-party dependency.
 */

const { escapeHtml } = require("./util");

function printSummary(scene) {
  const curves = Array.isArray(scene && scene.curves) ? scene.curves.length : 0;
  const points = Array.isArray(scene && scene.points) ? scene.points.length : 0;
  return `3D view with ${curves} curve${curves === 1 ? "" : "s"} and ${points} point${points === 1 ? "" : "s"}.`;
}

function printDocument(scene) {
  const source = scene || {};
  const dataUrl = String(source.dataUrl || "");
  if (!/^data:image\/(png|jpeg);base64,/i.test(dataUrl)) {
    return { ok: false, reason: "canvas", message: "The 3D canvas did not produce an image to print." };
  }
  const expressions = Array.isArray(source.expressions) ? source.expressions.map((text) => String(text || "").trim()).filter(Boolean) : [];
  if (!expressions.length) return { ok: false, reason: "empty", message: "Add a surface or curve before printing the 3D view." };
  const title = String(source.title || "MCQ Tracker 3D view");
  const summary = String(source.summary || printSummary(source));
  const list = expressions.map((text) => `<li><code>${escapeHtml(text)}</code></li>`).join("");
  return {
    ok: true,
    expressions,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { margin: 16mm; }
body { color: #111; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; }
h1 { font-size: 20px; margin: 0 0 4px; }
p { margin: 0 0 12px; color: #444; }
img { display: block; max-width: 100%; height: auto; border: 1px solid #ddd; background: #fff; }
ul { margin: 12px 0 0; padding-left: 20px; }
code { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
@media print { body { margin: 0; } }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(summary)}</p>
<img src="${escapeHtml(dataUrl)}" alt="Rendered 3D scene">
<ul>${list}</ul>
</body></html>`,
  };
}

module.exports = { escapeHtml, printDocument, printSummary };
