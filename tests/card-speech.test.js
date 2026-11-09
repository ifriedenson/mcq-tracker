"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cards = T.cards;

const CARD_TEXT = (back) => `---\ncard_id: mito\nitem_type: card\ndeck: Biology\n---\n\n## Front\nWhat is the powerhouse of the cell?\n\n## Back\n${back}\n`;

async function setup(options) {
  const opts = options || {};
  const back = opts.back || "mitochondria";
  const notes = [
    {
      path: "Cards/Bio/mito.md",
      noFm: true,
      fm: { card_id: "mito", item_type: "card", deck: "Biology" },
      text: CARD_TEXT(back),
    },
  ];
  const app = makeApp(notes);
  notes.forEach((note, index) => {
    if (note.noFm && note.fm) app.files[index].fm = { ...note.fm };
  });
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards = cards.mergeCardSettings({
    enabled: true,
    reviewLimit: 1,
    answerMode: opts.answerMode || "type",
    aiGrading: opts.ai === true,
  });
  plugin.settings.ai.enabled = opts.ai === true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.keys = opts.aiKey ? { anthropic: opts.aiKey } : {};
  return { app, plugin };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function hasClass(element, name) {
  return !!element && typeof element.meta.cls === "string" && element.meta.cls.split(/\s+/).includes(name);
}

function typedField(dom) {
  return dom.all.find((element) => hasClass(element, "qt-cards-typed"));
}

function storedAnswer(dom) {
  return dom.all.find((element) => hasClass(element, "qt-cards-back"));
}

async function openReview(plugin, app, prepare) {
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  if (prepare) prepare(view);
  view.render();
  await dom.click(/Start review/);
  await tick();
  return { dom, view };
}

class FakeRecognition {
  constructor() {
    this.started = 0;
    this.aborted = 0;
    this.lang = "";
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
  }

  start() {
    this.started += 1;
    if (this.onstart) this.onstart();
  }

  abort() {
    this.aborted += 1;
  }

  emit(transcript, final) {
    const result = [{ transcript }];
    result.isFinal = final !== false;
    if (this.onresult) this.onresult({ resultIndex: 0, results: [result] });
  }
}

test("cards view: a typed answer reaches the existing AI grader with the stored answer and renders its verdict", async () => {
  const { app, plugin } = await setup({ ai: true, aiKey: "test-key" });
  let asked = null;
  plugin.gradeCardWithAi = async (card, typed, strictness) => {
    asked = { card, typed, strictness };
    return {
      verdict: "correct",
      suggestedGrade: "good",
      reason: "The AI accepted the definition.",
      matchedBy: "ai",
      gradedBy: "ai",
      confidence: 0.9,
    };
  };
  const { dom, view } = await openReview(plugin, app);
  const card = view.current;
  const typed = typedField(dom);
  typed.value = "powerhouse";
  await dom.click("Check answer");
  await tick();

  assert.equal(asked.typed, "powerhouse");
  assert.equal(asked.card.body.back, "mitochondria", "the stored answer is the reference");
  assert.equal(asked.strictness, "standard");
  assert.equal(view.verdict.verdict, "correct");
  assert.equal(view.verdict.gradedBy, "ai");
  assert.ok(dom.texts().includes("Correct"));
  assert.ok(dom.texts().some((text) => /The AI accepted the definition/.test(text)));
  assert.ok(dom.texts().some((text) => /You wrote: powerhouse/.test(text)));
  assert.ok(storedAnswer(dom), "the stored answer is rendered after checking");

  await dom.click("Good");
  assert.equal(card.file.fm.last_typed_answer, "powerhouse");
  assert.equal(card.file.fm.last_verdict, "correct");
  assert.equal(card.file.fm.graded_by, "ai");
});

test("cards view: dictated speech becomes an editable transcript before it reaches the grader", async () => {
  const { app, plugin } = await setup({ ai: true, aiKey: "test-key", answerMode: "speak" });
  const recognition = new FakeRecognition();
  let asked = null;
  plugin.gradeCardWithAi = async (card, typed, strictness) => {
    asked = { card, typed, strictness };
    return {
      verdict: "correct",
      suggestedGrade: "good",
      reason: "The AI accepted the corrected transcript.",
      matchedBy: "ai",
      gradedBy: "ai",
      confidence: 0.9,
    };
  };
  const { dom, view } = await openReview(plugin, app, (current) => {
    current.speechFactory = () => recognition;
  });
  const typed = typedField(dom);
  await dom.click("Dictate");
  assert.equal(recognition.started, 1, "the injected recognition boundary started");
  recognition.emit("power", false);
  assert.equal(typed.value, "power", "the interim transcript is shown while speaking");
  recognition.emit("power house");

  assert.equal(typed.value, "power house", "the final transcript replaces the interim one without duplicating words");
  assert.equal(view.verdict, null, "dictation does not grade by itself");
  assert.equal(view.revealed, false);

  typed.value = "powerhouse";
  const input = typed.handlers.find((handler) => handler.ev === "input");
  assert.ok(input, "the transcript box keeps its input handler");
  input.fn();

  await dom.click("Check answer");
  await tick();

  assert.equal(asked.typed, "powerhouse", "the corrected transcript is what reaches the grader");
  assert.equal(asked.card.body.back, "mitochondria");
  assert.equal(view.verdict.verdict, "correct");
  assert.equal(view.verdict.gradedBy, "ai");
  assert.ok(dom.texts().includes("Correct"));
  assert.ok(dom.texts().some((text) => /Graded by AI/.test(text)));
  assert.ok(storedAnswer(dom), "the stored answer is shown for comparison");
});

test("cards view: without provider credentials the local verdict and stored answer still let the learner self-check", async () => {
  const { app, plugin } = await setup({ ai: true, answerMode: "type" });
  let aiCalls = 0;
  plugin.gradeCardWithAi = async () => {
    aiCalls += 1;
    throw new Error("must not be called without credentials");
  };
  const { dom, view } = await openReview(plugin, app);
  assert.ok(
    dom.texts().some((text) => /no provider credentials are configured/i.test(text)),
    "the surface explains that no AI provider is configured"
  );
  assert.ok(dom.texts().some((text) => /checked locally/i.test(text)));

  typedField(dom).value = "wrong answer";
  await dom.click("Check answer");
  await tick();

  assert.equal(aiCalls, 0, "no AI request is attempted without credentials");
  assert.equal(view.verdict.verdict, "incorrect");
  assert.match(view.aiError, /No AI provider credentials are configured/);
  assert.ok(dom.texts().some((text) => /No AI provider credentials are configured/.test(text)));
  assert.ok(storedAnswer(dom), "the stored answer is revealed for self-checking");
  assert.ok(dom.find("Good").length, "the learner can still rate the card");
  assert.equal(plugin.pendingCardGrades().length, 0, "a local-only fallback does not queue an AI grade");
});

test("cards view: when speech recognition is unavailable the mic is disabled and typing still works", async () => {
  const previous = global.activeWindow.SpeechRecognition;
  const previousWebkit = global.activeWindow.webkitSpeechRecognition;
  delete global.activeWindow.SpeechRecognition;
  delete global.activeWindow.webkitSpeechRecognition;
  try {
    const { app, plugin } = await setup({ answerMode: "type" });
    const { dom, view } = await openReview(plugin, app);
    const dictate = dom.find("Dictate")[0];
    assert.ok(dictate, "the mic control is still visible");
    assert.equal(dictate.disabled, true, "the mic is disabled without a recognition API");
    assert.ok(
      dom.texts().some((text) => /Speech recognition is not available/.test(text)),
      "the reason is visible instead of failing silently"
    );

    typedField(dom).value = "mitochondria";
    await dom.click("Check answer");
    await tick();
    assert.equal(view.verdict.verdict, "correct");
    assert.ok(storedAnswer(dom));
  } finally {
    if (previous) global.activeWindow.SpeechRecognition = previous;
    if (previousWebkit) global.activeWindow.webkitSpeechRecognition = previousWebkit;
  }
});

test("cards view: leaving a review stops an active dictation", async () => {
  const { app, plugin } = await setup({ answerMode: "speak" });
  const recognition = new FakeRecognition();
  const { dom, view } = await openReview(plugin, app, (current) => {
    current.speechFactory = () => recognition;
  });
  await dom.click("Dictate");
  assert.equal(view.speechListening, true);
  await dom.click("Decks");
  assert.equal(recognition.aborted, 1);
  assert.equal(view.speechListening, false);
  assert.equal(view.state, "browse");
});

test("cards view: an empty dictation says no speech was heard instead of claiming a transcript", async () => {
  const { app, plugin } = await setup({ answerMode: "speak" });
  const recognition = new FakeRecognition();
  const { dom, view } = await openReview(plugin, app, (current) => {
    current.speechFactory = () => recognition;
  });
  await dom.click("Dictate");
  recognition.onend();
  assert.equal(view.speechListening, false);
  assert.ok(dom.texts().some((text) => /No speech was heard/.test(text)));
  assert.ok(!dom.texts().some((text) => /Transcript ready/.test(text)));
});

test("cards view: a denied microphone explains the failure and leaves typing available", async () => {
  const { app, plugin } = await setup({ answerMode: "speak" });
  const recognition = new FakeRecognition();
  const { dom } = await openReview(plugin, app, (current) => {
    current.speechFactory = () => recognition;
  });
  await dom.click("Dictate");
  recognition.onerror({ error: "not-allowed" });

  assert.ok(dom.texts().some((text) => /Microphone access was denied/.test(text)));
  assert.ok(dom.find("Try dictation again").length, "the learner can retry");
  assert.ok(dom.find("Check answer").length, "typing and local checking remain available");
});
