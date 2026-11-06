"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const budget = T.chatBudget;

test("chat budget: estimates at four characters per token", () => {
  assert.equal(budget.CHARS_PER_TOKEN, 4);
  assert.equal(budget.estimateTokens(""), 0);
  assert.equal(budget.estimateTokens("abcd"), 1);
  assert.equal(budget.estimateTokens("abcde"), 2);
  assert.equal(budget.formatTokenCount(0), "0");
  assert.equal(budget.formatTokenCount(12000), "12,000");
  assert.equal(budget.formatTokenCount(-4), "0");
});

test("chat budget: reports ok, warn and over for the total and each part", () => {
  const ok = budget.budgetState([{ label: "message", text: "abcd" }], { limit: 100 });
  assert.equal(ok.tokens, 1);
  assert.equal(ok.level, "ok");
  assert.equal(ok.over, false);
  assert.equal(ok.warn, false);
  assert.deepEqual(ok.parts, [{ label: "message", chars: 4, tokens: 1 }]);

  const warn = budget.budgetState([{ label: "context", text: "x".repeat(4 * 80) }], { limit: 100 });
  assert.equal(warn.level, "warn");
  assert.equal(warn.warn, true);
  assert.equal(warn.over, false);
  assert.equal(warn.ratio, budget.WARN_RATIO);

  const over = budget.budgetState([{ label: "context", text: "x".repeat(4 * 101) }], { limit: 100 });
  assert.equal(over.level, "over");
  assert.equal(over.over, true);
  assert.equal(over.warn, false);
});

test("chat budget: adds every part and falls back to the conservative default", () => {
  const state = budget.budgetState(
    [
      { label: "message", text: "x".repeat(400) },
      { label: "context", text: "x".repeat(800) },
    ],
    { limit: 0 }
  );
  assert.equal(state.limit, budget.CONTEXT_BUDGET_TOKENS);
  assert.equal(budget.CONTEXT_BUDGET_TOKENS, 12000);
  assert.equal(state.chars, 1200);
  assert.equal(state.tokens, 300);
  assert.equal(state.parts.length, 2);
});
