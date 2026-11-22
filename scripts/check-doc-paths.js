#!/usr/bin/env node
"use strict";
/*
 * Checks that a repository path named in the docs — `src/foo.js`,
 * `tests/bar.test.js`, `vendor/lib.js` and the like — exists on disk.
 *
 * The docs are full of these: the plan points at the module that implements
 * each shipped surface, the audits name the test that proves a row, the
 * release notes list what they touched. When a file is renamed or the suite
 * is reorganised, the sentence that names the old path goes stale without
 * anyone noticing, and the next person who opens it goes looking for a file
 * that is not there. A backticked path in prose is a promise that the
 * reader can open it.
 *
 * Files that were genuinely removed stay citable: the release notes that
 * shipped them describe what is no longer in the tree. Those live in
 * REMOVED, each with the reason it is still named, instead of pretending
 * the citation is current.
 */
const fs = require("fs");
const path = require("path");
const { ROOT, markdownFiles, relativePath } = require("./lib/doc-files");
// Only the extensions this repository owns: third-party plugins have their own
// src/ trees (TypeScript, Svelte, Python), so those cites are left alone.
const CITED_PATH = /`((?:src|tests|scripts|vendor|tools|docs)\/[A-Za-z0-9_.][\w./-]*\.(?:js|mjs|cjs|json|md|css|yml|yaml))`/g;

// Historical citations: the file is gone, the sentence that names it is a
// record of what was there. Each entry says why the citation stays.
const REMOVED = new Map([
  ["src/pdf-plus.js", "removed in 1.307.29; named by the notes that shipped it"],
  ["tests/pdf-plus.test.js", "removed in 1.307.29; named by the notes that shipped it"],
  ["tests/pdf-plus-boot.test.js", "removed in 1.307.29; named by the notes that shipped it"],
  ["tests/helpers/pdf-plus-boot.js", "removed in 1.307.29; named by the notes that shipped it"],
  ["vendor/pdf-plus.js", "removed in 1.307.29; named by the notes that shipped it"],
  ["vendor/pdf-plus-css.js", "removed in 1.307.29; named by the notes that shipped it"],
  ["src/jsxgraph-adapter.js", "removed in 1.209.1; named by the 1.209.0/1.209.1 notes"],
  ["vendor/jsxgraph-core.js", "removed in 1.209.1; named by the 1.209.0/1.209.1 notes"],
]);

const failures = [];
let cited = 0;
let historical = 0;

for (const file of markdownFiles(ROOT).sort()) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(CITED_PATH)) {
      const citedPath = match[1];
      cited += 1;
      if (fs.existsSync(path.join(ROOT, citedPath))) continue;
      if (REMOVED.has(citedPath)) {
        historical += 1;
        continue;
      }
      failures.push(relativePath(ROOT, file) + ":" + (index + 1) +
        "  `" + citedPath + "` is not in the tree");
    }
  });
}

if (failures.length) {
  console.error("check-doc-paths: " + failures.length + " cited path(s) are missing\n");
  for (const failure of failures.slice(0, 30)) console.error("  " + failure);
  if (failures.length > 30) console.error("  …and " + (failures.length - 30) + " more");
  console.error("\nPoint the sentence at the file that holds the code now, or — only if the");
  console.error("citation is a record of something removed — add it to REMOVED with the reason.");
  process.exit(1);
}

console.log("check-doc-paths: " + cited + " cited paths resolve (" + historical + " historical).");
