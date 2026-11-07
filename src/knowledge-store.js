"use strict";
/* Local, rebuildable knowledge-record index. It is not study data: every field
 * can be derived again from notes and question history. */
const { emptyRecord, normalizeRecord } = require("./knowledge-record");
const { str } = require("./util");

const RECORD_FOLDER = "MCQ Tracker";
const RECORD_PATH = `${RECORD_FOLDER}/knowledge-record.json`;

async function readText(app) {
  const vault = app && app.vault;
  if (!vault) return "";
  const file = typeof vault.getAbstractFileByPath === "function" ? vault.getAbstractFileByPath(RECORD_PATH) : null;
  if (file) {
    if (typeof vault.cachedRead === "function") return str(await vault.cachedRead(file));
    if (typeof vault.read === "function") return str(await vault.read(file));
  }
  const adapter = vault.adapter;
  if (adapter && typeof adapter.exists === "function" && (await adapter.exists(RECORD_PATH))) {
    if (typeof adapter.read === "function") return str(await adapter.read(RECORD_PATH));
  }
  return "";
}

async function loadRecord(app) {
  const text = await readText(app);
  if (!text.trim()) return emptyRecord();
  try {
    return normalizeRecord(JSON.parse(text));
  } catch (e) {
    return emptyRecord();
  }
}

async function saveRecord(app, record) {
  const vault = app && app.vault;
  if (!vault) throw new Error("The vault is not ready.");
  const text = JSON.stringify(normalizeRecord(record), null, 2);
  if (typeof vault.createFolder === "function") {
    try {
      await vault.createFolder(RECORD_FOLDER);
    } catch (e) {
      /* the folder normally already exists */
    }
  }
  const file = typeof vault.getAbstractFileByPath === "function" ? vault.getAbstractFileByPath(RECORD_PATH) : null;
  if (file && typeof vault.modify === "function") {
    await vault.modify(file, text);
    return file;
  }
  if (typeof vault.create === "function") return vault.create(RECORD_PATH, text);
  throw new Error("This vault cannot write the knowledge record.");
}

module.exports = {
  RECORD_FOLDER,
  RECORD_PATH,
  loadRecord,
  saveRecord,
};
