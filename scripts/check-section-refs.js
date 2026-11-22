#!/usr/bin/env node
"use strict";
/*
 * Checks that every "§N.N" cross-reference in the Markdown actually lands on a
 * section that exists, so a renumbering or a collapsed section cannot leave a
 * reader chasing a heading that is gone.
 *
 * This exists because of the 1.307.32 plan cleanup: collapsing plan.md's
 * October 28 backlog into one status table removed ten subsections and left 58
 * references pointing at them across plan.md and six other documents. Nothing
 * failed — the plan still built, the status block still matched, and every
 * dangling reference looked exactly like a working one until it was followed.
 *
 * A reference resolves when the number names:
 *   - a heading or a bold "**5.16.1 Title**" lead in plan.md,
 *   - a heading in the file that carries the reference (its own sections),
 *   - a section of another .md named on the same line ("`grow.md` §4.7").
 *
 * Numbering that predates a restructure is allowed to keep its old numbers
 * when the file is an archive of the text as it was written; EXEMPT names those
 * files and the reason each one is exempt.
 */
const fs = require("fs");
const path = require("path");
const { ROOT, markdownFiles, relativePath } = require("./lib/doc-files");

const HEADING = /^#{1,4}\s+(\d+[a-z]?(?:\.\d+)*)[.\s]/;
const BOLD_LEAD = /^\*\*(\d+[a-z]?(?:\.\d+)*)[.\s]/;
const LETTER_HEADING = /^#{1,4}\s+([A-C])[.\s]/;
const REFERENCE = /§\s*(\d+[a-z]?(?:\.\d+)*|[A-C](?![\w]))/g;
const MARKDOWN_NAME = /`?([\w/.-]+\.md)`?/g;

// Files whose section numbers are historical and must stay as written.
const EXEMPT = {
  "docs/archive/plan-brainstorms.md":
    "archive kept verbatim from 1.106.0; its §5.22.4 predates the status table",
};

function sectionsOf(text) {
  const found = new Set();
  for (const line of text.split(/\r?\n/)) {
    for (const pattern of [HEADING, BOLD_LEAD]) {
      const match = pattern.exec(line);
      if (match) found.add(match[1]);
    }
    const letter = LETTER_HEADING.exec(line);
    if (letter) found.add(letter[1]);
  }
  return found;
}

function main() {
  const cache = new Map();

  function sectionsOfFile(file) {
    if (!cache.has(file)) {
      cache.set(file, fs.existsSync(file) ? sectionsOf(fs.readFileSync(file, "utf8")) : new Set());
    }
    return cache.get(file);
  }

  const planSections = sectionsOfFile(path.join(ROOT, "plan.md"));
  const files = markdownFiles(ROOT).sort();

  function namedDocument(line, refIndex, fromFile) {
    const names = [];
    for (const match of line.matchAll(MARKDOWN_NAME)) {
      if (match.index >= refIndex) break;
      names.push(match[1]);
    }
    for (const name of names.reverse()) {
      for (const candidate of [path.join(path.dirname(fromFile), name), path.join(ROOT, name), path.join(ROOT, "docs", name)]) {
        if (fs.existsSync(candidate) && candidate.endsWith(".md")) return candidate;
      }
      for (const candidate of files) {
        if (path.basename(candidate) === path.basename(name)) return candidate;
      }
    }
    return null;
  }

  const failures = [];
  let checked = 0;

  for (const file of files) {
    const name = relativePath(ROOT, file);
    const exempt = EXEMPT[name];
    const own = new Set([...planSections, ...sectionsOfFile(file)]);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const match of line.matchAll(REFERENCE)) {
        checked += 1;
        const section = match[1];
        if (own.has(section)) continue;
        const other = namedDocument(line, match.index, file);
        if (other && sectionsOfFile(other).has(section)) continue;
        if (exempt) continue;
        failures.push({
          where: name + ":" + (index + 1),
          section,
          target: other ? relativePath(ROOT, other) : "plan.md",
          line: line.trim(),
        });
      }
    });
  }

  const fileList = files.filter((file) => !EXEMPT[relativePath(ROOT, file)]);

  if (failures.length) {
    console.error("check-section-refs: " + failures.length + " § reference(s) point at nothing\n");
    for (const failure of failures) {
      console.error("  " + failure.where + "  §" + failure.section + " is not a section of " + failure.target);
      console.error("      " + (failure.line.length > 110 ? failure.line.slice(0, 107) + "..." : failure.line));
    }
    console.error("\nPoint the reference at a section that exists, or restore the heading it names.");
    return 1;
  }

  const exemptNote = Object.keys(EXEMPT).length
    ? " (" + Object.keys(EXEMPT).length + " historical file(s) exempt)"
    : "";
  console.log(
    "check-section-refs: " + checked + " references resolve across " + fileList.length + " files" + exemptNote + "."
  );
  return 0;
}

module.exports = { sectionsOf, EXEMPT };

if (require.main === module) process.exit(main());
