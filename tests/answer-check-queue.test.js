"use strict";
/*
 * The verification pass: any question note with a stored answer but no
 * verdict gets its blind check, two at a time, with frontmatter-only
 * write-back. The flagged-answers surface lists what disagreed.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, NOTE_TEXT } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const queue = () => T.answerCheckQueue;

function note(id, answer, extraFm) {
  return {
    path: `Questions/${id}.md`,
    text: NOTE_TEXT(id, answer),
    fm: { question_id: id, answer, ...(extraFm || {}) },
  };
}

async function setup(files) {
  const app = makeApp(files);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.aiComplete = async () => '{"answer":"B"}';
  return { app, plugin };
}

const VERIFIED = { verified: true, verification: "match", verified_by: "M", verified_on: "2026-01-01", verified_answer: "B" };
const FLAGGED = { verified: false, verification: "mismatch", verified_by: "M", verified_on: "2026-01-01", verified_answer: "A", needs_review: true };

test("answer-check queue: only notes without a verdict are collected", async () => {
  const { plugin } = await setup([
    note("Q01", "B", VERIFIED),
    note("Q02", "B", FLAGGED),
    note("Q03", "B"),
    { path: "Questions/Q04.md", text: NOTE_TEXT("Q04", ""), fm: { question_id: "Q04" } },
  ]);
  const found = await queue().findUncheckedNotes(plugin);
  assert.deepEqual(found.map((f) => f.path), ["Questions/Q03.md"], "verified, flagged and answer-less notes are skipped");
});

test("answer-check queue: the pass checks and writes frontmatter only", async () => {
  const { app, plugin } = await setup([note("Q03", "B")]);
  const { notes, summary } = await queue().checkUncheckedNotes(plugin, { concurrency: 1 });
  assert.deepEqual(notes, ["Questions/Q03.md"]);
  assert.equal(summary.matched, 1);
  const file = app.files[0];
  assert.equal(file.fm.verified, true);
  assert.equal(file.fm.verification, "match");
  assert.match(file.text, /## Question/, "the note body is untouched");
});

test("answer-check queue: a spent cap pauses the pass like the overnight one", async () => {
  const { app, plugin } = await setup([note("Q03", "B")]);
  plugin.aiComplete = async () => {
    throw new Error("The daily AI request cap (100) has been reached. Raise it in Settings.");
  };
  const { summary } = await queue().checkUncheckedNotes(plugin, { concurrency: 1 });
  assert.ok(summary.paused, "the pass pauses with the reason");
  assert.equal(app.files[0].fm.verified, undefined, "nothing is marked either way");
});

test("answer-check queue: the morning pace comes from finished runs", async () => {
  const { app, plugin } = await setup([]);
  assert.equal(queue().storedCheckMedianMs(app), 0, "no runs yet means no pace");
  const run = T.overnightRun.makeOvernightRun([{ sourcePath: "a.pdf", hash: "h" }]);
  run.checkMedianMs = 45000;
  run.status = "finished";
  T.overnightRun.storeOvernightRun(app, run);
  assert.equal(queue().storedCheckMedianMs(app), 45000);
  assert.match(queue().checkEta(3, 45000, plugin), /minute/, "three slow checks read as minutes");
  assert.equal(queue().checkEta(0, 45000, plugin), "", "nothing to check means no ETA");
});
