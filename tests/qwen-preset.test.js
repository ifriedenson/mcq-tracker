"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T } = load();

test("qwen: the preset is selectable, uses DashScope and has a default model", () => {
  const preset = T.API_PRESETS.qwen;
  assert.ok(preset, "Qwen is exposed in the provider list");
  assert.equal(preset.kind, "openai");
  assert.equal(preset.base, "https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
  assert.equal(preset.defaultModel, "qwen-plus");
  assert.match(preset.label, /Qwen/);
});

test("qwen: chat and model discovery use the OpenAI-compatible endpoints", async () => {
  const requests = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (request) => {
    requests.push(request);
    if (request.method === "GET") return { status: 200, json: { data: [{ id: "qwen-plus" }, { id: "text-embedding-v4" }] } };
    return { status: 200, json: { choices: [{ message: { content: "Answers stay in the vault." } }] } };
  };
  try {
    const api = { provider: "qwen", baseUrl: "", model: "", models: [], keys: { qwen: "qwen-secret" }, secrets: {} };
    const client = new T.ApiClient({ api }, makeApp([]));
    const found = await client.listModels();
    assert.deepEqual(found.models, ["qwen-plus"]);
    assert.equal(found.skipped, 1);
    const reply = await client.chat("Be concise.", [{ role: "user", content: "Hello" }]);
    assert.equal(reply, "Answers stay in the vault.");
  } finally {
    obsidian.requestImpl = previous;
  }
  assert.equal(requests[0].url, "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models");
  assert.equal(requests[0].method, "GET");
  assert.deepEqual(requests[0].headers, { Authorization: "Bearer qwen-secret" });
  assert.equal(requests[1].url, "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions");
  assert.equal(requests[1].method, "POST");
  assert.deepEqual(requests[1].headers, { Authorization: "Bearer qwen-secret" });
  const body = JSON.parse(requests[1].body);
  assert.equal(body.model, "qwen-plus");
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[1].content, "Hello");
});
