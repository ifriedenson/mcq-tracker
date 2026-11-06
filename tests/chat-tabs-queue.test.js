"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const a = T.agentView;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function waitFor(check, message) {
  for (let i = 0; i < 100; i += 1) {
    if (check()) return;
    await tick();
  }
  throw new Error(message || "condition did not become true");
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function openView() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = makeDom().root;
  await view.onOpen();
  return { app, plugin, view };
}

function alphaBetaHistory(text) {
  return [
    { role: "user", content: `${text} question` },
    { role: "assistant", content: `${text} answer` },
  ];
}

test("study agent tabs: two conversations keep their own history and model across a reload", async () => {
  const { app, plugin, view } = await openView();
  const ai = plugin.settings.ai;

  view.saveApiHistory(alphaBetaHistory("Alpha"));
  const alphaId = ai.studyChatId;
  view.newTab();
  view.saveApiHistory(alphaBetaHistory("Beta"));
  const betaId = ai.studyChatId;
  assert.notEqual(alphaId, betaId);
  assert.equal(view.chatTabs.length, 2);

  view.switchTab(alphaId);
  view.chatPanel.setChatModel("alpha/model");
  assert.deepEqual(view.chatPanel.turns.map((turn) => turn.texts[0]), ["Alpha question", "Alpha answer"]);
  assert.equal(ai.studyChatModel, "alpha/model");

  view.switchTab(betaId);
  view.chatPanel.setChatModel("beta/model");
  assert.deepEqual(view.chatPanel.turns.map((turn) => turn.texts[0]), ["Beta question", "Beta answer"]);
  assert.equal(view.tabById(alphaId).model, "alpha/model");
  assert.equal(view.tabById(betaId).model, "beta/model");

  const reloadedPlugin = new QT(app);
  reloadedPlugin.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloadedPlugin.onload();
  const reopened = new a.AgentView({ app }, reloadedPlugin);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();

  assert.equal(reopened.chatTabs.length, 2);
  assert.equal(reopened.activeTab().id, betaId);
  assert.equal(reopened.chatPanel.modelSelect.value, "beta/model");
  reopened.switchTab(alphaId);
  assert.equal(reopened.chatPanel.modelSelect.value, "alpha/model");
  assert.deepEqual(reopened.chatPanel.turns.map((turn) => turn.texts[0]), ["Alpha question", "Alpha answer"]);

  assert.equal(reopened.closeTab(alphaId), true);
  assert.equal(reopened.activeTab().id, betaId);
  const afterClose = new QT(app);
  afterClose.saved = JSON.parse(JSON.stringify(reloadedPlugin.saved));
  await afterClose.onload();
  const closedView = new a.AgentView({ app }, afterClose);
  closedView.contentEl = makeDom().root;
  await closedView.onOpen();
  assert.equal(closedView.chatTabs.length, 1);
  assert.equal(closedView.activeTab().id, betaId);
  assert.ok(closedView.getLibrary().some((row) => row.id === alphaId), "a closed tab remains in the saved library");
});

test("study agent queue: messages queue in order and drain exactly once after the reply", async () => {
  const { view } = await openView();
  const panel = view.chatPanel;
  const gate = deferred();
  const calls = [];
  view.plugin.aiChat = async (system, base) => {
    const text = base[base.length - 1].content;
    calls.push(text);
    if (text === "first") await gate.promise;
    return `reply:${text}`;
  };

  const first = panel.send("first");
  await waitFor(() => panel.busy && calls.length === 1, "the first reply did not start");
  assert.equal(await panel.send("second"), true);
  assert.equal(await panel.send("third"), true);
  assert.deepEqual(panel.queueItems(), ["second", "third"]);
  assert.deepEqual(view.plugin.settings.ai.studyChatQueue, ["second", "third"]);
  assert.ok(panel.queueEl && panel.queueEl.children && panel.queueEl.children.length >= 2, "queued messages are visible");

  gate.resolve();
  await first;
  await waitFor(() => calls.length === 3 && !panel.busy, "queued messages did not drain");

  assert.deepEqual(calls, ["first", "second", "third"]);
  assert.deepEqual(panel.queueItems(), []);
  assert.deepEqual(view.plugin.settings.ai.studyChatQueue, []);
  const users = view.plugin.settings.ai.studyChat.filter((message) => message.role === "user").map((message) => message.content);
  assert.deepEqual(users, ["first", "second", "third"]);
});

test("study agent queue: cancel removes one item and the rest still sends once", async () => {
  const { view } = await openView();
  const panel = view.chatPanel;
  const gate = deferred();
  const calls = [];
  view.plugin.aiChat = async (system, base) => {
    const text = base[base.length - 1].content;
    calls.push(text);
    if (text === "first") await gate.promise;
    return `reply:${text}`;
  };

  const first = panel.send("first");
  await waitFor(() => panel.busy && calls.length === 1);
  await panel.send("second");
  await panel.send("third");
  assert.equal(panel.removeQueued(0), true);
  assert.deepEqual(panel.queueItems(), ["third"]);
  assert.deepEqual(view.plugin.settings.ai.studyChatQueue, ["third"]);

  gate.resolve();
  await first;
  await waitFor(() => calls.length === 2 && !panel.busy);
  assert.deepEqual(calls, ["first", "third"]);
  assert.equal(panel.queueItems().length, 0);
  const users = view.plugin.settings.ai.studyChat.filter((message) => message.role === "user").map((message) => message.content);
  assert.deepEqual(users, ["first", "third"]);
});

test("study agent queue: a queued message follows its own tab across a switch", async () => {
  const { view } = await openView();
  const panel = view.chatPanel;
  const alphaId = view.activeTab().id;
  const gate = deferred();
  const calls = [];
  view.plugin.aiChat = async (system, base) => {
    const text = base[base.length - 1].content;
    calls.push(text);
    if (text === "first") await gate.promise;
    return `reply:${text}`;
  };

  const first = panel.send("first");
  await waitFor(() => panel.busy && calls.length === 1);
  await panel.send("queued on alpha");
  assert.equal(view.newTab(), true);
  assert.equal(view.activeTab().id !== alphaId, true);
  assert.deepEqual(view.activeTab().queue, []);
  assert.deepEqual(view.tabById(alphaId).queue, ["queued on alpha"]);

  assert.equal(view.switchTab(alphaId), true);
  assert.deepEqual(view.chatPanel.queueItems(), ["queued on alpha"]);
  gate.resolve();
  await first;
  await waitFor(() => calls.length === 2 && !view.chatPanel.busy);
  assert.deepEqual(calls, ["first", "queued on alpha"]);
  assert.deepEqual(view.plugin.settings.ai.studyChatQueue, []);
});

test("study agent queue: a queued message survives a reload and is delivered once", async () => {
  const { app, plugin, view } = await openView();
  const panel = view.chatPanel;
  view.saveApiHistory(alphaBetaHistory("Earlier"));
  const gate = deferred();
  const calls = [];
  plugin.aiChat = async (system, base) => {
    const text = base[base.length - 1].content;
    calls.push(text);
    if (text === "first") await gate.promise;
    return `reply:${text}`;
  };

  const first = panel.send("first");
  await waitFor(() => panel.busy && calls.length === 1);
  await panel.send("survives reload");
  await tick();
  const saved = JSON.parse(JSON.stringify(plugin.saved));
  assert.deepEqual(saved.ai.studyChatQueue, ["survives reload"]);

  const reloadedPlugin = new QT(app);
  reloadedPlugin.saved = saved;
  await reloadedPlugin.onload();
  const reloadedCalls = [];
  reloadedPlugin.aiChat = async (system, base) => {
    const text = base[base.length - 1].content;
    reloadedCalls.push(text);
    return `reloaded:${text}`;
  };
  const reopened = new a.AgentView({ app }, reloadedPlugin);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();
  await waitFor(() => reloadedCalls.length === 1 && reopened.chatPanel.queueItems().length === 0, "the restored queue did not drain");

  assert.deepEqual(reloadedCalls, ["survives reload"]);
  const users = reloadedPlugin.settings.ai.studyChat.filter((message) => message.role === "user").map((message) => message.content);
  assert.deepEqual(users, ["Earlier question", "survives reload"]);
  assert.deepEqual(reloadedPlugin.settings.ai.studyChatQueue, []);
});

test("study agent queue: an errored reply does not lose the queued follow-up", async () => {
  const { view } = await openView();
  const panel = view.chatPanel;
  const gate = deferred();
  const calls = [];
  view.plugin.aiChat = async (system, base) => {
    const text = base[base.length - 1].content;
    calls.push(text);
    if (text === "first") await gate.promise;
    return `reply:${text}`;
  };

  const first = panel.send("first");
  await waitFor(() => panel.busy && calls.length === 1);
  await panel.send("after the error");
  gate.reject(new Error("provider offline"));
  await first;
  await waitFor(() => calls.length === 2 && !panel.busy);
  assert.deepEqual(calls, ["first", "after the error"]);
  assert.deepEqual(panel.queueItems(), []);
  const users = view.plugin.settings.ai.studyChat.filter((message) => message.role === "user").map((message) => message.content);
  assert.deepEqual(users, ["after the error"], "the failed reply is not invented, but its queued follow-up still sends once");
});

test("study agent queue: Stop drains the next queued message instead of dropping it", async () => {
  const { view } = await openView();
  const panel = view.chatPanel;
  const gate = deferred();
  const calls = [];
  view.plugin.aiChat = async (system, base) => {
    const text = base[base.length - 1].content;
    calls.push(text);
    if (text === "first") await gate.promise;
    return `reply:${text}`;
  };

  const first = panel.send("first");
  await waitFor(() => panel.busy && calls.length === 1);
  await panel.send("after stop");
  panel.cancelApi();
  gate.resolve();
  await first;
  await waitFor(() => calls.length === 2 && !panel.busy);
  assert.deepEqual(calls, ["first", "after stop"]);
  assert.deepEqual(panel.queueItems(), []);
});
