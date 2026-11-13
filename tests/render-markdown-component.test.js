"use strict";
/**
 * Obsidian logs "Plugin mcq-tracker is not passing Component in renderMarkdown"
 * when a render call has no Component. Every call site in this plugin passes
 * one; this test fails if a new call forgets it.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");

function callArguments(source, start) {
  let depth = 1;
  let i = start;
  while (i < source.length && depth) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

function splitTopLevel(args) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of args) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out.map((part) => part.trim());
}

test("every renderMarkdownInto call passes a component", () => {
  const misses = [];
  for (const name of fs.readdirSync(SRC).filter((file) => file.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(SRC, name), "utf8");
    const pattern = /renderMarkdownInto\(/g;
    let match;
    while ((match = pattern.exec(source))) {
      const args = splitTopLevel(callArguments(source, match.index + match[0].length));
      const line = source.slice(0, match.index).split("\n").length;
      if (args.length < 5 || !args[4] || /^(undefined|null)$/.test(args[4])) {
        misses.push(`${name}:${line} (${args.length} argument${args.length === 1 ? "" : "s"})`);
      }
    }
  }
  assert.deepEqual(misses, [], `renderMarkdownInto without a Component: ${misses.join(", ")}`);
});

test("the shared helper hands the component to Obsidian", () => {
  const source = fs.readFileSync(path.join(SRC, "view-helpers.js"), "utf8");
  assert.match(source, /MarkdownRenderer\.render\(app, source, el, sourcePath, component\)/);
  assert.match(source, /MarkdownRenderer\.renderMarkdown\(source, el, sourcePath, component\)/);
});
