"use strict";
/*
 * Clean up empty import folders: earlier failed runs can leave an empty
 * folder per file behind, and there is nothing to undo — only empty
 * directories. The command removes every empty folder under the import
 * parent, deepest first, removing a folder only after a fresh listing still
 * shows nothing inside, so a note anywhere inside keeps its whole chain.
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
  plugin.settings.importFolder = "";
  plugin.settings.questionFolder = "Questions";
  obsidian.notices.length = 0;
  return { state, plugin };
}

function lastNotice() {
  const notes = obsidian.notices;
  const last = notes[notes.length - 1];
  return typeof last === "string" ? last : (last && last.text) || "";
}

test("empty folders go, folders holding notes stay", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/good");
  await state.app.vault.createFolder("Questions/working");
  await state.app.vault.createFolder("Questions/nested");
  await state.app.vault.createFolder("Questions/nested/empty");
  await state.app.vault.createFolder("Questions/nested/full");
  await state.app.vault.create("Questions/working/WORKING-Q01.md", "note");
  await state.app.vault.create("Questions/nested/full/FULL-Q01.md", "note");

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 2);
  assert.equal(state.app.vault.getAbstractFileByPath("Questions/good"), null);
  assert.equal(state.app.vault.getAbstractFileByPath("Questions/nested/empty"), null);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/nested"));
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/working/WORKING-Q01.md"));
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/nested/full/FULL-Q01.md"));
  assert.match(lastNotice(), /Removed 2 empty folders under Questions\. Notes were not touched\./);
});

test("a chain of empty folders is removed deepest first", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/a");
  await state.app.vault.createFolder("Questions/a/b");
  await state.app.vault.createFolder("Questions/a/b/c");

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 3);
  assert.equal(state.app.vault.getAbstractFileByPath("Questions/a"), null);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions"));
});

test("a non-recursive remove that refuses everything still cleans up", async () => {
  // Live: real Obsidian answers adapter.rmdir(path, false) with EISDIR even
  // for an empty folder, so the command re-checks emptiness and removes.
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/good");
  await state.app.vault.createFolder("Questions/working");
  await state.app.vault.create("Questions/working/WORKING-Q01.md", "note");
  const realRmdir = state.app.vault.adapter.rmdir;
  state.app.vault.adapter.rmdir = async (path, recursive) => {
    if (!recursive) throw new Error("Path is a directory: rm returned EISDIR (is a directory) " + path);
    return realRmdir(path, recursive);
  };

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 1);
  assert.equal(state.app.vault.getAbstractFileByPath("Questions/good"), null);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/working/WORKING-Q01.md"));
});

test("a folder with only non-note leftovers is left alone", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/partial");
  await state.app.vault.create("Questions/partial/partial.pdf", "binary");

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 0);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/partial/partial.pdf"));
  assert.match(lastNotice(), /No empty import folders under Questions\. Notes were not touched\./);
});

test("the import root itself is never removed", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 0);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions"));
});

test("a missing root reports plainly instead of failing", async () => {
  const { state, plugin } = await setup();

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 0);
  assert.match(lastNotice(), /No Questions folder yet, so there is nothing to clean up\./);
});

test("a running overnight import refuses the cleanup", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/good");
  plugin.importSession = { modal: { unattended: true, closed: false } };

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 0);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/good"));
  assert.match(lastNotice(), /An import is running\. Clean up its empty folders after it finishes\./);
  plugin.importSession = null;
});

test("a running import window refuses the cleanup", async () => {
  const { state, plugin } = await setup();
  await state.app.vault.createFolder("Questions");
  await state.app.vault.createFolder("Questions/good");
  state.app.workspace.getLeavesOfType = () => [{ view: { modal: { closed: false, running: true } } }];

  const removed = await plugin.cleanupEmptyImportFolders();

  assert.equal(removed, 0);
  assert.ok(state.app.vault.getAbstractFileByPath("Questions/good"));
  assert.match(lastNotice(), /An import is running\. Clean up its empty folders after it finishes\./);
});
