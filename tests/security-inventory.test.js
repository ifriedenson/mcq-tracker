"use strict";
/**
 * Repo-wide security invariants, not just the PDF editor's.
 *
 * `docs/security-inventory.md` states where every network call, credential,
 * dynamic-code sink, HTML sink, filesystem write and untrusted parser lives.
 * This test re-derives each list from all 297 source files and fails when a new
 * one appears, so the inventory cannot quietly go stale.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { scanTree, maskCode } = require("../scripts/check-no-dynamic-code");
const { load } = require("./helpers/load");

const { T } = load();
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const files = fs.readdirSync(SRC).filter((name) => name.endsWith(".js")).sort();

/** One byte per character of the original: 1 where the source is code. */
function codeOnly(text) {
  const mask = maskCode(text);
  let out = "";
  for (let i = 0; i < text.length; i++) out += mask[i] ? text[i] : text[i] === "\n" ? "\n" : " ";
  return out;
}

const read = (name) => fs.readFileSync(path.join(SRC, name), "utf8");
/**
 * Comments blanked, string literals kept. The code masker used by the dynamic-code
 * lint can lose a region of a large file when a regex literal or a stray quote
 * confuses it (plugin.js is the known case), so the security-critical sinks are
 * counted on comment-stripped raw text instead.
 */
function withoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*(?:\*|\/\/).*$/gm, (match) => match.replace(/[^\n]/g, " "));
}
const source = Object.fromEntries(files.map((name) => [name, withoutComments(read(name))]));
const code = Object.fromEntries(files.map((name) => [name, codeOnly(read(name))]));
const matching = (re) => files.filter((name) => re.test(source[name]));

test("no source file uses dynamic code, a string timer or dynamic require", () => {
  const result = scanTree(SRC);
  assert.equal(result.files, files.length, "the scanner reads every source file");
  assert.deepEqual(result.violations, [], "npm run check should already have failed on these");
});

test("only the four documented files touch a network transport", () => {
  assert.deepEqual(matching(/\brequestUrl\s*\(|\bfetch\s*\(/), [
    "api-client.js",
    "opencode-client.js",
    "opencode-manager.js",
    "plugin.js",
  ]);
  // The provider and local-server bases are validated before use.
  assert.ok(source["api-client.js"].includes("safeApiBase("), "api-client validates its base URL");
  assert.ok(source["opencode-client.js"].includes("safeApiBase("), "opencode-client validates its base URL");
  assert.match(read("opencode-manager.js"), /https:\/\/api\.github\.com\/repos\/\$\{OPENCODE_REPO\}/, "the installer only asks GitHub for its own repository");
  // Both plugin.js calls are calendar feeds and both are sanitised first.
  const plugin = source["plugin.js"];
  const calls = [...plugin.matchAll(/requestUrl\s*\(/g)].map((m) => m.index);
  assert.equal(calls.length, 2, "plugin.js makes exactly the two calendar requests");
  for (const at of calls) {
    const before = plugin.slice(Math.max(0, at - 400), at);
    assert.ok(before.includes("safeCalendarFeedUrl("), "a calendar request is sanitised before it is sent");
  }
});

test("the URL guards refuse remote plain HTTP, embedded credentials and non-HTTP feeds", () => {
  const url = T.urlSafety;
  assert.ok(url && typeof url.safeApiBase === "function", "url-safety is exported to the test surface");
  assert.throws(() => url.safeApiBase("http://example.com/v1"), /https:\/\//, "remote HTTP is refused");
  assert.throws(() => url.safeApiBase("https://user:pass@example.com"), /username or password/, "credentials in a URL are refused");
  assert.equal(url.safeApiBase("https://api.example.com/v1/"), "https://api.example.com/v1", "HTTPS is accepted and normalised");
  assert.equal(url.safeApiBase("http://127.0.0.1:11434"), "http://127.0.0.1:11434", "loopback HTTP is accepted");
  assert.throws(() => url.safeCalendarFeedUrl("javascript:alert(1)"), /http/i, "a javascript: feed is refused");
  assert.throws(() => url.safeCalendarFeedUrl("file:///etc/passwd"), /http/i, "a file: feed is refused");
  assert.equal(url.safeCalendarFeedUrl("https://example.com/cal.ics"), "https://example.com/cal.ics", "an https feed is accepted");
});

test("the six HTML sinks are exactly the guarded ones", () => {
  const sinks = [];
  for (const name of files) {
    const raw = read(name).split("\n");
    code[name].split("\n").forEach((line, index) => {
      if (/\.innerHTML\s*=/.test(line)) sinks.push(`${name}: ${raw[index].trim()}`);
    });
  }
  assert.deepEqual(sinks, [
    "plugin.js: box.innerHTML = safeSvg(result.svg);",
    "plugin.js: el.createDiv({ cls: \"qt-stem-block\" }).innerHTML = result.html;",
    "plugin.js: el.createDiv({ cls: \"qt-stem-block\" }).innerHTML = result.html;",
    "plugin.js: el.createDiv({ cls: \"qt-stem-block\" }).innerHTML = result.html;",
    "plugin.js: el.createDiv({ cls: \"qt-stem-block\" }).innerHTML = result.html;",
    "reference-view.js: preview.innerHTML = safeSvg(result.svg);",
  ]);
  assert.equal(sinks.filter((line) => line.includes("safeSvg(")).length, 2, "both SVG sinks go through safeSvg");
});

test("safeSvg and the three diagram renderers cannot emit a script, image or handler", () => {
  const { safeSvg } = T.svgSafety;
  assert.equal(safeSvg('<svg><script>alert(1)</script></svg>'), "", "a script element is dropped");
  assert.equal(safeSvg('<svg onload="alert(1)"></svg>'), "", "an event handler is dropped");
  assert.equal(safeSvg('<svg><a href="javascript:alert(1)">x</a></svg>'), "", "a javascript: link is dropped");
  assert.equal(safeSvg("<svg><circle r='4'/></svg>"), "<svg><circle r='4'/></svg>", "a plain diagram survives");

  const d = T.stemDiagrams;
  const hostile = "H2 + <script>alert(1)</script> -> H2O";
  const renderers = [
    ["renderChemistryDiagram", hostile],
    ["renderBiologyDiagram", "ATCG<img src=x onerror=alert(1)>"],
    ["renderCircuitDiagram", "R1 10 <script>alert(1)</script>"],
  ];
  for (const [name, input] of renderers) {
    const result = d[name](input);
    const html = String((result && result.html) || (result && result.svg) || "");
    assert.ok(!/<script|<img|onerror\s*=/i.test(html), `${name} never emits markup from its input`);
  }
});

test("no credential shape is committed anywhere in source or documentation", () => {
  const patterns = [
    [/sk-[A-Za-z0-9]{20,}/, "an OpenAI-style key"],
    [/ghp_[A-Za-z0-9]{20,}/, "a GitHub token"],
    [/AKIA[0-9A-Z]{16}/, "an AWS access key"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  ];
  const roots = [SRC, path.join(ROOT, "docs")];
  const texts = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|md)$/.test(entry.name)) texts.push([path.relative(ROOT, full), fs.readFileSync(full, "utf8")]);
    }
  };
  for (const dir of roots) walk(dir);
  texts.push(["README.md", fs.readFileSync(path.join(ROOT, "README.md"), "utf8")]);
  for (const [label, text] of texts) {
    for (const [re, what] of patterns) assert.ok(!re.test(text), `${label} does not contain ${what}`);
  }
});

test("vault writes stay inside the fourteen documented files", () => {
  assert.deepEqual(matching(/vault\.(createBinary|create|modify|process|delete|trash)\s*\(|adapter\.write|processFrontMatter\s*\(/), [
    "agent-note.js",
    "agent-view.js",
    "calendar-notes.js",
    "course-notes.js",
    "graph-3d-panel.js",
    "import-modal.js",
    "knowledge-store.js",
    "ocr-modal.js",
    "paper-scanner.js",
    "pdf-annotation-modal.js",
    "pdf-editor-modal.js",
    "pdf-ink-modal.js",
    "plugin.js",
    "reference-view.js",
  ]);
});

test("Node's fs and child_process are reachable only from the desktop OpenCode installer", () => {
  assert.deepEqual(matching(/\bchild_process\b|\brequire\s*\(\s*["'](?:node:)?fs["']\s*\)/), ["opencode-manager.js"]);
  assert.deepEqual(matching(/\brequire\s*\(\s*["'](?:node:)?child_process["']\s*\)/), ["opencode-manager.js"]);
  assert.match(read("opencode-manager.js"), /fs: \(\) => require\("fs"\)/, "fs is loaded lazily, not at module top level");
  assert.match(read("opencode-manager.js"), /child_process: \(\) => require\("child_process"\)/, "child_process is loaded lazily");
});
