"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GOOD = (name) => ({ path: `Questions/${name}.md`, fm: { answer: "B" } });
// has the question properties, but a blank question_id
const NO_ID = { path: "Pdf/noid.md", fm: { question_id: "", answer: "B" } };
// a question stem and nothing else: no answer, no choices
const NO_ANSWER = { path: "Pdf/stub.md", fm: { answer: "" }, text: "---\nquestion_id: stub\n---\n\n## Question\nWhat?\n" };
// an ordinary note
const JOURNAL = { path: "Journal/day.md", noFm: true, text: "# Today\nNothing about questions.\n" };

async function setup(notes, settings) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  Object.assign(plugin.settings, settings || {});
  plugin.imports = 0;
  plugin.openPdfImport = () => plugin.imports++;
  plugin.openSettingsCalls = 0;
  plugin.openSettings = () => plugin.openSettingsCalls++;
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  return { app, plugin, dom, view };
}

/* ------------------------------------------------------------ the zero-MCQ check */

test("zero-MCQ check: an empty vault, or one with only ordinary notes, has no valid questions", async () => {
  for (const notes of [[], [JOURNAL]]) {
    const { app } = await setup(notes);
    assert.equal(T.hasValidQuestion(app, ""), false);
    assert.deepEqual(T.emptyState(app, ""), { broken: [] });
  }
});

test("zero-MCQ check: one valid question ends the empty state", async () => {
  const { app } = await setup([JOURNAL, NO_ID, GOOD("q1")]);
  assert.equal(T.hasValidQuestion(app, ""), true);
  assert.equal(T.emptyState(app, ""), null);
});

test("zero-MCQ check reads only the metadata cache, never note contents", async () => {
  const { app } = await setup([JOURNAL, NO_ID, NO_ANSWER, GOOD("q1")]);
  const boom = async () => {
    throw new Error("note contents were read");
  };
  app.vault.read = boom;
  app.vault.cachedRead = boom;
  T.hasValidQuestion(app, "");
  T.scanQuestionNotes(app, "");
  T.emptyState(app, "");
});

test("zero-MCQ check stops at the first valid note", async () => {
  const notes = Array.from({ length: 50 }, (_, i) => GOOD(`q${i}`));
  const { app } = await setup(notes);
  let looked = 0;
  const get = app.metadataCache.getFileCache;
  app.metadataCache.getFileCache = (f) => (looked++, get(f));
  assert.equal(T.hasValidQuestion(app, ""), true);
  assert.equal(looked, 1);
});

test("zero-MCQ check only looks inside the question folder", async () => {
  const { app } = await setup([GOOD("q1"), { path: "Elsewhere/q2.md", fm: { answer: "A" } }]);
  assert.equal(T.hasValidQuestion(app, "Questions"), true);
  assert.equal(T.hasValidQuestion(app, "Elsewhere"), true);
  assert.equal(T.hasValidQuestion(app, "Nothing/here"), false);
  assert.equal(T.hasValidQuestion(app, "/Questions/"), true); // slashes around the setting are ignored
});

/* ------------------------------------------------------------ notes that fail validation */

test("malformed notes: counted and labelled, and ordinary notes are left out", async () => {
  const { app } = await setup([JOURNAL, NO_ID, NO_ANSWER]);
  const state = T.emptyState(app, "");
  assert.deepEqual(
    state.broken.map((b) => [b.path, b.problems]),
    [
      ["Pdf/noid.md", ["No question ID"]],
      ["Pdf/stub.md", ["No answer", "No answer choices"]],
    ]
  );
});

test("malformed notes: a note with no question_id is still spotted by its Question and Answer Choices sections", async () => {
  const { app } = await setup([{ path: "Pdf/a.md", noFm: true, text: "## Question\nWhat?\n\n## Answer Choices\n- A. x\n- B. y\n\n## Answer\nB\n" }]);
  assert.deepEqual(T.emptyState(app, "").broken, [{ path: "Pdf/a.md", problems: ["No question ID"] }]);
});

test("malformed notes: a letter answer needs answer choices, but a note with an answer section and no choices is a self-graded card", async () => {
  assert.deepEqual(T.cacheIssues({ question_id: "a", answer: "B" }, []), ["No answer choices"]);
  assert.deepEqual(T.cacheIssues({ question_id: "a", answer: "B", choices: 4 }, []), []);
  assert.deepEqual(T.cacheIssues({ question_id: "a" }, [{ heading: "Question" }, { heading: "Answer" }]), []);
  assert.deepEqual(T.cacheIssues({ question_id: "a", correct_answer: "C" }, [{ heading: "Answer Choices" }]), []); // the alias names findAnswerKey reads
  assert.deepEqual(T.cacheIssues({ question_id: "a", answer: "42", question_type: "spr" }, []), []);
});

test("malformed notes: valid notes do not count as malformed, and any valid note hides the empty state", async () => {
  const { app } = await setup([NO_ID, NO_ANSWER, GOOD("q1")]);
  assert.equal(T.emptyState(app, ""), null);
  const scan = T.scanQuestionNotes(app, "");
  assert.equal(scan.valid, 1);
  assert.equal(scan.broken.length, 2);
});

test("cacheIssues agrees with the import checker (noteIssues) on the same notes", async () => {
  const notes = [
    "---\nquestion_id: a\nanswer: B\n---\n\n## Question\nQ\n\n## Answer Choices\n- A. x\n- B. y\n",
    "---\nquestion_id: a\n---\n\n## Question\nQ\n",
    "---\nquestion_id: a\nanswer: B\n---\n\n## Question\nQ\n",
    "---\nquestion_id: a\nanswer: 42\nquestion_type: spr\n---\n\n## Question\nQ\n",
  ];
  for (const text of notes) {
    const { fm } = T.parseNote(text);
    const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => ({ heading: m[1] }));
    const expected = (await T.noteIssues(text, async () => true)).filter((x) => x !== "Missing figure");
    assert.deepEqual(T.cacheIssues(fm, headings), expected, text);
  }
});

/* ------------------------------------------------------------ is AI ready? */

test("aiReady: needs AI on, and a key and model for the direct API", async () => {
  const { plugin } = await setup([]);
  const ai = plugin.settings.ai;
  assert.equal(T.aiReady(plugin), false); // off by default
  ai.enabled = true;
  ai.backend = "api";
  assert.equal(T.aiReady(plugin), false); // no key
  ai.api.keys.anthropic = "sk-test";
  assert.equal(T.aiReady(plugin), true);
  ai.api.model = "";
  assert.equal(T.aiReady(plugin), false); // no model
  ai.api.provider = "ollama";
  ai.api.model = "llama3";
  assert.equal(T.aiReady(plugin), true); // local models need no key
  ai.backend = "opencode";
  ai.api.model = "";
  assert.equal(T.aiReady(plugin), true);
});

/* ------------------------------------------------------------ the screen */

test("screen: with no questions it shows the headline, the explanation, Import PDFs and the guide link", async () => {
  const { dom, view } = await setup([JOURNAL]);
  view.render();
  const texts = dom.texts();
  assert.ok(texts.includes("No questions yet"));
  assert.ok(texts.some((t) => /Extract multiple-choice questions from your PDFs/.test(t)));
  assert.ok(texts.includes("Import PDFs"));
  const guide = dom.find("Quick-start guide")[0];
  assert.equal(guide.meta.href, T.QUICK_START_URL);
  assert.ok(!texts.includes("Start")); // none of the practice controls
  assert.ok(!texts.some((t) => /match ·/.test(t)));
  assert.equal(view.emptyShown, true);
  assert.ok(!texts.some((t) => /look like questions/.test(t))); // nothing broken, so no warning
});

test("screen: Import PDFs opens the import flow when AI is set up", async () => {
  const { plugin, dom, view } = await setup([]);
  Object.assign(plugin.settings.ai, { enabled: true, backend: "api" });
  plugin.settings.ai.api.keys.anthropic = "sk-test";
  view.render();
  await dom.click("Import PDFs");
  assert.equal(plugin.imports, 1);
  assert.equal(view.state, "idle");
});

test("screen: with no AI set up, Import PDFs goes to setup first, then on to the import flow", async () => {
  const { plugin, dom, view } = await setup([]);
  view.render();
  await dom.click("Import PDFs");
  assert.equal(plugin.imports, 0, "does not open the import yet");
  assert.equal(view.state, "ai-setup");
  assert.ok(dom.texts().includes("Set up AI to import PDFs"));

  // continuing without a key is refused
  await dom.click("Save and continue");
  assert.equal(plugin.imports, 0);
  assert.equal(plugin.settings.ai.enabled, false);

  // fill in the key and model
  const field = (ph) => dom.all.find((o) => o.meta && o.meta.attr && o.meta.attr.placeholder === ph);
  field("Paste your key").value = "sk-abc";
  field("model name").value = "claude-sonnet-5-5";
  await dom.click("Save and continue");
  const ai = plugin.settings.ai;
  assert.equal(ai.enabled, true);
  assert.equal(ai.backend, "api");
  assert.equal(ai.api.keys.anthropic, "sk-abc");
  assert.equal(plugin.saved.ai.enabled, true, "saved to data.json");
  assert.equal(plugin.imports, 1, "returned to the import flow");
  assert.equal(view.state, "idle");
});

test("screen: choosing OpenCode opens the settings, then Continue returns to the import flow", async () => {
  const { plugin, dom, view } = await setup([]);
  view.render();
  await dom.click("Import PDFs");
  const how = dom.all.find((o) => o.meta && o.meta.tag === "select");
  how.value = "opencode";
  how.handlers.find((h) => h.ev === "change").fn({});
  await dom.click("Open AI settings");
  assert.equal(plugin.openSettingsCalls, 1);
  assert.equal(plugin.settings.ai.backend, "opencode");
  assert.equal(plugin.settings.ai.enabled, false, "not on until they continue");
  assert.equal(plugin.imports, 0);
  await dom.click("Continue to import");
  assert.equal(plugin.settings.ai.enabled, true);
  assert.equal(plugin.imports, 1);
});

test("screen: Back from AI setup returns to the empty screen without changing settings", async () => {
  const { plugin, dom, view } = await setup([]);
  view.render();
  await dom.click("Import PDFs");
  await dom.click("Back");
  assert.equal(view.state, "idle");
  assert.equal(plugin.settings.ai.enabled, false);
});

test("screen: broken notes are counted, listed by problem, and open when tapped", async () => {
  const { app, dom, view } = await setup([JOURNAL, NO_ID, NO_ANSWER]);
  view.render();
  const texts = dom.texts();
  assert.ok(texts.includes("No questions yet"));
  assert.ok(texts.includes("2 notes in your vault look like questions but can't be used yet."));
  assert.ok(texts.includes("See what's wrong"));
  assert.ok(texts.includes("No question ID (1)"));
  assert.ok(texts.includes("No answer (1)"));
  await dom.click("stub");
  assert.deepEqual(app.opened, ["Pdf/stub.md"]);
});

test("screen: a single broken note reads correctly", async () => {
  const { dom, view } = await setup([NO_ID]);
  view.render();
  assert.ok(dom.texts().includes("1 note in your vault looks like a question but can't be used yet."));
});

test("screen: goes away once one valid question exists, and the normal practice screen shows", async () => {
  const { app, dom, view } = await setup([NO_ID]);
  view.render();
  assert.equal(view.emptyShown, true);
  const dom2 = makeDom();
  view.contentEl = dom2.root;
  const added = makeApp([GOOD("q1")]).files[0];
  app.files.push(added);
  view.render();
  assert.equal(view.emptyShown, false);
  assert.ok(dom2.texts().includes("Start"));
  assert.ok(!dom2.texts().includes("No questions yet"));
});

test("screen: refreshes by itself after an import, once the metadata cache catches up", async () => {
  const { app, view } = await setup([]);
  await view.onOpen();
  assert.equal(view.emptyShown, true);
  assert.equal(typeof app.handlers["cache:changed"], "function");
  assert.equal(typeof app.handlers["cache:deleted"], "function");

  // the import has written a note, but the cache hasn't indexed it yet: the screen stays
  const added = makeApp([GOOD("q1")]).files[0];
  const dom2 = makeDom();
  view.contentEl = dom2.root;
  app.handlers["cache:changed"]();
  await sleep(550);
  assert.equal(view.emptyShown, true);

  // the cache catches up (a burst of events): the screen is replaced
  app.files.push(added);
  const dom3 = makeDom();
  view.contentEl = dom3.root;
  app.handlers["cache:changed"]();
  app.handlers["cache:changed"]();
  await sleep(550);
  assert.equal(view.emptyShown, false);
  assert.ok(dom3.texts().includes("Start"));
  assert.equal(dom2.texts().includes("Start"), false);
});

test("screen: cache events do nothing while a question is on screen", async () => {
  const { app, dom, view } = await setup([GOOD("q1")]);
  await view.onOpen();
  assert.equal(view.emptyShown, false);
  const before = dom.all.length;
  app.handlers["cache:changed"]();
  await sleep(500);
  assert.equal(dom.all.length, before);
});

test("closing the import window refreshes only views that are showing the empty screen", async () => {
  const { app, plugin, dom, view } = await setup([]);
  view.render();
  const other = { emptyShown: false, rendered: 0, render() { this.rendered++; } };
  const shown = { emptyShown: true, rendered: 0, render() { this.rendered++; } };
  app.workspace.getLeavesOfType = () => [{ view: other }, { view: shown }];
  const modal = new T.PdfImportModal(app, plugin);
  modal.contentEl = makeDom().root;
  modal.onClose();
  assert.equal(shown.rendered, 1);
  assert.equal(other.rendered, 0);
});

/* ------------------------------------------------------------ layout */

test("styles: the first-run screen uses theme variables only (light and dark), and has a phone layout", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const block = css.slice(css.indexOf("first-run screen"));
  assert.ok(block.includes(".qt-onboard-card"));
  assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(block), "no hard-coded colours");
  assert.match(block, /max-width:\s*28rem/); // never wider than a phone-friendly column
  assert.match(block, /min-height:\s*2\.75rem/); // tap target
});
