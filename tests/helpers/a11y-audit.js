"use strict";
/*
 * Static accessibility audit for the plugin's UI source.
 *
 * It parses every `.createEl("input" | "textarea" | "select")` and
 * `.createEl("button")` call, including multiline option objects, and reports
 * the ones that do not carry a name. A form control counts as named when its
 * creation options carry `aria-label` or an `aria-label` is assigned in the
 * statement that follows (the two patterns used in `src/`). A button counts as
 * named when it has `aria-label`, direct `text`, or visible child text /
 * `setText` added shortly after it is created.
 *
 * This is deliberately conservative: it only understands the call shapes the
 * project uses, so it cannot prove that something is unnamed at runtime — it
 * proves that a newly added control with no name in source fails the suite.
 */
const fs = require("fs");
const path = require("path");

function sourceFiles(root) {
  const dir = path.join(root, "src");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(dir, name));
}

/** Returns the text of the call starting at the opening parenthesis. */
function callText(source, openIndex) {
  let depth = 0;
  let quote = null;
  let template = null;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (template) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "`") template = null;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "`") {
      template = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return source.slice(openIndex);
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

const FORM_RE = /\.createEl\(\s*["'`](input|textarea|select)["'`]/g;
const BUTTON_RE = /\.createEl\(\s*["'`]button["'`]/g;

function formIsNamed(text, after) {
  return /aria-label/.test(text) || /\.(setAttribute|setAttr)\(\s*["'`]aria-label/.test(after.slice(0, 300));
}

function buttonIsNamed(text, after) {
  if (/aria-label/.test(text)) return true;
  if (/\btext\s*[:},]/.test(text)) return true;
  if (/\.(setAttribute|setAttr)\(\s*["'`]aria-label/.test(after.slice(0, 300))) return true;
  if (/\.setText\(/.test(after)) return true;
  if (/\.appendText\(/.test(after)) return true;
  if (/\.createSpan\(\s*\{[^}]*\btext\s*:/.test(after)) return true;
  if (/\.createEl\(\s*["'`](span|strong|div)["'`]\s*,\s*\{[^}]*\btext\s*:/.test(after)) return true;
  return false;
}

function auditSourceTree(root) {
  const controls = [];
  const buttons = [];
  const files = sourceFiles(root);
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    let match;
    FORM_RE.lastIndex = 0;
    while ((match = FORM_RE.exec(source))) {
      const open = source.indexOf("(", match.index);
      const text = callText(source, open);
      const after = source.slice(open + text.length, open + text.length + 400);
      if (!formIsNamed(text, after)) {
        controls.push({ file: path.relative(root, file), line: lineNumber(source, match.index), tag: match[1] });
      }
    }
    BUTTON_RE.lastIndex = 0;
    while ((match = BUTTON_RE.exec(source))) {
      const open = source.indexOf("(", match.index);
      const text = callText(source, open);
      const after = source.slice(open + text.length, open + text.length + 2000);
      if (!buttonIsNamed(text, after)) {
        buttons.push({ file: path.relative(root, file), line: lineNumber(source, match.index) });
      }
    }
  }
  return { files: files.length, controls, buttons };
}

module.exports = { auditSourceTree };
