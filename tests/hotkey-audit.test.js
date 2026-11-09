"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditHotkeys, normalizeBinding } = require("../src/hotkey-audit");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const hotkeyAudit = T.hotkeyAudit;

function makeAuditApp(options = {}) {
  const commands = {};
  for (const command of options.commands || []) commands[command.id] = command;
  return {
    commands: { commands },
    hotkeyManager: {
      customKeys: options.custom || {},
      defaultKeys: options.defaults || {},
    },
    plugins: { plugins: options.plugins || {} },
  };
}

const own = { id: "mcq-tracker:open-cards", name: "Open cards" };
const palette = {
  id: "command-palette:open",
  name: "Open command palette",
  hotkeys: [{ modifiers: ["Mod"], key: "P" }],
};

test("hotkey audit: a custom plugin shortcut colliding with a core default is listed", () => {
  const app = makeAuditApp({
    custom: { "mcq-tracker:open-cards": [{ modifiers: ["Mod"], key: "P" }] },
    commands: [own, palette, { id: "mcq-tracker:quick-add", name: "Quick add" }],
  });
  const report = hotkeyAudit.auditHotkeys(app, { isMac: false });
  assert.equal(report.available, true);
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.conflicts[0].shortcut, "Ctrl+P");
  assert.equal(report.conflicts[0].command.id, "mcq-tracker:open-cards");
  assert.deepEqual(report.conflicts[0].core, [
    { id: "command-palette:open", name: "Open command palette" },
  ]);
  assert.equal(report.pluginBindingCount, 1);
  assert.equal(report.coreBindingCount, 1);
});

test("hotkey audit: custom core bindings replace core defaults and empty plugin bindings stay empty", () => {
  const app = makeAuditApp({
    custom: {
      "mcq-tracker:open-cards": [],
      "command-palette:open": [{ modifiers: ["Mod"], key: "K" }],
    },
    commands: [
      { ...own, hotkeys: [{ modifiers: ["Mod"], key: "P" }] },
      palette,
    ],
  });
  const report = auditHotkeys(app, { isMac: false });
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.pluginBindingCount, 0);
  assert.equal(report.pluginCommandCount, 0);
});

test("hotkey audit: other community plugins are not treated as Obsidian core", () => {
  const app = makeAuditApp({
    custom: { "mcq-tracker:open-cards": [{ modifiers: ["Mod"], key: "P" }] },
    plugins: { "other-plugin": {} },
    commands: [
      own,
      { id: "other-plugin:thing", name: "Other thing", hotkeys: [{ modifiers: ["Mod"], key: "P" }] },
    ],
  });
  const report = auditHotkeys(app, { isMac: false });
  assert.equal(report.conflicts.length, 0);
  assert.equal(report.coreBindingCount, 0);
});

test("hotkey audit: Mod resolves to Ctrl on Windows and Cmd on macOS", () => {
  assert.equal(normalizeBinding({ modifiers: ["Mod"], key: "p" }, false).label, "Ctrl+P");
  assert.equal(normalizeBinding({ modifiers: ["Mod"], key: "p" }, true).label, "Cmd+P");
  assert.equal(normalizeBinding({ modifiers: [], key: " " }, false).label, "Space");
  const app = makeAuditApp({
    custom: { "mcq-tracker:open-cards": [{ modifiers: ["Mod"], key: "P" }] },
    commands: [own, { id: "app:test", name: "Core test", hotkeys: [{ modifiers: ["Ctrl"], key: "P" }] }],
  });
  assert.equal(auditHotkeys(app, { isMac: true }).conflicts.length, 0);
  assert.equal(auditHotkeys(app, { isMac: false }).conflicts.length, 1);
});

test("hotkey audit: a missing hotkey manager is reported instead of throwing", () => {
  const report = auditHotkeys({ commands: { commands: {} } });
  assert.equal(report.available, false);
  assert.match(report.reason, /hotkey manager/i);
  assert.deepEqual(report.conflicts, []);
});

test("hotkey audit: the modal renders the collision with both command names", () => {
  const app = makeAuditApp({
    custom: { "mcq-tracker:open-cards": [{ modifiers: ["Mod"], key: "P" }] },
    commands: [own, palette],
  });
  const report = auditHotkeys(app, { isMac: false });
  const dom = makeDom();
  const modal = new T.HotkeyAuditModal(app, report);
  modal.containerEl = dom.root;
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.titleEl = dom.root;
  modal.open();
  assert.ok(dom.find("Hotkey audit").length);
  assert.ok(dom.find("Ctrl+P").length);
  assert.ok(dom.find("Open cards").length);
  assert.ok(dom.find("Open command palette (command-palette:open)").length);
  assert.ok(dom.find("Close").length);
});

test("hotkey audit: the command opens the modal", async () => {
  const app = makeApp([]);
  app.commands = {
    commands: {
      "mcq-tracker:open-cards": own,
      "command-palette:open": { ...palette, hotkeys: [{ modifiers: ["Mod"], key: "K" }] },
    },
  };
  app.hotkeyManager = {
    customKeys: { "mcq-tracker:open-cards": [{ modifiers: ["Mod"], key: "K" }] },
    defaultKeys: {},
  };
  app.plugins = { plugins: {} };
  const plugin = new QT(app, require("../manifest.json"));
  await plugin.onload();
  const command = plugin.commands.find((entry) => entry.id === "hotkey-audit");
  assert.ok(command, "the command is registered");
  const before = obsidian.modals.length;
  command.callback();
  assert.equal(obsidian.modals.length, before + 1);
  assert.ok(obsidian.modals.at(-1) instanceof T.HotkeyAuditModal);
});
