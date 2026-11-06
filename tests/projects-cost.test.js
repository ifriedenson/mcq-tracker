"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const AgentView = T.agentView.AgentView;
const projects = T.chatProjects;
const pricing = T.chatPricing;
const MODEL = "gpt-4o-mini";

async function openView() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.model = MODEL;
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

function budgetLines(panel) {
  const own = panel.budgetEl && panel.budgetEl.__own;
  return own && Array.isArray(own.children)
    ? own.children.map((child) => child.meta && child.meta.text).filter((text) => typeof text === "string")
    : [];
}

test("projects: names are bounded and de-duplicated, and filters separate assigned from unassigned", () => {
  const normalized = projects.normalizeProjects([
    { id: "p1", name: "  Exams  " },
    { id: "p2", name: "exams" },
    { id: "", name: "No id" },
    { id: "p3", name: "   " },
  ]);
  assert.deepEqual(normalized, [{ id: "p1", name: "Exams" }]);

  const created = projects.ensureProject(normalized, " Revision ");
  assert.equal(created.project.name, "Revision");
  assert.equal(created.projects.length, 2);
  const again = projects.ensureProject(created.projects, "revision");
  assert.equal(again.project.id, created.project.id, "an existing name is reused, not duplicated");
  assert.equal(again.projects.length, 2);

  assert.equal(projects.projectName(created.projects, created.project.id), "Revision");
  assert.equal(projects.projectName(created.projects, "missing"), "");

  const rows = [
    { id: "a", project: created.project.id },
    { id: "b", project: "" },
    { id: "c", project: "deleted-project" },
  ];
  assert.equal(projects.filterByProject(rows, "").length, 3);
  assert.deepEqual(projects.filterByProject(rows, "none").map((row) => row.id), ["b"]);
  assert.deepEqual(projects.filterByProject(rows, created.project.id).map((row) => row.id), ["a"]);
});

test("projects: a chat keeps its project across a reload, filters the library and is cleared on removal", async () => {
  const { app, plugin, view } = await openView();
  const ai = plugin.settings.ai;

  view.saveApiHistory(history("Alpha"));
  const alphaId = ai.studyChatId;
  const project = view.createChatProject("Exams");
  assert.ok(project && project.id);
  assert.equal(view.assignChatProjectById(project.id), true);
  assert.equal(ai.studyChatProject, project.id);
  assert.equal(view.activeTab().project, project.id);
  const filtered = view.getLibrary({ project: project.id });
  assert.deepEqual(filtered.map((row) => row.id), [alphaId]);
  assert.equal(filtered[0].projectName, "Exams");

  view.newTab();
  view.saveApiHistory(history("Beta"));
  const betaId = ai.studyChatId;
  assert.equal(ai.studyChatProject, "", "a new tab starts unassigned");
  assert.deepEqual(view.getLibrary({ project: "none" }).map((row) => row.id), [betaId]);
  assert.deepEqual(view.getLibrary({ project: project.id }).map((row) => row.id), [alphaId]);
  assert.deepEqual(view.getLibrary({ project: "" }).map((row) => row.id).sort(), [alphaId, betaId].sort());

  const reloaded = new QT(app);
  reloaded.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloaded.onload();
  const reopened = new AgentView({ app }, reloaded);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();
  assert.equal(reopened.chatProjects().length, 1);
  reopened.switchTab(alphaId);
  assert.equal(reopened.activeTab().project, project.id);
  assert.deepEqual(reopened.getLibrary({ project: project.id }).map((row) => row.id), [alphaId]);

  assert.equal(reopened.removeChatProject(project.id), true);
  assert.deepEqual(reopened.chatProjects(), []);
  assert.equal(reopened.tabById(alphaId).project, "");
  assert.equal(reopened.getLibrary({ project: "none" }).length, 2, "both chats read as unassigned after removal");
});

test("projects: absent projects and stale ids degrade to unassigned without an error", async () => {
  const { plugin, view } = await openView();
  view.saveApiHistory(history("Solo"));
  assert.deepEqual(view.chatProjects(), []);
  assert.equal(view.assignChatProjectById("missing"), false);
  assert.deepEqual(view.getLibrary({ project: "missing" }), []);
  assert.equal(view.removeChatProject(""), false);
  assert.equal(view.removeChatProject("missing"), false);

  view.chatPanel.refreshLibrary();
  assert.equal(view.chatPanel.projectSelect.value, "", "the filter falls back to all conversations");
  assert.ok(view.chatPanel.projectAssign, "the per-chat project picker still renders");

  plugin.settings.ai.chatSessions = [
    { id: "old", title: "Old", messages: history("Old"), project: "deleted-project" },
  ];
  const rows = view.getLibrary({ project: "none" });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.project === ""), "a project id that no longer exists reads as unassigned");
  assert.ok(rows.every((row) => row.projectName === ""));
});

test("cost: a conversation estimate counts each resent prompt and each stored reply", () => {
  const table = { m: { model: "m", input: 2, output: 10 } };
  const cost = pricing.estimateConversationCost(table, "M", [
    { role: "user", content: "aaaa" },
    { role: "assistant", content: "bbbbbbbb" },
    { role: "user", content: "cccc" },
  ]);
  assert.equal(cost.ok, true);
  assert.equal(cost.model, "m");
  assert.equal(cost.turns, 2);
  assert.equal(cost.inputTokens, 5, "two prompts, the second resending the first turn");
  assert.equal(cost.outputTokens, 2);
  assert.ok(Math.abs(cost.inputCost - 0.00001) < 1e-12);
  assert.ok(Math.abs(cost.outputCost - 0.00002) < 1e-12);
  assert.ok(Math.abs(cost.total - 0.00003) < 1e-12);

  const withBase = pricing.estimateConversationCost(table, "m", [{ role: "user", content: "aaaa" }], { baseTokens: 100 });
  assert.equal(withBase.inputTokens, 101, "the system/context estimate is part of the first prompt");

  assert.equal(pricing.estimateConversationCost({}, "m", [{ role: "user", content: "x" }]).ok, false);
  assert.equal(pricing.estimateConversationCost(table, "m", []).ok, false);
  assert.equal(pricing.estimateConversationCost({ m: { model: "m", input: 0, output: 0 } }, "m", [{ role: "user", content: "x" }]).ok, false);
});

test("cost: the footer shows a local conversation estimate only with history and prices", async () => {
  const { plugin, view } = await openView();
  const panel = view.chatPanel;

  assert.ok(!budgetLines(panel).some((line) => line.includes("Conversation estimate:")), "an empty chat has no total");
  view.saveApiHistory(history("Alpha"));
  panel.refreshTokenFooter();
  assert.ok(!budgetLines(panel).some((line) => line.includes("Conversation estimate:")), "no local price table means no line");

  plugin.settings.ai.pricing = { [MODEL]: { model: MODEL, input: 2, output: 10 } };
  panel.refreshTokenFooter();
  const line = budgetLines(panel).find((text) => text.includes("Conversation estimate:"));
  assert.ok(line, "the footer adds the conversation estimate");
  assert.match(line, /local prices/);
  assert.match(line, /estimate, not an invoice/);

  plugin.settings.ai.pricing = {};
  panel.refreshTokenFooter();
  assert.ok(!budgetLines(panel).some((text) => text.includes("Conversation estimate:")), "the line disappears without prices");
});

test("cost: the palette estimate command reports the active chat and degrades without data", async () => {
  const { plugin, view } = await openView();
  // study-agent-cost -> this.showChatCostEstimate; study-agent-project opens the
  // name prompt through promptNewChatProject, both local and provider-free.
  assert.equal(plugin.promptNewChatProject(null, null), false, "a missing view is refused, not faked");

  view.saveApiHistory(history("Alpha"));
  plugin.settings.ai.studyChatModel = MODEL;
  const missing = plugin.showChatCostEstimate();
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "no pricing for this model");

  plugin.settings.ai.pricing = { [MODEL]: { model: MODEL, input: 1, output: 2 } };
  const cost = plugin.showChatCostEstimate();
  assert.equal(cost.ok, true);
  assert.ok(cost.total > 0);
  assert.equal(cost.turns, 1);

  plugin.settings.ai.studyChat = [];
  const empty = plugin.showChatCostEstimate();
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "no messages yet");
});
