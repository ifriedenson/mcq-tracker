"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const verify = T.answerVerification;

test("answer verification: the prompt shows choices but never the stored key", () => {
  const prompt = verify.buildBlindVerificationPrompt({
    question: "What is 2 + 2?",
    choices: [{ letter: "A", text: "3" }, { letter: "B", text: "4" }],
  });
  assert.match(prompt.user, /What is 2 \+ 2\?/);
  assert.match(prompt.user, /B\. 4/);
  assert.doesNotMatch(prompt.user, /Correct Answer/i);
  assert.doesNotMatch(prompt.user, /stored answer/i);
});

test("answer verification: replies are read as letters with optional confidence", () => {
  assert.equal(verify.parseBlindVerification('{"answer":"B","confidence":"high"}').answer, "B");
  assert.equal(verify.parseBlindVerification("```json\n{\"answer\":\"c\"}\n```").answer, "C");
  assert.equal(verify.parseBlindVerification("I think the answer is D because...").answer, "D");
  assert.equal(verify.parseBlindVerification("no idea").answer, "");
});

test("answer verification: status fields and a visible banner are generated", () => {
  const match = { status: "match", answer: "B", key: "B", model: "model", date: "2026-10-29" };
  assert.deepEqual(verify.verificationFields(match), {
    verified: true,
    verified_by: "model",
    verified_on: "2026-10-29",
    verification: "match",
    verified_answer: "B",
  });
  assert.equal(verify.verificationBanner(match), "");
  const mismatch = { status: "mismatch", answer: "A", key: "B", model: "model", date: "2026-10-29" };
  assert.match(verify.verificationBanner(mismatch), /Answer check failed/);
  assert.match(verify.verificationBanner(mismatch), /chose A.*answer is B/);
  const text = "---\nquestion_id: q\n---\n\n## Question\nQ\n";
  assert.match(verify.addVerificationBanner(text, mismatch), /Answer check failed/);
  assert.equal(verify.addVerificationBanner(text, match), text);
});

test("answer verification: a drop setting removes only mismatched drafts", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.verification = "drop";
  let calls = 0;
  plugin.aiComplete = async () => (++calls === 1 ? '{"answer":"B"}' : '{"answer":"A"}');
  const items = [
    { question: "One?", choices: ["a", "b", "c", "d"], answer: "B" },
    { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" },
    { question: "Three?", choices: [], answer: "" },
  ];
  const summary = await plugin.verifyDraftQuestions(items);
  assert.deepEqual(summary, { checked: 2, dropped: 1, failed: 0, mode: "drop" });
  assert.equal(items[0].verification.status, "match");
  assert.equal(items[0].verification.drop, false);
  assert.equal(items[1].verification.status, "mismatch");
  assert.equal(items[1].verification.drop, true);
  assert.equal(items[2].verification.status, "unchecked");
  assert.equal(app.created, undefined);

  plugin.settings.ai.verification = "mark";
  calls = 0;
  plugin.aiComplete = async () => '{"answer":"A"}';
  const marked = await plugin.verifyDraftQuestions([{ question: "Two?", choices: ["a", "b"], answer: "B" }]);
  assert.equal(marked.checked, 1);
  assert.equal(marked.dropped, 0);
});

test("plugin: a matching blind answer verifies the note and a mismatch flags it", async () => {
  const app = makeApp([
    {
      path: "Questions/two-plus-two.md",
      fm: { question_id: "two-plus-two", answer: "B" },
      text: [
        "---",
        "question_id: two-plus-two",
        "answer: B",
        "---",
        "",
        "## Question",
        "What is 2 + 2?",
        "",
        "## Answer Choices",
        "- A. 3",
        "- B. 4",
        "- C. 5",
        "- D. 6",
        "",
        "## Answer",
        "> [!answer]- Reveal answer",
        "> **Correct Answer: B**",
        ">",
        "> Two plus two is four.",
        "",
        "## My Notes",
      ].join("\n"),
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  let asked = "";
  plugin.aiComplete = async (system, user) => {
    asked = user;
    return '{"answer":"B","confidence":"high","reason":"2 + 2 = 4"}';
  };

  const result = await plugin.verifyAnswerWithAi("Questions/two-plus-two.md");
  assert.equal(result.match, true);
  assert.equal(app.files[0].fm.verified, true);
  assert.equal(app.files[0].fm.verification, "match");
  assert.ok(app.files[0].fm.verified_by);
  assert.ok(app.files[0].fm.verified_on);
  assert.doesNotMatch(app.files[0].text, /Answer check failed/);
  assert.doesNotMatch(asked, /Correct Answer/i, "the checker never sees the stored key");

  plugin.aiComplete = async () => '{"answer":"A","confidence":"low"}';
  const wrong = await plugin.verifyAnswerWithAi("Questions/two-plus-two.md");
  assert.equal(wrong.match, false);
  assert.equal(app.files[0].fm.verified, false);
  assert.equal(app.files[0].fm.verification, "mismatch");
  assert.equal(app.files[0].fm.verified_answer, "A");
  assert.equal(app.files[0].fm.needs_review, true);
  assert.match(app.files[0].text, /Answer check failed/);
  assert.match(app.files[0].text, /chose A.*answer is B/);
});
