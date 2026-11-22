#!/usr/bin/env node
"use strict";
/*
 * Checks that a relative link in the Markdown lands on a file that exists, and
 * that a "#fragment" lands on a heading in the file it names.
 *
 * The docs are read as a chain — plan.md sends you to docs/plan-decisions.md,
 * every release note names a page, the audits point at each other — and a link
 * that has rotted is indistinguishable from a working one until somebody
 * clicks it. A page that moved in one commit and was left behind in five
 * others reads exactly like a page that is fine.
 *
 * Only repository-relative targets are checked. http(s), mailto, obsidian://,
 * tel: and app:// links are somebody else's uptime, not this repository's
 * consistency, and bare "#fragment" links are checked against the file that
 * carries them.
 */
const fs = require("fs");
const path = require("path");
const { ROOT, markdownFiles, relativePath } = require("./lib/doc-files");

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
const LINK = /!?\[[^\]]*\]\(([^()\s]+(?:\([^()\s]*\)[^()\s]*)*)\)/g;
const HEADING = /^#{1,6}\s+(.+?)\s*#*$/;

// GitHub's heading anchors: lowercase, punctuation dropped, spaces to hyphens,
// and a "-1", "-2" suffix for repeated headings.
function slug(text) {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

const anchorCache = new Map();
function anchorsOf(file) {
  if (!anchorCache.has(file)) {
    const seen = new Map();
    const anchors = new Set();
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = HEADING.exec(line);
      if (!match) continue;
      const base = slug(match[1]);
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      anchors.add(count ? base + "-" + count : base);
    }
    anchorCache.set(file, anchors);
  }
  return anchorCache.get(file);
}

const failures = [];
let links = 0;
let anchors = 0;

for (const file of markdownFiles(ROOT).sort()) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(LINK)) {
      const target = match[1];
      if (EXTERNAL.test(target)) continue;
      const [rawPath, fragment] = target.split("#");
      const where = relativePath(ROOT, file) + ":" + (index + 1);
      let destination = file;
      if (rawPath) {
        links += 1;
        let decoded = rawPath;
        try {
          decoded = decodeURIComponent(rawPath);
        } catch (error) {
          /* a literal % that is not an escape: use it as written */
        }
        destination = path.resolve(path.dirname(file), decoded);
        if (!fs.existsSync(destination)) {
          failures.push(where + "  " + target + "  — no such file or directory");
          continue;
        }
      }
      if (!fragment || !destination.endsWith(".md")) continue;
      anchors += 1;
      if (!anchorsOf(destination).has(slug(fragment))) {
        failures.push(where + "  " + target + "  — no heading anchors to #" +
          fragment + " in " + relativePath(ROOT, destination));
      }
    }
  });
}

if (failures.length) {
  console.error("check-doc-links: " + failures.length + " link(s) point at nothing\n");
  for (const failure of failures) console.error("  " + failure);
  console.error("\nRepair the path, or drop the link and name the document in plain text.");
  process.exit(1);
}

console.log("check-doc-links: " + links + " file links and " + anchors + " anchors resolve.");
