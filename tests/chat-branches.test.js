"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const AgentView = T.agentView.AgentView;
const branches = T.chatBranches;
const MODEL = "gpt-4o-mini";

async function readyPlugin(app) {
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.model = MODEL;
  return plugin;
}

async function openView() {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  const view = new AgentView({ app }, plugin);
  view.contentEl = makeDom().root;
  await view.onOpen();
  return { app, plugin, view };
}

function history(text) {
  return [
    { role: "user", content: `${text} question` },
    { role: "assistant", content: `${text} answer` },
  ];
}

function messages() {
  return [...history("Alpha"), ...history("Beta")];
}

function makePanel(plugin, app, rows, extra = {}) {
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(view, dom.root, {
    title: "Study agent",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    getModel: () => plugin.settings.ai.api.model,
    setModel: () => {},
    buildContext: (...parts) => parts.filter(Boolean).join("\n\n"),
    getApiHistory: () => rows,
    saveApiHistory: () => {},
    quick: [],
    ...extra,
  });
  return { panel, dom };
}

test("branches: a plan keeps the prefix before a question and refuses the first turn", () => {
  const rows = messages();
  assert.deepEqual(branches.userTurnIndexes(rows), [0, 2]);
  assert.equal(branches.indexForTurn(rows, 1), 2);
  assert.equal(branches.indexForTurn(rows, 5), -1);
  assert.equal(branches.lastTurnNumber(rows), 1);

  const plan = branches.rewindPlan(rows, 2);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.messages.map((message) => message.content), ["Alpha question", "Alpha answer"]);
  assert.equal(plan.text, "Beta question");

  assert.equal(branches.rewindPlan(rows, 0).reason, "first");
  assert.equal(branches.rewindPlan(rows, 1).reason, "not-user");
  assert.equal(branches.rewindPlan(rows, 9).reason, "missing");
  assert.equal(branches.rewindPlan([], 0).reason, "no-messages");
  assert.equal(branches.forkTitle("Alpha question"), "Alpha question (fork)");
  assert.ok(branches.forkTitle("x".repeat(100)).length <= 80);
  assert.match(branches.reasonText("first"), /first question/i);
});

test("rewind: later turns are removed, the question returns to the composer and the state persists", async () => {
  const { app, plugin, view } = await openView();
  view.saveApiHistory(messages());
  assert.equal(view.activeTab().messages.length, 4);

  assert.equal(view.rewindTurn(1), true);
  assert.deepEqual(view.activeTab().messages.map((message) => message.content), ["Alpha question", "Alpha answer"]);
  assert.equal(view.chatPanel.input.value, "Beta question");
  assert.equal(plugin.settings.ai.studyChat.length, 2);
  const bookmarks = view.activeTab().bookmarks;
  assert.ok(bookmarks.every((bookmark) => bookmark.index < 2), "bookmarks past the cut are dropped");

  const before = JSON.stringify(view.activeTab().messages);
  assert.equal(view.rewindTurn(0), false, "the first question has nothing before it");
  assert.equal(JSON.stringify(view.activeTab().messages), before, "a refused rewind changes nothing");

  plugin.activateAgent = async () => view;
  view.saveApiHistory(messages());
  // study-agent-rewind -> this.rewindLastQuestion -> rewindTurn.
  assert.equal(await plugin.rewindLastQuestion(), true);
  assert.equal(view.activeTab().messages.length, 2);

  const reloaded = new QT(app);
  reloaded.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloaded.onload();
  assert.equal(reloaded.settings.ai.studyChat.length, 2, "the shortened transcript is what reloads");
});

test("rewind and fork: an empty transcript or the OpenCode backend is refused without a change", async () => {
  const { plugin, view } = await openView();
  assert.equal(view.rewindTurn(0), false);
  assert.equal(view.forkTurn(0), false);
  assert.equal(view.rewindLastQuestion(), false);
  assert.equal(view.forkLastQuestion(), false);

  view.saveApiHistory(messages());
  const before = JSON.stringify(view.activeTab().messages);
  plugin.settings.ai.backend = "opencode";
  assert.equal(view.canBranch(), false);
  assert.equal(view.rewindTurn(1), false);
  assert.equal(view.forkTurn(1), false);
  assert.equal(JSON.stringify(view.activeTab().messages), before);
});

test("fork: the prefix becomes a new saved conversation and the original is untouched", async () => {
  const { app, plugin, view } = await openView();
  view.saveApiHistory(messages());
  const original = view.activeTab();

  assert.equal(view.forkTurn(1), true);
  const forked = view.activeTab();
  assert.notEqual(forked.id, original.id);
  assert.deepEqual(forked.messages.map((message) => message.content), ["Alpha question", "Alpha answer"]);
  assert.equal(forked.title, "Alpha question (fork)");
  assert.deepEqual(original.messages.map((message) => message.content), [
    "Alpha question",
    "Alpha answer",
    "Beta question",
    "Beta answer",
  ]);

  const saved = plugin.settings.ai.chatSessions.find((session) => session.id === original.id);
  assert.ok(saved, "the original is saved as an open conversation");
  assert.equal(saved.messages.length, 4);
  assert.equal(plugin.settings.ai.studyChatId, forked.id);

  const reloaded = new QT(app);
  reloaded.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloaded.onload();
  const reopened = new AgentView({ app }, reloaded);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();
  assert.ok(reopened.tabById(original.id), "the original tab is restored");
  assert.equal(reopened.tabById(original.id).messages.length, 4);
  assert.equal(reopened.activeTab().messages.length, 2);

  plugin.activateAgent = async () => view;
  view.saveApiHistory(messages());
  // study-agent-fork -> this.forkLastQuestion -> forkTurn.
  assert.equal(await plugin.forkLastQuestion(), true);
});

test("branches: each question in the message list exposes Rewind and Fork", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  const calls = [];
  const { panel, dom } = makePanel(plugin, app, [], {
    onRewindTurn: (turn) => calls.push(["rewind", turn]),
    onForkTurn: (turn) => calls.push(["fork", turn]),
    canBranch: () => true,
  });
  panel.turns = [
    { role: "user", texts: ["Alpha question"], tools: [] },
    { role: "assistant", texts: ["Alpha answer"], tools: [] },
    { role: "user", texts: ["Beta question"], tools: [] },
  ];
  panel.draw();
  const rewinds = dom.find("Rewind");
  assert.equal(rewinds.length, 2, "both user turns, and only user turns, offer Rewind");
  for (const handler of rewinds[1].handlers.filter((item) => item.ev === "click")) await handler.fn({});
  for (const handler of dom.find("Fork")[1].handlers.filter((item) => item.ev === "click")) await handler.fn({});
  assert.deepEqual(calls, [["rewind", 1], ["fork", 1]]);

  const other = makePanel(plugin, app, [], {
    onRewindTurn: () => {},
    onForkTurn: () => {},
    canBranch: () => false,
  });
  other.panel.turns = [{ role: "user", texts: ["Only question"], tools: [] }];
  other.panel.draw();
  assert.equal(other.dom.find("Rewind").length, 0, "a server-side transcript hides the actions");
  assert.equal(other.dom.find("Fork").length, 0);
});
