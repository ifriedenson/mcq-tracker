"use strict";
/*
 * Versioned backups of the plugin's own settings (data.json).
 *
 * The study-bundle export covers question and card *notes*, but every
 * schedule, preset, goal, task list and AI setting lives in data.json, and
 * nothing backed that file up. These helpers keep timestamped copies beside
 * it (the plugin's own data folder, never the vault, so secrets that are
 * still in data.json are not synced as notes) and restore one on demand.
 *
 * Pure helpers stay dependency-free; the small adapter IO takes the vault
 * adapter as an argument so tests can hand it a stand-in. This module is
 * only required from inside the backup/restore commands, never at startup.
 */
const { QtFuzzySuggestModal } = require("./a11y");

const BACKUP_PREFIX = "mcq-settings-backup-";
const BACKUP_SUFFIX = ".json";
const MAX_BACKUPS = 10;

function pad2(value) {
  return String(value).padStart(2, "0");
}

/** File name for a backup taken now: sortable, UTC, no characters a file system dislikes. */
function backupFileName(now) {
  const date = now instanceof Date ? now : new Date();
  const stamp = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}-${pad2(date.getUTCMinutes())}-${pad2(date.getUTCSeconds())}Z`;
  return `${BACKUP_PREFIX}${stamp}${BACKUP_SUFFIX}`;
}

function isBackupName(name) {
  return (
    typeof name === "string" &&
    name.startsWith(BACKUP_PREFIX) &&
    name.endsWith(BACKUP_SUFFIX)
  );
}

/** Sort key for a backup name; unknown names sort before every real backup. */
function backupOrder(name) {
  if (!isBackupName(name)) return "";
  return String(name).slice(BACKUP_PREFIX.length, -BACKUP_SUFFIX.length);
}

/** Split a name list into the newest `keep` to retain and the older ones to remove. */
function pruneNames(names, keep) {
  const limit = Number.isFinite(keep) ? Math.max(0, Math.floor(keep)) : MAX_BACKUPS;
  const backups = [...new Set((Array.isArray(names) ? names : []).filter(isBackupName))].sort((a, b) =>
    backupOrder(a) < backupOrder(b) ? -1 : backupOrder(a) > backupOrder(b) ? 1 : 0
  );
  if (limit === 0) return { keep: [], drop: backups };
  return { keep: backups.slice(-limit), drop: backups.slice(0, Math.max(0, backups.length - limit)) };
}

/** The folder beside data.json that holds the backups. */
function backupDir(configDir, pluginId) {
  const base = String(configDir || "").replace(/\/+$/, "");
  const id = String(pluginId || "mcq-tracker").replace(/\/+/g, "");
  return `${base}/plugins/${id}/settings-backups`;
}

/** Parse and sanity-check backup text: it must be a plain settings object. */
function parseBackupText(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch (e) {
    return { ok: false, error: "That backup is not valid JSON." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "That backup does not hold plugin settings." };
  }
  return { ok: true, settings: parsed };
}

async function ensureDir(adapter, dir) {
  if (!adapter) throw new Error("The vault adapter is not available.");
  if (typeof adapter.mkdir === "function") {
    try {
      await adapter.mkdir(dir);
    } catch (e) {
      /* the folder already exists on most adapters */
    }
  }
}

async function listBackupNames(adapter, dir) {
  if (!adapter || typeof adapter.list !== "function") return [];
  let listed;
  try {
    listed = await adapter.list(dir);
  } catch (e) {
    return [];
  }
  const files = Array.isArray(listed) ? listed : listed && Array.isArray(listed.files) ? listed.files : [];
  return files
    .map((entry) => (typeof entry === "string" ? entry : entry && entry.path) || "")
    .map((path) => String(path).split("/").pop())
    .filter(isBackupName)
    .sort((a, b) => (backupOrder(a) < backupOrder(b) ? 1 : backupOrder(a) > backupOrder(b) ? -1 : 0));
}

async function writeBackup(adapter, dir, name, text) {
  if (!adapter || typeof adapter.write !== "function") throw new Error("The vault adapter cannot write here.");
  await ensureDir(adapter, dir);
  const path = `${dir}/${name}`;
  await adapter.write(path, text);
  return path;
}

async function readBackup(adapter, dir, name) {
  if (!adapter || typeof adapter.read !== "function") throw new Error("The vault adapter cannot read here.");
  if (!isBackupName(name)) throw new Error("That is not a settings backup.");
  return adapter.read(`${dir}/${name}`);
}

async function removeBackup(adapter, dir, name) {
  if (!adapter || typeof adapter.remove !== "function") return;
  try {
    await adapter.remove(`${dir}/${name}`);
  } catch (e) {
    /* a leftover backup must not fail the command */
  }
}

/** A picker for the restore command: newest backup first. */
class SettingsBackupPickerModal extends QtFuzzySuggestModal {
  constructor(app, names, onPick) {
    super(app);
    this.names = Array.isArray(names) ? names : [];
    this.onPick = onPick;
  }

  qtDialogLabel() {
    return "Restore plugin settings from backup";
  }

  getItems() {
    return this.names;
  }

  getItemText(item) {
    return String(item);
  }

  onChooseItem(item) {
    if (typeof this.onPick === "function") this.onPick(item);
  }
}

module.exports = {
  BACKUP_PREFIX,
  BACKUP_SUFFIX,
  MAX_BACKUPS,
  backupDir,
  backupFileName,
  backupOrder,
  isBackupName,
  pruneNames,
  parseBackupText,
  ensureDir,
  listBackupNames,
  writeBackup,
  readBackup,
  removeBackup,
  SettingsBackupPickerModal,
};
