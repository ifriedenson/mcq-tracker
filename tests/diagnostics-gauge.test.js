"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

function makeChatPanel(plugin, app, history) {
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(view, dom.root, {
    title: "Study agent",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    buildContext: (mode, context) => `BASE${context ? `\n${context}` : ""}`,
    getApiHistory: () => history,
    saveApiHistory: (next) => {
      history.length = 0;
      history.push(...next);
    },
    quick: [],
  });
  return { panel, dom };
}

test("diagnostics bundle: writes local state, redacts a fake API key and makes no network call", async () => {
  const fakeKey = "sk-ant-FAKE-diagnostics-secret-123456";
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "anthropic";
  plugin.settings.ai.api.keys.anthropic = fakeKey;
  plugin.settings.ai.api.baseUrl = `https://student:${fakeKey}@example.test/v1?token=${fakeKey}`;
  plugin.settings.cards = plugin.settings.cards || {};
  plugin.settings.cards.couchdb = { lastError: `CouchDB rejected ${fakeKey}` };
  plugin.recordDiagnosticError("provider", `request failed for ${fakeKey}`);

  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = () => {
    fetchCalls += 1;
    throw new Error("the diagnostics bundle must not use fetch");
  };
  try {
    assert.equal(T.diagnostics.bundleFileName(new Date("2026-11-06T10:30:00")), "Study agent diagnostics 2026-11-06 1030.md");
    const result = await plugin.saveDiagnosticsBundle({ now: new Date("2026-11-06T10:30:00") });
    assert.equal(
      result.path,
      "Study agent diagnostics/Study agent diagnostics 2026-11-06 1030.md",
      "the report is named predictably and written through the Vault"
    );
    const created = app.created.find((entry) => entry.path === result.path);
    assert.ok(created, "the bundle was created in the vault");
    assert.ok(created.text.includes("# MCQ Tracker diagnostics bundle"));
    assert.ok(created.text.includes("## Chat budget and model"));
    assert.ok(created.text.includes("## Plan and capability status"));
    assert.ok(created.text.includes("## Recent local errors"));
    assert.ok(created.text.includes("request failed for [redacted]"));
    assert.ok(created.text.includes("CouchDB rejected [redacted]"));
    assert.ok(created.text.includes("[redacted]"), "the report marks redacted fields");
    assert.ok(!created.text.includes(fakeKey), "the fake API key never appears in the bundle");
    assert.equal(fetchCalls, 0, "no network request is made while building or saving diagnostics");
  } finally {
    global.fetch = originalFetch;
  }
});

test("token gauge: follows the shipped budget across add and trim, then hides when empty", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.aiChat = async () => "Answer";
  const history = [];
  const { panel, dom } = makeChatPanel(plugin, app, history);

  assert.equal(panel.tokenGauge.classes.has("qt-hidden"), true, "an unused chat shows no gauge");
  assert.equal(panel.lastGauge, null);

  history.push({ role: "user", content: "x".repeat(400) });
  panel.refreshTokenFooter();
  assert.equal(panel.tokenGauge.classes.has("qt-hidden"), false, "the gauge appears once the chat has a message");
  const first = panel.lastGauge;
  assert.ok(first.tokens > 0);
  assert.equal(first.tokens, panel.lastBudget.tokens, "the gauge reads the shipped budget, not a second counter");
  assert.equal(first.limit, T.chatBudget.CONTEXT_BUDGET_TOKENS);
  assert.ok(dom.texts().some((text) => text.includes(`${first.percent}%`) && text.includes("tokens")));

  history.push({ role: "assistant", content: "y".repeat(1200) });
  panel.refreshTokenFooter();
  assert.ok(panel.lastGauge.tokens > first.tokens, "adding messages raises the gauge value");
  assert.equal(panel.lastGauge.tokens, panel.lastBudget.tokens);

  history.length = 0;
  panel.turns = [];
  panel.refreshTokenFooter();
  assert.equal(panel.lastGauge, null, "trimming the conversation clears the gauge value");
  assert.equal(panel.tokenGauge.classes.has("qt-hidden"), true, "an empty conversation hides the gauge again");
});

test("token gauge: degrades silently when budget data is unavailable", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const history = [{ role: "user", content: "hello" }];
  const { panel } = makeChatPanel(plugin, app, history);

  assert.equal(panel.renderTokenGauge(null, "hello"), false);
  assert.equal(panel.tokenGauge.classes.has("qt-hidden"), true);
  assert.equal(panel.renderTokenGauge({ tokens: 8, limit: 0, ratio: 0 }, "hello"), false);
  assert.equal(panel.tokenGauge.classes.has("qt-hidden"), true);
});
