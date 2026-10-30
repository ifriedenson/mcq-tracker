"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const urlSafety = T.urlSafety;
const svgSafety = T.svgSafety;
const secretKeys = T.secretKeys;
const apkg = T.apkg;

const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "anki-basic.apkg"));

function memoryStore(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    values,
    getSecret: (name) => (values.has(name) ? values.get(name) : null),
    setSecret: (name, value) => values.set(name, value),
  };
}

test("URL safety: remote credentials require HTTPS, loopback HTTP stays usable", () => {
  assert.equal(urlSafety.safeApiBase("https://api.example.com/v1/"), "https://api.example.com/v1");
  assert.equal(urlSafety.safeApiBase("http://localhost:11434/v1"), "http://localhost:11434/v1");
  assert.equal(urlSafety.safeApiBase("http://127.0.0.1:4096"), "http://127.0.0.1:4096");
  assert.throws(() => urlSafety.safeApiBase("http://api.example.com/v1"), /must use https/);
  assert.throws(() => urlSafety.safeApiBase("ftp://api.example.com/v1"), /valid http/);
  assert.throws(() => urlSafety.safeApiBase("https://user:pass@api.example.com/v1"), /username or password/);
});

test("calendar URL safety: public feeds require HTTPS and oversized responses are rejected", () => {
  assert.equal(urlSafety.safeCalendarFeedUrl("https://example.com/feed.ics"), "https://example.com/feed.ics");
  assert.throws(() => urlSafety.safeCalendarFeedUrl("http://example.com/feed.ics"), /must use https/);
  assert.throws(() => urlSafety.safeCalendarFeedUrl("webcal://example.com/feed.ics"), /valid https/);
  assert.throws(() => urlSafety.calendarText({ text: "x".repeat(urlSafety.MAX_CALENDAR_BYTES + 1) }), /too large/);
});

test("SVG guard: normal generated markup passes, scriptable markup is dropped", () => {
  assert.equal(svgSafety.safeSvg("<svg><path d=\"M0 0\"/></svg>"), "<svg><path d=\"M0 0\"/></svg>");
  assert.equal(svgSafety.safeSvg("<svg><script>alert(1)</script></svg>"), "");
  assert.equal(svgSafety.safeSvg("<svg><path onclick=\"run()\"/></svg>"), "");
  assert.equal(svgSafety.safeSvg("<svg><foreignObject><div>x</div></foreignObject></svg>"), "");
  assert.equal(svgSafety.safeSvg("<a href=\"javascript:alert(1)\">x</a>"), "");
});

test("secret storage: a manual OpenCode password migrates out of data.json", async () => {
  const store = memoryStore();
  const app = makeApp([]);
  app.secretStorage = store;
  const plugin = new QT(app);
  plugin.saved = { ai: { password: "opencode-secret", url: "http://127.0.0.1:4096" } };
  await plugin.onload();
  assert.equal(plugin.settings.ai.password, "");
  assert.equal(plugin.settings.ai.passwordSecret, secretKeys.OPENCODE_PASSWORD_SECRET);
  assert.equal(store.values.get(secretKeys.OPENCODE_PASSWORD_SECRET), "opencode-secret");
  assert.equal(plugin.conn().password, "opencode-secret");
});

test("secret storage: the session password is used when no secret store exists", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.password = "";
  plugin.settings.ai.passwordSecret = "";
  plugin.sessionOpenCodePassword = "session-only";
  assert.equal(plugin.conn().password, "session-only");
});

test("apkg: decompression bounds reject oversized archives, entries and counts", () => {
  assert.throws(() => apkg.readZipEntries(fixture, { maxBytes: 10 }), /too large/);
  assert.throws(() => apkg.readZipEntries(fixture, { maxEntries: 1 }), /too many ZIP entries/);
  assert.throws(() => apkg.readZipEntries(fixture, { maxEntryBytes: 10 }), /entry .* too large/);
  assert.throws(() => apkg.readZipEntries(fixture, { maxTotalBytes: 10 }), /too much data/);
});

test("archive extraction: normal trees pass and symlinks are rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mcq-extract-"));
  try {
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "nested", "file.txt"), "ok");
    assert.doesNotThrow(() => T.assertExtractedTree(root));
    fs.symlinkSync(fs.existsSync("/etc/passwd") ? "/etc/passwd" : path.join(root, "nested", "file.txt"), path.join(root, "escape"));
    assert.throws(() => T.assertExtractedTree(root), /symbolic link/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("agent tools: shell is disabled in Agent mode unless explicitly enabled", () => {
  assert.deepEqual(T.ChatPanel.toolsForMode("tutor", true), { edit: false, write: false, patch: false, bash: false });
  assert.deepEqual(T.ChatPanel.toolsForMode("agent", false), { bash: false });
  assert.equal(T.ChatPanel.toolsForMode("agent", true), null);
});
