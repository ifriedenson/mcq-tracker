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
 * escaped pipe (\|) is literal text, so both are blanked before counting.
 */
const fs = require("fs");
const { ROOT, markdownFiles, relativePath } = require("./lib/doc-files");

const DELIMITER_CELL = /^\s*:?-+:?\s*$/;

// Splits a table row into cells. Returns null for a line that is not one.
function cellsOf(line) {
  if (!/^\s*\|/.test(line)) return null;
  const parts = line
    .replace(/`[^`]*`/g, "``")
    .replace(/\\\|/g, "\u0000")
    .split("|")
    .map((part) => part.trim());
  if (parts.length && parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function main() {
  const failures = [];
  let tables = 0;

  for (const file of markdownFiles(ROOT).sort()) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length - 1; index += 1) {
      const header = cellsOf(lines[index]);
      const delimiter = cellsOf(lines[index + 1]);
      if (!header || !delimiter) continue;
      if (!delimiter.every((cell) => DELIMITER_CELL.test(cell))) continue;
      // A table: header row, delimiter row, then the body rows.
      tables += 1;
      if (delimiter.length !== header.length) {
        failures.push(relativePath(ROOT, file) + ":" + (index + 2) +
          "  delimiter has " + delimiter.length +
          " cells but the header has " + header.length);
      }
      let row = index + 2;
      while (row < lines.length) {
        const body = cellsOf(lines[row]);
        if (!body) break;
        if (body.length !== header.length) {
          failures.push(relativePath(ROOT, file) + ":" + (row + 1) +
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
    return 1;
  }

  console.log("check-markdown-tables: " + tables + " tables have matching row widths.");
  return 0;
}

module.exports = { cellsOf, DELIMITER_CELL };

if (require.main === module) process.exit(main());
