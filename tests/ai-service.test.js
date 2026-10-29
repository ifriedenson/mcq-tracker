"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T } = load();
const ai = T.aiService;

test("AI service: capability flags are per backend, and a missing capability says why", () => {
  assert.deepEqual(ai.capabilities("api"), { vision: true, structured: true, streaming: false, tools: false });
  assert.deepEqual(ai.capabilities("opencode"), { vision: false, structured: true, streaming: true, tools: true });
  assert.equal(ai.capabilities("nonsense").vision, true, "an unknown backend falls back to Direct AI");
  assert.equal(ai.featureSupport("ocr", "api").ok, true);
  const blocked = ai.featureSupport("ocr", "opencode");
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /page images/i);
  assert.match(blocked.reason, /Direct AI/);
  assert.equal(ai.featureSupport("cardGrading", "opencode").ok, true);
});

test("AI service: feature models fall back to the backend model and unknown features use chat", () => {
  const settings = {
    model: "opencode-default",
    api: { model: "api-default" },
    features: { chat: { model: " cheap-chat " }, ocr: { model: "vision" } },
  };
  assert.equal(ai.featureModel(settings, "chat", "api"), "cheap-chat");
  assert.equal(ai.featureModel(settings, "generation", "api"), "api-default");
  assert.equal(ai.featureModel(settings, "generation", "opencode"), "opencode-default");
  assert.equal(ai.featureModel(settings, "ocr", "api"), "vision");
  assert.equal(ai.featureModel(settings, "not-a-feature", "api"), "cheap-chat");
});

test("AI service: settings normalize without losing unknown fields or allowing unsafe caps", () => {
  const raw = {
    enabled: true,
    model: "keep",
    features: { chat: { model: "  chat-model  " }, bogus: { model: "remove-me" } },
    limits: { maxTokens: 10, dailyRequests: -3, runRequests: "12" },
  };
  const out = ai.normalizeAiService(raw);
  assert.equal(out.enabled, true);
  assert.equal(out.model, "keep");
  assert.deepEqual(out.features.chat, { model: "chat-model" });
  assert.equal(out.features.bogus, undefined);
  assert.deepEqual(out.limits, { maxTokens: 256, dailyRequests: 0, runRequests: 12 });
  assert.deepEqual(ai.normalizeLimits({ maxTokens: "nope" }), { maxTokens: 4000, dailyRequests: 0, runRequests: 0 });
});

test("AI service: a feature never asks for more tokens than the cap allows", () => {
  const settings = { limits: { maxTokens: 1200 } };
  assert.equal(ai.clampMaxTokens(settings, 4000), 1200);
  assert.equal(ai.clampMaxTokens(settings, 300), 300);
  assert.equal(ai.clampMaxTokens(settings, 0), 1200);
  assert.equal(ai.estimateTokens("12345678"), 2);
  assert.equal(ai.estimateRequestTokens("1234", [{ content: "12345678" }], [{ data: "abc" }]), 1203);
});

test("AI service: usage resets on a new day and budgets count every request, including failures", () => {
  const today = "2026-10-29";
  let usage = ai.usageForDate('{"date":"2026-10-28","requests":9,"tokens":90,"features":{"chat":{"requests":9,"tokens":90}}}', today);
  assert.deepEqual(usage, { date: today, requests: 0, tokens: 0, features: {} });
  usage = ai.recordUsage(usage, "chat", 100, today);
  usage = ai.recordUsage(usage, "cardGrading", 50, today);
  assert.equal(usage.requests, 2);
  assert.equal(usage.tokens, 150);
  assert.deepEqual(usage.features.cardGrading, { requests: 1, tokens: 50 });
  const packed = ai.packUsage(usage);
  assert.deepEqual(ai.usageForDate(packed, today), usage);

  const allowed = ai.budgetState(usage, { dailyRequests: 3 }, today);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.remaining, 1);
  const blocked = ai.budgetState(usage, { dailyRequests: 2 }, today);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.message, /daily AI request cap \(2\)/);
  assert.equal(ai.budgetState(usage, { dailyRequests: 0 }, today).allowed, true, "0 means no cap");
});

test("AI service: a run cap resets after ten idle minutes", () => {
  const now = 1_000_000_000;
  assert.equal(ai.runBudgetState({ startedAt: now - 1000, requests: 4 }, { runRequests: 5 }, now).allowed, true);
  const capped = ai.runBudgetState({ startedAt: now - 1000, requests: 5 }, { runRequests: 5 }, now);
  assert.equal(capped.allowed, false);
  assert.match(capped.message, /request cap \(5\)/);
  assert.equal(ai.runBudgetState({ startedAt: now - 11 * 60 * 1000, requests: 99 }, { runRequests: 5 }, now).allowed, true);
  assert.equal(ai.runBudgetState({}, { runRequests: 0 }, now).allowed, true);
});

test("AI service: retry classification distinguishes a bad key from a temporary outage", () => {
  assert.equal(ai.isRetryableError(new Error("HTTP 401: bad key")), false);
  assert.equal(ai.isRetryableError(new Error("HTTP 400: bad request")), false);
  assert.equal(ai.isRetryableError(new Error("HTTP 429: rate limited")), true);
  assert.equal(ai.isRetryableError(new Error("HTTP 503: unavailable")), true);
  assert.equal(ai.isRetryableError(new Error("Failed to fetch")), true);
});

async function startPlugin() {
  const app = makeApp([]);
  const { Plugin: QT } = load();
  const plugin = new QT(app);
  await plugin.onload();
  const settings = plugin.settings.ai;
  settings.enabled = true;
  settings.backend = "api";
  settings.api.provider = "openai";
  settings.api.baseUrl = "https://example.test/v1";
  settings.api.model = "base-model";
  settings.api.keys.openai = "secret";
  return { app, plugin };
}

test("plugin: the shared path uses the feature model, caps output and counts the request", async () => {
  const { plugin } = await startPlugin();
  plugin.settings.ai.features.chat.model = "cheap-chat";
  plugin.settings.ai.limits.maxTokens = 1200;
  let request = null;
  obsidian.requestImpl = async (req) => {
    request = req;
    return { status: 200, json: { choices: [{ message: { content: "reply" } }] } };
  };
  try {
    const reply = await plugin.aiComplete("system", "hello", { feature: "chat", maxTokens: 9000 });
    assert.equal(reply, "reply");
    const body = JSON.parse(request.body);
    assert.equal(body.model, "cheap-chat");
    assert.equal(body.max_tokens, 1200);
    assert.equal(plugin.aiBudget().used, 1);
    assert.equal(plugin.aiBudget().features.chat.requests, 1);
    assert.equal(plugin.aiModelLabel("chat"), "cheap-chat");
    assert.equal(plugin.aiModelLabel("generation"), "base-model");
  } finally {
    obsidian.requestImpl = null;
  }
});

test("plugin: a daily cap blocks before another request is sent", async () => {
  const { plugin } = await startPlugin();
  plugin.settings.ai.limits.dailyRequests = 1;
  let calls = 0;
  obsidian.requestImpl = async () => {
    calls++;
    return { status: 200, json: { choices: [{ message: { content: "ok" } }] } };
  };
  try {
    await plugin.aiComplete("system", "one", { feature: "chat" });
    await assert.rejects(() => plugin.aiComplete("system", "two", { feature: "chat" }), /daily AI request cap \(1\)/);
    assert.equal(calls, 1);
    assert.equal(plugin.aiBudget().used, 1);
  } finally {
    obsidian.requestImpl = null;
  }
});

test("plugin: vision OCR is refused on OpenCode before anything is started", async () => {
  const { plugin } = await startPlugin();
  plugin.settings.ai.backend = "opencode";
  await assert.rejects(
    () => plugin.aiVision("system", "read this", [{ data: "abc", mime: "image/png" }], { maxTokens: 100 }),
    /needs page images/i
  );
  assert.equal(plugin.aiBudget().used, 0, "a refused capability spends nothing");
});
