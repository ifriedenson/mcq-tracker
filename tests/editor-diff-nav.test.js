"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const N = T.editorDiffNav;

function fakeEditor(lines) {
  return {
    lines,
    selected: null,
    scrolled: false,
    getLine(n) {
      return this.lines[n];
    },
    lastLine() {
      return this.lines.length - 1;
    },
    setSelection(from, to) {
      this.selected = [from, to];
    },
    scrollIntoView() {
      this.scrolled = true;
    },
  };
}

const DIFF = {
  added: 3,
  removed: 2,
  lines: [
    { kind: "context", text: "a", oldNo: 1, newNo: 1 },
    { kind: "del", text: "b", oldNo: 2, newNo: null },
    { kind: "del", text: "c", oldNo: 3, newNo: null },
    { kind: "add", text: "B", oldNo: null, newNo: 2 },
    { kind: "context", text: "d", oldNo: 4, newNo: 3 },
    { kind: "add", text: "tail", oldNo: null, newNo: 4 },
  ],
};

test("editor diff nav: changed blocks become old-file hunks", () => {
  const spans = N.hunkSpans(DIFF);
  assert.deepEqual(
    spans.map((span) => [span.startOld, span.endOld]),
    [
      [2, 3],
      [4, 4],
    ]
  );
  const pure = N.hunkSpans({ lines: [{ kind: "add", text: "new file", oldNo: null, newNo: 1 }] });
  assert.deepEqual(
    pure.map((span) => [span.startOld, span.endOld]),
    [[1, 1]]
  );
  assert.deepEqual(N.hunkSpans({ lines: [{ kind: "context", text: "same", oldNo: 1, newNo: 1 }] }), []);
  assert.deepEqual(N.hunkSpans(null), []);
});

test("editor diff nav: only changes with hunks are listed", () => {
  const groups = N.spansForChanges([
    { path: "a.md", status: "modified", diff: DIFF },
    { path: "b.md", status: "modified", diff: { lines: [] } },
    null,
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].path, "a.md");
  assert.equal(groups[0].spans.length, 2);
});

test("editor diff nav: selecting a hunk lands on the old lines", () => {
  const editor = fakeEditor(["a", "b", "c", "d"]);
  assert.equal(N.selectHunk(editor, { startOld: 2, endOld: 3 }), true);
  assert.deepEqual(editor.selected, [
    { line: 1, ch: 0 },
    { line: 2, ch: 1 },
  ]);
  assert.equal(editor.scrolled, true);
  assert.equal(N.selectHunk(null, { startOld: 1, endOld: 1 }), false);
  assert.equal(N.selectHunk({}, { startOld: 1, endOld: 1 }), false);
  assert.equal(N.selectHunk(fakeEditor(["a"]), { startOld: 99, endOld: 120 }), true, "out-of-range hunks clamp to the file");
});

test("plugin: the show-in-note command steps through pending hunks", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  assert.ok(plugin.commands.some((command) => command.id === "agent-show-change"), "command registered");
  assert.ok(typeof T.agentEditHistoryModal.AgentEditHistoryModal === "function", "history modal exposed");
  assert.equal(await plugin.revealNextProposalChange(), false, "no proposal, no navigation");
  plugin.noteProposalChanges([{ path: "missing-note.md", status: "modified", diff: DIFF }]);
  assert.equal(await plugin.revealChangeInNote({ path: "missing-note.md", diff: DIFF }, 0), false);
  assert.equal(await plugin.revealChangeInNote(null, 0), false);
});
