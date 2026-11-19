"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const J = T.agentEditJournal;

async function setup(files) {
  const app = makeApp(files);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

function record(id, changes) {
  return J.makeAgentEditRecord({ id, date: "2026-11-19", label: "Agent review", changes });
}

test("agent edit journal: records trim text, cap entries and keep order", () => {
  assert.equal(J.makeAgentEditRecord({ changes: [] }), null);
  assert.equal(J.makeAgentEditRecord(null), null);
  const big = `x`.repeat(J.MAX_CHANGE_TEXT + 10);
  const made = record("r1", [{ path: "a.md", before: big, after: "new" }]);
  assert.equal(made.changes[0].before.length, J.MAX_CHANGE_TEXT);
  let list = [];
  for (let n = 0; n < J.MAX_AGENT_EDIT_RECORDS + 3; n++) {
    list = J.appendAgentEditRecord(list, record(`r${n}`, [{ path: "a.md", before: "b", after: "a" }]));
  }
  assert.equal(list.length, J.MAX_AGENT_EDIT_RECORDS);
  assert.equal(list[0].id, `r${J.MAX_AGENT_EDIT_RECORDS + 2}`, "newest first");
  assert.equal(J.latestAgentEditRecord(list).id, list[0].id);
  assert.equal(J.normalizeAgentEditRecords("nope").length, 0);
});

test("plugin: every applied review is journalled and undoes on its own", async () => {
  const { app, plugin } = await setup([{ path: "a.md", text: "before" }]);
  assert.ok(plugin.commands.some((command) => command.id === "ai-review-agent-edits"), "review command registered");
  plugin.recordAgentEdit(record("r1", [{ path: "a.md", status: "modified", before: "before", after: "after" }]));
  assert.equal(plugin.agentEditHistory().length, 1);
  const file = app.vault.getAbstractFileByPath("a.md");
  await app.vault.modify(file, "after");
  const undone = await plugin.undoAgentEdit("r1");
  assert.deepEqual(undone, { restored: 1, skipped: 0, paths: ["a.md"] });
  assert.equal(file.text, "before");
  const again = await plugin.undoAgentEdit("r1");
  assert.equal(again.restored, 0, "a second undo finds the text already restored");
  assert.equal(again.skipped, 1);
  assert.deepEqual(await plugin.undoAgentEdit("missing"), { restored: 0, skipped: 0, paths: [] });
});

test("plugin: notes edited after the review are skipped, not clobbered", async () => {
  const { app, plugin } = await setup([{ path: "a.md", text: "before" }]);
  plugin.recordAgentEdit(record("r1", [{ path: "a.md", status: "modified", before: "before", after: "after" }]));
  const file = app.vault.getAbstractFileByPath("a.md");
  await app.vault.modify(file, "edited by the learner");
  const result = await plugin.undoAgentEdit("r1");
  assert.equal(result.restored, 0);
  assert.equal(result.skipped, 1);
  assert.equal(file.text, "edited by the learner");
});

test("plugin: applying agent edits journals them and the last undo survives reload", async () => {
  const { app, plugin } = await setup([{ path: "a.md", text: "before" }]);
  const changes = [{ path: "a.md", status: "modified", before: "before", after: "after", diff: { lines: [] } }];
  const result = await plugin.applyAgentEdits(changes, ["a.md"]);
  assert.deepEqual(result.applied, ["a.md"]);
  assert.equal(plugin.agentEditHistory().length, 1, "the applied review was journalled");
  const second = new QT(app);
  await second.onload();
  const undone = await second.undoLastAgentEdit();
  assert.equal(undone.restored, 1, "the journal carries the undo across reloads");
  assert.equal(app.vault.getAbstractFileByPath("a.md").text, "before");
});
