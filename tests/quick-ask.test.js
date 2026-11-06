"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const qa = T.quickAsk;
const sc = T.studyCommands;

function editorFor(text) {
  const state = { selection: text, replaced: "" };
  return {
    state,
    getSelection: () => state.selection,
    getRange: () => state.selection,
    getCursor: () => ({ line: 0, ch: 0 }),
    replaceSelection: (value) => {
      state.replaced = value;
      state.selection = value;
    },
  };
}

test("quick ask: selected text is context, full note is opt-in", () => {
  const context = { path: "Notes/lecture.md", title: "Lecture", text: "The whole note.", selection: "ATP is energy." };
  const selectedOnly = qa.quickAskContext(context, { includeNote: false, includeSelection: true });
  assert.match(selectedOnly, /ATP is energy\./);
  assert.doesNotMatch(selectedOnly, /The whole note\./);
  assert.match(selectedOnly, /untrusted study material/);

  const withNote = qa.quickAskContext(context, { includeNote: true, includeSelection: true });
  assert.match(withNote, /The whole note\./);
  assert.match(withNote, /ATP is energy\./);
});

test("quick ask: a typed question wins, otherwise the action supplies the prompt", () => {
  assert.equal(qa.QUICK_ACTIONS.length, 7);
  assert.equal(new Set(qa.QUICK_ACTIONS.map((action) => action.id)).size, 7);
  assert.equal(qa.quickAskQuestion("  Why does ATP matter?  ", "explain"), "Why does ATP matter?");
  assert.match(qa.quickAskQuestion("", "quiz"), /three short questions/i);
  assert.match(qa.quickAskQuestion("", "gaps"), /likely to confuse/i);
  assert.match(qa.quickAskQuestion("", "rewrite"), /clearly and concisely/i);
  assert.match(qa.quickAskQuestion("", "missing"), /question/i);
});

test("quick ask: replace is refused when the original selection changed", () => {
  const editor = editorFor("ATP is energy.");
  assert.equal(qa.canReplaceSelection(editor, "ATP is energy.", { from: { line: 0, ch: 0 }, to: { line: 0, ch: 14 } }), true);
  editor.state.selection = "A different sentence.";
  assert.equal(qa.canReplaceSelection(editor, "ATP is energy.", { from: { line: 0, ch: 0 }, to: { line: 0, ch: 14 } }), false);
  assert.equal(qa.canReplaceSelection(null, "ATP", null), false);
});

test("study commands: text round-trips, ids are unique and the first pipe separates the prompt", () => {
  const rows = sc.parseStudyCommandsText("Explain simply | Explain {} | give one example\nQuiz | Ask three questions\n\nNo separator");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Explain simply");
  assert.equal(rows[0].prompt, "Explain {} | give one example");
  assert.equal(rows[0].id, "explain-simply");

  const deduped = sc.normalizeStudyCommands([
    { name: "Same", prompt: "one" },
    { name: "same", prompt: "two" },
    { id: "same", name: "Other", prompt: "three" },
  ]);
  assert.equal(deduped.length, 2);
  assert.equal(new Set(deduped.map((command) => command.id)).size, 2);
  assert.match(sc.studyCommandsText(deduped), /^Same \| one\nOther \| three$/);
  assert.equal(sc.MAX_STUDY_COMMANDS, 40);
  assert.equal(sc.MAX_COMMAND_PROMPT, 2000);
  assert.equal(sc.normalizeStudyCommands([{ name: "Long", prompt: "x".repeat(2500) }])[0].prompt.length, 2000);
});

test("study commands: slash parsing expands context and keeps the extra instruction", () => {
  const commands = sc.normalizeStudyCommands([{ name: "Explain", prompt: "Explain {}. Use {path}." }]);
  const parsed = sc.parseStudyCommand("/explain focus on the graph", commands);
  assert.equal(parsed.command.id, "explain");
  assert.equal(parsed.rest, "focus on the graph");
  const text = sc.applyStudyCommand(parsed.command, {
    path: "Notes/lecture.md",
    selection: "ATP is energy.",
    note: "The whole note.",
    extra: parsed.rest,
  });
  assert.match(text, /Explain ATP is energy\./);
  assert.match(text, /Notes\/lecture\.md/);
  assert.match(text, /focus on the graph/);
  assert.equal(sc.parseStudyCommand("/not-a-command", commands), null);
});

test("quick ask modal: asks through the shared chat path and only writes on Replace", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  let seen = null;
  plugin.aiChat = async (system, messages, options) => {
    seen = { system, messages, options };
    return "**ATP** is the energy currency of the cell.";
  };

  const editor = editorFor("ATP is energy.");
  const dom = makeDom();
  const modal = new T.QuickAskModal(app, plugin, {
    path: "Notes/lecture.md",
    title: "Lecture",
    text: "The full lecture text.",
    selection: "ATP is energy.",
    editor,
  });
  modal.contentEl = dom.root;
  modal.onOpen();
  modal.input.value = "Explain ATP.";
  await modal.ask();

  assert.equal(seen.options.feature, "chat");
  assert.match(seen.system, /ATP is energy\./);
  assert.doesNotMatch(seen.system, /The full lecture text\./);
  assert.equal(seen.messages[0].role, "user");
  assert.match(modal.answer, /energy currency/);
  assert.equal(editor.state.replaced, "", "asking writes nothing");

  modal.replaceAnswer();
  assert.match(editor.state.replaced, /energy currency/);
});

test("quick ask modal: a changed selection is never overwritten", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.aiChat = async () => "A new answer";
  const editor = editorFor("Original text");
  const dom = makeDom();
  const modal = new T.QuickAskModal(app, plugin, {
    path: "Notes/lecture.md",
    title: "Lecture",
    text: "Note body",
    selection: "Original text",
    editor,
  });
  modal.contentEl = dom.root;
  modal.onOpen();
  await modal.ask();
  editor.state.selection = "Changed text";
  modal.replaceAnswer();
  assert.equal(editor.state.replaced, "");
  assert.ok(require("./helpers/load").obsidian.notices.some((notice) => /selection changed/i.test(notice)));
});

test("quick ask: the command is registered", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.ok(plugin.commands.some((command) => command.id === "ai-quick-ask"));
});

test("chat panel: a saved study command expands with the allowed context", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  let seen = null;
  plugin.aiChat = async (system, messages) => {
    seen = { system, messages };
    return "A reply";
  };
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(view, dom.root, {
    title: "Study agent",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    buildContext: () => "BASE",
    readNoteContext: async () => ({ path: "Notes/lecture.md", title: "Lecture", text: "The note.", selection: "ATP is energy." }),
    getCommands: () => [{ name: "Explain", prompt: "Explain {}. Use {path}." }],
    quick: [],
  });
  panel.includeSelection = true;
  await panel.send("/explain focus on the graph");
  assert.match(seen.messages[0].content, /Explain ATP is energy\./);
  assert.match(seen.messages[0].content, /Notes\/lecture\.md/);
  assert.match(seen.messages[0].content, /focus on the graph/);
});
