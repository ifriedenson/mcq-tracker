"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

async function setup(saved) {
  const app = makeApp([
    {
      path: "Questions/closed.md",
      fm: { question_id: "closed-1", answer: "B", source_pdf: "Papers/Guide.pdf", source_page: 4 },
    },
  ]);
  const plugin = new QT(app);
  plugin.saved = saved;
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const file = app.files[0];
  await view.loadQuestion({ file, fm: file.fm }, true);
  view.render();
  return { app, plugin, dom, view, file };
}

const hasOpenNote = (dom) =>
  dom.all.some(
    (el) =>
      el.meta &&
      ((el.meta.attrs && el.meta.attrs["aria-label"] === "Open note") ||
        (el.meta.attr && el.meta.attr["aria-label"] === "Open note"))
  );
const hasExplanationButton = (dom) => dom.all.some((el) => el.meta && typeof el.meta.cls === "string" && el.meta.cls.includes("qt-exp-btn"));

test("closed-book practice is off by default and keeps the Open note shortcut", async () => {
  const { plugin, dom } = await setup();
  assert.equal(plugin.settings.closedBook, false);
  assert.ok(hasOpenNote(dom));
  assert.equal(dom.texts().some((text) => /Closed book:/.test(text)), false);
  assert.equal(dom.texts().includes("Source"), false, "the source row is post-submit only");
});

test("closed-book practice hides the note escape until submit, then shows the source and explanation", async () => {
  const { plugin, dom, view } = await setup({ closedBook: true });
  assert.equal(plugin.settings.closedBook, true);
  assert.equal(hasOpenNote(dom), false);
  assert.ok(dom.texts().some((text) => /Closed book:.*unlock after you submit/.test(text)));
  assert.equal(dom.texts().includes("Source"), false);
  assert.equal(hasExplanationButton(dom), false);

  view.sel = "B";
  view.conf = 2;
  await view.submit();
  assert.equal(view.state, "result");
  assert.ok(dom.texts().includes("Source"));
  assert.ok(dom.texts().some((text) => /Guide\.pdf/.test(text)));
  assert.ok(hasExplanationButton(dom));
});

test("closed-book practice normalizes corrupt saved state and survives a plugin restart", async () => {
  const app = makeApp([{ path: "Questions/closed.md", fm: { answer: "B" } }]);
  const plugin = new QT(app);
  plugin.saved = { closedBook: "yes" };
  await plugin.onload();
  assert.equal(plugin.settings.closedBook, false, "a string is not a boolean opt-in");

  plugin.settings.closedBook = true;
  await plugin.save();
  assert.equal(plugin.saved.closedBook, true);

  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.closedBook, true);

  restarted.saved.closedBook = 1;
  await restarted.onload();
  assert.equal(restarted.settings.closedBook, false);
});

test("closed-book practice leaves attempts, history, streak and next review unchanged", async () => {
  const results = [];
  for (const closedBook of [false, true]) {
    const { view, file } = await setup({ closedBook });
    view.sel = "B";
    view.conf = 2;
    await view.submit();
    assert.equal(view.state, "result");
    results.push({
      result: file.fm.result,
      attempts: file.fm.attempts,
      correct: file.fm.correct_count,
      streak: file.fm.streak,
      next: file.fm.next_review,
      history: file.fm.history.length,
    });
  }
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[1].result, "correct");
  assert.equal(results[1].attempts, 1);
  assert.equal(results[1].correct, 1);
  assert.equal(results[1].streak, 1);
  assert.equal(results[1].history, 1);
});
