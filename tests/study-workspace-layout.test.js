"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const byClass = (dom, cls) => dom.all.filter((el) => el.classes && el.classes.has(cls));
const lastBody = (dom) => byClass(dom, "qt-workspace-body").at(-1);
const within = (node, cls) => {
  const found = [];
  const walk = (parent) => {
    for (const child of parent.children || []) {
      if (child.classes && child.classes.has(cls)) found.push(child);
      walk(child);
    }
  };
  walk(node);
  return found;
};
const textWithin = (node) => {
  const out = [];
  const walk = (parent) => {
    if (parent.meta && typeof parent.meta.text === "string") out.push(parent.meta.text);
    for (const child of parent.children || []) walk(child);
  };
  walk(node);
  return out;
};

async function mount() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  await view.onOpen();
  return { app, plugin, dom, view };
}

test("study workspace: the section picker controls one labelled body", async () => {
  const { dom } = await mount();
  const pickers = byClass(dom, "qt-workspace-picker");
  assert.equal(pickers.length, 1, "there is one compact section picker");
  const header = byClass(dom, "qt-study-header")[0];
  assert.ok(header, "the header remains the page landmark");
  const select = pickers[0].children.find((el) => el.meta.tag === "select");
  const attrs = select.meta.attrs || select.meta.attr;
  assert.equal(attrs["aria-controls"], "qt-study-workspace-panel");
  assert.equal(select.children.filter((el) => el.meta.tag === "option").length, 19);
  const body = byClass(dom, "qt-workspace-body")[0];
  assert.ok(body, "the section content has its own body wrapper");
  assert.equal((body.meta.attrs || body.meta.attr).id, "qt-study-workspace-panel");
  assert.equal(byClass(dom, "qt-workspace-tabs").length, 1, "the legacy rail stays in the DOM");
});

test("study workspace: every first-run section gets one composed next-step panel", async () => {
  const { dom, view } = await mount();
  for (const tab of ["feynman", "recall", "planner", "flow", "subjects", "courses", "tasks", "annotations", "deepNotes", "retention", "vocabulary", "readingLibrary", "quizIndex", "health", "lectures", "readAloud", "bookmarks", "feynmanAi", "pdfAnnotations"]) {
    if (tab !== "feynman") view.setTab(tab);
    const body = lastBody(dom);
    const panels = within(body, "qt-workspace-empty-panel");
    assert.equal(panels.length, 1, tab + " renders one first-run panel");
    const steps = within(body, "qt-workspace-empty-steps");
    assert.equal(steps.length, 1, tab + " renders ordered steps");
    assert.ok(steps[0].children.filter((el) => el.meta.tag === "li").length >= 2, tab + " has at least two next steps");
  }
});

test("study workspace: first-run hides empty stat grids and secondary forms", async () => {
  const reading = await mount();
  reading.view.setTab("readingLibrary");
  const readingBody = lastBody(reading.dom);
  assert.equal(within(readingBody, "qt-study-stats").length, 0, "no zero reading tiles before the first book");
  assert.equal(within(readingBody, "qt-workspace-empty-panel").length, 1);

  const vocabulary = await mount();
  vocabulary.view.setTab("vocabulary");
  const vocabBody = lastBody(vocabulary.dom);
  assert.equal(within(vocabBody, "qt-study-stats").length, 0, "no zero vocabulary tiles before the first word");
  assert.equal(within(vocabBody, "qt-workspace-disclosure").length, 2, "bulk import and the glossary are compact disclosures");

  const tasks = await mount();
  tasks.view.setTab("tasks");
  const taskBody = lastBody(tasks.dom);
  assert.ok(!textWithin(taskBody).some((text) => /0 open · 0 overdue/.test(text)), "first-run does not print a zero task summary");
  assert.ok(!textWithin(taskBody).includes("Task queue"), "the empty queue card is not duplicated");

  const subjects = await mount();
  subjects.view.setTab("subjects");
  assert.ok(!textWithin(lastBody(subjects.dom)).includes("Log an absence"), "project and absence forms wait for the first subject");

  const retention = await mount();
  retention.view.setTab("retention");
  assert.equal(within(lastBody(retention.dom), "qt-scheduler-fit").length, 0, "scheduler fitting waits for a card scan");

  const populated = await mount();
  await populated.plugin.addReadingBook({ title: "Deep Work", author: "Cal Newport", totalPages: 300, status: "reading" });
  populated.view.setTab("readingLibrary");
  const populatedBody = lastBody(populated.dom);
  assert.equal(within(populatedBody, "qt-workspace-empty-panel").length, 0, "a populated shelf replaces the empty panel");
  assert.equal(within(populatedBody, "qt-study-stats").length, 1, "a populated shelf restores the summary tiles");
});

test("study workspace: action feedback is scoped to the section that produced it", async () => {
  const { view } = await mount();
  view.saveMessage("Scanned 1 card.");
  view.setTab("retention");
  assert.equal(view.message, "", "switching sections clears another section's action feedback");
  view.saveMessage("Scanned 1 card.");
  view.setTab("retention");
  assert.equal(view.message, "Scanned 1 card.", "rerendering the same section keeps its own feedback");
});

test("study workspace: populated reading books stack their controls in one disclosure", async () => {
  const { plugin, dom, view } = await mount();
  await plugin.addReadingBook({ title: "Deep Work", author: "Cal Newport", totalPages: 300, status: "reading" });
  view.setTab("readingLibrary");
  const body = lastBody(dom);
  const book = within(body, "qt-reading-book")[0];
  assert.ok(book, "the populated shelf renders a book row");
  const tools = within(book, "qt-reading-tools");
  assert.equal(tools.length, 1, "progress and quote fields share one disclosure");
  assert.equal(tools[0].children.filter((el) => el.classes.has("qt-workspace-disclosure-title")).length, 1);
  assert.equal(within(book, "qt-study-form").length, 2, "both forms remain available when the disclosure opens");
});

test("study workspace: audio bookmarks save and remove through their module normalizer", async () => {
  const { plugin } = await mount();
  const entry = await plugin.addAudioBookmark({ path: "Recordings/lecture-01.mp3", at: 72, label: "Glycolysis" });
  assert.ok(entry, "the primary Add bookmark action returns an entry");
  assert.equal(plugin.settings.audioBookmarks.entries.length, 1);
  await plugin.removeAudioBookmark(entry.id);
  assert.equal(plugin.settings.audioBookmarks.entries.length, 0);
});

test("study workspace: the compact picker and phone targets are scoped contracts", () => {
  assert.match(css, /\.qt-workspace-picker \{\s*display: none;\s*\}/s, "the picker is hidden at desktop width");
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-tabs \{[^}]*display: flex/s, "the desktop rail is visible");
  assert.match(css, /@container qt-screen \(max-width: 760px\) \{[\s\S]*?\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-tabs \{[^}]*display: none/s, "narrow panes hide the rail");
  assert.match(css, /@container qt-screen \(max-width: 760px\) \{[\s\S]*?\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-picker \{[^}]*display: grid/s, "narrow panes show the picker");
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-empty-panel \{[^}]*grid-template-areas/s);
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-study-field input,[\s\S]*?min-height: 44px/s);
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-study-row-actions \{[^}]*display: grid/s);
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-reading-book \{[^}]*flex-direction: column/s);
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-body \{[^}]*padding-bottom: 96px/s);
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-filter \{[^}]*min-height: 40px/s);
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap button \{[^}]*min-height: 40px/s);
});
