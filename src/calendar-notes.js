"use strict";
/*
 * Creates and opens the note for one class, from the calendar module's template.
 * Note creation is always one click and never overwrites an existing note: a class
 * that already has a note opens that note. Notes are linked back to their event by
 * `calendar_uid` + `calendar_date`, so renaming or moving a note does not make the
 * calendar create a duplicate.
 */
const { TFile, TFolder } = require("obsidian");
const { ensureFolder } = require("./util");
const { noteContent, noteFileName, noteVariables, resolveSubjectFolder } = require("./calendar-model");

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

/** Path of the note for this class, whether or not it exists yet. `folders` can be a shared cache. */
function notePathFor(app, settings, event, dateKeyValue, folders) {
  const available = folders || vaultFolders(app);
  const folder = resolveSubjectFolder(settings, event.summary || "", available, event);
  const name = noteFileName(settings, event, dateKeyValue);
  return folder ? `${folder}/${name}` : name;
}

/** Stable key for one occurrence; recurring events share a UID but not a date. */
function noteKey(event, dateKeyValue) {
  const uid = String((event && event.uid) || "").trim();
  return uid && dateKeyValue ? `${uid}|${dateKeyValue}` : "";
}

/** Index of class notes by `calendar_uid|calendar_date`, read through the metadata cache. */
function classNoteIndex(app) {
  const out = new Map();
  const files = typeof app.vault.getMarkdownFiles === "function" ? app.vault.getMarkdownFiles() : [];
  for (const file of files || []) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    const uid = String(fm.calendar_uid || "").trim();
    const date = String(fm.calendar_date || "").trim().slice(0, 10);
    if (uid && date) out.set(`${uid}|${date}`, file);
  }
  return out;
}

/**
 * Finds the existing class note: the path the template would create first, then the
 * durable UID/date index. `index` can be a shared index built once per refresh.
 */
function findClassNote(app, settings, event, dateKeyValue, index, folders) {
  const path = notePathFor(app, settings, event, dateKeyValue, folders);
  const direct = app.vault.getAbstractFileByPath(path);
  if (direct instanceof TFile) return { file: direct, path };
  const key = noteKey(event, dateKeyValue);
  if (!key) return null;
  const found = (index || classNoteIndex(app)).get(key);
  return found instanceof TFile ? { file: found, path: found.path } : null;
}

/** Adds the calendar identity to older notes the first time they are touched. */
async function stampClassNote(app, settings, event, dateKeyValue, file) {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
  const uid = String((event && event.uid) || "").trim();
  const subject = noteVariables(settings, event, dateKeyValue).subject;
  if ((!uid || fm.calendar_uid === uid) && fm.calendar_date === dateKeyValue && fm.course) return;
  await app.fileManager.processFrontMatter(file, (next) => {
    if (uid && !next.calendar_uid) next.calendar_uid = uid;
    if (!next.calendar_date) next.calendar_date = dateKeyValue;
    if (!next.course) next.course = subject;
  });
}

async function openFile(app, file) {
  const leaf = app.workspace.getLeaf(false);
  if (leaf && leaf.openFile) await leaf.openFile(file);
}

/**
 * Opens the class note, creating it from the template when missing.
 * Returns { path, created, file } so callers can tell the learner what happened.
 */
async function openOrCreateClassNote(app, settings, event, dateKeyValue, index, folders) {
  const found = findClassNote(app, settings, event, dateKeyValue, index, folders);
  if (found) {
    await stampClassNote(app, settings, event, dateKeyValue, found.file);
    await openFile(app, found.file);
    return { path: found.path, created: false, file: found.file };
  }

  const path = notePathFor(app, settings, event, dateKeyValue, folders);
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  if (dir) await ensureFolder(app, dir);
  const file = await app.vault.create(path, noteContent(settings, event, dateKeyValue));
  await stampClassNote(app, settings, event, dateKeyValue, file);
  await openFile(app, file);
  return { path, created: true, file };
}

module.exports = {
  vaultFolders,
  notePathFor,
  noteKey,
  classNoteIndex,
  findClassNote,
  stampClassNote,
  openOrCreateClassNote,
};
