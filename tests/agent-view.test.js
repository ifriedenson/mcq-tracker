"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const a = T.agentView;
const note = T.agentNote;

test("study agent: local search ranks matching notes and cites path and line", async () => {
  const app = {
    vault: {
      getMarkdownFiles: () => [{ path: "Biology/Cells.md" }, { path: "History/Notes.md" }],
      cachedRead: async (file) => (file.path.startsWith("Biology") ? "# Cells\n\nMitochondria make ATP.\n" : "Unrelated."),
    },
  };
  const hits = await a.searchVault(app, "mitochondria ATP", 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, "Biology/Cells.md");
  assert.equal(hits[0].lineNumber, 3);
  assert.match(a.citationMarkdown(hits[0]), /\[\[Biology\/Cells\.md#L3/);
});

test("study agent: full-vault context is opt-in and local search needs no provider", () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "agent-view.js"), "utf8");
  assert.match(source, /this\.includeVaultIndex = false/);
  assert.match(source, /if \(this\.includeVaultIndex\)/);
  assert.match(source, /Local vault search still works/);
});

test("study agent: card creation goes through the existing approval window", () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "agent-view.js"), "utf8");
  assert.match(source, /ChatPanel/);
  assert.match(source, /nothing is saved without approval/i);
});

test("study agent: context assembly includes citations, retrieval hits, active note and opt-in index", () => {
  const app = {
    vault: {
      getMarkdownFiles: () => [{ path: "Biology/Cells.md" }, { path: "History/Notes.md" }],
      adapter: { basePath: "/vault" },
    },
  };
  const view = new a.AgentView({ app }, { settings: { ai: { tutorRole: "private" } } });
  view.results = [{ path: "Biology/Cells.md", line: "Mitochondria make ATP.", lineNumber: 12 }];

  const context = view.buildContext("tutor", "CURRENT NOTE CONTEXT\nNote: Lecture");
  assert.match(context, /cite it as \[\[path\]\]/);
  assert.match(context, /Biology\/Cells\.md#L12/);
  assert.match(context, /CURRENT NOTE CONTEXT/);
  assert.doesNotMatch(context, /Opt-in vault file index/);

  view.includeVaultIndex = true;
  assert.match(view.buildContext("tutor", ""), /Opt-in vault file index \(paths only\):\nBiology\/Cells\.md\nHistory\/Notes\.md/);
});

test("study agent: a chat question retrieves local notes before context assembly", async () => {
  const app = {
    vault: {
      getMarkdownFiles: () => [{ path: "Biology/Cells.md" }],
      cachedRead: async () => "Mitochondria make ATP.",
    },
  };
  const view = new a.AgentView({ app }, { settings: { ai: { tutorRole: "private" } } });
  view.searchInput = { value: "" };
  view.resultsEl = null;
  await view.prepareQuestion("mitochondria ATP");
  assert.equal(view.results.length, 1);
  assert.equal(view.results[0].path, "Biology/Cells.md");
  assert.match(view.buildContext("tutor", ""), /Biology\/Cells\.md#L1/);
});

test("study agent: ask-about-note turns on note context and sends the note", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  let system = "";
  plugin.aiChat = async (nextSystem) => {
    system = nextSystem;
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
    buildContext: (mode, currentNote) => ["BASE", currentNote].filter(Boolean).join("\n\n"),
    readNoteContext: async () => ({ path: "Notes/lecture.md", title: "Lecture", text: "Cells make ATP.", selection: "" }),
    quick: [],
  });

  assert.equal(panel.includeNote, false);
  await panel.askAboutActiveNote("Explain this note.");
  assert.equal(panel.includeNote, true);
  assert.match(system, /CURRENT NOTE CONTEXT/);
  assert.match(system, /Cells make ATP\./);
  assert.ok(panel.turns.some((turn) => turn.role === "assistant" && turn.texts.includes("A reply")));
});

test("study agent: insert action writes an assistant reply into the active note", async () => {
  let inserted = "";
  const editor = { replaceSelection: (text) => (inserted = text) };
  const file = { path: "Notes/lecture.md" };
  const app = {
    workspace: {
      getActiveFile: () => file,
      activeEditor: { file, editor },
    },
  };
  const result = await note.insertReplyIntoNote(app, "## Summary\nCells make ATP.");
  assert.deepEqual(result, { path: "Notes/lecture.md", mode: "cursor", chars: 26 });
  assert.equal(inserted, "## Summary\nCells make ATP.");
});

test("study agent: insert action appends when the note is open without an editor", async () => {
  const file = { path: "Notes/lecture.md", text: "Existing note" };
  let written = "";
  const app = {
    workspace: { getActiveFile: () => file, activeEditor: null },
    vault: {
      read: async () => file.text,
      modify: async (_file, text) => {
        written = text;
      },
    },
  };
  const result = await note.insertReplyIntoNote(app, "New idea");
  assert.equal(result.mode, "append");
  assert.equal(written, "Existing note\n\nNew idea\n");
});

test("study agent: insert action refuses an empty reply and a missing active note", async () => {
  await assert.rejects(note.insertReplyIntoNote({}, "  "), /no reply/i);
  await assert.rejects(
    note.insertReplyIntoNote({ workspace: { getActiveFile: () => null } }, "text"),
    /Open a note first/
  );
});

test("study agent: Stop clears a Direct API request and ignores its late reply", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  let finish = null;
  plugin.aiChat = () => new Promise((resolve) => (finish = resolve));
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
    quick: [],
  });

  const request = panel.send("Slow question");
  await Promise.resolve();
  assert.equal(panel.busy, true);
  panel.cancelApi();
  assert.equal(panel.busy, false);
  assert.match(panel.error, /Stopped waiting/);
  finish("A late reply");
  await request;
  assert.equal(panel.turns.length, 0, "the cancelled reply is not added to the transcript");
});

test("study agent: the transcript exposes the insert action and passes the reply through", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  let saved = "";
  const panel = new T.ChatPanel(view, dom.root, {
    title: "Study agent",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    buildContext: () => "BASE",
    onSaveNote: (text) => (saved = text),
    saveNoteLabel: "Insert into active note",
    quick: [],
  });
  panel.turns = [{ role: "assistant", texts: ["A useful answer"], tools: [] }];
  panel.sig = "";
  panel.draw();
  assert.ok(dom.texts().includes("Insert into active note"));
  await dom.click("Insert into active note");
  assert.equal(saved, "A useful answer");
});

test("study agent: ribbon and command open the sidebar view when AI is on", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  const ribbon = [];
  plugin.addRibbonIcon = (icon, title, onClick) => {
    ribbon.push({ icon, title, onClick });
    return { remove() {} };
  };
  plugin.ribbonAdded = {};
  plugin.ribbonButtons = {};
  plugin.refreshRibbon();
  assert.ok(ribbon.some((item) => item.icon === "bot" && item.title === "Open Study agent"));
  assert.ok(plugin.commands.some((command) => command.id === "open-study-agent"));
});
