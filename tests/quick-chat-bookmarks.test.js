"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const a = T.agentView;
const chatBookmarks = T.chatBookmarks;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function waitFor(check, message) {
  for (let i = 0; i < 120; i += 1) {
    if (check()) return;
    await tick();
  }
  throw new Error(message || "condition did not become true");
}

async function openView(notes) {
  const app = makeApp(notes || []);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const view = new a.AgentView({ app }, plugin);
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

test("Quick Chat sends through the shipped panel with model, mentions and one send per invocation", async () => {
  const app = makeApp([{ path: "Biology/Cells.md", text: "Mitochondria make ATP." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.commandModels = { quiz: "command/model" };
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = makeDom().root;
  await view.onOpen();
  plugin.activateAgent = async () => view;

  const calls = [];
  plugin.aiChat = async (system, base, opts) => {
    calls.push({ system, base, opts });
    return "Quick answer";
  };

  const modal = plugin.openQuickChat();
  assert.ok(modal, "Quick Chat opens");
  assert.equal(modal instanceof T.QuickChatModal, true);
  assert.equal(plugin.openQuickChat(), modal, "repeated invocation reuses the open surface");
  modal.contentEl = makeDom().root;
  modal.onOpen();
  modal.input.value = "/quiz Explain @[[Biology/Cells.md]]";
  view.chatPanel.includeMentions = true;

  assert.equal(modal.submit(), true);
  assert.equal(modal.submit(), false, "a second submit on the same surface does not send again");
  await waitFor(() => calls.length === 1 && !view.chatPanel.busy);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].base[calls[0].base.length - 1].content, "/quiz Explain @[[Biology/Cells.md]]");
  assert.match(calls[0].system, /EXPLICITLY ATTACHED VAULT NOTES/);
  assert.match(calls[0].system, /Mitochondria make ATP\./);
  assert.equal(calls[0].opts.model, "command/model", "Quick Chat uses the shipped command-model resolver");
  assert.deepEqual(
    view.activeTab().messages.map((message) => message.content),
    ["/quiz Explain @[[Biology/Cells.md]]", "Quick answer"]
  );
});

test("Quick Chat refuses an over-budget prompt and reports an aborted reply through the panel", async () => {
  const { plugin, view } = await openView();
  plugin.activateAgent = async () => view;
  const calls = [];
  plugin.aiChat = async (system, base, opts) => {
    calls.push({ system, base, opts });
    return "never";
  };
  const panel = view.chatPanel;

  const huge = "x".repeat(T.chatBudget.CONTEXT_BUDGET_TOKENS * T.chatBudget.CHARS_PER_TOKEN + 400);
  const modal = plugin.openQuickChat();
  modal.contentEl = makeDom().root;
  modal.onOpen();
  modal.input.value = huge;
  assert.equal(modal.submit(), true);
  await waitFor(() => /over the local .* chat budget/.test(panel.error || ""));
  assert.equal(calls.length, 0, "the shipped budget guard refuses before a provider call");
  assert.equal(panel.busy, false);

  const aborted = [];
  plugin.aiChat = async () => {
    aborted.push(1);
    const error = new Error("request stopped");
    error.name = "AbortError";
    throw error;
  };
  assert.equal(await view.quickChat("abort this"), true);
  await waitFor(() => aborted.length === 1 && !panel.busy);
  assert.equal(panel.error, "");
  assert.match(panel.status.meta.text || "", /Stopped/);
});

test("message bookmarks persist through the existing chat store and reopen the exact chat and message", async () => {
  const { app, plugin, view } = await openView();
  const ai = plugin.settings.ai;
  view.saveApiHistory(history("Alpha"));
  const chatId = ai.studyChatId;
  const panel = view.chatPanel;

  panel.toggleBookmark(1, panel.turns[1]);
  assert.equal(panel.bookmarks.length, 1);
  assert.equal(ai.studyChatBookmarks.length, 1);
  assert.equal(chatBookmarks.isBookmarked(panel.bookmarks, chatBookmarks.makeBookmark(panel.turns[1], 1)), true);
  const link = view.bookmarkLink(panel.bookmarks[0]);
  assert.match(link, /^obsidian:\/\/mcq-tracker-chat\?chat=/);
  assert.equal(chatBookmarks.parseBookmarkLink(link).chatId, chatId);

  const saved = JSON.parse(JSON.stringify(plugin.saved));
  const reloadPlugin = new QT(app);
  reloadPlugin.saved = saved;
  await reloadPlugin.onload();
  const reopened = new a.AgentView({ app }, reloadPlugin);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();
  assert.equal(reopened.chatPanel.bookmarks.length, 1, "the active bookmark survives a reload");
  assert.equal(await reopened.openBookmarkLink(link), true);
  assert.equal(reopened.activeTab().id, chatId);
  assert.equal(reopened.chatPanel.turnEls[1].classes.has("is-bookmark-jump"), true);

  reopened.startNewChat();
  assert.equal(reopened.plugin.settings.ai.chatSessions[0].bookmarks.length, 1);
  const savedAgain = JSON.parse(JSON.stringify(reopened.plugin.saved));
  const nextPlugin = new QT(app);
  nextPlugin.saved = savedAgain;
  await nextPlugin.onload();
  const next = new a.AgentView({ app }, nextPlugin);
  next.contentEl = makeDom().root;
  await next.onOpen();
  assert.equal(next.getLibrary({ includeArchived: true }).find((row) => row.id === chatId).bookmarks.length, 1);
  assert.equal(await next.openBookmarkLink(link), true, "a saved conversation resumes from its link");
  assert.equal(next.activeTab().id, chatId);

  obsidian.notices.length = 0;
  next.saveApiHistory([{ role: "user", content: "Different question" }]);
  assert.equal(await next.openBookmarkLink(link), false);
  assert.ok(obsidian.notices.some((message) => /message is no longer in this conversation/i.test(message)));
  assert.equal(next.activeTab().id, chatId, "the conversation still opens even when its message is gone");

  next.deleteChat(chatId);
  obsidian.notices.length = 0;
  assert.equal(await next.openBookmarkLink(link), false);
  assert.ok(obsidian.notices.some((message) => /conversation no longer exists/i.test(message)));
});
