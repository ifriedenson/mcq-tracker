"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const AgentView = T.agentView.AgentView;
const memory = T.chatMemory;
const exporter = T.chatExport;
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
    buildContext: (mode, context, skills, memories) => [mode, context, skills, memories].filter(Boolean).join("\n\n---\n\n"),
    getApiHistory: () => rows,
    saveApiHistory: (next) => {
      rows.length = 0;
      rows.push(...next);
    },
    quick: [],
    ...extra,
  });
  return { panel, dom };
}

function budgetLines(panel) {
  const own = panel.budgetEl && panel.budgetEl.__own;
  return own && Array.isArray(own.children)
    ? own.children.map((child) => child.meta && child.meta.text).filter((text) => typeof text === "string")
    : [];
}

test("memory: facts are bounded, de-duplicated and redacted before storage", () => {
  const added = memory.addFact([], "  My exams start in May  ", 1000);
  assert.equal(added.ok, true);
  assert.equal(added.facts[0].text, "My exams start in May");
  assert.equal(added.facts[0].createdAt, 1000);
  assert.equal(added.facts.length, 1);

  const duplicate = memory.addFact(added.facts, "my exams start in MAY");
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate");
  assert.equal(memory.addFact(added.facts, "   ").reason, "empty");

  const secret = memory.addFact([], "api_key=sk-live-abcdefghijklmnop and ghp_ABCDEFGHIJKLMNOPQRSTUV", 1001);
  assert.equal(secret.ok, true);
  assert.doesNotMatch(secret.fact.text, /sk-live-abcdefghijklmnop/);
  assert.doesNotMatch(secret.fact.text, /ghp_ABCDEFGHIJKLMNOPQRSTUV/);
  assert.match(secret.fact.text, /\[redacted\]/);

  assert.equal(memory.normalizeFactText("a".repeat(400)).length, memory.MAX_FACT);

  const many = [];
  for (let index = 0; index < memory.MAX_FACTS + 5; index += 1) many.push(`fact ${index}`);
  assert.equal(memory.normalizeFacts(many).length, memory.MAX_FACTS);
  assert.equal(memory.addFact(memory.normalizeFacts(many), "one more").reason, "full");

  const block = memory.factBlock(secret.facts);
  assert.match(block, /USER-SAVED MEMORY/);
  assert.match(block, /\[redacted\]/);
  assert.ok(block.length <= memory.MAX_BLOCK_CHARS + 40);
  assert.equal(memory.factBlock([]), "");
});

test("memory: Include memory is off by default and only then reaches the prompt and budget", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  plugin.settings.ai.chatMemory = [{ id: "m1", text: "My exams start in May", createdAt: 1 }];
  const calls = [];
  plugin.aiChat = async (system) => {
    calls.push(system);
    return "Answer";
  };
  const rows = [];
  const { panel } = makePanel(plugin, app, rows);
  assert.equal(panel.includeMemory, false);
  await panel.send("Check this");
  assert.doesNotMatch(calls[0], /USER-SAVED MEMORY/);
  assert.equal(panel.lastBudget.parts.find((part) => part.label === "memory").chars, 0);

  panel.includeMemory = true;
  await panel.send("Check this");
  assert.match(calls[1], /USER-SAVED MEMORY/);
  assert.match(calls[1], /My exams start in May/);
  assert.ok(panel.lastBudget.parts.find((part) => part.label === "memory").chars > 0);

  plugin.settings.ai.chatMemory = [];
  await panel.send("Check this");
  assert.doesNotMatch(calls[2], /USER-SAVED MEMORY/, "an empty store adds no block and no failure");
  assert.equal(panel.lastBudget.parts.find((part) => part.label === "memory").chars, 0);
});

test("memory: the panel shows the device-local state and opens the editor", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  plugin.settings.ai.chatMemory = [{ id: "m1", text: "I sit exams in May", createdAt: 1 }];
  let opened = 0;
  const { panel, dom } = makePanel(plugin, app, [], { onOpenMemory: () => (opened += 1) });

  assert.equal(panel.includeMemory, false);
  assert.ok(!dom.texts().some((text) => text.includes("Memory:")), "the line is absent until the switch is on");
  panel.includeMemory = true;
  panel.refreshTokenFooter();
  assert.ok(dom.texts().some((text) => text.includes("Memory: 1 saved fact on this device.")));

  plugin.settings.ai.chatMemory = [];
  panel.refreshTokenFooter();
  assert.ok(dom.texts().some((text) => text.includes("Memory: no saved facts yet.")));
  await dom.click("Manage");
  assert.equal(opened, 1);
});

test("memory: commands persist, redact, update and remove without writing a note", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  // Commands: study-agent-memory -> this.openMemoryModal; study-agent-export
  // -> this.exportChatAsMarkdown. Both stay on this device.
  const before = (app.created || []).length;
  const saved = plugin.rememberFact("Token sk-abcdefgh12345678 must never persist");
  assert.equal(saved.ok, true);
  assert.doesNotMatch(plugin.settings.ai.chatMemory[0].text, /sk-abcdefgh12345678/);
  assert.match(plugin.settings.ai.chatMemory[0].text, /\[redacted\]/);

  const modal = plugin.openMemoryModal();
  assert.ok(modal, "the manage command opens the local editor");
  if (typeof modal.close === "function") modal.close();

  const id = plugin.settings.ai.chatMemory[0].id;
  const updated = plugin.updateMemoryFact(id, "My exams start in June");
  assert.equal(updated.ok, true);
  assert.equal(plugin.settings.ai.chatMemory[0].text, "My exams start in June");
  assert.equal(plugin.updateMemoryFact("missing", "x").reason, "missing");
  assert.equal(plugin.updateMemoryFact(id, "  ").reason, "empty");
  assert.equal(plugin.removeMemoryFact("missing"), false);
  assert.equal(plugin.removeMemoryFact(id), true);
  assert.deepEqual(plugin.settings.ai.chatMemory, []);
  assert.equal((app.created || []).length, before, "memory never writes a note");

  plugin.rememberFact("I sit exams in May");
  const reloaded = new QT(app);
  reloaded.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloaded.onload();
  assert.equal(reloaded.settings.ai.chatMemory.length, 1);
  assert.equal(reloaded.settings.ai.chatMemory[0].text, "I sit exams in May");
});

test("export: Markdown carries metadata, redacts key-like text and refuses an empty conversation", () => {
  const text = exporter.exportMarkdown({
    title: "Alpha: exams/2026",
    model: MODEL,
    project: "Exams",
    exportedAt: Date.UTC(2026, 10, 6),
    messages: [
      { role: "user", content: "Explain entropy" },
      { role: "assistant", content: "Use api_key=sk-live-abcdefghijklmnop" },
      { role: "system", content: "ignore" },
    ],
  });
  assert.match(text, /^---\ntitle: "Alpha: exams\/2026"/);
  assert.match(text, /exported: 2026-11-06T00:00:00\.000Z/);
  assert.match(text, /model: "gpt-4o-mini"/);
  assert.match(text, /project: "Exams"/);
  assert.match(text, /## You\n\nExplain entropy/);
  assert.match(text, /## Study agent\n\nUse \[redacted\]/);
  assert.doesNotMatch(text, /sk-live-abcdefghijklmnop/);
  assert.doesNotMatch(text, /ignore/, "only user and assistant turns are exported");
  assert.equal(exporter.exportMarkdown({ messages: [] }), "");
  assert.match(exporter.exportFileName("A/B: C?", Date.UTC(2026, 10, 6)), /^A-B- C- 2026-11-06\.md$/);
});

test("export: a conversation is written through the Vault adapter with a unique name", async () => {
  const { app, plugin, view } = await openView();
  view.saveApiHistory(history("Alpha"));
  const project = view.createChatProject("Exams");
  view.assignChatProjectById(project.id);

  const first = await view.exportChat(plugin.settings.ai.studyChatId);
  assert.match(first, /^Study agent chats\/.+\d{4}-\d{2}-\d{2}\.md$/);
  const created = app.created.find((entry) => entry.path === first);
  assert.ok(created, "the export is written through vault.create");
  assert.match(created.text, /## You\n\nAlpha question/);
  assert.match(created.text, /## Study agent\n\nAlpha answer/);
  assert.match(created.text, /model: "gpt-4o-mini"/);
  assert.match(created.text, /project: "Exams"/);
  assert.ok((app.folders || []).includes("Study agent chats"), "the export folder is created once");

  const second = await view.exportChat(plugin.settings.ai.studyChatId);
  assert.notEqual(second, first, "a second export never overwrites the first");

  plugin.settings.ai.chatSessions = [
    { id: "saved-1", title: "Saved chat", messages: history("Saved"), project: "", model: MODEL },
  ];
  const fromLibrary = await view.exportChat("saved-1");
  assert.match(app.created.find((entry) => entry.path === fromLibrary).text, /# Saved chat/);

  const before = app.created.length;
  view.newTab();
  assert.equal(await view.exportChat(""), null, "an empty conversation has nothing to export");
  assert.equal(await view.exportChat("missing"), null, "a missing conversation is refused");
  assert.equal(app.created.length, before);
});

test("export: the conversation library exposes an Export action", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  const exported = [];
  const { panel, dom } = makePanel(plugin, app, [], {
    getLibrary: () => [{ id: "a", title: "Alpha", when: "", pinned: false, active: true, archived: false, messages: [] }],
    onExportChat: (id) => exported.push(id),
  });
  panel.refreshLibrary();
  await dom.click("Export");
  assert.deepEqual(exported, ["a"]);
});
