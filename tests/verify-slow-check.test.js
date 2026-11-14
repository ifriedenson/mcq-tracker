"use strict";
/*
 * A check that goes quiet is usually a slow provider, not a dead server.
 * Only a server that stops answering small requests earns a restart: the
 * probe goes first, and a server that still answers keeps the note alive
 * without one.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const VERIFY_IDLE_TIMEOUT_MS = T.opencodeClient ? T.opencodeClient.VERIFY_IDLE_TIMEOUT_MS : 20 * 60 * 1000;

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "opencode";
  plugin.settings.ai.managed = true;
  plugin.settings.ai.verifyPanel = false;
  return plugin;
}

const ITEM = { question: "Two?", choices: ["a", "b", "c", "d"], answer: "B" };

test("verify slow check: an alive server is probed, never restarted, and the question is asked again", async () => {
  const plugin = await setup();
  plugin.manager.stop = () => {
    throw new Error("a slow provider must not stop the server");
  };
  let starts = 0;
  plugin.ensureOpenCode = async () => {
    starts++;
  };
  let probes = 0;
  plugin.openCode = () => ({
    async providers() {
      probes++;
      return [];
    },
  });
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    if (calls === 1) throw new Error("OpenCode accepted the request but wrote nothing new for 6 minutes.");
    return '{"answer":"B"}';
  };
  const notices = [];
  const summary = await plugin.verifyDraftQuestions([ITEM], { onNotice: (m) => notices.push(m) });
  assert.deepEqual(summary, { checked: 1, dropped: 0, failed: 0, mode: "mark" });
  assert.equal(calls, 2, "the same question is asked again");
  assert.equal(probes, 1, "the server is probed before any restart decision");
  assert.equal(starts, 0, "an alive server is never restarted");
  assert.equal(ITEM.verification.status, "match");
  assert.ok(notices.some((m) => /more time/i.test(m)), "the window says the check gets more time");
  assert.ok(!notices.some((m) => /restart/i.test(m)), "no restart is announced");
});

test("verify slow check: an unreachable server still restarts and the question is asked again", async () => {
  const plugin = await setup();
  const order = [];
  plugin.manager.stop = () => order.push("stop");
  plugin.ensureOpenCode = async () => order.push("start");
  plugin.openCode = () => ({
    async providers() {
      order.push("probe");
      throw new Error("fetch failed");
    },
  });
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    order.push(`ask ${calls}`);
    if (calls === 1) throw new Error("Can't reach OpenCode at http://127.0.0.1:4096. Start it in a terminal with: opencode serve");
    return '{"answer":"B"}';
  };
  const summary = await plugin.verifyDraftQuestions([ITEM]);
  assert.deepEqual(summary, { checked: 1, dropped: 0, failed: 0, mode: "mark" });
  assert.deepEqual(order, ["ask 1", "stop", "start", "ask 2"], "a silent server is restarted once, then asked again");
  assert.equal(ITEM.verification.status, "match");
});

test("verify slow check: silence that outlives a dead probe still restarts once", async () => {
  const plugin = await setup();
  const order = [];
  plugin.manager.stop = () => order.push("stop");
  plugin.ensureOpenCode = async () => order.push("start");
  plugin.openCode = () => ({
    async providers() {
      order.push("probe");
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
  const summary = await plugin.verifyDraftQuestions([ITEM]);
  assert.deepEqual(summary, { checked: 1, dropped: 0, failed: 0, mode: "mark" });
  assert.deepEqual(order, ["ask 1", "probe", "stop", "start", "ask 2"], "the probe goes before the restart");
});

test("verify slow check: verification sends carry the longer silence allowance, chat sends do not", async () => {
  const plugin = await setup();
  plugin.ensureOpenCode = async () => {};
  const sent = [];
  plugin.openCode = () => ({
    async createSession() {
      return { id: "s1" };
    },
    async send(id, body, opts) {
      sent.push({ id, body, idleMs: opts && opts.idleMs });
    },
    async messages() {
      return [{ info: { id: "a", role: "assistant" }, parts: [{ type: "text", text: "hello" }] }];
    },
  });
  await plugin.aiChat("system", [{ role: "user", content: "hi" }], { feature: "verification" });
  await plugin.aiChat("system", [{ role: "user", content: "hi" }], { feature: "chat" });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].idleMs, VERIFY_IDLE_TIMEOUT_MS, "a check waits out a slow model");
  assert.equal(sent[1].idleMs, undefined, "an ordinary send keeps the agent guard");
});
