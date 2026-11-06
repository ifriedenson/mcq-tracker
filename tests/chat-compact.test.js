"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const compact = T.chatCompact;
const budget = T.chatBudget;

function conversation(count, size) {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `${index}: ${"x".repeat(size)}`,
  }));
}

test("compact: a chat with fewer than six messages is reported as nothing to compact", () => {
  const messages = conversation(4, 10);
  const result = compact.compactMessages(messages);
  assert.equal(result.ok, false);
  assert.match(result.reason, /only 4 messages/);
  assert.deepEqual(result.messages, messages);
  assert.equal(result.tokens, result.beforeTokens);
});

test("compact: a chat already under the compaction target is left untouched", () => {
  const messages = conversation(8, 10);
  const result = compact.compactMessages(messages);
  assert.equal(result.ok, false);
  assert.match(result.reason, /nothing worth folding/);
  assert.deepEqual(result.messages, messages);
  assert.ok(result.beforeTokens < result.target);
});

test("compact: an over-budget chat folds old turns into a bounded summary and keeps recent turns verbatim", () => {
  const messages = conversation(20, 3000);
  const result = compact.compactMessages(messages, { limit: budget.CONTEXT_BUDGET_TOKENS });
  assert.equal(result.ok, true);
  assert.ok(result.beforeTokens > result.limit, "the fixture starts over the local chat budget");
  assert.ok(result.tokens <= result.target, "the compacted conversation is under the target");
  assert.ok(result.tokens <= result.limit);
  assert.equal(result.removed, 16);
  assert.equal(result.kept, 4);
  assert.deepEqual(result.messages.slice(-4), messages.slice(-4), "recent turns stay byte-for-byte verbatim");
  assert.match(result.messages[0].content, /Earlier conversation summary/);
  assert.equal(result.messages[0].role, "user");
  assert.equal(result.messages[1].role, "assistant");
  assert.ok(result.summaryChars <= compact.MAX_SUMMARY_CHARS);
  assert.equal(result.messages.length, 6);
});

test("compact: recent turns alone over the budget refuse instead of mangling history", () => {
  const messages = conversation(4, 10).concat(conversation(2, 60000));
  messages[4].role = "user";
  messages[5].role = "assistant";
  const result = compact.compactMessages(messages, { limit: budget.CONTEXT_BUDGET_TOKENS });
  assert.equal(result.ok, false);
  assert.match(result.reason, /most recent turns alone/);
  assert.deepEqual(result.messages, messages);
});

test("compact: the summary itself is one line-bounded block and keeps role alternation", () => {
  const messages = conversation(12, 3000);
  const result = compact.compactMessages(messages);
  assert.equal(result.ok, true);
  const roles = result.messages.map((message) => message.role);
  assert.deepEqual(roles, ["user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant"].slice(0, result.messages.length));
  assert.ok(result.messages[0].content.split("\n").every((line) => line.length <= compact.MAX_SUMMARY_CHARS));
});
