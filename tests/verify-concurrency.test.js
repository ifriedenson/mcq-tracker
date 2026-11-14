"use strict";
/*
 * Blind checks run in a small bounded pool: two at a time by default, every
 * item still verified in place, Stop still honored between items, and each
 * OpenCode check session cleaned up behind itself.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin: QT } = load();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function item(answer) {
  return { question: "What is 2 + 2?", choices: ["a", "b", "c", "d"], answer: answer || "B" };
}

async function setup() {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.verifyPanel = false;
  return plugin;
}

test("verify concurrency: two checks run at the same time and all verify", async () => {
  const plugin = await setup();
  const pending = [];
  let inFlight = 0;
  let maxInFlight = 0;
  plugin.aiComplete = async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => pending.push(resolve));
    inFlight--;
    return '{"answer":"B"}';
  };
  const items = [item(), item(), item(), item()];
  const summary = plugin.verifyDraftQuestions(items, { concurrency: 2 });
  await sleep(50);
  assert.equal(maxInFlight, 2, "two checks are in flight at once");
  for (let i = 0; i < 8; i++) {
    while (pending.length) pending.shift()();
    await sleep(20);
  }
  const done = await summary;
  assert.deepEqual(done, { checked: 4, dropped: 0, failed: 0, mode: "mark" });
  assert.equal(maxInFlight, 2, "no more than two checks ever run together");
  assert.ok(items.every((entry) => entry.verification && entry.verification.status === "match"), "every item is verified in place");
});

test("verify concurrency: one slot keeps the sequential order and counts", async () => {
  const plugin = await setup();
  const seen = [];
  plugin.aiComplete = async () => '{"answer":"B"}';
  const items = [item(), item(), item()];
  const summary = await plugin.verifyDraftQuestions(items, {
    concurrency: 1,
    onProgress: (n, total) => seen.push(`${n}/${total}`),
  });
  assert.deepEqual(seen, ["1/3", "2/3", "3/3"]);
  assert.deepEqual(summary, { checked: 3, dropped: 0, failed: 0, mode: "mark" });
});

test("verify concurrency: a stop between checks leaves the rest unchecked", async () => {
  const plugin = await setup();
  const pending = [];
  plugin.aiComplete = async () => {
    await new Promise((resolve) => pending.push(resolve));
    return '{"answer":"B"}';
  };
  let stopping = false;
  let calls = 0;
  const asked = plugin.aiComplete;
  plugin.aiComplete = async (...args) => {
    calls++;
    return asked(...args);
  };
  const items = [item(), item(), item(), item()];
  const summary = plugin.verifyDraftQuestions(items, { concurrency: 2, shouldStop: () => stopping });
  await sleep(50);
  assert.equal(pending.length, 2, "two checks start together");
  pending.shift()(); // one finishes; a second pair starts
  await sleep(30);
  stopping = true;
  while (pending.length) pending.shift()();
  const done = await summary;
  assert.equal(calls, 3, "the check after the stop is never sent");
  assert.equal(done.checked, 3);
  assert.ok(!items[3].verification, "the unreached item stays unverified");
  assert.ok(items.every((entry, i) => (i === 3 ? true : entry.verification && entry.verification.status === "match")));
});

test("verify concurrency: two checks are the default without asking", async () => {
  const plugin = await setup();
  assert.equal(plugin.settings.ai.checkConcurrency, 2, "fresh settings check two at a time");
  const pending = [];
  let inFlight = 0;
  let maxInFlight = 0;
  plugin.aiComplete = async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => pending.push(resolve));
    inFlight--;
    return '{"answer":"B"}';
  };
  const items = [item(), item(), item()];
  const summary = plugin.verifyDraftQuestions(items, {});
  await sleep(50);
  assert.equal(maxInFlight, 2, "the default pools two checks");
  for (let i = 0; i < 8; i++) {
    while (pending.length) pending.shift()();
    await sleep(20);
  }
  const done = await summary;
  assert.equal(done.checked, 3);
});

test("verify concurrency: the check flag reaches the model call", async () => {
  const plugin = await setup();
  const seen = [];
  plugin.aiComplete = async (system, user, opts) => {
    seen.push(opts && opts.deleteSession);
    return '{"answer":"B"}';
  };
  await plugin.verifyDraftQuestions([item()]);
  assert.deepEqual(seen, [true], "every check asks for its session to be cleaned up");
});

test("verify concurrency: OpenCode check sessions are deleted, chat sessions are not", async () => {
  const plugin = await setup();
  plugin.settings.ai.backend = "opencode";
  plugin.ensureOpenCode = async () => {};
  const deleted = [];
  const sent = [];
  plugin.openCode = () => ({
    async createSession() {
      return { id: "s-check" };
    },
    async send(id, body, opts) {
      sent.push({ id, idleMs: opts && opts.idleMs });
    },
    async messages() {
      return [{ info: { id: "a", role: "assistant" }, parts: [{ type: "text", text: "hello" }] }];
    },
    async deleteSession(id) {
      deleted.push(id);
    },
  });
  await plugin.aiChat("system", [{ role: "user", content: "hi" }], { feature: "verification", deleteSession: true });
  await plugin.aiChat("system", [{ role: "user", content: "hi" }], { feature: "chat" });
  assert.deepEqual(sent.map((entry) => entry.id), ["s-check", "s-check"]);
  assert.deepEqual(deleted, ["s-check"], "only the check session is cleaned up");
});
