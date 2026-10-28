"use strict";
/*
 * Creates and opens the note for one class, from the calendar module's template.
 * Note creation is always one click and never overwrites an existing note: a class
 * that already has a note opens that note.
 */
const { TFile, TFolder } = require("obsidian");
const { ensureFolder } = require("./util");
const { noteContent, noteFileName, resolveSubjectFolder } = require("./calendar-model");

/** Every folder path in the vault, from loaded files (works without a vault-wide scan). */
function vaultFolders(app) {
  const out = new Set();
  const files = typeof app.vault.getAllLoadedFiles === "function" ? app.vault.getAllLoadedFiles() : app.vault.getMarkdownFiles();
  for (const file of files || []) {
    if (file instanceof TFolder) out.add(file.path);
    else if (file && file.parent && typeof file.parent.path === "string") out.add(file.parent.path);
  }
  return [...out].filter((p) => p && p !== "/");
}

/** Path of the note for this class, whether or not it exists yet. */
function notePathFor(app, settings, event, dateKeyValue) {
  const folders = vaultFolders(app);
  const folder = resolveSubjectFolder(settings, event.summary || "", folders, event);
  const name = noteFileName(settings, event, dateKeyValue);
  return folder ? `${folder}/${name}` : name;
}

async function openFile(app, file) {
  const leaf = app.workspace.getLeaf(false);
  if (leaf && leaf.openFile) await leaf.openFile(file);
}

/**
 * Opens the class note, creating it from the template when missing.
 * Returns { path, created } so callers can tell the learner what happened.
 */
async function openOrCreateClassNote(app, settings, event, dateKeyValue) {
  const path = notePathFor(app, settings, event, dateKeyValue);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await openFile(app, existing);
    return { path, created: false };
  }
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  if (dir) await ensureFolder(app, dir);
  const file = await app.vault.create(path, noteContent(settings, event, dateKeyValue));
  await openFile(app, file);
  return { path, created: true };
}

module.exports = {
  vaultFolders,
  notePathFor,
  openOrCreateClassNote,
};
