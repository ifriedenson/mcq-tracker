"use strict";
/*
 * Paper/print assembly for the Reference graph.
 *
 * The view paints the existing canvas scene once and hands its PNG data URL here.
 * This module only assembles a self-contained print document: escaping, the paper
 * stylesheet, the expression list and the optional data table. It has no DOM,
 * Obsidian or network dependency, and it never trusts a caller's HTML.
 */

const { escapeHtml, textValue } = require("./util");

const MAX_EXPRESSIONS = 200;
const MAX_TABLE_ROWS = 500;
const MAX_TITLE = 120;

const PRINT_STYLES = `
@page { margin: 16mm; }
* { box-sizing: border-box; }
html { background: #ffffff; }
body {
  background: #ffffff;
  color: #111111;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.45;
  margin: 0 auto;
  max-width: 170mm;
  padding: 12mm 6mm;
}
header { border-bottom: 1.5pt solid #111111; margin-bottom: 8mm; padding-bottom: 3mm; }
h1 { font-size: 20pt; margin: 0 0 2mm; }
h2 { font-size: 13pt; margin: 8mm 0 3mm; }
p { margin: 0 0 2mm; }
.meta { color: #444444; font-size: 10pt; }
figure { margin: 0; page-break-inside: avoid; }
figure img { border: 0.75pt solid #333333; display: block; height: auto; max-width: 100%; width: 100%; }
figcaption { color: #444444; font-size: 9.5pt; margin-top: 2mm; }
ol, table { margin: 0; }
ol { padding-left: 7mm; }
ol li { font-family: "Courier New", monospace; font-size: 10.5pt; margin-bottom: 1.5mm; }
table { border-collapse: collapse; font-size: 10pt; width: 100%; }
th, td { border: 0.5pt solid #777777; padding: 1.5mm 2mm; text-align: left; }
th { background: #eeeeee; font-weight: bold; }
tbody tr:nth-child(even) { background: #f7f7f7; }
footer { border-top: 0.5pt solid #999999; color: #555555; font-size: 9pt; margin-top: 10mm; padding-top: 2mm; }
@media print {
  body { max-width: none; padding: 0; }
  a { color: inherit; text-decoration: none; }
  figure, table, ol { page-break-inside: avoid; }
}
`;

function cleanTitle(value) {
  return textValue(value).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
}

function cleanExpressions(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => textValue(value).trim())
    .filter(Boolean)
    .slice(0, MAX_EXPRESSIONS);
}

function formatBound(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "\u2014";
  return String(Number(number.toPrecision(8)));
}

function cleanTable(table) {
  const headers = (table && Array.isArray(table.headers) ? table.headers : [])
    .map((header) => textValue(header).trim())
    .filter(Boolean);
  if (!headers.length) return { headers: [], rows: [] };
  const rows = (table && Array.isArray(table.rows) ? table.rows : [])
    .slice(0, MAX_TABLE_ROWS)
    .map((row) => {
      const cells = {};
      for (const header of headers) cells[header] = textValue(row && row[header]);
      return cells;
    });
  return { headers, rows };
}

/** One sentence for the accessible summary; the sheet carries the same wording. */
function printSummary(expressions, table) {
  const count = cleanExpressions(expressions).length;
  const clean = cleanTable(table);
  const expressionText = count ? `${count} expression${count === 1 ? "" : "s"}` : "no expressions";
  const tableText = clean.headers.length
    ? ` and a ${clean.headers.length}-column table with ${clean.rows.length} row${clean.rows.length === 1 ? "" : "s"}`
    : "";
  return `Print sheet with the graph image, ${expressionText}${tableText}.`;
}

/**
 * Assemble a complete print document. The image must already be a PNG or JPEG data
 * URL painted by the existing scene renderer; no canvas work happens here.
 */
function printDocument(input) {
  const source = input && typeof input === "object" ? input : {};
  const expressions = cleanExpressions(source.expressions);
  if (!expressions.length) {
    return { ok: false, reason: "empty", message: "Add an expression before printing the graph." };
  }
  const imageDataUrl = textValue(source.imageDataUrl).trim();
  if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
    return { ok: false, reason: "canvas", message: "The graph image could not be prepared for printing." };
  }
  const clean = cleanTable(source.table);
  const title = cleanTitle(source.title) || "Graph";
  const window = source.window && typeof source.window === "object" ? source.window : {};
  const bounds = `x from ${formatBound(window.xMin)} to ${formatBound(window.xMax)}, y from ${formatBound(window.yMin)} to ${formatBound(window.yMax)}.`;
  const pair = source.regression && source.regression.x && source.regression.y
    ? ` Regression uses ${escapeHtml(source.regression.x)} and ${escapeHtml(source.regression.y)}.`
    : "";
  const expressionItems = expressions.map((expression) => `<li>${escapeHtml(expression)}</li>`).join("\n        ");
  const tableHtml = clean.headers.length
    ? `\n      <h2>Data table</h2>\n      <table>\n        <thead><tr>${clean.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>\n        <tbody>\n${clean.rows
      .map((row) => `          <tr>${clean.headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`)
      .join("\n")}\n        </tbody>\n      </table>`
    : "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Window: ${escapeHtml(bounds)}</p>
    <p class="meta">${escapeHtml(printSummary(expressions, clean))}${pair}</p>
  </header>
  <figure>
    <img src="${escapeHtml(imageDataUrl)}" alt="${escapeHtml(`Graph of ${expressions.length} expression${expressions.length === 1 ? "" : "s"}`)}">
    <figcaption>${escapeHtml(bounds)}</figcaption>
  </figure>
  <h2>Expressions</h2>
  <ol>
        ${expressionItems}
  </ol>${tableHtml}
  <footer>Exported from MCQ Tracker. Everything in this sheet was drawn and computed locally.</footer>
</body>
</html>`;
  return {
    ok: true,
    html,
    title,
    expressions: expressions.length,
    columns: clean.headers.length,
    rows: clean.rows.length,
  };
}

module.exports = {
  MAX_EXPRESSIONS,
  MAX_TABLE_ROWS,
  PRINT_STYLES,
  escapeHtml,
  printSummary,
  printDocument,
};
