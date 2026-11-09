"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const C = T.aiConnection;

async function withRequests(handler, fn) {
  obsidian.requestImpl = handler;
  try {
    return await fn();
  } finally {
    obsidian.requestImpl = null;
  }
}

const MODELS = ["claude-sonnet-4-5", "claude-opus-4-1", "claude-embed"];

function providerRequests() {
  const requests = [];
  return {
    requests,
    handler: async (request) => {
      requests.push(request);
      if (request.method === "GET") return { status: 200, json: { data: MODELS.map((id) => ({ id })) } };
      return { status: 200, json: { content: [{ type: "text", text: "OK" }] } };
    },
  };
}

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.imports = 0;
  plugin.openPdfImport = () => {
    plugin.imports++;
  };
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  await dom.click("Import files (needs AI)");
  return { app, plugin, dom, view };
}

/* ------------------------------------------------------------ shared surfaces */

test("connection: the one renderer and the one fetch/test service are exported", () => {
  assert.equal(typeof T.renderAiConnectionForm, "function", "the wizard is shared, not copied");
  assert.equal(typeof T.aiConnection.fetchModels, "function");
  assert.equal(typeof T.aiConnection.testConnection, "function");
  assert.equal(T.aiConnection.RECOMMENDED_PROVIDER, "anthropic");
});

/* ------------------------------------------------------------ model choice */

test("connection: one sensible model is chosen from the provider's own list", () => {
  assert.equal(
    C.chooseModel({ provider: "anthropic", saved: "", models: ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-1"] }),
    "claude-sonnet-4-5",
    "a stable Sonnet beats the first and the priciest model"
  );
  assert.equal(
    C.chooseModel({ provider: "anthropic", saved: "claude-opus-4-1", models: ["claude-sonnet-4-5", "claude-opus-4-1"] }),
    "claude-opus-4-1",
    "a saved model that the provider still offers is kept"
  );
  assert.equal(
    C.chooseModel({ provider: "openai", saved: "", models: ["gpt-4o", "gpt-5", "text-embedding-3-small"] }),
    "gpt-5",
    "the stable family is preferred"
  );
  assert.equal(C.chooseModel({ provider: "google", saved: "", models: ["gemini-2.5-flash", "gemini-2.5-pro"] }), "gemini-2.5-pro");
  assert.equal(C.chooseModel({ provider: "custom", saved: "", models: ["first-model", "second-model"] }), "first-model");
  assert.equal(C.chooseModel({ provider: "anthropic", saved: "", models: [] }), "claude-sonnet-5-5", "the provider default fills an unfetched field");
  assert.equal(C.chooseModel({ provider: "custom", saved: "", models: [] }), "", "an unknown provider stays honest instead of inventing a name");
});

test("connection: each provider's key page is a real, direct address", () => {
  assert.equal(C.keyPageUrl("anthropic"), "https://console.anthropic.com/settings/keys");
  assert.equal(C.keyPageUrl("openai"), "https://platform.openai.com/api-keys");
  assert.equal(C.keyPageUrl("google"), "https://aistudio.google.com/app/apikey");
  assert.equal(C.keyPageUrl("ollama"), "", "local servers have no key page");
  assert.equal(C.keyPageHost("openai"), "platform.openai.com");
  assert.equal(C.isRecommendedProvider("anthropic"), true);
});

/* ------------------------------------------------------------ the cold start */

test("wizard: a cold start reaches a tested, model-populated import without typing a model", async () => {
  const { plugin, dom, view } = await setup();
  assert.equal(view.state, "ai-setup");
  assert.ok(dom.texts().includes("Connect AI to import files"));
  assert.equal(dom.field("AI provider").value, "anthropic", "the recommended provider is preselected");
  assert.ok(dom.texts().some((text) => /Anthropic \(Claude\) — recommended/.test(text)));
  assert.ok(dom.find("Create a key ↗").length, "the provider's key page is one visible click");
  assert.ok(dom.texts().some((text) => /Opens console\.anthropic\.com in your browser/.test(text)), "the external lookup is explained");
  assert.equal(dom.field("Model name"), undefined, "the happy path never asks for a model name");
  assert.equal(dom.find("Save and continue").length, 0, "the old dead-end save is gone");
  assert.equal(dom.find("Paste questions instead (works offline)").length > 0, true);

  const { requests, handler } = providerRequests();
  await withRequests(handler, async () => {
    dom.type(dom.field("API key"), "sk-ant-test");
    await dom.clickLast("Fetch models");

    assert.equal(plugin.settings.ai.api.model, "claude-sonnet-4-5", "a model was chosen, not typed");
    assert.equal(plugin.settings.ai.api.keys.anthropic, "sk-ant-test");
    assert.match(
      dom.last((entry) => entry.meta && /Found 2 chat models/.test(entry.meta.text || "")).meta.text,
      /Chose claude-sonnet-4-5/
    );
    assert.equal(dom.field("Model").value, "claude-sonnet-4-5");
    assert.equal(dom.last((entry) => entry.meta && entry.meta.text === "Continue to import").disabled, true, "testing comes first");

    await dom.clickLast("Test connection");
    assert.equal(plugin.settings.ai.enabled, false, "testing does not switch AI on early");
    assert.ok(dom.texts().some((text) => /Connected\. claude-sonnet-4-5 replied/.test(text)));
    assert.equal(dom.last((entry) => entry.meta && entry.meta.text === "Continue to import").disabled, false);

    await dom.clickLast("Continue to import");
  });

  assert.equal(plugin.settings.ai.enabled, true, "continuing turns AI on");
  assert.equal(plugin.settings.ai.backend, "api");
  assert.equal(plugin.saved.ai.enabled, true, "the choice is saved");
  assert.equal(plugin.imports, 1, "the real importer opens");
  assert.equal(view.state, "idle");
  assert.equal(requests.filter((request) => request.method === "GET").length, 1);
  assert.equal(requests.filter((request) => request.method === "POST").length, 1);
});

/* ------------------------------------------------------------ honest failures */

test("wizard: a rejected key names the problem and keeps Create a key and the offline route", async () => {
  const { plugin, dom, view } = await setup();
  await withRequests(
    async () => ({ status: 401, json: { error: { message: "invalid x-api-key" } } }),
    async () => {
      dom.type(dom.field("API key"), "sk-wrong");
      await dom.clickLast("Fetch models");
    }
  );
  const text = dom.texts().join("\n");
  assert.match(text, /rejected the API key/);
  assert.match(text, /create a new one with Create a key/);
  assert.ok(dom.find("Paste questions instead (works offline)").length, "offline work stays reachable");
  assert.equal(dom.last((entry) => entry.meta && entry.meta.text === "Continue to import").disabled, true);
  assert.equal(view.state, "ai-setup");
  assert.equal(plugin.settings.ai.enabled, false);
});

test("wizard: a provider with no chat models explains it instead of leaving a dead save", async () => {
  const { plugin, dom } = await setup();
  await withRequests(
    async () => ({ status: 200, json: { data: [] } }),
    async () => {
      dom.type(dom.field("API key"), "sk-test");
      await dom.clickLast("Fetch models");
    }
  );
  const text = dom.texts().join("\n");
  assert.match(text, /empty model list/);
  assert.match(text, /paste questions instead \(it works offline\)/i);
  assert.equal(dom.last((entry) => entry.meta && entry.meta.text === "Continue to import").disabled, true);
  assert.equal(plugin.settings.ai.enabled, false);
});

test("wizard: an offline device says so and points at the offline paste path", async () => {
  const { plugin, dom } = await setup();
  await withRequests(
    async () => {
      throw new Error("Failed to fetch");
    },
    async () => {
      dom.type(dom.field("API key"), "sk-test");
      await dom.clickLast("Fetch models");
    }
  );
  const text = dom.texts().join("\n");
  assert.match(text, /Couldn't reach the provider/);
  assert.match(text, /works offline/);
  assert.equal(dom.last((entry) => entry.meta && entry.meta.text === "Continue to import").disabled, true);
  assert.equal(plugin.settings.ai.enabled, false);
});

/* ------------------------------------------------------------ offline paste */

test("offline paste: Quick add writes a real question note with AI switched off", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(plugin.settings.ai.enabled, false, "the offline path needs no AI");

  const dom = makeDom();
  const modal = new T.QuickAddModal(app, plugin, () => {});
  modal.containerEl = dom.root;
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.titleEl = dom.root;
  modal.open();
  modal.text = "Q: Which gas do plants take in during photosynthesis?\nA. Oxygen\nB. Carbon dioxide\nAnswer: B\nWhy: Photosynthesis consumes carbon dioxide.";
  modal.refresh();
  await modal.write();

  assert.equal(app.created.length, 1, "one ordinary question note is written");
  const note = app.created[0];
  const parsed = T.parseNote(note.text);
  const headings = [...note.text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => ({ heading: match[1] }));
  assert.deepEqual(T.cacheIssues(parsed.fm, headings), [], "the written note passes the import checker");
  assert.match(note.text, /## Question/);
  assert.match(note.text, /## Answer Choices/);
  assert.match(note.text, /## Answer/);
  assert.equal(plugin.settings.ai.enabled, false);
});
