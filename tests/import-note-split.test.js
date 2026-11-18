"use strict";
/*
 * The separator an AI uses between notes, as a model really writes it. A live
 * import with qwen2.5:7b on a CPU (no GPU, 8 cores) answered with "=====" and
 * "NOTE=====" on two lines before each of its three notes; splitting on the
 * exact marker alone reported zero notes, so a completely correct reply looked
 * like an empty document.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

load();
const { splitNotes, parseNote } = require("../src/importer");

const note = (n, answer) =>
  `---\nquestion_id: PREFIX-Q0${n}\nnumber: ${n}\nanswer: ${answer}\n---\n\n## Question\nQuestion ${n}\n\n## Answer Choices\n- A. one\n- B. two\n\n## Answer\n> **Correct Answer: ${answer}**`;

test("import notes: a separator broken over two lines by a local model still splits every note", () => {
  const reply = `${note(1, "B")}\n\n=====\nNOTE=====\n\n${note(2, "B")}\n\n=====\nNOTE=====\n\n${note(3, "C")}`;
  const notes = splitNotes(reply);
  assert.equal(notes.length, 3);
  assert.deepEqual(
    notes.map((text) => parseNote(text).fm.answer),
    ["B", "B", "C"]
  );
  assert.deepEqual(
    notes.map((text) => parseNote(text).fm.number),
    [1, 2, 3]
  );
});

test("import notes: the separator's spacing and punctuation can vary", () => {
  assert.equal(splitNotes(`=====NOTE=====\n${note(1, "A")}`).length, 1);
  assert.equal(splitNotes(`===== NOTE =====\n${note(1, "A")}`).length, 1);
  assert.equal(splitNotes(`----- NOTE -----\n${note(1, "A")}`).length, 1);
  assert.equal(splitNotes(`${note(1, "A")}\n\n===== NOTE =====\n\n${note(2, "D")}`).length, 2);
});

test("import notes: a horizontal rule inside a note is not a separator", () => {
  const withRule = `${note(1, "A")}\n\n---\n\nA note about the = sign.\n`;
  const notes = splitNotes(withRule);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /A note about the = sign\./);
});
