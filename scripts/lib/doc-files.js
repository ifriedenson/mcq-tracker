#!/usr/bin/env node
"use strict";
/*
 * Shared by the doc checks: walks the tree for Markdown (skipping
 * dependencies, version control and dotfiles) and prints repo-relative
 * paths with forward slashes so failure lines read the same on Windows.
 */
const fs = require("fs");
const path = require("path");

// The repository root: this helper lives at scripts/lib/, two levels down.
const ROOT = path.join(__dirname, "..", "..");

function markdownFiles(root, dir = root, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      markdownFiles(root, path.join(dir, entry.name), files);
    } else if (entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function relativePath(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

module.exports = { ROOT, markdownFiles, relativePath };
