"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const local = T.localModels;

test("local presets: loopback OpenAI endpoints that need no key", () => {
  const ids = local.localProviderIds();
  assert.deepEqual(ids.sort(), ["jan", "llamacpp", "lmstudio", "ollama"]);
  for (const id of ids) {
    const preset = T.API_PRESETS[id];
    assert.ok(preset, `${id} is a preset`);
    assert.equal(preset.local, true, `${id} is marked local`);
    assert.equal(preset.noKey, true, `${id} needs no key`);
    assert.equal(preset.kind, "openai");
    assert.match(preset.base, /^http:\/\/(localhost|127\.0\.0\.1):\d+\/v1$/, `${id} uses a loopback /v1 address`);
    const client = new T.ApiClient({ api: { provider: id, baseUrl: "", model: "some-model" } }, {}, {});
    const cfg = client.cfg();
    assert.equal(cfg.base, preset.base);
    assert.equal(cfg.key, "");
  }
});

test("local guides: Gemma through Ollama and the other runners", () => {
  const ollama = local.localModelGuide("ollama");
  assert.equal(ollama.ok, true);
  assert.equal(ollama.baseUrl, "http://localhost:11434/v1");
  assert.ok(ollama.commands.includes("ollama pull gemma4:12b"));
  assert.match(ollama.description, /gemma4:12b/);
  assert.match(ollama.description, /same computer as Obsidian/);
  assert.match(ollama.description, /OLLAMA_CONTEXT_LENGTH=32768/);

  assert.match(local.localModelGuide("lmstudio").description, /localhost:1234/);
  assert.ok(local.localModelGuide("llamacpp").commands[0].includes("llama-server"));
  assert.match(local.localModelGuide("llamacpp").description, /9931/);
  assert.match(local.localModelGuide("jan").description, /1337/);
  assert.ok(local.LOCAL_MODEL_NOTES.some((note) => /Apache 2\.0/.test(note)));
  assert.ok(local.LOCAL_MODEL_NOTES.some((note) => /phone/.test(note)));
});

test("local guides: hosted providers and unknown ids are not local", () => {
  for (const id of ["anthropic", "openai", "openrouter", "google", "custom", "nope"]) {
    assert.equal(local.isLocalProvider(id), false);
    assert.equal(local.localModelGuide(id).ok, false);
  }
  assert.equal(T.API_PRESETS.custom.local, undefined);
});
