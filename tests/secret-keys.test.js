"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const SK = T.secretKeys;

function memoryStore(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    values,
    getSecret: (name) => (values.has(name) ? values.get(name) : null),
    setSecret: (name, value) => values.set(name, value),
    listSecrets: () => [...values.keys()],
  };
}

test("resolveApiKey prefers Secret Storage and falls back to a legacy key", () => {
  const app = { secretStorage: memoryStore({ "my-key": "sk-secret" }) };
  assert.equal(SK.resolveApiKey(app, { provider: "anthropic", secrets: { anthropic: "my-key" }, keys: { anthropic: "sk-legacy" } }), "sk-secret");
  assert.equal(SK.resolveApiKey(app, { provider: "anthropic", keys: { anthropic: "sk-legacy" } }), "sk-legacy");
  assert.equal(SK.resolveApiKey({}, { provider: "anthropic", keys: { anthropic: "sk-legacy" } }), "sk-legacy");
});

test("a missing or unreadable secret falls back without throwing", () => {
  const app = { secretStorage: { getSecret: () => { throw new Error("locked"); }, setSecret() {} } };
  assert.equal(SK.resolveApiKey(app, { provider: "openai", secrets: { openai: "gone" }, keys: { openai: "sk-old" } }), "sk-old");
});

test("storeApiKey writes to Secret Storage and removes the plain-text copy", () => {
  const store = memoryStore();
  const app = { secretStorage: store };
  const api = { provider: "anthropic", keys: { anthropic: "sk-old" } };
  const saved = SK.storeApiKey(app, api, "anthropic", " sk-new ");
  assert.equal(saved.stored, "secret");
  assert.equal(store.values.get(saved.name), "sk-new");
  assert.equal(api.keys.anthropic, undefined);
  assert.equal(api.secrets.anthropic, saved.name);
  assert.equal(SK.resolveApiKey(app, api), "sk-new");
});

test("storeApiKey falls back to data.json when Secret Storage is unavailable", () => {
  const api = { provider: "openai", keys: {} };
  assert.deepEqual(SK.storeApiKey({}, api, "openai", "sk-plain"), { stored: "plain", name: "" });
  assert.equal(api.keys.openai, "sk-plain");
});

test("migrateApiKeys moves every plain-text key once and keeps an existing secret", () => {
  const store = memoryStore({ "chosen-key": "sk-chosen" });
  const app = { secretStorage: store };
  const api = {
    keys: { anthropic: "sk-legacy", openai: "sk-openai" },
    secrets: { anthropic: "chosen-key" },
  };
  assert.equal(SK.migrateApiKeys(app, api), 2);
  assert.equal(api.keys.anthropic, undefined);
  assert.equal(api.keys.openai, undefined);
  assert.equal(api.secrets.anthropic, "chosen-key");
  assert.equal(store.values.get("chosen-key"), "sk-chosen", "an existing secret is not overwritten");
  assert.ok(api.secrets.openai.startsWith("mcq-tracker-openai-"));
  assert.equal(store.values.get(api.secrets.openai), "sk-openai");
  assert.equal(SK.migrateApiKeys(app, api), 0);
});

test("plugin load migrates a saved API key before saving settings", async () => {
  const store = memoryStore();
  const app = makeApp([]);
  app.secretStorage = store;
  const plugin = new QT(app);
  plugin.saved = { ai: { api: { provider: "anthropic", model: "claude-test", keys: { anthropic: "sk-live" } } } };
  await plugin.onload();
  assert.equal(plugin.settings.ai.api.keys.anthropic, undefined);
  const name = plugin.settings.ai.api.secrets.anthropic;
  assert.ok(name.startsWith("mcq-tracker-anthropic-"));
  assert.equal(store.values.get(name), "sk-live");
  assert.equal(plugin.saved.ai.api.keys.anthropic, undefined, "the migrated key is not left in saved data");
});
