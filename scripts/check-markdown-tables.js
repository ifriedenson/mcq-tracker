#!/usr/bin/env node
"use strict";
/*
 * Checks that every Markdown table row has the same number of cells as its
 * header, and that the delimiter line agrees with the header too.
 *
 * The docs lean on tables — plugin maps, status rows, audit verdicts — and a
 * row with a stray "|" fails silently: the extra cell is pushed past the last
 * column and the row reads as if the fact it records belongs somewhere else.
 * A code span that holds a pipe (|) is a value, not a boundary, and an
 * escaped pipe (\|) is literal text, so both are set aside before counting.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = ["node_modules", ".git"];
const DELIMITER_CELL = /^\s*:?-{1,}:?\s*$/;

function markdownFiles(dir = ROOT, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name) || entry.name.startsWith(".")) continue;
      markdownFiles(path.join(dir, entry.name), files);
    } else if (entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

// Splits a table row into cell text, ignoring pipes inside code spans and
// escaped pipes. Returns null for a line that is not a table row.
function cellsOf(line) {
  if (!/^\s*\|/.test(line)) return null;
  let stripped = "";
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === "\\" && line[i + 1] === "|") {
      stripped += "\u0000";
      i += 2;
    } else if (char === "`") {
      const end = line.indexOf("`", i + 1);
      stripped += "\u0001";
      i = end === -1 ? line.length : end + 1;
    } else {
      stripped += char;
      i += 1;
    }
  }
  const parts = stripped.split("|").map((part) => part.trim());
  if (parts.length && parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const failures = [];
let tables = 0;

for (const file of markdownFiles().sort()) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = cellsOf(lines[index]);
    const delimiter = cellsOf(lines[index + 1]);
    if (!header || !delimiter) continue;
    if (!delimiter.every((cell) => DELIMITER_CELL.test(cell))) continue;
    // A table: header row, delimiter row, then the body rows.
    tables += 1;
    if (delimiter.length !== header.length) {
      failures.push(relative(file) + ":" + (index + 2) +
        "  delimiter has " + delimiter.length +
        " cells but the header has " + header.length);
    }
    let row = index + 2;
    while (row < lines.length) {
      const body = cellsOf(lines[row]);
      if (!body) break;
      if (body.length !== header.length) {
        failures.push(relative(file) + ":" + (row + 1) +
          "  row has " + body.length +
          " cells but the table has " + header.length);
      }
      row += 1;
    }
    index = row;
  }
}

if (failures.length) {
  console.error("check-markdown-tables: " + failures.length + " bad row(s) in " + tables + " tables\n");
  for (const failure of failures.slice(0, 30)) console.error("  " + failure);
  if (failures.length > 30) console.error("  …and " + (failures.length - 30) + " more");
  console.error("\nSplit the note out of the row, or escape a literal pipe as \\|.");
  process.exit(1);
}

console.log("check-markdown-tables: " + tables + " tables have matching row widths.");
