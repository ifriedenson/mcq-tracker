"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const files = fs.readdirSync(SRC).filter((name) => name.endsWith(".js"));
const sourceOf = (name) => fs.readFileSync(path.join(SRC, name), "utf8");

test("privacy: no analytics, beacon or crash-reporting client ships in src", () => {
  const banned = [
    /navigator\s*\.\s*sendBeacon/,
    /\bgtag\s*\(/,
    /\bdataLayer\b/,
    /mixpanel/i,
    /posthog/i,
    /amplitude/i,
    /\bsegment\s*\.\s*(track|identify|page)\b/,
    /plausible\.(io|analytics)/i,
    /\bsentry\b/i,
    /@sentry\//,
    /\bdatadog\b/i,
    /hotjar/i,
    /fullstory/i,
  ];
  const hits = [];
  for (const name of files) {
    const text = sourceOf(name);
    for (const pattern of banned) {
      if (pattern.test(text)) hits.push(`${name}: ${pattern}`);
    }
  }
  assert.deepEqual(hits, [], "telemetry-shaped code must not ship");
});

test("privacy: network sinks stay inside the audited files", () => {
  const allowed = new Set([
    "api-client.js",
    "opencode-client.js",
    "opencode-manager.js",
    "plugin.js",
    "anki-connect.js",
    "couchdb-sync.js",
  ]);
  const offenders = [];
  for (const name of files) {
    const text = sourceOf(name);
    const usesSink = /\brequestUrl\s*\(/.test(text) || /\bfetch\s*\(/.test(text);
    if (usesSink && !allowed.has(name)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], "a new network sink needs a privacy-audit entry");
});

test("privacy: the triage, health and Anki timing logic never touches the network", () => {
  for (const name of ["card-triage.js", "import-health.js", "anki-schedule.js"]) {
    const text = sourceOf(name);
    assert.ok(!/\brequestUrl\s*\(/.test(text), `${name} must not call requestUrl`);
    assert.ok(!/\bfetch\s*\(/.test(text), `${name} must not call fetch`);
    assert.ok(!/auto-anki|ai-service|api-client/.test(text), `${name} must not import a network module`);
  }
});
