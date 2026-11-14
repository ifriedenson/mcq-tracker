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

test("answer verification: the check prompt forbids tools and shows no echoable example answer", () => {
  // Regression: a blind check ran on the full build agent, used bash, then
  // went silent, wedging a multi-file import on "Checking answer...". The
  // check needs no tools, and its example must not be a letter a model can echo.
  const single = verify.buildBlindVerificationPrompt({
    question: "Who was first?",
    choices: [{ letter: "A", text: "x" }, { letter: "B", text: "y" }],
  });
  assert.match(single.system, /do not use .*tools/i);
  assert.doesNotMatch(single.user, /"answer":"[A-H]/);
  const multi = verify.buildBlindVerificationPrompt({
    question: "Pick both.",
    choices: [{ letter: "A", text: "x" }, { letter: "B", text: "y" }],
    multiple: true,
  });
  assert.doesNotMatch(multi.user, /"answer":"[A-H]/);
  const numeric = verify.buildBlindVerificationPrompt({ question: "How many?" });
  assert.match(numeric.system, /do not use .*tools/i);
  assert.doesNotMatch(numeric.user, /"answer":"[0-9]/);
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

test("answer verification: a slow provider is waited on until it answers", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.aiComplete = async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return '{"answer":"B"}';
  };
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  const summary = await plugin.verifyDraftQuestions([item]);
  assert.deepEqual(summary, { checked: 1, dropped: 0, failed: 0, mode: "mark" });
  assert.equal(item.verification.status, "match", "a slow reply still verifies the note");
  assert.equal(item.verification.drop, false);
});

test("answer verification: a long batch reports its position and stops when asked", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    return '{"answer":"B"}';
  };
  const items = [
    { question: "One?", choices: ["a", "b", "c", "d"], answer: "B" },
    { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" },
    { question: "Three?", choices: ["a", "b", "c", "d"], answer: "B" },
  ];
  const seen = [];
  let stopping = false;
  const summary = await plugin.verifyDraftQuestions(items, {
    onProgress: (n, total) => {
      seen.push(`${n}/${total}`);
      if (n === 2) stopping = true;
    },
    shouldStop: () => stopping,
  });
  assert.deepEqual(seen, ["1/3", "2/3"]);
  assert.equal(calls, 2, "the check after the stop is never sent");
  assert.equal(summary.checked, 2);
  assert.equal(items[2].verification, undefined, "the unchecked note is left unverified, not marked");
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

test("answer verification: multi-select, true/false and numeric drafts use the same blind check", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();

  plugin.aiComplete = async () => '{"answer":"C, A","confidence":"high"}';
  const multi = await plugin.verifyQuestionDraft({ question: "Pick both.", choices: ["one", "two", "three"], answer: "A, C" });
  assert.equal(multi.match, true);
  assert.equal(multi.key, "A, C");

  plugin.aiComplete = async () => '{"answer":"A"}';
  const tf = await plugin.verifyQuestionDraft({ question: "The sky is blue.", choices: ["True", "False"], answer: "True" });
  assert.equal(tf.match, true);
  assert.equal(tf.key, "A");

  plugin.aiComplete = async () => '{"answer":"42.0","confidence":"high"}';
  const numeric = await plugin.verifyQuestionDraft({ question: "What is 6 * 7?", choices: [], answer: "42" });
  assert.equal(numeric.match, true);
  assert.equal(numeric.answer, "42");

  const items = [{ question: "What is 6 * 7?", choices: [], answer: "42" }];
  const summary = await plugin.verifyDraftQuestions(items);
  assert.equal(summary.checked, 1);
  assert.equal(items[0].verification.status, "match");
});

test("consensus: a stored key wins only on a real majority of the checks", () => {
  const first = { status: "mismatch", match: false, answer: "A", key: "B", model: "m", date: "2026-11-13" };
  const twoOfThree = verify.consensusVerdict([{ answer: "A" }, { answer: "B" }, { answer: "B" }], first);
  assert.equal(twoOfThree.status, "match", "two passes for the key beat one against");
  assert.equal(twoOfThree.match, true);
  assert.equal(twoOfThree.answer, "B");
  assert.equal(twoOfThree.method, "consensus");
  assert.equal(twoOfThree.votes, 3);

  const panelAgrees = verify.consensusVerdict([{ answer: "A" }, { answer: "A" }, { answer: "A" }], first);
  assert.equal(panelAgrees.status, "mismatch", "a panel that settles on another answer stays a mismatch");
  assert.equal(panelAgrees.answer, "A", "the warning can name what the checks chose");

  const split = verify.consensusVerdict([{ answer: "A" }, { answer: "B" }, { answer: "C" }], first);
  assert.equal(split.status, "mismatch", "no majority means review, not a silent pass");
  assert.equal(split.answer, "A", "the first check is kept when nothing settles it");

  const errorsOnly = verify.consensusVerdict([{ answer: "A" }, { answer: "" }], first);
  assert.equal(errorsOnly.status, "mismatch", "a failed extra check is not a vote");
  assert.equal(errorsOnly.votes, 1);
});

test("consensus: a disagreement is put to two more checks and can be verified", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.verifyPanelSize = 2;
  // The first check disagrees, then both extra checks side with the key.
  const replies = ['{"answer":"A"}', '{"answer":"B"}', '{"answer":"B"}'];
  let calls = 0;
  plugin.aiComplete = async () => replies[Math.min(calls++, replies.length - 1)];
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  const summary = await plugin.verifyDraftQuestions([item]);
  assert.equal(summary.checked, 1);
  assert.equal(calls, 3, "one check plus two more after the disagreement");
  assert.equal(item.verification.status, "match");
  assert.equal(item.verification.method, "consensus");
  assert.equal(item.verification.drop, false);
});

test("consensus: three extra checks are the default, and a 2-of-4 split stays a mismatch", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  assert.equal(plugin.verificationPanelSize(), 3, "three more checks unless the install asks for two");
  // First says A; of the three extras, two back the key and one does not.
  const replies = ['{"answer":"A"}', '{"answer":"B"}', '{"answer":"B"}', '{"answer":"A"}'];
  let calls = 0;
  plugin.aiComplete = async () => replies[Math.min(calls++, replies.length - 1)];
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  await plugin.verifyDraftQuestions([item]);
  assert.equal(calls, 4, "one check plus three more");
  assert.equal(item.verification.status, "mismatch", "half the passes backing the key is not a majority");
  assert.equal(item.verification.votes, 4);

  calls = 0;
  plugin.aiComplete = async () => (calls++ === 0 ? '{"answer":"A"}' : '{"answer":"B"}');
  const clear = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  await plugin.verifyDraftQuestions([clear]);
  assert.equal(clear.verification.status, "match", "three of four backing the key verifies");
});

test("panel models: a typed list is cleaned up and the extra checks take turns", async () => {
  const verify = require("../src/answer-verification");
  assert.deepEqual(verify.normalizePanelModels("gpt-5\nclaude-sonnet-4-5"), ["gpt-5", "claude-sonnet-4-5"]);
  assert.deepEqual(verify.normalizePanelModels("a, b , ,a"), ["a", "b"], "commas work and a repeat is dropped");
  assert.deepEqual(verify.normalizePanelModels(["one", "two", "three", "four"]).length, 3, "at most three models");
  assert.deepEqual(verify.normalizePanelModels(undefined), []);
  assert.equal(verify.panelModelFor(["m-one", "m-two"], 0), "m-one");
  assert.equal(verify.panelModelFor(["m-one", "m-two"], 1), "m-two");
  assert.equal(verify.panelModelFor(["m-one", "m-two"], 2), "m-one", "the list repeats for a third check");
  assert.equal(verify.panelModelFor([], 0), "", "no list leaves the verification model in charge");
});

test("panel models: the picker only offers models this device already knows", () => {
  const verify = require("../src/answer-verification");
  assert.deepEqual(
    verify.panelModelChoices({
      fetched: ["model-a", "model-b", "model-a"],
      features: ["model-b", "typed/elsewhere", ""],
      saved: ["model-a", "saved-one"],
      own: "own-model",
    }),
    ["model-a", "model-b", "typed/elsewhere", "saved-one", "own-model"],
    "fetched models first, blanks dropped, repeats collapsed"
  );
  assert.deepEqual(verify.panelModelChoices({}), [], "nothing known means an empty list (and the Other field)");
});

test("consensus: the extra checks use the listed models in turn", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.verifyPanelSize = 3;
  plugin.settings.ai.verifyPanelModels = ["m-one", "m-two"];
  const asked = [];
  let calls = 0;
  plugin.aiComplete = async (system, user, opts) => {
    asked.push(opts && opts.model);
    return calls++ === 0 ? '{"answer":"A"}' : '{"answer":"B"}';
  };
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  await plugin.verifyDraftQuestions([item]);
  assert.deepEqual(asked, ["", "m-one", "m-two", "m-one"], "the first check keeps the settings model");
  assert.equal(item.verification.status, "match");
  assert.match(String(item.verification.model), /m-one \+ m-two/, "the note names the models that voted");
});

test("answer verification: a frozen OpenCode is restarted and the same answer is asked again", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "opencode";
  plugin.settings.ai.managed = true;
  plugin.settings.ai.verifyPanel = false;
  const order = [];
  plugin.manager.stop = () => order.push("stop");
  plugin.ensureOpenCode = async () => order.push("start");
  // The probe must fail too: a server that still answers keeps the note alive
  // without a restart (see the slow-check tests).
  plugin.openCode = () => ({
    async providers() {
      throw new Error("fetch failed");
    },
  });
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    order.push(`ask ${calls}`);
    if (calls === 1) throw new Error("OpenCode accepted the request but wrote nothing new for 6 minutes.");
    return '{"answer":"B"}';
  };
  const notices = [];
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  const summary = await plugin.verifyDraftQuestions([item], { onNotice: (m) => notices.push(m) });
  assert.deepEqual(summary, { checked: 1, dropped: 0, failed: 0, mode: "mark" });
  assert.deepEqual(order, ["ask 1", "stop", "start", "ask 2"], "the same answer is asked again after a restart");
  assert.equal(item.verification.status, "match", "the retry verifies the note");
  assert.match(notices[0], /OpenCode stopped answering/i, "the window says what is happening");
});

test("answer verification: a slow check is given more time when the server still answers", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "opencode";
  plugin.settings.ai.managed = false;
  plugin.settings.ai.verifyPanel = false;
  let starts = 0;
  plugin.ensureOpenCode = async () => {
    starts++;
  };
  // A server that still answers must not be restarted for a slow model.
  plugin.openCode = () => ({
    async providers() {
      return [];
    },
  });
  plugin.manager.stop = () => {
    throw new Error("a manual server must not be stopped");
  };
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    if (calls === 1) throw new Error("OpenCode accepted the request but wrote nothing new for 6 minutes.");
    return '{"answer":"B"}';
  };
  const notices = [];
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  const summary = await plugin.verifyDraftQuestions([item], { onNotice: (m) => notices.push(m) });
  assert.deepEqual(summary, { checked: 1, dropped: 0, failed: 0, mode: "mark" });
  assert.equal(calls, 2, "the same answer is asked again");
  assert.equal(starts, 0, "no managed copy is installed or started behind a manual server");
  assert.equal(item.verification.status, "match");
  assert.match(notices[0], /more time/i, "the window says the check gets more time, not a restart");
});

test("answer verification: a reply that makes no sense is not retried", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.verifyPanel = false;
  let calls = 0;
  let restarts = 0;
  plugin.ensureOpenCode = async () => {
    restarts++;
  };
  plugin.aiComplete = async () => {
    calls++;
    return "I would rather not answer that.";
  };
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  const summary = await plugin.verifyDraftQuestions([item]);
  assert.equal(calls, 1, "a nonsensical reply is not a connection problem");
  assert.equal(restarts, 0);
  assert.equal(summary.failed, 1);
  assert.match(item.verification.error, /usable answer letter/);
});

test("answer verification: a stopped import does not restart the server", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "opencode";
  let restarts = 0;
  plugin.ensureOpenCode = async () => {
    restarts++;
  };
  let asked = 0;
  plugin.aiComplete = async () => {
    asked++;
    throw new Error("Can't reach OpenCode at http://127.0.0.1:4096. Start it in a terminal with: opencode serve");
  };
  const item = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };
  // The import is stopped while this answer is being asked.
  const summary = await plugin.verifyDraftQuestions([item], { shouldStop: () => asked > 0 });
  assert.equal(restarts, 0, "a stopped run must not start OpenCode behind the user");
  assert.equal(summary.failed, 1, "the note is kept and reported, not retried");
});

test("consensus: turning the panel off flags the first disagreement immediately", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.verifyPanel = false;
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    return '{"answer":"A"}';
  };
  const item = { question: "Two?", choices: ["a", "b"], answer: "B" };
  await plugin.verifyDraftQuestions([item]);
  assert.equal(calls, 1, "no extra requests when the panel is off");
  assert.equal(item.verification.status, "mismatch");
});
