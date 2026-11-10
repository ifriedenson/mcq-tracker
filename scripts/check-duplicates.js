#!/usr/bin/env node
"use strict";
/*
 * Catches duplicate class members and duplicate module.exports keys in src/.
 * The 1.299 line had a second onTableEditorToggled that silently replaced the
 * first, so this check is deliberately run by `npm run check` rather than a
 * minifier warning that is easy to ignore.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const failures = [];

function duplicateNames(names) {
  const seen = new Set();
  const dups = new Set();
  for (const name of names) {
    if (seen.has(name)) dups.add(name);
    seen.add(name);
  }
  return [...dups];
}

function checkClasses(file, source) {
  const startRe = /^class\s+([A-Za-z_$][\w$]*)[^{]*\{/gm;
  let match;
  while ((match = startRe.exec(source))) {
    const bodyStart = startRe.lastIndex;
    const bodyEnd = source.indexOf("\n}", bodyStart);
    const body = source.slice(bodyStart, bodyEnd < 0 ? source.length : bodyEnd);
    const methodRe = /^  (?:(async|static|get|set)\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*\(/gm;
    const names = [];
    let method;
    while ((method = methodRe.exec(body))) {
      const kind = method[1] || "method";
      const name = method[2];
      names.push(kind === "get" || kind === "set" ? `${kind}:${name}` : kind === "static" ? `static:${name}` : name);
    }
    const dups = duplicateNames(names);
    for (const key of dups) {
      const name = key.replace(/^(get|set|static):/, "");
      failures.push(`${file}: duplicate class member ${match[1]}.${name} (${key})`);
    }
  }
}

function checkExports(file, source) {
  const marker = "module.exports = {";
  let from = 0;
  while ((from = source.indexOf(marker, from)) >= 0) {
    const start = from + marker.length;
    const end = source.indexOf("\n};", start);
    const body = source.slice(start, end < 0 ? source.length : end);
    const keyRe = /^  (?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*(?::|,|\()/gm;
    const names = [];
    let key;
    while ((key = keyRe.exec(body))) names.push(key[1]);
    for (const name of duplicateNames(names)) failures.push(`${file}: duplicate module.exports key ${name}`);
    from = start;
  }
}

for (const file of fs.readdirSync(SRC).filter((name) => name.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(SRC, file), "utf8");
  checkClasses(file, source);
  checkExports(file, source);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("No duplicate class members or export keys.");
