"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

test("selecting a secret keeps only its name and drops the plain-text copy", () => {
  const api = {
    provider: "openai",
    keys: { openai: "sk-legacy" },
    secrets: { openai: "old-name" },
  };
  assert.equal(SK.selectApiSecret(api, "openai", " chosen-key "), "chosen-key");
  assert.equal(api.secrets.openai, "chosen-key");
  assert.equal(api.keys.openai, undefined);
  assert.equal(SK.selectApiSecret(api, "openai", ""), "");
  assert.equal(api.secrets.openai, undefined);
  assert.equal(api.keys.openai, undefined);
});

test("ApiClient uses a Secret Storage key selected by name", () => {
  const app = { secretStorage: memoryStore({ "chosen-key": "sk-live" }) };
  const ai = {
    api: {
      provider: "anthropic",
      baseUrl: "",
      model: "claude-test",
      secrets: { anthropic: "chosen-key" },
      keys: {},
    },
  };
  assert.equal(new T.ApiClient(ai, app).cfg().key, "sk-live");
});

test("the settings connection test uses the shared service so Secret Storage resolves", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "settings-tab.js"), "utf8");
  assert.match(source, /this\.plugin\.testAiConnection\(\)/);
  assert.match(source, /connectionProblem\(e, ai\.api\.provider\)/);
  assert.match(source, /selectApiSecret\(api, api\.provider, value\)/);
});

test("selectPasswordSecret stores only the name and drops the legacy value", () => {
  const target = { password: "legacy-pass", passwordSecret: "" };
  assert.equal(SK.selectPasswordSecret(target, " chosen-password "), "chosen-password");
  assert.equal(target.passwordSecret, "chosen-password");
  assert.equal(target.password, "");
  assert.equal(SK.selectPasswordSecret(target, ""), "");
  assert.equal(target.passwordSecret, "");
  assert.equal(target.password, "");
});

test("resolveSecretValue prefers the named secret and falls back to the legacy value", () => {
  const app = { secretStorage: memoryStore({ picked: "stored-secret" }) };
  assert.equal(SK.resolveSecretValue(app, "picked", "legacy-secret"), "stored-secret");
  assert.equal(SK.resolveSecretValue(app, "missing", "legacy-secret"), "legacy-secret");
  assert.equal(SK.resolveSecretValue({}, "picked", "legacy-secret"), "legacy-secret");
});

test("migratePasswordSecret moves plain text once and keeps it when the store is locked", () => {
  const store = memoryStore();
  const app = { secretStorage: store };
  const target = { password: "server-pass", passwordSecret: "" };
  assert.equal(SK.migratePasswordSecret(app, target, "mcq-tracker-opencode-password"), 1);
  assert.equal(target.password, "");
  assert.equal(target.passwordSecret, "mcq-tracker-opencode-password");
  assert.equal(store.values.get("mcq-tracker-opencode-password"), "server-pass");
  assert.equal(SK.migratePasswordSecret(app, target, "mcq-tracker-opencode-password"), 0);

  const locked = {
    secretStorage: {
      getSecret: () => { throw new Error("locked"); },
      setSecret: () => { throw new Error("locked"); },
    },
  };
  const plain = { password: "keep-me", passwordSecret: "" };
  assert.equal(SK.migratePasswordSecret(locked, plain, "name"), 0);
  assert.equal(plain.password, "keep-me");
  assert.equal(plain.passwordSecret, "");
  assert.equal(SK.migratePasswordSecret({}, { password: "unsecured" }, "name"), 0);
});

test("migratePasswordSecret adopts a legacy fixed-name secret", () => {
  const store = memoryStore({ "mcq-tracker-couchdb-password": "couch-secret" });
  const target = { password: "", passwordSecret: "" };
  assert.equal(SK.migratePasswordSecret({ secretStorage: store }, target, "mcq-tracker-couchdb-password"), 1);
  assert.equal(target.passwordSecret, "mcq-tracker-couchdb-password");
});

test("plugin load migrates OpenCode and CouchDB plain-text passwords", async () => {
  const store = memoryStore();
  const app = makeApp([]);
  app.secretStorage = store;
  const plugin = new QT(app);
  plugin.saved = {
    ai: { password: "opencode-pass", url: "http://127.0.0.1:4096" },
    cards: { couchdb: { password: "couch-pass" } },
  };
  await plugin.onload();
  assert.equal(plugin.settings.ai.password, "");
  assert.equal(plugin.settings.cards.couchdb.password, "");
  assert.equal(store.values.get(plugin.settings.ai.passwordSecret), "opencode-pass");
  assert.equal(store.values.get(plugin.settings.cards.couchdb.passwordSecret), "couch-pass");
});

test("OpenCode resolves a selected secret, a fixed legacy name, and the plain fallback", async () => {
  const store = memoryStore({ "opencode-picked": "server-secret" });
  const app = makeApp([]);
  app.secretStorage = store;
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.passwordSecret = "opencode-picked";
  plugin.settings.ai.password = "legacy";
  assert.equal(plugin.conn().password, "server-secret");
  plugin.settings.ai.passwordSecret = "";
  assert.equal(plugin.conn().password, "legacy");
  plugin.settings.ai.password = "";
  store.values.set(SK.OPENCODE_PASSWORD_SECRET, "fixed-secret");
  assert.equal(plugin.conn().password, "fixed-secret");
});

test("CouchDB sends a picked secret, then the legacy password, in its auth header", async () => {
  const store = memoryStore({ "couch-picked": "couch-secret" });
  const app = makeApp([]);
  app.secretStorage = store;
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.couchdb = {
    enabled: true,
    url: "http://localhost:5984",
    database: "mcq-tracker",
    username: "student",
    passwordSecret: "couch-picked",
    password: "",
  };
  const calls = [];
  plugin.couchDbRequest = async (req) => {
    calls.push(req);
    return { status: 200, json: { db_name: "mcq-tracker" } };
  };
  const decoded = (request) => Buffer.from(String(request.headers.Authorization).replace(/^Basic /, ""), "base64").toString("utf8");
  assert.equal((await plugin.testCouchDbConnection()).ok, true);
  assert.equal(decoded(calls[0]), "student:couch-secret");

  plugin.settings.cards.couchdb = { ...plugin.settings.cards.couchdb, passwordSecret: "", password: "legacy-couch" };
  calls.length = 0;
  assert.equal((await plugin.testCouchDbConnection()).ok, true);
  assert.equal(decoded(calls[0]), "student:legacy-couch");
});

test("settings use SecretComponent and the shared helper for both password rows", () => {
  const settings = fs.readFileSync(path.join(__dirname, "..", "src", "settings-tab.js"), "utf8");
  const cards = fs.readFileSync(path.join(__dirname, "..", "src", "cards-settings.js"), "utf8");
  assert.match(settings, /new SecretComponent\(this\.app, el\)/);
  assert.match(settings, /selectPasswordSecret\(ai, value\)/);
  assert.match(settings, /qt-settings-secret-row/);
  assert.match(cards, /new SecretComponent\(plugin\.app, el\)/);
  assert.match(cards, /selectPasswordSecret\(next, value\)/);
  assert.match(cards, /qt-settings-secret-row/);
  assert.match(cards, /stored as plain text in data\.json/);
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
