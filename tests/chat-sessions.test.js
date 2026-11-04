"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const sessions = T.chatSessions;

function messages(question) {
  return [
    { role: "user", content: question },
    { role: "assistant", content: `${question} answer` },
  ];
}

function session(id, question, updatedAt) {
  return { id, title: question, updatedAt, messages: messages(question) };
}

test("conversation archive: newest first, no archived duplicate of the active conversation", () => {
  const rows = sessions.libraryRows(
    { id: "a", title: "Alpha", updatedAt: 200, messages: messages("Alpha") },
    [session("b", "Beta", 300), session("a", "Alpha copy", 100)],
    0
  );
  assert.deepEqual(rows.map((row) => row.id), ["b", "a"]);
  assert.equal(rows.find((row) => row.id === "a").active, true);
  assert.equal(rows.find((row) => row.id === "a").title, "Alpha");
  assert.match(rows[0].when, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

test("conversation archive: archiving the same id replaces it instead of duplicating", () => {
  let list = sessions.archiveSession([], session("a", "Alpha", 1));
  assert.equal(list.length, 1);
  list = sessions.archiveSession(list, session("a", "Alpha again", 2));
  assert.equal(list.length, 1);
  assert.equal(list[0].title, "Alpha again");
  assert.equal(sessions.archiveSession(list, { id: "a", messages: [] }).length, 1, "an invalid record is a no-op");
});

test("conversation archive: duplicate and empty records are dropped, list is capped", () => {
  const rows = sessions.normalizeSessions([
    session("a", "Alpha", 1),
    session("a", "Alpha duplicate", 2),
    { id: "", messages: messages("No id") },
    { id: "b", messages: [] },
    ...Array.from({ length: 30 }, (_, i) => session(`s${i}`, `Question ${i}`, i + 10)),
  ]);
  assert.equal(rows.length, sessions.MAX_SESSIONS);
  assert.equal(rows[0].id, "s29");
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
});

test("conversation archive: rename and remove are idempotent and keep the messages", () => {
  const list = sessions.renameSession([session("a", "Alpha", 1)], "a", "  A   better  title ");
  assert.equal(list[0].title, "A better title");
  assert.deepEqual(list[0].messages, messages("Alpha"));
  assert.equal(sessions.renameSession(list, "missing", "Nope")[0].title, "A better title");
  assert.equal(sessions.removeSession(list, "missing").length, 1);
  assert.equal(sessions.removeSession(list, "a").length, 0);
});

test("conversation title: first question, one line, truncated with an ellipsis", () => {
  assert.equal(sessions.titleFromMessages(messages("What is ATP?")), "What is ATP?");
  assert.equal(sessions.titleFromMessages([{ role: "user", content: "line one\nline two" }]), "line one line two");
  const long = sessions.titleFromMessages([{ role: "user", content: "x".repeat(200) }]);
  assert.ok(long.length <= 60);
  assert.match(long, /\.\.\.$/);
  assert.equal(sessions.titleFromMessages([]), "New chat");
});
