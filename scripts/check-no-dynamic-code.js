#!/usr/bin/env node
"use strict";
/*
 * Fails when dynamic code execution appears in the shipped source under src/.
 *
 * main.js is deliberately not scanned: `npm run check` already fails unless it
 * is the exact build of src/, so a sink has to exist in src/ to reach the bundle.
 * Comments and string literals are masked before matching so explanatory prose
 * stays harmless; template-literal interpolations remain code because they run.
 * Regex literals are not tokenized, so a regex that spells a sink is reported.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

const RULES = [
  { name: "eval", re: /\beval\s*\(/g, kind: "call" },
  { name: "Function", re: /\bFunction\s*\(/g, kind: "call" },
  { name: "string timer", re: /\bset(?:Timeout|Interval)\s*\(/g, kind: "string" },
  { name: "dynamic import", re: /\bimport\s*\(/g, kind: "literal" },
  { name: "dynamic require", re: /\brequire\s*\(/g, kind: "literal" },
];

/** One byte per source character: 1 = code, 0 = comment, string or template text. */
function maskCode(source) {
  const mask = new Uint8Array(source.length);
  const stack = [{ kind: "code", depth: 0 }];
  let i = 0;
  while (i < source.length) {
    const frame = stack[stack.length - 1];
    const ch = source[i];
    const next = source[i + 1];
    if (frame.kind === "line") {
      if (ch === "\n") {
        stack.pop();
        mask[i] = 1;
        i++;
      } else i++;
      continue;
    }
    if (frame.kind === "block") {
      if (ch === "*" && next === "/") {
        stack.pop();
        i += 2;
      } else i++;
      continue;
    }
    if (frame.kind === "string") {
      if (ch === "\\") i += 2;
      else if (ch === frame.quote || ch === "\n") {
        stack.pop();
        i++;
      } else i++;
      continue;
    }
    if (frame.kind === "template") {
      if (ch === "\\") i += 2;
      else if (ch === "`") {
        stack.pop();
        i++;
      } else if (ch === "$" && next === "{") {
        stack.push({ kind: "code", depth: 0, interpolation: true });
        i += 2;
      } else i++;
      continue;
    }
    mask[i] = 1;
    if (ch === "/" && next === "/") {
      stack.push({ kind: "line" });
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      stack.push({ kind: "block" });
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      stack.push({ kind: "string", quote: ch });
      i++;
      continue;
    }
    if (ch === "`") {
      stack.push({ kind: "template" });
      i++;
      continue;
    }
    if (frame.interpolation) {
      if (ch === "{") {
        frame.depth++;
        i++;
        continue;
      }
      if (ch === "}") {
        if (frame.depth === 0) stack.pop();
        else frame.depth--;
        i++;
        continue;
      }
    }
    i++;
  }
  return mask;
}

function locate(source, index) {
  let line = 1;
  let start = 0;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") {
      line++;
      start = i + 1;
    }
  }
  return { line, column: index - start + 1 };
}

function nextNonSpace(source, from) {
  let i = from;
  while (i < source.length) {
    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    return ch;
  }
  return "";
}

/** Every masked-in violation in one source string, ordered by position. */
function findViolations(file, source) {
  const mask = maskCode(source);
  const violations = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let match;
    while ((match = rule.re.exec(source))) {
      if (!mask[match.index]) continue;
      const arg = nextNonSpace(source, match.index + match[0].length);
      if (rule.kind === "string" && arg !== '"' && arg !== "'" && arg !== "`") continue;
      if (rule.kind === "literal" && (arg === '"' || arg === "'")) continue;
      const { line, column } = locate(source, match.index);
      violations.push({ file, line, column, rule: rule.name, match: match[0].trim() });
    }
  }
  return violations.sort((a, b) => a.line - b.line || a.column - b.column);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** Scan every JavaScript file under root; throws instead of passing on an empty tree. */
function scanTree(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`source directory not found: ${root}`);
  }
  const files = walk(root);
  if (!files.length) throw new Error(`no JavaScript files found under ${root}`);
  const violations = [];
  for (const file of files) {
    const label = path.relative(ROOT, file).split(path.sep).join("/") || file;
    violations.push(...findViolations(label, fs.readFileSync(file, "utf8")));
  }
  return { files: files.length, violations };
}

module.exports = { findViolations, maskCode, scanTree };

if (require.main === module) {
  let result;
  try {
    result = scanTree(SRC);
  } catch (e) {
    console.error(`check-no-dynamic-code: ${e.message}`);
    process.exit(1);
  }
  if (result.violations.length) {
    for (const hit of result.violations) {
      console.error(`${hit.file}:${hit.line}: ${hit.rule}: ${hit.match}`);
    }
    console.error(`check-no-dynamic-code: ${result.violations.length} violation(s) in ${result.files} files.`);
    process.exit(1);
  }
  console.log(`check-no-dynamic-code: no dynamic code in ${result.files} files.`);
}
