"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const h = T.chatHistory;

test("chat history: unusable rows are dropped, roles coerced and text trimmed", () => {
  const rows = h.normalizeChatHistory([
    { role: "assistant", content: "leading reply" },
    { role: "user", content: "  hi  " },
    { role: "system", content: "x" },
    { role: "assistant", content: "yo" },
    { role: "user", content: "   " },
    null,
  ]);
  assert.deepEqual(rows, [
    { role: "user", content: "hi" },
    { role: "assistant", content: "x" },
    { role: "assistant", content: "yo" },
  ]);
});

test("chat history: the newest 40 messages survive and the first is a question", () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const rows = h.normalizeChatHistory(many);
  assert.equal(rows.length, h.MAX_MESSAGES);
  assert.equal(rows[0].role, "user");
  assert.equal(rows[0].content, "m10");
  assert.equal(rows[rows.length - 1].content, "m49");
});

test("chat history: one message is bounded and non-arrays become empty", () => {
  const rows = h.normalizeChatHistory([{ role: "user", content: "x".repeat(9000) }]);
  assert.equal(rows[0].content.length, h.MAX_MESSAGE_CHARS);
  assert.deepEqual(h.normalizeChatHistory("nope"), []);
  assert.deepEqual(h.normalizeChatHistory(null), []);
});

test("chat history: Markdown keeps both sides and tool lines, and refuses an empty chat", () => {
  const markdown = h.chatMarkdown(
    [
      { role: "user", texts: ["What is ATP?"], tools: [] },
      { role: "assistant", texts: ["**Energy.**"], tools: ["read · done · note.md"] },
      { role: "assistant", texts: [], tools: [] },
    ],
    { title: "Study agent", date: new Date("2026-11-04T12:00:00Z") }
  );
  assert.match(markdown, /^# Study agent\n/);
  assert.match(markdown, /## You\n\nWhat is ATP\?/);
  assert.match(markdown, /## Assistant\n\n\*\*Energy\.\*\*/);
  assert.match(markdown, /- _read · done · note\.md_/);
  assert.match(markdown, /2026-11-04/);
  assert.equal(h.chatMarkdown([]), "");
});

test("chat history: saved chat names are Windows-safe and unique by minute", () => {
  const name = h.chatFileName(new Date(2026, 10, 4, 9, 5));
  assert.equal(name, "Study agent chat 2026-11-04 0905.md");
  assert.doesNotMatch(name, /[:*?"<>|]/);
});
