"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const thinkFirst = T.thinkFirst;

async function setup(ai = {}) {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  Object.assign(plugin.settings.ai, ai);
  let calls = 0;
  plugin.aiChat = async () => {
    calls++;
    return "reply";
  };
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(view, dom.root, {
    title: "Assistant",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    buildContext: () => "BASE",
    quick: [],
  });
  return { app, plugin, dom, panel, calls: () => calls };
}

test("think-first: off by default, with a bounded seconds normalizer", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(plugin.settings.ai.thinkFirst, false);
  assert.equal(plugin.settings.ai.thinkFirstSeconds, 15);
  assert.equal(thinkFirst.normalizeThinkFirstSeconds(undefined), 15);
  assert.equal(thinkFirst.normalizeThinkFirstSeconds("not a number"), 15);
  assert.equal(thinkFirst.normalizeThinkFirstSeconds(1), 5);
  assert.equal(thinkFirst.normalizeThinkFirstSeconds(999), 120);
  assert.equal(thinkFirst.normalizeThinkFirstSeconds(42.4), 42);
  assert.equal(thinkFirst.thinkFirstRemainingMs(1000, 5, 3500), 2500);
  assert.equal(thinkFirst.thinkFirstRemainingMs(1000, 5, 7000), 0);
  assert.equal(thinkFirst.thinkFirstLabel(2500), "Think first · 3s");
});

test("think-first: opening a chat shows a countdown and blocks sending until it expires", async () => {
  const { panel, calls } = await setup({ thinkFirst: true, thinkFirstSeconds: 5 });
  assert.equal(panel.sendBtn.disabled, true);
  assert.match(panel.thinkFirstText(), /^Think first · [45]s$/);

  panel.input.value = "hello";
  await panel.send("hello");
  assert.equal(calls(), 0, "nothing is sent before the countdown ends");
  assert.equal(panel.input.value, "hello", "the draft is kept");

  panel.thinkFirstStartedAt = Date.now() - 6000;
  panel.refreshThinkFirst();
  assert.equal(panel.sendBtn.disabled, false);
  assert.equal(panel.thinkFirstText(), "");
  await panel.send("hello");
  assert.equal(calls(), 1, "the expired countdown allows the next send");
  assert.ok(panel.turns.some((turn) => turn.texts.includes("reply")));
  await panel.send("again");
  assert.equal(calls(), 2, "the countdown is not reset for the next message");
});

test("think-first: New chat restarts the countdown", async () => {
  const { dom, panel } = await setup({ thinkFirst: true, thinkFirstSeconds: 5 });
  panel.thinkFirstStartedAt = Date.now() - 6000;
  panel.refreshThinkFirst();
  assert.equal(panel.sendBtn.disabled, false);

  await dom.click("New chat");
  assert.equal(panel.sendBtn.disabled, true);
  assert.match(panel.thinkFirstText(), /^Think first · [45]s$/);
});

test("think-first: the shared gate also covers the OpenCode backend", async () => {
  const { panel, plugin, calls } = await setup({ thinkFirst: true, thinkFirstSeconds: 5, backend: "opencode" });
  let started = 0;
  plugin.ensureOpenCode = async () => {
    started++;
  };
  await panel.send("hello");
  assert.equal(calls(), 0);
  assert.equal(started, 0, "OpenCode is not started before the countdown ends");
});

test("think-first: turning the setting off allows immediate sends", async () => {
  const { panel, calls } = await setup({ thinkFirst: false });
  assert.equal(panel.sendBtn.disabled, false);
  assert.equal(panel.thinkFirstText(), "");
  await panel.send("hello");
  assert.equal(calls(), 1);
});

test("think-first: settings survive save and reload, and invalid values clamp", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.thinkFirst = true;
  plugin.settings.ai.thinkFirstSeconds = 42;
  await plugin.save();
  assert.equal(plugin.saved.ai.thinkFirst, true);

  const restarted = new QT(app);
  restarted.saved = JSON.parse(JSON.stringify(plugin.saved));
  await restarted.onload();
  assert.equal(restarted.settings.ai.thinkFirst, true);
  assert.equal(restarted.settings.ai.thinkFirstSeconds, 42);

  restarted.saved.ai.thinkFirstSeconds = 500;
  const clamped = new QT(app);
  clamped.saved = JSON.parse(JSON.stringify(restarted.saved));
  await clamped.onload();
  assert.equal(clamped.settings.ai.thinkFirstSeconds, 120);
});
