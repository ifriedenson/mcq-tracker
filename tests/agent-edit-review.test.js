"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const review = T.agentEditReview;

const OLD = "---\nquestion_id: q\nattempts: 2\n---\n\n## Question\nOld wording\n";
const NEW = "---\nquestion_id: q\nattempts: 2\n---\n\n## Question\nNew wording\n";

test("agent review: a compact diff shows additions, removals and context", () => {
  const diff = review.diffPreview("alpha\nold\nomega", "alpha\nnew\nomega");
  assert.deepEqual(diff.lines.map((line) => line.kind), ["context", "del", "add", "context"]);
  assert.equal(diff.removed, 1);
  assert.equal(diff.added, 1);
  assert.equal(diff.lines.find((line) => line.kind === "del").text, "old");
  assert.equal(diff.lines.find((line) => line.kind === "add").text, "new");
});

test("agent review: whole-file additions and deletions are reported", () => {
  assert.equal(review.changeFor("Questions/new.md", null, "hello").status, "added");
  assert.equal(review.changeFor("Questions/gone.md", "hello", null).status, "deleted");
  assert.equal(review.changeFor("Questions/same.md", "hello", "hello").status, "unchanged");
});

test("agent review: compareSnapshots includes added, modified and deleted notes", () => {
  const changes = review.compareSnapshots(
    new Map([
      ["Questions/a.md", "old a"],
      ["Questions/b.md", "old b"],
    ]),
    new Map([
      ["Questions/a.md", "new a"],
      ["Questions/c.md", "new c"],
    ])
  );
  assert.deepEqual(changes.map((change) => [change.path, change.status]), [
    ["Questions/a.md", "modified"],
    ["Questions/b.md", "deleted"],
    ["Questions/c.md", "added"],
  ]);
  assert.deepEqual(review.summarize(changes), { added: 1, modified: 1, deleted: 1, total: 3 });
});

test("agent review: only reviewable markdown paths are snapshotted", () => {
  assert.equal(review.isReviewablePath("Questions/q.md", ["Questions"]), true);
  assert.equal(review.isReviewablePath("QuestionsExtra/q.md", ["Questions"]), false);
  assert.equal(review.isReviewablePath("Questions/image.png", ["Questions"]), false);
});

test("plugin: stageAgentEdits reverts the agent's writes and applyAgentEdits writes only approved files", async () => {
  const app = makeApp([{ path: "Questions/q.md", text: OLD, fm: { question_id: "q", attempts: 2 } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.questionFolder = "Questions";
  plugin.settings.cards = { newCardFolder: "Cards", decks: [] };

  const baseline = await plugin.captureAgentBaseline();
  assert.deepEqual([...baseline.keys()], ["Questions/q.md"]);

  app.files[0].text = NEW;
  const changes = await plugin.stageAgentEdits(baseline);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].status, "modified");
  assert.equal(changes[0].before, OLD);
  assert.equal(changes[0].after, NEW);
  assert.equal(app.files[0].text, OLD, "the agent write is paused before review");

  const result = await plugin.applyAgentEdits(changes, ["Questions/q.md"]);
  assert.deepEqual(result.applied, ["Questions/q.md"]);
  assert.deepEqual(result.conflicts, []);
  assert.equal(app.files[0].text, NEW);

  await plugin.undoLastAgentEdit();
  assert.equal(app.files[0].text, OLD);
});

test("plugin: a file edited during review is reported as a conflict instead of overwritten", async () => {
  const app = makeApp([{ path: "Questions/q.md", text: OLD, fm: { question_id: "q", attempts: 2 } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.questionFolder = "Questions";

  const baseline = await plugin.captureAgentBaseline();
  app.files[0].text = NEW;
  const changes = await plugin.stageAgentEdits(baseline);
  app.files[0].text = "user edit while reviewing\n";

  const result = await plugin.applyAgentEdits(changes, ["Questions/q.md"]);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.conflicts, ["Questions/q.md"]);
  assert.equal(app.files[0].text, "user edit while reviewing\n");
});

test("plugin: a deleted note is restored while its deletion waits for approval", async () => {
  const app = makeApp([{ path: "Questions/q.md", text: OLD, fm: { question_id: "q", attempts: 2 } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.questionFolder = "Questions";

  const baseline = await plugin.captureAgentBaseline();
  app.files.splice(0, 1);
  const changes = await plugin.stageAgentEdits(baseline);
  assert.equal(changes[0].status, "deleted");
  assert.ok(app.files.some((file) => file.path === "Questions/q.md"), "the deleted note is put back for review");

  const result = await plugin.applyAgentEdits(changes, ["Questions/q.md"]);
  assert.deepEqual(result.applied, ["Questions/q.md"]);
  assert.ok(app.trashed.includes("Questions/q.md"));
});

test("plugin: applying no files leaves every staged edit discarded", async () => {
  const app = makeApp([{ path: "Questions/q.md", text: OLD, fm: { question_id: "q", attempts: 2 } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.questionFolder = "Questions";

  const baseline = await plugin.captureAgentBaseline();
  app.files[0].text = NEW;
  const changes = await plugin.stageAgentEdits(baseline);
  const result = await plugin.applyAgentEdits(changes, []);
  assert.deepEqual(result.applied, []);
  assert.equal(app.files[0].text, OLD);
});

test("plugin: an empty baseline still stages a newly created note", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.questionFolder = "Questions";

  const baseline = await plugin.captureAgentBaseline();
  assert.equal(baseline.size, 0);
  await app.vault.create("Questions/new.md", "new note\n");
  const changes = await plugin.stageAgentEdits(baseline);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].status, "added");
  assert.ok(app.trashed.includes("Questions/new.md"));
});
