"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.studySkin;

const NOTES = [
  {
    path: "Questions/one.md",
    fm: { question_id: "one", skill: "grammar", answer: "B" },
    text: `---\nquestion_id: one\nskill: grammar\nanswer: B\n---\n\n## Question\nChoose the best word.\n\n## Answer Choices\n- A. one\n- B. two\n- C. three\n- D. four\n\n## Answer\n> [!answer]- Reveal answer\n> **Correct Answer: B**\n>\n> Two is correct because the sentence needs it.\n`,
  },
  {
    path: "Questions/two.md",
    fm: { question_id: "two", skill: "vocab", answer: "C" },
    text: `---\nquestion_id: two\nskill: vocab\nanswer: C\n---\n\n## Question\nChoose the best word.\n\n## Answer Choices\n- A. alpha\n- B. beta\n- C. gamma\n- D. delta\n\n## Answer\n> [!answer]- Reveal answer\n> **Correct Answer: C**\n>\n> Gamma is correct.\n`,
  },
];

function setup(saved) {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  plugin.saved = saved;
  return plugin.onload().then(() => {
    const dom = makeDom();
    const view = new T.PracticeView({ app }, plugin);
    view.app = app;
    view.contentEl = dom.root;
    return { app, plugin, dom, view };
  });
}

test("study skin: the default is off, invalid values stay off, and labels are explicit", () => {
  assert.equal(S.normalizeStudySkin(undefined), "off");
  assert.equal(S.normalizeStudySkin("FLIP"), "flip");
  assert.equal(S.normalizeStudySkin("something-else"), "off");
  assert.equal(S.studySkinEnabled({}), false);
  assert.equal(S.studySkinEnabled({ studySkin: "choice" }), true);
  assert.equal(S.STUDY_SKIN_LABELS.choice, "Choice cards");
});

test("study skin: choice mode falls back to flip when there are no choices or no key", () => {
  const withChoices = { mode: "mcq", key: "B", sections: { choices: [{ letter: "A", text: "one" }] } };
  const noKey = { mode: "self", key: "", sections: { choices: [{ letter: "A", text: "one" }] } };
  assert.equal(S.resolveStudySkin("choice", withChoices), "choice");
  assert.equal(S.resolveStudySkin("choice", noKey), "flip");
  assert.equal(S.resolveStudySkin("flip", noKey), "flip");
  assert.equal(S.resolveStudySkin("off", withChoices), "off");
});

test("study skin: flip and choice ratings map to ordinary attempts", () => {
  assert.deepEqual(S.studyAttemptForFlip(true, 9), { correct: true, chosen: "known", conf: 3, seconds: 9 });
  assert.deepEqual(S.studyAttemptForFlip(false, 9), { correct: false, chosen: "still learning", conf: 0, seconds: 9 });
  assert.deepEqual(S.studyAttemptForChoice("b", "B", 12), { correct: true, chosen: "b", conf: 2, seconds: 12 });
  assert.deepEqual(S.studyAttemptForChoice("A", "B", 12), { correct: false, chosen: "A", conf: 0, seconds: 12 });
  assert.deepEqual(S.studyAttemptForChoice("correct", "", 3, true), { correct: true, chosen: "correct", conf: 2, seconds: 3 });
});

test("study skin is off by default and does not change the practice home screen", async () => {
  const { dom, view } = await setup();
  view.render();
  assert.equal(dom.texts().includes("Study cards"), false);
  assert.equal(view.state, "idle");
});

test("study skin: flip mode reviews a note without creating a duplicate and records a normal attempt", async () => {
  const { app, plugin, dom, view } = await setup();
  plugin.settings.studySkin = "flip";
  plugin.recorded = [];
  plugin.recordAttempt = async (file, attempt) => {
    plugin.recorded.push([file.path, attempt]);
    return { nextReview: "2026-11-05", streak: 1, attempts: 1, correctCount: 1 };
  };
  const before = app.files.length;

  await view.startStudySkin();
  assert.equal(view.state, "study");
  assert.equal(view.study.paths.length, 2);
  assert.equal(app.files.length, before, "the skin never creates a second copy of a note");
  assert.ok(dom.texts().includes("Flip cards"));

  view.render();
  await dom.click("Show answer");
  assert.equal(view.study.revealed, true);
  assert.match(view.study.card.sections.answer, /Correct Answer:/);

  view.render();
  await dom.click("Known");
  assert.equal(plugin.recorded.length, 1);
  assert.equal(plugin.recorded[0][0], view.study.card.file.path);
  assert.equal(plugin.recorded[0][1].correct, true);
  assert.equal(plugin.recorded[0][1].chosen, "known");

  view.render();
  await dom.click("Next card");
  assert.equal(view.study.index, 1);
});

test("study skin: choice mode records the chosen letter and marks the answer", async () => {
  const { app, plugin, dom, view } = await setup();
  plugin.settings.studySkin = "choice";
  plugin.recorded = [];
  plugin.recordAttempt = async (file, attempt) => {
    plugin.recorded.push([file.path, attempt]);
    return { nextReview: "2026-11-05", streak: 0, attempts: 1, correctCount: 0 };
  };

  await view.startStudySkin();
  view.render();
  assert.ok(dom.texts().includes("Choice cards"));
  await dom.click("A");
  assert.equal(view.study.sel, "A");
  await dom.click("Show answer");
  assert.equal(view.study.revealed, true);
  assert.equal(plugin.recorded.length, 1);
  assert.equal(plugin.recorded[0][1].correct, false);
  assert.equal(plugin.recorded[0][1].chosen, "A");
  assert.ok(dom.texts().some((text) => text.includes("Correct answer")));
  assert.equal(app.files.length, NOTES.length);
});

test("study skin: summary counts recalled cards and returns to practice", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.studySkin = "flip";
  plugin.recordAttempt = async () => ({ nextReview: "2026-11-05", streak: 1, attempts: 1, correctCount: 1 });
  await view.startStudySkin();
  view.study.index = view.study.paths.length - 1;
  view.study.card = await T.loadQuestionData(plugin, plugin.getQuestions()[1]);
  view.study.revealed = true;
  await view.recordStudy("known");
  view.render();
  await dom.click("Next card");
  assert.equal(view.state, "study-summary");
  assert.ok(dom.texts().some((text) => text.includes("1 of 1 recalled")));
  await dom.click("Back to practice");
  assert.equal(view.state, "idle");
});
