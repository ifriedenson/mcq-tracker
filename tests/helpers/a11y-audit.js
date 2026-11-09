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
 * Dialog containers are checked separately. Every modal class must extend the
 * shared `QtModal` / `QtFuzzySuggestModal`, which name the container from its
 * visible heading (or a written purpose label) when it opens. A file with a
 * managed dialog must render a heading or supply `qtDialogLabel()`, no raw
 * `new Modal(...)` may remain, and every custom container created with
 * `role: "dialog"` must carry `aria-label` or `aria-labelledby`.
 *
 * This is deliberately conservative: it only understands the call shapes the
 * project uses, so it cannot prove that something is unnamed at runtime — it
 * proves that a newly added control or dialog with no name in source fails the
 * suite.
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
const DIALOG_CLASS_RE = /class\s+(\w+)\s+extends\s+(QtModal|QtFuzzySuggestModal|Modal|FuzzySuggestModal|SuggestModal)\b/g;
const DIALOG_ROLE_RE = /role:\s*["'`](dialog|alertdialog)["'`]/g;
const RAW_MODAL_RE = /new\s+Modal\s*\(/g;
const HEADING_RE = /\.createEl\(\s*["'`](h1|h2|h3|h4)["'`]/;

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
  const dialogGaps = [];
  const dialogContainers = [];
  const managedDialogFiles = new Set();
  let dialogs = 0;
  const files = sourceFiles(root);
  for (const file of files) {
    const relative = path.relative(root, file);
    const source = fs.readFileSync(file, "utf8");
    let match;
    FORM_RE.lastIndex = 0;
    while ((match = FORM_RE.exec(source))) {
      const open = source.indexOf("(", match.index);
      const text = callText(source, open);
      const after = source.slice(open + text.length, open + text.length + 400);
      if (!formIsNamed(text, after)) {
        controls.push({ file: relative, line: lineNumber(source, match.index), tag: match[1] });
      }
    }
    BUTTON_RE.lastIndex = 0;
    while ((match = BUTTON_RE.exec(source))) {
      const open = source.indexOf("(", match.index);
      const text = callText(source, open);
      const after = source.slice(open + text.length, open + text.length + 2000);
      if (!buttonIsNamed(text, after)) {
        buttons.push({ file: relative, line: lineNumber(source, match.index) });
      }
    }

    // The base classes themselves extend Obsidian's Modal; every other class
    // must go through them so `open()` can name the container.
    if (relative !== path.join("src", "a11y.js")) {
      DIALOG_CLASS_RE.lastIndex = 0;
      let managedInFile = 0;
      while ((match = DIALOG_CLASS_RE.exec(source))) {
        if (match[2] === "QtModal" || match[2] === "QtFuzzySuggestModal") {
          dialogs += 1;
          managedInFile += 1;
        } else {
          dialogGaps.push({
            file: relative,
            line: lineNumber(source, match.index),
            reason: `${match[1]} extends ${match[2]} instead of the shared dialog base`,
          });
        }
      }
      if (managedInFile) {
        managedDialogFiles.add(relative);
        if (!HEADING_RE.test(source) && !/qtDialogLabel\s*\(/.test(source)) {
          dialogGaps.push({
            file: relative,
            line: 1,
            reason: "dialog renders no heading and supplies no qtDialogLabel()",
          });
        }
      }
      RAW_MODAL_RE.lastIndex = 0;
      while ((match = RAW_MODAL_RE.exec(source))) {
        dialogGaps.push({ file: relative, line: lineNumber(source, match.index), reason: "constructs a raw Modal" });
      }
    }

    DIALOG_ROLE_RE.lastIndex = 0;
    while ((match = DIALOG_ROLE_RE.exec(source))) {
      const start = source.lastIndexOf(".createDiv(", match.index);
      let named = false;
      if (start !== -1) {
        const open = source.indexOf("(", start);
        const text = callText(source, open);
        named = /aria-label|aria-labelledby/.test(text);
      }
      if (!named) {
        dialogContainers.push({ file: relative, line: lineNumber(source, match.index), role: match[1] });
      }
    }
  }
  return {
    files: files.length,
    controls,
    buttons,
    dialogs,
    managedDialogFiles: managedDialogFiles.size,
    dialogGaps,
    dialogContainers,
  };
}

module.exports = { auditSourceTree };
