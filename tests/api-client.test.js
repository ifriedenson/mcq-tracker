"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");

const { T } = load();
const { ApiClient, friendlyApiError } = T;

const app = {};
const okAi = () => ({ api: { provider: "openai", baseUrl: "https://api.example.com/v1", model: "gpt-test", keys: { openai: "sk-test" } } });
const client = (opts, ai) => new ApiClient(ai || okAi(), app, opts);
const messages = [{ role: "user", content: "hello" }];

function stubRequest(handler) {
  obsidian.requestImpl = handler;
  return () => {
    obsidian.requestImpl = null;
  };
}

test("AI request: a missing key, base URL or model names the setting to fix", async () => {
  const config = (pattern) => (error) => {
    assert.equal(error.aiConfig, true);
    assert.match(error.message, pattern);
    return true;
  };
  const noKey = { api: { provider: "openai", baseUrl: "https://api.example.com/v1", model: "m", keys: {} } };
  await assert.rejects(() => client({}, noKey).chat("sys", messages), config(/Add your API key in the plugin settings/));
  await assert.rejects(
    () => client({}, noKey).vision("sys", "prompt", [{ data: "x" }]),
    config(/Add your API key in the plugin settings/)
  );

  const noBase = { api: { provider: "custom", baseUrl: "", model: "m", keys: { custom: "k" } } };
  await assert.rejects(() => client({}, noBase).chat("sys", messages), config(/Add a base URL in the plugin settings/));

  const noModel = { api: { provider: "openai", baseUrl: "https://api.example.com/v1", model: "", keys: { openai: "k" } } };
  await assert.rejects(() => client({}, noModel).chat("sys", messages), config(/Add a model name in the plugin settings/));
});

test("AI request: rejected keys, unknown models and unsafe base URLs carry a settings-fix kind", async () => {
  const config = (code, pattern) => (error) => {
    assert.equal(error.aiConfig, true);
    assert.equal(error.code, code);
    assert.match(error.message, pattern);
    return true;
  };

  const restore401 = stubRequest(async () => ({ status: 401, json: { error: { message: "invalid x-api-key" } }, text: "" }));
  try {
    await assert.rejects(() => client().chat("sys", messages), config("provider-auth", /rejected the API key/));
  } finally {
    restore401();
  }

  const restore404 = stubRequest(async () => ({ status: 404, json: { error: { message: "model gpt-missing not found" } }, text: "" }));
  try {
    await assert.rejects(
      () => client().chat("sys", messages),
      config("provider-model", /did not find that model or endpoint.*Check the model name and base URL in settings/)
    );
  } finally {
    restore404();
  }

  const restore400 = stubRequest(async () => ({
    status: 400,
    json: { error: { message: "model gpt-test does not support this request" } },
    text: "",
  }));
  try {
    await assert.rejects(
      () => client().chat("sys", messages),
      config("provider-model", /rejected the request.*Check the model name and request limits in settings/)
    );
  } finally {
    restore400();
  }

  const unsafe = { api: { provider: "custom", baseUrl: "http://api.example.com/v1", model: "m", keys: { custom: "k" } } };
  await assert.rejects(() => client({}, unsafe).chat("sys", messages), config("ai-config", /must use https:\/\//));
});

test("AI errors: a rejected key is reported as a key problem, not a network problem", () => {
  const message = friendlyApiError(new Error("HTTP 401: Incorrect API key provided: sk-test."));
  assert.match(message, /rejected the API key/);
  assert.match(message, /Incorrect API key provided/);
  assert.doesNotMatch(message, /Couldn't reach the provider/);
});

test("AI request: a local provider that needs no key still works without one", async () => {
  const restore = stubRequest(async () => ({
    status: 200,
    json: { choices: [{ message: { content: "  local reply  " } }] },
    text: "",
  }));
  try {
    const ai = { api: { provider: "ollama", model: "llama", keys: {} } };
    assert.equal(await client({}, ai).chat("sys", messages), "  local reply  ");
  } finally {
    restore();
  }
});

test("AI request: a provider that cannot be reached gets a message that says what to check", async () => {
  // Regression: chat()/vision() used to surface the raw runtime error ("net::ERR_…").
  const restore = stubRequest(async () => {
    throw new Error("net::ERR_INTERNET_DISCONNECTED");
  });
  try {
    await assert.rejects(() => client().chat("sys", messages), /Couldn't reach the provider\. Check your internet connection and the base URL/);
    await assert.rejects(
      () => client().vision("sys", "prompt", [{ data: "abc", mime: "image/png" }]),
      /Couldn't reach the provider\. Check your internet connection and the base URL/
    );
    await assert.rejects(() => client().listModels(), /Couldn't reach the provider\. Check your internet connection and the base URL/);
  } finally {
    restore();
  }
});

test("AI request: an HTTP failure keeps the status and the provider's reason", async () => {
  const restore = stubRequest(async () => ({
    status: 401,
    json: { error: { message: "invalid x-api-key" } },
    text: "",
  }));
  try {
    await assert.rejects(() => client().chat("sys", messages), (e) => {
      assert.match(e.message, /rejected the API key/);
      assert.match(e.message, /HTTP 401: invalid x-api-key/);
      return true;
    });
  } finally {
    restore();
  }

  const restore429 = stubRequest(async () => ({ status: 429, json: { error: "slow down" }, text: "" }));
  try {
    await assert.rejects(() => client().chat("sys", messages), /rate limited or out of credit/);
  } finally {
    restore429();
  }
});

test("AI request: a truncated or non-JSON body says the reply was empty instead of crashing", async () => {
  const restore = stubRequest(async () => ({
    status: 200,
    get json() {
      throw new SyntaxError("Unexpected end of JSON input");
    },
    text: '{"choices":[{"message":{"content":"par',
  }));
  try {
    await assert.rejects(() => client().chat("sys", messages), /The provider returned an empty reply/);
    await assert.rejects(() => client().vision("sys", "p", [{ data: "abc" }]), /The provider returned an empty reply/);
  } finally {
    restore();
  }

  const restoreEmpty = stubRequest(async () => ({ status: 200, json: { choices: [{ message: { content: "   " } }] }, text: "" }));
  try {
    await assert.rejects(() => client().chat("sys", messages), /The provider returned an empty reply/);
    await assert.rejects(() => client().vision("sys", "p", [{ data: "abc" }]), /The provider returned an empty reply/);
  } finally {
    restoreEmpty();
  }

  const restoreNull = stubRequest(async () => null);
  try {
    await assert.rejects(() => client().chat("sys", messages), /The provider returned no response/);
  } finally {
    restoreNull();
  }
});

test("AI request: a provider that never answers times out with a next step", async () => {
  // Regression: requestUrl had no deadline, so the spinner ran forever.
  const restore = stubRequest(() => new Promise(() => {}));
  try {
    await assert.rejects(() => client({ timeoutMs: 40 }).chat("sys", messages), /took longer than 40ms\. Check your connection, then try again\./);
    await assert.rejects(() => client({ timeoutMs: 40 }).vision("sys", "p", [{ data: "abc" }]), /took longer than 40ms/);
    await assert.rejects(() => client({ timeoutMs: 40 }).listModels(), /took longer than 40ms/);
  } finally {
    restore();
  }
  assert.ok(T.REQUEST_TIMEOUT_MS >= 30000, "the default deadline is generous enough for a slow model");
});

test("AI streaming: a failing fetch falls back to the friendly reach message", async () => {
  // Regression: streamChat surfaced the raw "Failed to fetch" TypeError.
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  try {
    await assert.rejects(
      () => client().streamChat("sys", messages, { onDelta: () => {} }),
      /Couldn't reach the provider\. Check your internet connection and the base URL/
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test("AI streaming: a hanging fetch times out instead of freezing the chat", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});
  try {
    await assert.rejects(() => client({ timeoutMs: 40 }).streamChat("sys", messages, { onDelta: () => {} }), /took longer than 40ms/);
  } finally {
    globalThis.fetch = previous;
  }
});

test("AI streaming: an HTTP error keeps the status, and no-model-runtimes fall back to chat()", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    headers: { get: () => "application/json" },
    json: async () => ({ error: { message: "boom" } }),
  });
  try {
    await assert.rejects(() => client().streamChat("sys", messages, { onDelta: () => {} }), /HTTP 500: boom/);
  } finally {
    globalThis.fetch = previous;
  }

  const restore = stubRequest(async () => ({ status: 200, json: { choices: [{ message: { content: "plain" } }] }, text: "" }));
  try {
    const ai = { api: { provider: "ollama", model: "llama", keys: {} } };
    assert.equal(await client({}, ai).streamChat("sys", messages, {}), "plain", "no onDelta means the non-streaming path is used");
  } finally {
    restore();
  }
});

test("AI model list: a 404 points at the base URL, an empty list points at the provider", async () => {
  const restore = stubRequest(async () => ({ status: 404, json: { error: "not found" }, text: "" }));
  try {
    await assert.rejects(() => client().listModels(), /did not expose a model list at that address\. Check the base URL/);
  } finally {
    restore();
  }

  const restoreEmpty = stubRequest(async () => ({ status: 200, json: { data: [] }, text: "" }));
  try {
    await assert.rejects(() => client().listModels(), /empty model list|returned no models|No models/i);
  } finally {
    restoreEmpty();
  }
});

test("AI errors: friendlyApiError leaves an already-clear message alone", () => {
  assert.equal(friendlyApiError(new Error("Add your API key in the plugin settings.")), "Add your API key in the plugin settings.");
  assert.match(friendlyApiError("ETIMEDOUT"), /Couldn't reach the provider/);
  assert.match(friendlyApiError(new Error("HTTP 403: forbidden")), /rejected the API key/);
  for (const message of [
    "The provider rejected the API key, or the key can't use this model. HTTP 401: Incorrect API key provided.",
    "The provider says you're rate limited or out of credit. HTTP 429: slow down",
    "Couldn't reach the provider. Check your internet connection and the base URL in settings.",
  ]) {
    assert.equal(friendlyApiError(new Error(message)), message, "a friendly message is not prefixed twice");
  }
});

test("AI streaming: a cancelled request keeps its AbortError so the panel shows no failure", async () => {
  // Regression: wrapping every rejection made a user cancel look like a provider error.
  const previous = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    throw error;
  };
  try {
    await assert.rejects(() => client().streamChat("sys", messages, { onDelta: () => {}, signal: controller.signal }), (e) => {
      assert.equal(e.name, "AbortError");
      assert.match(e.message, /aborted/);
      return true;
    });
  } finally {
    globalThis.fetch = previous;
  }
});
