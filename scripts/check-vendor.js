#!/usr/bin/env node
"use strict";
/*
 * Guards the one vendored engine the PDF editor loads.
 *
 * `vendor/pdf-lib.js` must be the published pdf-lib 1.17.1 `dist/pdf-lib.min.js`,
 * byte for byte. The size and SHA-256 below are of that file in the npm tarball,
 * so a missing, truncated, edited or swapped copy fails `npm run check` instead
 * of failing when the plugin is installed. The editor must also load it through
 * the route the bundler understands (`require("../vendor/pdf-lib.js")`), and the
 * build must include it, or the editor would work in tests and break in Obsidian.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "vendor", "pdf-lib.js");
const EDITOR = path.join(ROOT, "src", "pdf-editor.js");
const EXPECTED = {
  package: "pdf-lib",
  version: "1.17.1",
  file: "dist/pdf-lib.min.js",
  bytes: 525099,
  sha256: "0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f",
};

/** Every problem with the vendored engine; an empty list means it is good. */
function verify() {
  const problems = [];
  if (!fs.existsSync(FILE)) {
    problems.push("vendor/pdf-lib.js is missing; the PDF editor cannot load");
    return { ok: false, problems, bytes: 0, sha256: "" };
  }
  const data = fs.readFileSync(FILE);
  if (data.length !== EXPECTED.bytes) {
    problems.push(`vendor/pdf-lib.js is ${data.length} bytes, expected ${EXPECTED.bytes} (${EXPECTED.package} ${EXPECTED.version} ${EXPECTED.file})`);
  }
  const digest = crypto.createHash("sha256").update(data).digest("hex");
  if (digest !== EXPECTED.sha256) {
    problems.push(`vendor/pdf-lib.js sha256 is ${digest}, expected ${EXPECTED.sha256} (${EXPECTED.package} ${EXPECTED.version} ${EXPECTED.file})`);
  }
  if (!data.includes(Buffer.from("PDFDocument")) || !data.includes(Buffer.from("useObjectStreams"))) {
    problems.push("vendor/pdf-lib.js does not look like the published pdf-lib bundle");
  }
  if (!/require\("\.\.\/vendor\/pdf-lib\.js"\)/.test(fs.readFileSync(EDITOR, "utf8"))) {
    problems.push("src/pdf-editor.js must load the vendored engine as require(\"../vendor/pdf-lib.js\")");
  }
  try {
    const { build } = require("./build");
    if (!build().includes('__defs["vendor/pdf-lib"]')) problems.push("the build does not bundle vendor/pdf-lib.js");
  } catch (error) {
    problems.push(`the build could not be inspected: ${error && error.message ? error.message : error}`);
  }
  return { ok: problems.length === 0, problems, bytes: data.length, sha256: digest, expected: EXPECTED };
}

module.exports = { EXPECTED, verify };

if (require.main === module) {
  const result = verify();
  if (!result.ok) {
    for (const problem of result.problems) console.error(`check-vendor: ${problem}`);
    process.exit(1);
  }
  console.log(`check-vendor: vendor/pdf-lib.js is ${result.expected.package} ${result.expected.version} (${result.bytes} bytes, sha256 ${result.sha256.slice(0, 12)}…).`);
}
