"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

function makePanel(plugin, app, extra) {
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  let history = [];
  const panel = new T.ChatPanel(
    view,
    dom.root,
    Object.assign(
      {
        title: "Study agent",
        sourcePath: "",
        getSessionId: () => "",
        setSessionId: () => {},
        getRole: () => "private",
        setRole: () => {},
        buildContext: (mode, context) => `BASE${context ? `\n${context}` : ""}`,
        getApiHistory: () => history,
        saveApiHistory: (next) => {
          history = next.slice();
        },
        quick: [],
      },
      extra || {}
    )
  );
  return { panel, dom, view, history: () => history };
}

async function apiPanel(app, extra) {
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const calls = [];
  plugin.aiChat = async (system, base, opts) => {
    calls.push({ system, base, opts });
    return "Answer";
  };
  const built = makePanel(plugin, app, extra);
  return { plugin, calls, ...built };
}

test("study agent chat: an @ note is attached only while the Mentions switch is on", async () => {
  const app = makeApp([{ path: "Biology/Cells.md", text: "Mitochondria make ATP." }]);
  const { panel, calls } = await apiPanel(app);

  panel.input.value = "Explain @[[Biology/Cells.md]]";
  panel.includeMentions = true;
  await panel.send(panel.input.value);
  assert.equal(calls.length, 1);
  assert.match(calls[0].system, /EXPLICITLY ATTACHED VAULT NOTES/);
  assert.match(calls[0].system, /Mitochondria make ATP\./);
  assert.equal(calls[0].base[calls[0].base.length - 1].content, "Explain @[[Biology/Cells.md]]");

  panel.input.value = "Explain @[[Biology/Cells.md]]";
  panel.includeMentions = false;
  await panel.send(panel.input.value);
  assert.equal(calls.length, 2);
  assert.doesNotMatch(calls[1].system, /Mitochondria make ATP\./);
});

test("study agent chat: a deleted mention refuses the send instead of dropping context", async () => {
  const app = makeApp([]);
  const { panel, calls } = await apiPanel(app);
  panel.input.value = "Summarize @[[Biology/Gone.md]]";
  panel.includeMentions = true;

  await panel.send(panel.input.value);
  assert.equal(calls.length, 0, "no request is made when a mentioned note is missing");
  assert.match(panel.error, /Nothing was sent/);
  assert.match(panel.error, /Biology\/Gone\.md/);
  assert.equal(panel.input.value, "Summarize @[[Biology/Gone.md]]", "the draft stays in the composer");
  assert.equal(panel.busy, false);
});

test("study agent chat: an over-budget message is refused before any provider call", async () => {
  const app = makeApp([]);
  const { panel, calls, dom } = await apiPanel(app);
  const huge = "x".repeat(T.chatBudget.CONTEXT_BUDGET_TOKENS * T.chatBudget.CHARS_PER_TOKEN + 400);
  panel.input.value = huge;

  await panel.send(huge);
  assert.equal(calls.length, 0);
  assert.match(panel.error, /over the local .* chat budget/);
  assert.equal(panel.input.value.length, huge.length);
  assert.equal(panel.busy, false);
  assert.ok(dom.texts().some((text) => /Send will be refused/.test(text)));
  assert.equal(panel.lastBudget.over, true, "the footer reflects the refused over-budget draft");
});

test("study agent chat: the context footer names attachments and warns before and over the budget", async () => {
  const app = makeApp([]);
  const { panel, dom } = await apiPanel(app, {
    readNoteContext: async () => ({ path: "Biology/Cells.md", text: "Cells use ATP.", selection: "ATP" }),
  });
  panel.includeNote = true;
  panel.includeSelection = true;
  panel.input.value = "Explain this";
  await panel.refreshContextPreview();
  panel.refreshTokenFooter();
  assert.ok(dom.texts().some((text) => /current note · selection/.test(text) && /tokens/.test(text)));

  panel.includeNote = false;
  panel.includeSelection = false;
  panel.input.value = "x".repeat(4 * (T.chatBudget.CONTEXT_BUDGET_TOKENS - 100));
  panel.refreshTokenFooter();
  assert.equal(panel.lastBudget.warn, true);
  assert.ok(dom.texts().some((text) => /Approaching the local chat budget/.test(text)));

  panel.input.value = "x".repeat(4 * (T.chatBudget.CONTEXT_BUDGET_TOKENS + 1));
  panel.refreshTokenFooter();
  assert.equal(panel.lastBudget.over, true);
  assert.ok(dom.texts().some((text) => /Over the local chat budget/.test(text)));
});

test("study agent chat: adding a mention enables the switch, removing the last one disables it", async () => {
  const app = makeApp([{ path: "Biology/Cells.md", text: "Cells use ATP." }]);
  const { panel, dom } = await apiPanel(app);
  panel.input.value = "@";
  panel.mentionRange = { start: 0, end: 1 };

  panel.addMention({ kind: "note", path: "Biology/Cells.md" });
  assert.equal(panel.input.value, "@[[Biology/Cells.md]]");
  assert.equal(panel.includeMentions, true);
  assert.equal(panel.mentionTargets().length, 1);
  assert.equal(panel.mentionChip.classes.has("is-selected"), true);

  await dom.click("×");
  assert.equal(panel.input.value, "");
  assert.equal(panel.includeMentions, false);
  assert.equal(panel.mentionChip.classes.has("is-selected"), false);
  assert.equal(panel.mentionTargets().length, 0);
});

test("study agent chat: the @ picker offers vault notes and folders", async () => {
  const app = makeApp([
    { path: "Biology/Cells.md", text: "Cells use ATP." },
    { path: "History/Notes.md", text: "The war ended." },
  ]);
  const { panel, dom } = await apiPanel(app);

  panel.openMentionPicker("cells");
  assert.ok(dom.texts().some((text) => /Note: Biology\/Cells/.test(text)));
  await dom.click("Note: Biology/Cells");
  assert.match(panel.input.value, /@\[\[Biology\/Cells\.md\]\]/);
  assert.equal(panel.includeMentions, true);
  assert.equal(panel.mentionPicker.classes.has("qt-hidden"), true);
});

test("study agent chat: typing @ in the composer opens the mention picker", async () => {
  const app = makeApp([{ path: "Biology/Cells.md", text: "Cells use ATP." }]);
  const { panel, dom } = await apiPanel(app);
  const textarea = dom.all.find((element) => element.meta && element.meta.tag === "textarea");
  assert.ok(textarea, "the composer is rendered");

  textarea.value = "Explain @cells";
  for (const handler of textarea.handlers.filter((item) => item.ev === "input")) await handler.fn({});
  assert.equal(panel.mentionPicker.classes.has("qt-hidden"), false);
  assert.ok(dom.texts().some((text) => /Note: Biology\/Cells/.test(text)));
});

test("conversation library panel: search, archived toggle, pin, archive and restore", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  let rows = [
    { id: "a", title: "Alpha", when: "", pinned: false, active: true, archived: false, messages: [] },
  ];
  let options = null;
  const calls = [];
  const { panel, dom } = makePanel(plugin, app, {
    getLibrary: (next) => {
      options = next;
      return rows;
    },
    onPinChat: (id, pinned) => calls.push(["pin", id, pinned]),
    onArchiveChat: (id) => calls.push(["archive", id]),
    onResumeChat: (id) => calls.push(["resume", id]),
  });

  panel.libraryQuery = "alpha";
  panel.showArchived = true;
  panel.refreshLibrary();
  assert.deepEqual(options, { query: "alpha", includeArchived: true, project: "" });

  await dom.click("Pin");
  assert.deepEqual(calls[0], ["pin", "a", true]);
  await dom.click("Archive");
  assert.deepEqual(calls[1], ["archive", "a"]);

  rows = [{ id: "b", title: "Beta", when: "", pinned: true, active: false, archived: true, messages: [] }];
  panel.libraryQuery = "";
  panel.showArchived = false;
  panel.refreshLibrary();
  assert.equal(panel.libraryRows().length, 1);
  assert.ok(dom.texts().some((text) => /Pinned · Beta .*\(archived\)/.test(text)));
  await dom.click("Restore");
  assert.deepEqual(calls[2], ["resume", "b"]);

  const search = dom.all.find((o) => o.meta && o.meta.attr && o.meta.attr["aria-label"] === "Search conversations");
  assert.ok(search, "the search field is rendered");
  search.value = "beta";
  for (const handler of search.handlers.filter((item) => item.ev === "input")) handler.fn({});
  assert.equal(options.query, "beta");
});


test("study agent chat: the effective model follows chat override, command override, then global", async () => {
  const app = makeApp([]);
  const { panel, calls, plugin, dom } = await apiPanel(app);
  plugin.settings.ai.api.model = "global/model";
  plugin.settings.ai.api.models = ["global/model", "chat/model", "command/model"];
  plugin.settings.ai.commandModels = { quiz: "command/model" };
  plugin.settings.ai.studyChatModel = "chat/model";

  await panel.send("/quiz cells");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.model, "chat/model");
  assert.ok(dom.texts().some((text) => /Model: chat\/model \(chat override\)/.test(text)));

  plugin.settings.ai.studyChatModel = "gone/model";
  panel.input.value = "/quiz cells";
  panel.refreshTokenFooter();
  assert.ok(dom.texts().some((text) => /gone\/model is unavailable/.test(text)));
  assert.ok(dom.texts().some((text) => /Model: command\/model \(command override\)/.test(text)));
  await panel.send(panel.input.value);
  assert.equal(calls[1].opts.model, "command/model");

  plugin.settings.ai.commandModels = { quiz: "also-gone/model" };
  panel.input.value = "/quiz cells";
  panel.refreshTokenFooter();
  assert.ok(dom.texts().some((text) => /also-gone\/model is unavailable/.test(text)));
  assert.ok(dom.texts().some((text) => /Model: global\/model \(global chat model\)/.test(text)));
});

test("study agent chat: the model selector writes the per-chat override through settings", async () => {
  const app = makeApp([]);
  const { panel, plugin } = await apiPanel(app);
  plugin.settings.ai.api.model = "global/model";
  plugin.settings.ai.api.models = ["global/model", "picked/model"];
  panel.renderModelSelect();
  assert.deepEqual(panel.chatModelChoices(), ["global/model", "picked/model"]);

  panel.modelSelect.value = "picked/model";
  for (const handler of panel.modelSelect.handlers.filter((item) => item.ev === "change")) await handler.fn({});
  assert.equal(plugin.settings.ai.studyChatModel, "picked/model");
  assert.equal(panel.lastModelPlan.model, "picked/model");
});

test("study agent chat: /compact folds older messages under the budget with no provider call", async () => {
  const app = makeApp([]);
  const { panel, calls, dom, plugin } = await apiPanel(app);
  plugin.settings.ai.api.model = "global/model";
  const messages = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `${index}: ${"x".repeat(3000)}`,
  }));
  panel.apiHistory().push(...messages);
  panel.persistApiHistory();

  await panel.send("/compact");
  assert.equal(calls.length, 0, "compaction never calls a provider");
  assert.equal(panel.apiHistory().length, 6);
  assert.deepEqual(panel.apiHistory().slice(-4).map((message) => message.content), messages.slice(-4).map((message) => message.content));
  assert.ok(panel.lastBudget.tokens <= T.chatBudget.CONTEXT_BUDGET_TOKENS);
  assert.ok(dom.texts().some((text) => /Compacted 16 older messages into a local summary/.test(text)));
  assert.ok(dom.texts().some((text) => /About .* tokens now/.test(text)));
  assert.ok(dom.texts().some((text) => /Model: global\/model/.test(text)));
});

test("study agent chat: /compact on a small chat reports plainly and leaves history alone", async () => {
  const app = makeApp([]);
  const { panel, calls, dom } = await apiPanel(app);
  panel.apiHistory().push(
    { role: "user", content: "Small question" },
    { role: "assistant", content: "Small answer" }
  );
  panel.persistApiHistory();
  panel.input.value = "/compact";

  await panel.send("/compact");
  assert.equal(calls.length, 0);
  assert.equal(panel.apiHistory().length, 2);
  assert.deepEqual(panel.apiHistory().map((message) => message.content), ["Small question", "Small answer"]);
  assert.equal(panel.input.value, "/compact", "the no-op keeps the composer text");
  assert.ok(dom.texts().some((text) => /only 2 messages/.test(text)));
});
