"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cards = T.cards;

const CARD_TEXT = "---\ncard_id: cell\nitem_type: card\ndeck: Biology\n---\n\n## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life.\n";

function makeNotes() {
  return [
    {
      path: "Cards/Bio/cell.md",
      noFm: true,
      fm: { card_id: "cell", item_type: "card", deck: "Biology" },
      text: CARD_TEXT,
    },
    {
      path: "Questions/q.md",
      fm: { question_id: "q", answer: "B" },
      text: "---\nquestion_id: q\nanswer: B\n---\n\n## Question\nWhat is q?\n\n## Answer\nB\n",
    },
  ];
}

async function setup(saved) {
  const notes = makeNotes();
  const app = makeApp(notes);
  // makeApp only fills in question_id frontmatter by default; card notes carry their own.
  notes.forEach((n, i) => {
    if (n.noFm && n.fm) app.files[i].fm = { ...n.fm };
  });
  const plugin = new QT(app);
  if (saved) plugin.saved = saved;
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.reviewLimit = 1;
  return { app, plugin };
}

function answerEl(dom) {
  return dom.all
    .filter((o) => o.meta && typeof o.meta.cls === "string" && o.meta.cls.split(" ").includes("qt-cards-answer"))
    .at(-1);
}

async function openReview(plugin, app) {
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  await dom.click(/Start review/);
  await new Promise((r) => setTimeout(r, 0));
  return { dom, view };
}

test("cards: the reveal animation setting defaults to instant and rejects corrupt values", () => {
  assert.equal(cards.mergeCardSettings({}).revealAnimation, "instant");
  assert.equal(cards.normalizeRevealAnimation("fade"), "fade");
  assert.equal(cards.normalizeRevealAnimation("FLIP"), "flip");
  assert.equal(cards.normalizeRevealAnimation("instant"), "instant");
  for (const bad of ["spin", "", null, undefined, 42, {}, []]) {
    assert.equal(cards.normalizeRevealAnimation(bad), "instant", `normalizes ${JSON.stringify(bad)} to instant`);
  }

  assert.equal(cards.revealAnimationClass("instant"), "");
  assert.equal(cards.revealAnimationClass("fade"), "qt-cards-reveal-fade");
  assert.equal(cards.revealAnimationClass("flip"), "qt-cards-reveal-flip");
  assert.equal(cards.revealAnimationClass("fade", { reducedMotion: true }), "", "reduced motion wins");
  assert.equal(cards.revealAnimationClass("flip", { supportsTransition: false }), "", "no transition support falls back");
  assert.equal(cards.revealAnimationClass("flip", { reducedMotion: true, supportsTransition: false }), "");
});

test("cards view: the answer reveal is instant by default and still records a normal review", async () => {
  const { app, plugin } = await setup();
  const question = app.files.find((f) => f.path === "Questions/q.md");
  const questionBefore = JSON.stringify(question.fm);
  const fileCount = app.files.length;
  const { dom, view } = await openReview(plugin, app);
  await dom.click("Show answer");

  const answer = answerEl(dom);
  assert.ok(answer, "the answer is rendered");
  assert.ok(!answer.meta.cls.includes("qt-cards-reveal"), "no animation class by default");

  const card = view.current;
  await dom.click("Good");
  assert.equal(view.state, "summary");
  assert.equal(card.file.fm.attempts, 1);
  assert.equal(card.file.fm.streak, 1);
  assert.equal(card.file.fm.last_card_rating, "good");
  assert.ok(card.file.fm.next_review);
  assert.equal(card.file.fm.history.length, 1);
  assert.match(card.file.fm.history[0], /Good/);
  assert.equal(JSON.stringify(question.fm), questionBefore, "question attempts are untouched");
  assert.equal(app.files.length, fileCount, "revealing never creates a parallel card or note");
});

test("cards view: fade reveals once, survives a re-render without replaying, and keeps scheduling", async () => {
  const { app, plugin } = await setup({ cards: { enabled: true, revealAnimation: "fade" } });
  assert.equal(plugin.settings.cards.revealAnimation, "fade");
  const { dom, view } = await openReview(plugin, app);
  await dom.click("Show answer");

  const first = answerEl(dom);
  assert.ok(first.meta.cls.includes("qt-cards-reveal-fade"), "the first reveal fades in");

  view.render();
  const afterRefresh = answerEl(dom);
  assert.ok(afterRefresh, "the answer stays visible after a re-render");
  assert.ok(!afterRefresh.meta.cls.includes("qt-cards-reveal"), "a refresh does not replay the animation");

  const card = view.current;
  await dom.click("Good");
  assert.equal(card.file.fm.attempts, 1);
  assert.equal(card.file.fm.correct_count, 1);
  assert.equal(card.file.fm.streak, 1);
  assert.ok(card.file.fm.next_review);
  assert.equal(card.file.fm.history.length, 1);
});

test("cards view: flip is applied when enabled", async () => {
  const { app, plugin } = await setup({ cards: { enabled: true, revealAnimation: "flip" } });
  const { dom } = await openReview(plugin, app);
  await dom.click("Show answer");
  assert.ok(answerEl(dom).meta.cls.includes("qt-cards-reveal-flip"));
});

test("cards view: reduced motion reveals instantly even when flip is configured", async () => {
  const { app, plugin } = await setup({ cards: { enabled: true, revealAnimation: "flip" } });
  const previous = global.activeWindow.matchMedia;
  global.activeWindow.matchMedia = () => ({ matches: true });
  try {
    const { dom } = await openReview(plugin, app);
    await dom.click("Show answer");
    assert.ok(!answerEl(dom).meta.cls.includes("qt-cards-reveal"), "reduced motion suppresses the effect");
  } finally {
    if (previous) global.activeWindow.matchMedia = previous;
    else delete global.activeWindow.matchMedia;
  }
});

test("cards view: a browser without CSS transitions reveals instantly", async () => {
  const { app, plugin } = await setup({ cards: { enabled: true, revealAnimation: "flip" } });
  const previous = global.activeWindow.CSS;
  global.activeWindow.CSS = { supports: () => false };
  try {
    const { dom } = await openReview(plugin, app);
    await dom.click("Show answer");
    assert.ok(!answerEl(dom).meta.cls.includes("qt-cards-reveal"), "missing transition support suppresses the effect");
  } finally {
    if (previous) global.activeWindow.CSS = previous;
    else delete global.activeWindow.CSS;
  }
});

test("cards: a corrupt saved reveal setting falls back to instant and a valid one survives a restart", async () => {
  const corrupt = await setup({ cards: { enabled: true, revealAnimation: "wobble" } });
  assert.equal(corrupt.plugin.settings.cards.revealAnimation, "instant");

  const first = await setup();
  first.plugin.settings.cards.revealAnimation = "flip";
  await first.plugin.save();
  const saved = JSON.parse(JSON.stringify(first.plugin.saved));
  assert.equal(saved.cards.revealAnimation, "flip");

  const restarted = new QT(makeApp(makeNotes()));
  restarted.saved = saved;
  await restarted.onload();
  assert.equal(restarted.settings.cards.revealAnimation, "flip", "the opt-in setting persists across a restart");
});
