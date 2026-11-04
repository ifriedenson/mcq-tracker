"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const history = require("../src/pdf-editor-history");

/** Fake "document bytes" of a known size, so the byte bound can be exercised. */
function bytes(size, fill) {
  const value = new Uint8Array(size);
  value.fill(fill || 1);
  return value;
}

const state = (page) => ({ originOrder: [page || 1], annotations: [], flattenMarks: true });

test("starts empty on the opened file and reports the next action's label", () => {
  const opened = history.createHistory(bytes(8), state(), {});
  assert.equal(history.canUndo(opened), false);
  assert.equal(history.canRedo(opened), false);
  assert.equal(history.nextUndoLabel(opened), "");
  assert.equal(history.undoStep(opened).ok, false);
  assert.equal(history.redoStep(opened).ok, false);
  assert.match(history.undoStep(opened).message, /Nothing to undo/);
  assert.equal(history.historySummary(opened), "No changes yet.");

  const once = history.recordEdit(opened, "crop pages", bytes(9), state());
  assert.equal(history.canUndo(once), true);
  assert.equal(history.canRedo(once), false);
  assert.equal(history.nextUndoLabel(once), "crop pages");
  assert.equal(history.nextRedoLabel(once), "");
  assert.equal(history.historySummary(once), "1 change to undo.");
});

test("undo walks back to the opened bytes and redo walks forward to the edited bytes", () => {
  const opened = bytes(8, 1);
  const first = bytes(9, 2);
  const second = bytes(10, 3);
  let value = history.createHistory(opened, state(1), {});
  value = history.recordEdit(value, "rotate page 1", first, state(1));
  value = history.recordEdit(value, "add page numbers", second, state(2));

  const back = history.undoStep(value);
  assert.equal(back.ok, true);
  assert.equal(back.label, "add page numbers");
  assert.equal(back.entry.bytes, first);
  assert.deepEqual(back.entry.state.originOrder, [1]);

  const base = history.undoStep(back.history);
  assert.equal(base.ok, true);
  assert.equal(base.entry.bytes, opened, "the opened file is the last state");
  assert.equal(history.canUndo(base.history), false);

  const forward = history.redoStep(base.history);
  assert.equal(forward.ok, true);
  assert.equal(forward.label, "rotate page 1");
  assert.equal(forward.entry.bytes, first);
  const again = history.redoStep(forward.history);
  assert.equal(again.entry.bytes, second);
  assert.deepEqual(again.entry.state.originOrder, [2]);
  assert.equal(history.canRedo(again.history), false);
});

test("a new edit after undos discards the redo tail", () => {
  let value = history.createHistory(bytes(8), state(), {});
  value = history.recordEdit(value, "one", bytes(9), state());
  value = history.recordEdit(value, "two", bytes(10), state());
  value = history.undoStep(value).history;
  value = history.undoStep(value).history;
  assert.equal(history.canRedo(value), true);

  value = history.recordEdit(value, "three", bytes(11), state());
  assert.equal(history.canRedo(value), false);
  assert.equal(value.states.length, 2, "the tail is gone");
  assert.equal(history.nextUndoLabel(value), "three");
  assert.equal(history.undoStep(value).entry.bytes.length, 8);
});

test("is bounded by step count and never drops the opened file", () => {
  let value = history.createHistory(bytes(8), state(), { limit: 3 });
  for (let step = 1; step <= 9; step++) value = history.recordEdit(value, `edit ${step}`, bytes(8 + step), state());
  assert.equal(value.states.length, 4, "state zero plus three steps");
  assert.equal(value.states[0].label, "Open the PDF");
  assert.equal(value.cursor, 3);
  assert.equal(history.nextUndoLabel(value), "edit 9");
  // three undos reach the oldest kept edit, and the fourth lands on the opened file
  for (let step = 0; step < 4; step++) value = history.undoStep(value).history;
  assert.equal(value.cursor, 0);
  assert.equal(history.canUndo(value), false);
  assert.equal(value.states[0].bytes.length, 8);
});

test("is bounded by the bytes it holds, keeping the current step", () => {
  let value = history.createHistory(bytes(100), state(), { limit: 50, byteLimit: 350 });
  for (let step = 1; step <= 6; step++) value = history.recordEdit(value, `edit ${step}`, bytes(100), state());
  // opened (100) plus at most two more 100-byte steps fit under 350
  assert.ok(value.states.length <= 3, `held ${value.states.length} states`);
  assert.equal(value.states[0].label, "Open the PDF");
  assert.equal(history.nextUndoLabel(value), "edit 6");
  assert.equal(value.states[value.cursor].bytes.length, 100);
});

test("refuses an edit without bytes, and clearing keeps one honest state", () => {
  const opened = history.createHistory(bytes(8), state(), {});
  const refused = history.recordEdit(opened, "crop pages", null, state());
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "bytes");
  assert.equal(refused.history.states.length, 1);

  let value = history.recordEdit(opened, "one", bytes(9), state());
  value = history.recordEdit(value, "two", bytes(10), state());
  const cleared = history.clearHistory(value, bytes(10), state(), "Saved copy");
  assert.equal(cleared.states.length, 1);
  assert.equal(cleared.states[0].label, "Saved copy");
  assert.equal(cleared.cursor, 0);
  assert.equal(history.canUndo(cleared), false);
  assert.equal(history.canRedo(cleared), false);
});

test("survives junk input instead of throwing", () => {
  const junk = history.createHistory(null, null, { limit: "x", byteLimit: -4 });
  assert.equal(junk.limit, history.HISTORY_LIMIT);
  assert.equal(junk.byteLimit, history.HISTORY_BYTES);
  assert.equal(history.canUndo(null), false);
  assert.equal(history.canRedo({ states: "nope", cursor: 99 }), false);
  assert.equal(history.nextUndoLabel(undefined), "");
  assert.equal(history.historySummary({}), "No changes yet.");
  assert.equal(history.undoStep({ states: [], cursor: -5 }).ok, false);
});
