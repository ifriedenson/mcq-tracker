"use strict";
/*
 * "Check that OpenCode is running" has to answer a beginner's question in one
 * press: is the program that writes my notes alive? These tests pin the plain
 * answer for a healthy server, a dead server and a server with no provider,
 * plus the Check OpenCode button on the failed-import summary.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeDom } = require("./helpers/fake");

const { T } = load();
global.createEl = (tag, opts) => makeDom().root.createEl(tag, opts);

/** A plugin stand-in with only what openCodeStatus reads. */
function fakePlugin(client, ai) {
  return {
    settings: { ai: Object.assign({ managed: false, url: "http://127.0.0.1:4096", installedVersion: "1.19.5" }, ai || {}) },
    openCode: () => client,
  };
}

test("status: a healthy server is reported as running in plain words", async () => {
  const status = await T.aiConnection.openCodeStatus(fakePlugin({ providers: async () => ({ providers: [{ id: "anthropic" }] }) }));
  assert.equal(status.running, true);
  assert.match(status.text, /OpenCode is running 1\.19\.5/);
  assert.match(status.text, /answering normally/);
  assert.match(status.text, /Import the file again/);
});

test("status: a dead server says so plainly instead of naming an error code", async () => {
  const client = {
    providers: async () => {
      throw new Error("fetch failed: ECONNREFUSED 127.0.0.1:4096");
    },
    health: async () => {
      throw new Error("fetch failed: ECONNREFUSED 127.0.0.1:4096");
    },
  };
  const status = await T.aiConnection.openCodeStatus(fakePlugin(client));
  assert.equal(status.running, false);
  assert.match(status.text, /it is not answering right now/);
  assert.doesNotMatch(status.text, /ECONNREFUSED/);
});

test("status: a server with no provider connected still counts as running", async () => {
  const status = await T.aiConnection.openCodeStatus(fakePlugin({ providers: async () => ({ providers: [] }) }));
  assert.equal(status.running, true);
  assert.match(status.text, /no AI provider is connected yet/);
});

test("the failed-import summary offers Check OpenCode and shows its answer", async () => {
  const checked = [];
  const plugin = {
    practiceFolder: async () => {},
    checkOpenCodeServer: async () => {
      checked.push(1);
      return { running: true, text: "OpenCode is running 1.19.5 and answering normally." };
    },
  };
  const modal = new T.ImportCompleteModal({ vault: {}, workspace: {} }, plugin, {
    results: [
      { name: "Unit A.pdf", error: "Lost contact with OpenCode while importing this file: the program that writes the notes stopped answering." },
    ],
    folder: "Questions/Unit A",
  });
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.modalEl = dom.root;
  modal.onOpen();
  assert.ok(dom.texts().includes("Check OpenCode"), "the lost-contact failure offers the check");
  await dom.click("Check OpenCode");
  assert.equal(checked.length, 1, "pressing it runs the real check");
  assert.ok(
    dom.texts().some((text) => /OpenCode is running 1\.19\.5/.test(text)),
    "the plain answer is shown in the same window"
  );
});

test("the summary hides Check OpenCode when nothing lost contact", () => {
  const modal = new T.ImportCompleteModal({ vault: {}, workspace: {} }, { checkOpenCodeServer: async () => ({ running: true, text: "" }) }, {
    results: [{ name: "Unit A.pdf", error: "The disk is full." }],
    folder: "Questions/Unit A",
  });
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.modalEl = dom.root;
  modal.onOpen();
  assert.equal(dom.texts().includes("Check OpenCode"), false);
});
