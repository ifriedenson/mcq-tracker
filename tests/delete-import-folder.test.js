"use strict";
/*
 * Delete this import: the finished-import button moves the source PDF copy,
 * pictures and question notes to trash with one confirm, then removes the
 * import subfolder itself. Live (Obsidian 1.15.1): adapter.rmdir(path, false)
 * answers EISDIR even for an empty folder, so the folder is re-listed and
 * only a still-empty one is removed recursively. The import root itself is
 * never removed, and a folder holding a file outside the import set keeps
 * its folder.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeTrackedApp } = require("./helpers/real-pdf");

const { Plugin: QT } = load();

async function setup() {
  const state = makeTrackedApp([]);
  const plugin = new QT(state.app);
  await plugin.onload();
  obsidian.notices.length = 0;
  // Trash through the tracked store, like Obsidian's vault.trash: the note
  // leaves the vault so later listings skip it.
  state.app.vault.trash = async (file) => {
    const p = file && file.path;
    state.files.delete(p);
    const at = state.app.files.findIndex((f) => f.path === p);
    if (at >= 0) state.app.files.splice(at, 1);
    state.app.trashed.push(p);
  };
  // Mimic real Obsidian: non-recursive rmdir always refuses, even when empty.
  const realRmdir = state.app.vault.adapter.rmdir;
  state.app.vault.adapter.rmdir = async (path, recursive) => {
    if (!recursive) throw new Error("Path is a directory: rm returned EISDIR (is a directory) " + path);
    return realRmdir(path, recursive);
  };
  return { state, plugin };
}

test("delete removes the import files and the emptied subfolder", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/Unit 1");
  await state.app.vault.create("Questions/Unit 1/UNIT1-Q01.md", "note");
  await state.app.vault.create("Questions/Unit 1/UNIT1-Q02.md", "note");
  await state.app.vault.createBinary("Questions/Unit 1/source.pdf", new Uint8Array([1, 2]));
  await state.app.vault.createBinary("Questions/Unit 1/page1.png", new Uint8Array([3]));

  const removed = await plugin.deleteImportFolder("Questions/Unit 1");

  assert.equal(removed, 4);
  assert.deepEqual(state.app.trashed.sort(), [
    "Questions/Unit 1/UNIT1-Q01.md",
    "Questions/Unit 1/UNIT1-Q02.md",
    "Questions/Unit 1/page1.png",
    "Questions/Unit 1/source.pdf",
  ]);
  assert.equal(state.app.vault.getAbstractFileByPath("Questions/Unit 1"), null);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions"), "the import root is kept");
});

test("the import root itself is refused", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.create("Questions/KEEP-Q01.md", "note");

  await assert.rejects(() => plugin.deleteImportFolder("Questions"), /whole Questions folder/);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/KEEP-Q01.md"));
});

test("a folder holding a non-import file keeps its folder", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/Unit 2");
  await state.app.vault.create("Questions/Unit 2/UNIT2-Q01.md", "note");
  await state.app.vault.create("Questions/Unit 2/teacher-note.txt", "handout");

  const removed = await plugin.deleteImportFolder("Questions/Unit 2");

  assert.equal(removed, 1);
  assert.deepEqual(state.app.trashed, ["Questions/Unit 2/UNIT2-Q01.md"]);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/Unit 2"), "the leftover keeps its folder");
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/Unit 2/teacher-note.txt"));
});
