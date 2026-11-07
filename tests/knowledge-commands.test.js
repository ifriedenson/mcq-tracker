"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin: QT } = load();

test("knowledge record commands are registered and stay inert until enabled", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  for (const id of ["knowledge-record", "rebuild-knowledge-record", "copy-learner-digest"]) {
    assert.ok(plugin.commands.some((command) => command.id === id), `${id} is registered`);
  }
  assert.equal(plugin.knowledgeRecordSettings().enabled, false);
  assert.equal(plugin.learnerDigest(), "", "no digest is built while the record is off");
});
