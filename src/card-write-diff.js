"use strict";
/*
 * Read-only diff for a card import that will update an existing note.
 * The preview names the fields that change; review history is deliberately
 * not part of the comparison because it is protected and never rewritten.
 */
const { parseCardBody } = require("./cards");
const { str } = require("./util");

function text(value) {
  return str(value).trim();
}

function bodyOf(existing) {
  if (existing && existing.body && typeof existing.body === "object") return existing.body;
  return parseCardBody((existing && (existing.text || existing.bodyText)) || "", (existing && existing.fm) || {});
}

function cardUpdateDiff(existing, incoming) {
  const oldCard = existing || {};
  const newCard = incoming || {};
  const oldBody = bodyOf(oldCard);
  const before = {
    front: text(oldBody.front || oldBody.prompt),
    back: text(oldBody.back || oldBody.answer),
    deck: text(oldCard.deck || (oldCard.fm && oldCard.fm.deck)),
    course: text(oldCard.course || (oldCard.fm && oldCard.fm.course)),
  };
  const after = {
    front: text(newCard.front || newCard.prompt) || before.front,
    back: text(newCard.back || newCard.answer) || before.back,
    deck: text(newCard.deck) || before.deck,
    course: text(newCard.course) || before.course,
  };
  const labels = { front: "Front", back: "Back", deck: "Deck", course: "Course" };
  const fields = Object.keys(labels)
    .filter((key) => before[key] !== after[key])
    .map((key) => ({ key, label: labels[key], before: before[key], after: after[key] }));
  return {
    path: (oldCard.file && oldCard.file.path) || oldCard.path || "",
    fields,
    before,
    after,
    changed: fields.length > 0,
  };
}

function summarizeCardDiffs(diffs) {
  const list = Array.isArray(diffs) ? diffs.filter(Boolean) : [];
  return {
    count: list.length,
    changed: list.filter((diff) => diff.changed).length,
    fields: [...new Set(list.flatMap((diff) => diff.fields.map((field) => field.key)))],
    paths: list.map((diff) => diff.path).filter(Boolean),
  };
}

module.exports = {
  cardUpdateDiff,
  summarizeCardDiffs,
};
