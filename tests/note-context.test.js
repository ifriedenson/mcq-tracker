"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const noteContext = T.noteContext;

test("note context: frontmatter is removed and the body is capped", () => {
  const raw = "---\nquestion_id: q\nattempts: 4\nhistory:\n  - private\n---\n\n## Question\nWhat is 2 + 2?\n";
  assert.equal(noteContext.stripFrontmatter(raw), "## Question\nWhat is 2 + 2?");
  const long = "a".repeat(noteContext.MAX_NOTE_CHARS + 20);
  assert.match(noteContext.truncate(long, noteContext.MAX_NOTE_CHARS), /\[truncated\]/);
  const normalized = noteContext.normalizeNoteContext({ path: "Notes/lecture.md", title: "Lecture", text: raw });
  assert.equal(normalized.text, "## Question\nWhat is 2 + 2?");
  assert.equal(normalized.path, "Notes/lecture.md");
});

test("note context: nothing is built while both switches are off", () => {
  const raw = { title: "Lecture", path: "Notes/lecture.md", text: "## Question\nSecret question", selection: "Secret selection" };
  assert.equal(noteContext.buildCurrentNoteContext(raw, {}), "");
  assert.equal(noteContext.buildCurrentNoteContext(raw, { note: false, selection: false }), "");
  const note = noteContext.buildCurrentNoteContext(raw, { note: true });
  assert.match(note, /CURRENT NOTE CONTEXT/);
  assert.match(note, /Secret question/);
  assert.doesNotMatch(note, /Secret selection/);
  const selection = noteContext.buildCurrentNoteContext(raw, { selection: true });
  assert.match(selection, /Secret selection/);
  assert.doesNotMatch(selection, /Secret question/);
  assert.match(selection, /untrusted data/i);
  assert.match(selection, /Never change tracking properties/i);
});

test("note context: the active editor selection is read only for the active note", async () => {
  const file = { path: "Notes/lecture.md", basename: "lecture" };
  const app = {
    vault: { cachedRead: async () => "---\nattempts: 9\n---\n\nLecture body" },
    workspace: {
      getActiveFile: () => file,
      activeEditor: { file, editor: { getSelection: () => "key phrase" } },
    },
  };
  const raw = await noteContext.readActiveNoteContext(app);
  assert.equal(raw.path, "Notes/lecture.md");
  assert.equal(raw.title, "lecture");
  assert.equal(raw.selection, "key phrase");
  assert.match(raw.text, /Lecture body/);

  const other = await noteContext.readActiveNoteContext({
    ...app,
    workspace: { ...app.workspace, activeEditor: { file: { path: "Other.md" }, editor: { getSelection: () => "wrong" } } },
  });
  assert.equal(other.selection, "", "a selection from another file is not attached");
});

test("chat panel: note context is opt-in, per chat, and reaches the system prompt", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  let reads = 0;
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(view, dom.root, {
    title: "Assistant",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    buildContext: (mode, currentNote) => ["BASE", currentNote].filter(Boolean).join("\n\n"),
    readNoteContext: async () => {
      reads++;
      return { path: "Notes/lecture.md", title: "Lecture", text: "## Question\nWhat is 2 + 2?", selection: "2 + 2" };
    },
    quick: [],
  });

  assert.ok(dom.texts().includes("Include current note"));
  assert.ok(dom.texts().includes("Include selection"));
  assert.equal(await panel.prepareContext(), "");
  assert.equal(reads, 0, "nothing is read while both switches are off");

  panel.includeNote = true;
  const context = await panel.prepareContext();
  assert.equal(reads, 1);
  assert.match(context, /CURRENT NOTE CONTEXT/);
  assert.match(context, /What is 2 \+ 2\?/);
  assert.doesNotMatch(context, /SELECTED TEXT/);

  panel.includeSelection = true;
  const both = await panel.prepareContext();
  assert.match(both, /SELECTED TEXT/);
  assert.match(both, /2 \+ 2/);
});
