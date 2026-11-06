"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const models = T.chatModels;

test("chat models: ids are trimmed, bounded and stripped of control characters", () => {
  assert.equal(models.normalizeModel("  gpt\u0000-4  "), "gpt-4");
  assert.equal(models.normalizeModel(null), "");
  assert.equal(models.normalizeModel("x".repeat(400)).length, models.MAX_MODEL_ID);
  assert.equal(models.commandIdFromText(" /Quiz extra words"), "quiz");
  assert.equal(models.commandIdFromText("please /quiz"), "");
  assert.equal(models.commandIdFromText("/"), "");
});

test("chat models: command overrides round-trip through the settings text format", () => {
  const parsed = models.parseCommandModelsText("/quiz | model-one\n\nbad line\ngap|provider/model\nquiz|model-two");
  assert.deepEqual(parsed, { quiz: "model-two", gap: "provider/model" });
  assert.equal(models.commandModelsText(parsed), "gap | provider/model\nquiz | model-two");
  assert.deepEqual(models.normalizeCommandModels({ " /Quiz ": " model ", "bad id": "x", empty: "" }), { quiz: "model" });
  assert.deepEqual(models.normalizeCommandModels(null), {});
});

test("chat models: precedence is chat override, then command override, then the global model", () => {
  const availableModels = ["chat/model", "command/model", "global/model"];
  const base = { globalModel: "global/model", availableModels, backend: "api" };

  const chat = models.resolveChatModel({ ...base, chatModel: "chat/model", commandModel: "command/model" });
  assert.equal(chat.model, "chat/model");
  assert.equal(chat.source, "chat");

  const command = models.resolveChatModel({ ...base, chatModel: "", commandModel: "command/model" });
  assert.equal(command.model, "command/model");
  assert.equal(command.source, "command");

  const global = models.resolveChatModel(base);
  assert.equal(global.model, "global/model");
  assert.equal(global.source, "global");

  const explicitGlobal = models.resolveChatModel({ ...base, chatModel: "global/model" });
  assert.equal(explicitGlobal.model, "global/model");
  assert.equal(explicitGlobal.source, "chat", "an explicit override is still labelled as the chat's choice");
});

test("chat models: an unavailable override falls back visibly instead of failing the send", () => {
  const plan = models.resolveChatModel({
    chatModel: "removed/model",
    commandModel: "command/model",
    globalModel: "global/model",
    availableModels: ["command/model", "global/model"],
    backend: "api",
  });
  assert.equal(plan.model, "command/model");
  assert.equal(plan.source, "command");
  assert.equal(plan.fallbacks.length, 1);
  assert.equal(plan.fallbacks[0].source, "chat");
  assert.equal(plan.fallbacks[0].requested, "removed/model");
  assert.match(plan.fallbacks[0].reason, /fetched model list/);

  const both = models.resolveChatModel({
    chatModel: "removed/chat",
    commandModel: "removed/command",
    globalModel: "global/model",
    availableModels: ["global/model"],
    backend: "api",
  });
  assert.equal(both.model, "global/model");
  assert.equal(both.source, "global");
  assert.deepEqual(both.fallbacks.map((item) => item.source), ["chat", "command"]);
});

test("chat models: an empty fetched list leaves a saved model unvalidated, not rejected", () => {
  const plan = models.resolveChatModel({
    chatModel: "saved/custom",
    globalModel: "global/model",
    availableModels: [],
    backend: "api",
  });
  assert.equal(plan.model, "saved/custom");
  assert.equal(plan.source, "chat");
  assert.deepEqual(plan.fallbacks, []);
});

test("chat models: OpenCode requires a provider/model pair and reports the fallback", () => {
  const bad = models.resolveChatModel({
    chatModel: "gpt-4o",
    globalModel: "provider/model",
    availableModels: ["gpt-4o", "provider/model"],
    backend: "opencode",
  });
  assert.equal(bad.model, "provider/model");
  assert.equal(bad.source, "global");
  assert.match(bad.fallbacks[0].reason, /provider\/model/);

  const good = models.resolveChatModel({
    chatModel: "provider/model",
    globalModel: "other/model",
    availableModels: ["provider/model", "other/model"],
    backend: "opencode",
  });
  assert.equal(good.model, "provider/model");
  assert.equal(good.source, "chat");
});

test("chat models: the selector deduplicates known choices and keeps the saved override", () => {
  const choices = models.modelChoices({
    globalModel: "global/model",
    availableModels: ["global/model", "picked/model", "picked/model"],
    ownModel: "saved/model",
  });
  assert.deepEqual(choices, ["global/model", "picked/model", "saved/model"]);
});
