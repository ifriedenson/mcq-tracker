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
  const viewSource = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "agent-view.js"), "utf8");
  const panelSource = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "chat-panel.js"), "utf8");
  assert.match(viewSource, /ChatPanel/);
  assert.match(panelSource, /nothing is saved without approval/i);
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

test("study agent: a passage question uses the chat panel and refuses when busy or off", async () => {
  const view = new a.AgentView({ app: makeApp([]) }, { settings: { ai: { enabled: true } } });
  const sent = [];
  view.chatPanel = {
    busy: false,
    thinkFirstRemaining: () => 0,
    send: async (text) => sent.push(text),
  };
  assert.equal(await view.askPassage("  Study this passage  "), true);
  assert.deepEqual(sent, ["Study this passage"], "the passage prompt reaches the chat unchanged");

  view.chatPanel.busy = true;
  assert.equal(await view.askPassage("Second question"), false, "a busy chat is not interrupted");
  assert.equal(sent.length, 1);

  view.chatPanel.busy = false;
  view.chatPanel.thinkFirstRemaining = () => 5;
  assert.equal(await view.askPassage("Third question"), false, "the think-first delay is respected");
  assert.equal(sent.length, 1);

  view.chatPanel.thinkFirstRemaining = () => 0;
  view.plugin.settings.ai.enabled = false;
  assert.equal(await view.askPassage("Fourth question"), false, "AI off refuses the question");
  assert.equal(await view.askPassage(""), false);
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

test("study agent: the mounted view renders assistant markdown", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const dom = makeDom();
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();

  assert.equal(
    dom.all.some((element) => element.meta.tag === "h4"),
    false,
    "the leaf title is the only view header"
  );
  assert.equal(
    dom.all.some((element) => element.meta.text === "Ask about your notes, or ask it to create cards. Agent mode proposes cards for your review; nothing is saved without approval."),
    false,
    "the old branded intro does not sit above the chat"
  );
  assert.equal(typeof view.md, "function");
  view.chatPanel.turns = [{ role: "assistant", texts: ["**A useful answer**"], tools: [] }];
  view.chatPanel.sig = "";
  assert.doesNotThrow(() => view.chatPanel.draw());
  assert.ok(dom.texts().includes("Insert into active note"));
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

test("study agent: search returns a passage with its line range", async () => {
  const app = {
    vault: {
      getMarkdownFiles: () => [{ path: "Biology/Cells.md" }, { path: "Unrelated.md" }],
      cachedRead: async (file) =>
        file.path.startsWith("Biology") ? "# Cells\n\nMitochondria make ATP.\nThey have their own DNA.\n" : "Nothing here.",
    },
  };
  const hits = await a.searchVault(app, "mitochondria DNA", 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].lineNumber, 3);
  assert.equal(hits[0].endLine, 4);
  assert.match(hits[0].snippet, /own DNA/);
});

test("study agent: the chat context carries the passage, not one line", () => {
  const view = new a.AgentView({ app: { vault: { getMarkdownFiles: () => [] } } }, { settings: { ai: { tutorRole: "private" } } });
  view.results = [
    {
      path: "Biology/Cells.md",
      lineNumber: 3,
      endLine: 5,
      line: "Mitochondria make ATP.",
      snippet: "Mitochondria make ATP.\nThey have their own DNA.",
    },
  ];
  const context = view.buildContext("tutor", "");
  assert.match(context, /Local vault excerpts for the latest question/);
  assert.match(context, /\(lines 3-5\)/);
  assert.match(context, /> They have their own DNA\./);
});

test("study agent: saved Direct API history is restored and updated after a reply", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.studyChat = [
    { role: "user", content: "Earlier question" },
    { role: "assistant", content: "Earlier reply" },
  ];
  const dom = makeDom();
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();
  assert.deepEqual(view.chatPanel.turns.map((turn) => turn.texts[0]), ["Earlier question", "Earlier reply"]);

  plugin.aiChat = async () => "New reply";
  await view.chatPanel.send("New question");
  assert.equal(plugin.settings.ai.studyChat.length, 4);
  assert.equal(plugin.settings.ai.studyChat[2].role, "user");
  assert.equal(plugin.settings.ai.studyChat[3].content, "New reply");
});

test("study agent: Save chat writes a note and never overwrites one", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const view = new a.AgentView({ app }, plugin);
  const path = await view.saveChat("# Study agent chat\n\n## You\n\nHelp me study.");
  assert.match(path, /^Study agent chats\/Study agent chat \d{4}-\d\d-\d\d \d{4}\.md$/);
  assert.equal(app.created.length, 1);
  assert.match(app.created[0].text, /## You/);
  assert.match(app.created[0].text, /Help me study\./);
  const second = await view.saveChat("# Second chat");
  assert.match(second, / 2\.md$/);
  assert.equal(app.created.length, 2);
  await assert.rejects(view.saveChat("   "), /nothing to save/i);
});

async function panelFor(options) {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  if (options.aiChat) plugin.aiChat = options.aiChat;
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(view, dom.root, {
    title: options.title || "Study agent",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    buildContext: () => "BASE",
    quick: [],
    copyText: options.copyText,
    onSaveChat: options.onSaveChat,
  });
  return { app, plugin, dom, panel };
}

test("chat panel: Copy puts one reply on the clipboard", async () => {
  let copied = "";
  const { dom, panel } = await panelFor({ copyText: async (text) => (copied = text) });
  panel.turns = [{ role: "assistant", texts: ["A useful answer"], tools: [] }];
  panel.sig = "";
  panel.draw();
  await dom.click("Copy");
  assert.equal(copied, "A useful answer");
});

test("chat panel: Enter sends and Shift+Enter keeps a new line", async () => {
  const { panel } = await panelFor({});
  const sent = [];
  panel.send = (text) => sent.push(text);
  panel.input.value = "Question";
  const handler = panel.input.__own.handlers.find((entry) => entry.ev === "keydown").fn;
  let prevented = 0;
  handler({ key: "Enter", shiftKey: true, preventDefault: () => (prevented += 1) });
  assert.equal(sent.length, 0);
  assert.equal(prevented, 0);
  handler({ key: "Enter", shiftKey: false, isComposing: false, preventDefault: () => (prevented += 1) });
  assert.deepEqual(sent, ["Question"]);
  assert.equal(prevented, 1);
});

test("chat panel: Regenerate re-asks without a second user turn", async () => {
  const calls = [];
  const { dom, panel } = await panelFor({
    aiChat: async (_system, messages) => {
      calls.push(messages);
      return `Reply ${calls.length}`;
    },
  });
  await panel.send("Question");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filter((message) => message.role === "user").length, 1);
  await dom.click("Regenerate");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].length, 1, "the previous question is reused, not repeated");
  assert.equal(calls[1][0].role, "user");
  assert.equal(panel.turns.length, 2);
  assert.ok(panel.turns[1].texts.includes("Reply 2"));
});

test("chat panel: Retry re-sends the last question after a failure", async () => {
  let attempts = 0;
  const { dom, panel } = await panelFor({
    aiChat: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("network down");
      return "Second try";
    },
  });
  await panel.send("Question");
  assert.ok(panel.error);
  await dom.click("Retry");
  assert.equal(attempts, 2);
  assert.equal(panel.error, "");
  assert.ok(panel.turns.some((turn) => turn.texts.includes("Second try")));
});

test("chat panel: Save chat hands the whole transcript to the caller", async () => {
  let saved = "";
  const { dom, panel } = await panelFor({ onSaveChat: async (markdown) => (saved = markdown) });
  panel.turns = [
    { role: "user", texts: ["Why ATP?"], tools: [] },
    { role: "assistant", texts: ["Energy currency."], tools: [] },
  ];
  panel.sig = "";
  panel.draw();
  await dom.click("Save chat");
  assert.match(saved, /## You\n\nWhy ATP\?/);
  assert.match(saved, /## Assistant\n\nEnergy currency\./);
});

async function streamPanel(extras) {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.studyChat = [];
  const dom = makeDom();
  const view = { plugin, app, md(text, el) { el.setText(text); } };
  const panel = new T.ChatPanel(
    view,
    dom.root,
    Object.assign(
      {
        title: "Study agent",
        sourcePath: "",
        getSessionId: () => plugin.settings.ai.sessionId,
        setSessionId: (id) => {
          plugin.settings.ai.sessionId = id;
        },
        getRole: () => "private",
        setRole: () => {},
        getApiHistory: () => plugin.settings.ai.studyChat,
        saveApiHistory: (history) => {
          plugin.settings.ai.studyChat = history;
        },
        buildContext: () => "BASE",
        quick: [],
      },
      extras || {}
    )
  );
  return { app, plugin, dom, view, panel };
}

test("study agent: streamed Direct API chunks render live and settle into one reply", async () => {
  const { panel, dom, plugin } = await streamPanel();
  const snapshots = [];
  plugin.aiChat = async (system, messages, opts) => {
    assert.equal(typeof opts.onDelta, "function");
    assert.ok(opts.signal);
    opts.onDelta("Hel");
    snapshots.push(panel.streamText);
    assert.ok(dom.texts().includes("Hel"), "the partial reply is on screen while it streams");
    opts.onDelta("lo");
    snapshots.push(panel.streamText);
    return "Hello";
  };
  await panel.send("Hi there");
  assert.deepEqual(snapshots, ["Hel", "Hello"]);
  assert.equal(panel.streamText, "");
  assert.equal(panel.busy, false);
  assert.deepEqual(panel.turns.map((turn) => turn.role), ["user", "assistant"]);
  assert.deepEqual(panel.turns[1].texts, ["Hello"]);
  assert.deepEqual(plugin.settings.ai.studyChat, [
    { role: "user", content: "Hi there" },
    { role: "assistant", content: "Hello" },
  ]);
});

test("study agent: Stop and Esc cancel mid-stream and keep exactly one partial reply", async () => {
  const { panel, plugin } = await streamPanel();
  let finish = null;
  plugin.aiChat = (system, messages, opts) => {
    opts.onDelta("Partial answer");
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const request = panel.send("First question");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(panel.busy, true);
  panel.cancelApi();
  assert.equal(panel.busy, false);
  assert.equal(panel.error, "");
  assert.equal(plugin.settings.ai.studyChat.length, 2);
  assert.deepEqual(panel.turns[1].texts, ["Partial answer"]);
  finish("A late whole reply");
  await request;
  assert.equal(plugin.settings.ai.studyChat.length, 2, "the late reply is not appended after a cancel");
  assert.equal(panel.turns.length, 2);

  let finishSecond = null;
  plugin.aiChat = (system, messages, opts) => {
    opts.onDelta("Second partial");
    return new Promise((resolve) => {
      finishSecond = resolve;
    });
  };
  const second = panel.send("Second question");
  await new Promise((resolve) => setTimeout(resolve, 5));
  const keydown = panel.input.__own.handlers.find((handler) => handler.ev === "keydown");
  keydown.fn({ key: "Escape", preventDefault() {} });
  assert.equal(panel.busy, false);
  assert.equal(plugin.settings.ai.studyChat.length, 4);
  assert.equal(plugin.settings.ai.studyChat[3].content, "Second partial");
  finishSecond("late");
  await second;
  assert.equal(panel.turns.filter((turn) => turn.role === "user").length, 2);
  assert.equal(plugin.settings.ai.studyChat.length, 4);
});

test("study agent: a provider that does not stream still delivers the complete reply", async () => {
  const { panel, plugin } = await streamPanel();
  plugin.aiChat = async () => "Complete reply";
  await panel.send("Any provider");
  assert.equal(panel.error, "");
  assert.equal(panel.busy, false);
  assert.deepEqual(panel.turns[1].texts, ["Complete reply"]);
  assert.equal(plugin.settings.ai.studyChat.length, 2);
});

test("study agent: regenerate replaces a streamed reply without duplicating the question", async () => {
  const { panel, plugin } = await streamPanel();
  let calls = 0;
  const sent = [];
  plugin.aiChat = async (system, messages, opts) => {
    calls += 1;
    sent.push(messages.map((message) => message.content));
    const text = calls === 1 ? "First answer" : "Second answer";
    opts.onDelta(text);
    return text;
  };
  await panel.send("Explain ATP");
  await panel.regenerate();
  assert.equal(calls, 2);
  assert.deepEqual(sent[1], ["Explain ATP"]);
  assert.deepEqual(plugin.settings.ai.studyChat, [
    { role: "user", content: "Explain ATP" },
    { role: "assistant", content: "Second answer" },
  ]);
  assert.equal(panel.turns.filter((turn) => turn.role === "user").length, 1);
});

test("study agent: retry after a mid-stream error keeps the partial reply as the only one", async () => {
  const { panel, plugin } = await streamPanel();
  let attempts = 0;
  plugin.aiChat = async (system, messages, opts) => {
    attempts += 1;
    if (attempts === 1) {
      opts.onDelta("Half an ans");
      throw new Error("Failed to fetch");
    }
    return "Recovered answer";
  };
  await panel.send("Retry me");
  assert.match(panel.error, /Couldn't reach the provider/);
  assert.deepEqual(
    plugin.settings.ai.studyChat.map((message) => [message.role, message.content]),
    [
      ["user", "Retry me"],
      ["assistant", "Half an ans"],
    ]
  );
  await panel.retry();
  assert.equal(attempts, 2);
  assert.deepEqual(plugin.settings.ai.studyChat, [
    { role: "user", content: "Retry me" },
    { role: "assistant", content: "Recovered answer" },
  ]);
  assert.equal(panel.turns.filter((turn) => turn.role === "user").length, 1);
});

test("study agent: OpenCode streams event deltas and refreshes the server transcript", async () => {
  const { panel, plugin } = await streamPanel();
  plugin.settings.ai.backend = "opencode";
  plugin.settings.ai.managed = false;
  const server = [{ info: { role: "user" }, parts: [{ type: "text", text: "Hi" }] }];
  const oc = {
    base: () => "http://127.0.0.1:4096",
    createSession: async () => ({ id: "sid-1" }),
    messages: async () => server,
    stream: async (sid, body, opts) => {
      assert.equal(sid, "sid-1");
      assert.equal(body.parts[0].text, "Hi");
      opts.onDelta("Str");
      assert.equal(panel.streamText, "Str");
      opts.onDelta("eam");
      server.push({ info: { role: "assistant" }, parts: [{ type: "text", text: "Stream" }] });
      return "Stream";
    },
    abort: async () => {},
    send: async () => {
      throw new Error("the blocking send must not be used when streaming is available");
    },
  };
  plugin.openCode = () => oc;
  await panel.send("Hi");
  assert.equal(plugin.settings.ai.sessionId, "sid-1");
  assert.equal(panel.busy, false);
  assert.ok(panel.turns.some((turn) => turn.role === "assistant" && turn.texts.includes("Stream")));
});

test("study agent library: archive, resume, rename and delete never duplicate a conversation", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const dom = makeDom();
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();
  const ai = plugin.settings.ai;
  plugin.aiChat = async () => "Follow-up answer";

  view.saveApiHistory([
    { role: "user", content: "Alpha question" },
    { role: "assistant", content: "Alpha answer" },
  ]);
  const alphaId = ai.studyChatId;
  assert.ok(alphaId);
  assert.equal(ai.studyChatTitle, "Alpha question");
  assert.equal(view.getLibrary().length, 1);
  assert.equal(view.getLibrary()[0].active, true);
  assert.match(view.getLibrary()[0].when, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

  view.startNewChat();
  assert.deepEqual(ai.studyChat, []);
  assert.equal(ai.chatSessions.length, 1);
  assert.equal(ai.chatSessions[0].id, alphaId);

  await new Promise((resolve) => setTimeout(resolve, 5));
  view.saveApiHistory([
    { role: "user", content: "Beta question" },
    { role: "assistant", content: "Beta answer" },
  ]);
  const betaId = ai.studyChatId;
  view.startNewChat();
  const ids = view.getLibrary().map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [betaId, alphaId], "newest conversation comes first");

  assert.equal(view.resumeChat(alphaId), true);
  assert.deepEqual(ai.studyChat.map((message) => message.content), ["Alpha question", "Alpha answer"]);
  assert.equal(ai.chatSessions.length, 1);
  assert.equal(ai.chatSessions[0].id, betaId);
  assert.deepEqual(view.chatPanel.turns.map((turn) => turn.role), ["user", "assistant"]);

  const notesBefore = (app.created || []).length;
  await view.chatPanel.send("Alpha follow-up");
  assert.deepEqual(ai.studyChat.map((message) => message.content), [
    "Alpha question",
    "Alpha answer",
    "Alpha follow-up",
    "Follow-up answer",
  ]);
  view.renameChat(alphaId, "Renamed alpha");
  assert.equal(view.getLibrary().length, 2);
  assert.equal(view.getLibrary().find((row) => row.active).title, "Renamed alpha");
  assert.equal(ai.chatSessions.length, 1);
  view.renameChat(betaId, "Renamed beta");
  assert.equal(ai.chatSessions[0].title, "Renamed beta");
  view.deleteChat(betaId);
  assert.equal(ai.chatSessions.length, 0);
  assert.equal(view.getLibrary().length, 1);
  view.deleteChat(alphaId);
  assert.deepEqual(ai.studyChat, []);
  assert.equal(view.getLibrary().length, 0);
  assert.equal((app.created || []).length, notesBefore, "rename and delete never write chat notes");
});

test("study agent library: the active conversation and list survive reopening the view", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = makeDom().root;
  await view.onOpen();
  const ai = plugin.settings.ai;

  view.saveApiHistory([
    { role: "user", content: "Alpha question" },
    { role: "assistant", content: "Alpha answer" },
  ]);
  const alphaId = ai.studyChatId;
  await new Promise((resolve) => setTimeout(resolve, 5));
  view.startNewChat();
  view.saveApiHistory([
    { role: "user", content: "Gamma question" },
    { role: "assistant", content: "Gamma answer" },
  ]);
  view.startNewChat();
  assert.equal(view.resumeChat(alphaId), true);

  const reopened = new a.AgentView({ app }, plugin);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();
  assert.deepEqual(reopened.chatPanel.turns.map((turn) => turn.texts[0]), ["Alpha question", "Alpha answer"]);
  const rows = reopened.getLibrary();
  assert.equal(rows.find((row) => row.active).id, alphaId);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);

  const firstPath = await reopened.saveChat("# Chat one");
  const secondPath = await reopened.saveChat("# Chat two");
  assert.notEqual(firstPath, secondPath, "an existing saved chat note is never overwritten");
  assert.match(app.files.find((file) => file.path === firstPath).text, /Chat one/);
  assert.match(app.files.find((file) => file.path === secondPath).text, /Chat two/);
});

test("study agent library: pinned and archived chats survive a reload and stay searchable", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = makeDom().root;
  await view.onOpen();

  view.saveApiHistory([
    { role: "user", content: "Alpha question" },
    { role: "assistant", content: "Alpha answer" },
  ]);
  const alphaId = plugin.settings.ai.studyChatId;
  view.startNewChat();
  await new Promise((resolve) => setTimeout(resolve, 5));
  view.saveApiHistory([
    { role: "user", content: "Beta question" },
    { role: "assistant", content: "Beta answer" },
  ]);
  const betaId = plugin.settings.ai.studyChatId;
  view.startNewChat();

  assert.equal(view.pinChat(alphaId, true), true);
  assert.equal(view.archiveChat(betaId, true), true);
  assert.deepEqual(view.getLibrary().map((row) => row.id), [alphaId], "the archived chat is hidden by default");
  assert.deepEqual(view.getLibrary({ query: "beta" }).map((row) => row.id), [betaId], "a search finds the archived chat");
  assert.equal(view.getLibrary({ query: "beta" })[0].archived, true);

  const reloadedPlugin = new QT(app);
  reloadedPlugin.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloadedPlugin.onload();
  const reloadedView = new a.AgentView({ app }, reloadedPlugin);
  reloadedView.contentEl = makeDom().root;
  await reloadedView.onOpen();

  const rows = reloadedView.getLibrary({ includeArchived: true });
  assert.equal(rows.find((row) => row.id === alphaId).pinned, true);
  assert.equal(rows.find((row) => row.id === betaId).archived, true);
  assert.deepEqual(reloadedView.getLibrary({ query: "Beta" }).map((row) => row.id), [betaId]);
  assert.equal(reloadedView.getLibrary().some((row) => row.id === betaId), false);
});


test("study agent library: per-chat and per-command model choices survive a reload", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  const view = new a.AgentView({ app }, plugin);
  view.contentEl = makeDom().root;
  await view.onOpen();

  view.saveApiHistory([
    { role: "user", content: "Alpha question" },
    { role: "assistant", content: "Alpha answer" },
  ]);
  const alphaId = plugin.settings.ai.studyChatId;
  plugin.settings.ai.studyChatModel = "chat/model";
  plugin.settings.ai.commandModels = { quiz: "command/model" };
  view.startNewChat();
  assert.equal(plugin.settings.ai.studyChatModel, "", "a new chat starts on the global model");
  assert.equal(view.getLibrary().find((row) => row.id === alphaId).model, "chat/model");

  const reloadedPlugin = new QT(app);
  reloadedPlugin.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloadedPlugin.onload();
  assert.deepEqual(reloadedPlugin.settings.ai.commandModels, { quiz: "command/model" });

  const reopened = new a.AgentView({ app }, reloadedPlugin);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();
  assert.equal(reopened.getLibrary().find((row) => row.id === alphaId).model, "chat/model");
  assert.equal(reopened.resumeChat(alphaId), true);
  assert.equal(reloadedPlugin.settings.ai.studyChatModel, "chat/model");
  assert.equal(reopened.chatPanel.modelSelect.value, "chat/model");
});
