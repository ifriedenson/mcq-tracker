"use strict";
/*
 * The study bundle covers question and card notes, but every schedule,
 * preset, goal, task and AI setting lives in data.json. These tests pin the
 * versioned settings backups beside data.json: naming, pruning, listing, a
 * round trip through the plugin commands, and refusing a corrupt backup.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const backup = require("../src/settings-backup");

function memAdapter() {
  const files = new Map();
  return {
    files,
    async mkdir() {},
    async write(path, text) {
      files.set(path, String(text));
    },
    async read(path) {
      if (!files.has(path)) throw new Error(`ENOENT: ${path}`);
      return files.get(path);
    },
    async list(dir) {
      return { files: [...files.keys()].filter((p) => p.startsWith(`${dir}/`)), folders: [] };
    },
    async remove(path) {
      files.delete(path);
    },
  };
}

function pluginWithAdapter() {
  const app = makeApp([]);
  const adapter = memAdapter();
  app.vault.configDir = ".obsidian-test";
  app.vault.adapter = adapter;
  const plugin = new QT(app);
  plugin.askConfirm = async () => true;
  return { app, adapter, plugin };
}

test("backup names are sortable UTC stamps and parse back", () => {
  const first = backup.backupFileName(new Date("2026-01-01T00:00:00Z"));
  const second = backup.backupFileName(new Date("2026-01-02T00:00:00Z"));
  assert.match(first, /^mcq-settings-backup-2026-01-01T00-00-00Z\.json$/);
  assert.ok(backup.backupOrder(first) < backup.backupOrder(second));
  assert.ok(backup.isBackupName(first));
  assert.ok(!backup.isBackupName("data.json"));
  assert.ok(!backup.isBackupName(`${first}.bak`));
});

test("pruneNames keeps the newest ten and drops the rest", () => {
  const names = [];
  for (let day = 1; day <= 12; day++) {
    names.push(backup.backupFileName(new Date(`2026-01-${String(day).padStart(2, "0")}T00:00:00Z`)));
  }
  const { keep, drop } = backup.pruneNames(names, 10);
  assert.equal(keep.length, 10);
  assert.equal(drop.length, 2);
  assert.ok(backup.backupOrder(keep[0]) > backup.backupOrder(drop[1]));
});

test("parseBackupText accepts a settings object and refuses the rest", () => {
  assert.equal(backup.parseBackupText('{"filters":{}}').ok, true);
  assert.equal(backup.parseBackupText("not json").ok, false);
  assert.equal(backup.parseBackupText("[1,2]").ok, false);
  assert.equal(backup.parseBackupText("42").ok, false);
});

test("backup command writes a listing-visible backup and keeps ten", async () => {
  const { adapter, plugin } = pluginWithAdapter();
  await plugin.onload();
  const dir = plugin.settingsBackupDir();
  assert.match(dir, /\.obsidian-test\/plugins\/mcq-tracker\/settings-backups$/);
  for (let day = 1; day <= 9; day++) {
    const name = backup.backupFileName(new Date(`2026-02-${String(day).padStart(2, "0")}T00:00:00Z`));
    await backup.writeBackup(adapter, dir, name, '{"filters":{}}');
  }
  const written = await plugin.backupSettingsNow();
  assert.ok(backup.isBackupName(written.name));
  const names = await plugin.listSettingsBackups();
  assert.equal(names.length, 10);
  assert.equal(names[0], written.name);
});

test("restore brings back the backed-up settings and refuses a corrupt file", async () => {
  const { adapter, plugin } = pluginWithAdapter();
  await plugin.onload();
  const dir = plugin.settingsBackupDir();
  await plugin.backupSettingsNow();
  const names = await plugin.listSettingsBackups();
  assert.equal(names.length, 1);

  plugin.settings.questionFolder = "Changed";
  await plugin.restoreSettingsBackup(names[0]);
  assert.notEqual(plugin.settings.questionFolder, "Changed");

  await backup.writeBackup(adapter, dir, backup.backupFileName(new Date("2026-03-01T00:00:00Z")), "not json");
  await assert.rejects(() => plugin.restoreSettingsBackup(backup.backupFileName(new Date("2026-03-01T00:00:00Z"))), /not valid JSON/);
  await assert.rejects(() => plugin.restoreSettingsBackup(""), /Choose a backup/);
});

test("the backup commands are registered", async () => {
  const { plugin } = pluginWithAdapter();
  await plugin.onload();
  const ids = plugin.commands.map((c) => c.id);
  assert.ok(ids.includes("backup-settings-now"));
  assert.ok(ids.includes("restore-settings-backup"));
});
