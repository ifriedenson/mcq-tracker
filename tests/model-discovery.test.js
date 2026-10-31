"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const D = T.modelDiscovery;

function client(overrides) {
  const api = Object.assign(
    { provider: "openai", baseUrl: "https://example.test/v1", model: "", keys: { openai: "secret" }, secrets: {} },
    overrides || {}
  );
  return new T.ApiClient({ api }, makeApp([]));
}

async function withRequest(impl, fn) {
  obsidian.requestImpl = impl;
  try {
    return await fn();
  } finally {
    obsidian.requestImpl = null;
  }
}

test("model discovery: OpenAI and Anthropic shapes keep chat models and skip specialists", () => {
  const openai = D.parseModelList({
    data: [
      { id: "gpt-5" },
      { id: "text-embedding-3-small" },
      { id: "gpt-4o" },
      { id: "gpt-5" },
      { id: "gpt-4o-audio-preview" },
    ],
  });
  assert.deepEqual(openai.models, ["gpt-5", "gpt-4o"]);
  assert.equal(openai.skipped, 2);
  assert.equal(openai.issue, "");

  const anthropic = D.parseModelList({
    data: [
      { id: "claude-sonnet-4-5", display_name: "Claude Sonnet" },
      { id: "claude-3-haiku" },
      { id: "claude-embed" },
    ],
  });
  assert.deepEqual(anthropic.models, ["claude-sonnet-4-5", "claude-3-haiku"]);
  assert.equal(anthropic.skipped, 1);
});

test("model discovery: Ollama names, model/ prefixes and array payloads normalize", () => {
  const ollama = D.parseModelList({ models: [{ name: "llama3:latest" }, { name: "nomic-embed-text" }] });
  assert.deepEqual(ollama.models, ["llama3:latest"]);
  assert.deepEqual(D.parseModelList([{ name: "models/gemini-2.5-flash" }]).models, ["gemini-2.5-flash"]);
  assert.deepEqual(D.parseModelList({ data: ["gpt-4.1", "gpt-4.1"] }).models, ["gpt-4.1"]);
});

test("model discovery: empty, malformed and non-chat-only lists explain the problem", () => {
  assert.match(D.parseModelList({ data: [] }).issue, /empty model list/);
  assert.match(D.parseModelList({ unexpected: [] }).issue, /not in a recognised format/);
  assert.match(D.parseModelList({ data: [{}] }).issue, /did not contain any model names/);
  assert.match(D.parseModelList({ data: [{ id: "text-embedding-3-large" }, { id: "whisper-1" }] }).issue, /only non-chat/);
});

test("model discovery: saved lists are bounded, deduplicated and chat-only", () => {
  assert.deepEqual(D.normalizeModelList(["gpt-5", "text-embedding-3-small", "gpt-5", "", " claude "]), ["gpt-5", "claude"]);
  const many = Array.from({ length: D.MAX_MODELS + 5 }, (_value, index) => `model-${index}`);
  const parsed = D.parseModelList({ data: many });
  assert.equal(parsed.models.length, D.MAX_MODELS);
  assert.equal(parsed.truncated, true);
  assert.equal(parsed.issue, "");
});

test("model discovery: an OpenAI request uses GET /models with the bearer key", async () => {
  let request = null;
  await withRequest(
    async (req) => {
      request = req;
      return { status: 200, json: { data: [{ id: "gpt-5" }, { id: "text-embedding-3-small" }] } };
    },
    async () => {
      const found = await client().listModels();
      assert.deepEqual(found.models, ["gpt-5"]);
      assert.equal(found.skipped, 1);
    }
  );
  assert.equal(request.url, "https://example.test/v1/models");
  assert.equal(request.method, "GET");
  assert.deepEqual(request.headers, { Authorization: "Bearer secret" });
  assert.equal(request.body, undefined);
});

test("model discovery: Anthropic uses its versioned endpoint and Ollama needs no key", async () => {
  const requests = [];
  await withRequest(
    async (req) => {
      requests.push(req);
      return { status: 200, json: { data: [{ id: "claude-sonnet-4-5" }] } };
    },
    async () => {
      const anthropic = await client({
        provider: "anthropic",
        baseUrl: "",
        keys: { anthropic: "sk-ant" },
      }).listModels();
      assert.deepEqual(anthropic.models, ["claude-sonnet-4-5"]);
      const ollama = await client({ provider: "ollama", keys: {}, baseUrl: "" }).listModels();
      assert.deepEqual(ollama.models, ["claude-sonnet-4-5"]);
    }
  );
  assert.equal(requests[0].url, "https://api.anthropic.com/v1/models?limit=1000");
  assert.deepEqual(requests[0].headers, { "x-api-key": "sk-ant", "anthropic-version": "2023-06-01" });
  assert.equal(requests[1].url, "http://localhost:11434/v1/models");
  assert.deepEqual(requests[1].headers, {});
});

test("model discovery: missing configuration, HTTP errors and network failures are legible", async () => {
  await assert.rejects(() => client({ provider: "custom", baseUrl: "" }).listModels(), /Add a base URL/);
  await assert.rejects(() => client({ keys: {} }).listModels(), /Add your API key/);

  await withRequest(
    async () => ({ status: 401, json: { error: { message: "bad key" } } }),
    () => assert.rejects(() => client().listModels(), /rejected the API key/)
  );
  await withRequest(
    async () => ({ status: 200, json: { data: [] } }),
    () => assert.rejects(() => client().listModels(), /empty model list/)
  );
  await withRequest(
    async () => ({ status: 200, json: { ok: true } }),
    () => assert.rejects(() => client().listModels(), /not in a recognised format/)
  );
  await withRequest(
    async () => {
      throw new Error("Failed to fetch");
    },
    () => assert.rejects(() => client().listModels(), /Couldn't reach the provider/)
  );
});

async function startPlugin() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const ai = plugin.settings.ai;
  ai.enabled = true;
  ai.backend = "api";
  ai.api.provider = "openai";
  ai.api.baseUrl = "https://example.test/v1";
  ai.api.model = "";
  ai.api.models = [];
  ai.api.keys = { openai: "secret" };
  return { app, plugin, ai };
}

test("plugin: refreshing models persists the list, keeps a current model, and records no generation request", async () => {
  const { plugin, ai } = await startPlugin();
  await withRequest(
    async () => ({ status: 200, json: { data: [{ id: "gpt-5" }, { id: "text-embedding-3-small" }, { id: "gpt-4o" }] } }),
    async () => {
      const found = await plugin.refreshAiModels();
      assert.deepEqual(found.models, ["gpt-5", "gpt-4o"]);
      assert.deepEqual(ai.api.models, ["gpt-5", "gpt-4o"]);
      assert.deepEqual(plugin.saved.ai.api.models, ["gpt-5", "gpt-4o"]);
      assert.equal(ai.api.model, "");
      assert.equal(plugin.readAiUsage().requests, 0);

      ai.api.model = "gpt-4o";
      await plugin.refreshAiModels();
      assert.equal(ai.api.model, "gpt-4o", "a refresh does not replace the selected model");
    }
  );
  assert.equal(await plugin.selectAiModel("  gpt-5  "), "gpt-5");
  assert.equal(plugin.saved.ai.api.model, "gpt-5");
  await assert.rejects(() => plugin.selectAiModel("   "), /Choose a model/);
});

test("plugin: model discovery is Direct AI only and a saved list is normalized on load", async () => {
  const { plugin } = await startPlugin();
  plugin.settings.ai.backend = "opencode";
  await assert.rejects(() => plugin.refreshAiModels(), /Direct AI/);

  const restarted = new QT(makeApp([]));
  restarted.saved = { ai: { api: { models: ["gpt-5", "text-embedding-3-small", "gpt-5", "", " claude "] } } };
  await restarted.loadSettings();
  assert.deepEqual(restarted.settings.ai.api.models, ["gpt-5", "claude"]);
});
