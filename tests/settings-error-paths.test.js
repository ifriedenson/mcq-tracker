"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

// The fake Setting swallows button and text callbacks, so the OpenCode page has
// no way to be driven. Keep their handlers here for this test only.
function recordSettings() {
  const proto = obsidian.Setting.prototype;
  const saved = { addButton: proto.addButton, addText: proto.addText, setDesc: proto.setDesc };
  const buttons = [];
  const texts = [];
  const descs = [];
  proto.addButton = function (cb) {
    const rec = { label: "", run: null };
    cb({
      setButtonText(text) {
        rec.label = text;
        return this;
      },
      setCta() {
        return this;
      },
      setWarning() {
        return this;
      },
      setIcon() {
        return this;
      },
      setDisabled() {
        return this;
      },
      setTooltip() {
        return this;
      },
      addExtraButton(extra) {
        extra({ setIcon: () => this, setTooltip: () => this, onClick: () => this });
        return this;
      },
      onClick(fn) {
        rec.run = fn;
        return this;
      },
    });
    buttons.push(rec);
    return this;
  };
  proto.addText = function (cb) {
    cb({
      inputEl: {},
      setPlaceholder() {
        return this;
      },
      setValue() {
        return this;
      },
      setDisabled() {
        return this;
      },
      onChange(fn) {
        texts.push(fn);
        return this;
      },
    });
    return this;
  };
  proto.setDesc = function (value) {
    descs.push(value);
    return this;
  };
  return {
    buttons,
    texts,
    descs,
    restore() {
      Object.assign(proto, saved);
    },
  };
}

async function openAiPage(manager) {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.manager = manager;
  const tab = new T.QuestionTrackerSettingTab(app, plugin);
  const dom = makeDom();
  tab.containerEl = dom.root;
  const rec = recordSettings();
  try {
    tab.openPage("mcq-ai", { reveal: true });
  } catch (e) {
    rec.restore();
    throw e;
  }
  return { plugin, tab, dom, rec };
}

function managerStub(plugin, overrides = {}) {
  return {
    setupRun: true,
    setupBusy: false,
    ai: plugin.settings.ai,
    isRunning: () => false,
    describe: async () => "Not installed.",
    install: async () => ({ version: "1.0.0" }),
    ensure: async () => {},
    stop() {},
    saveProviderKey: () => "/home/me/.config/opencode/auth.json",
    ...overrides,
  };
}

test("settings: a failed 'Download and install' names the setup and what to check next", async () => {
  const { plugin, rec } = await openAiPage({
    setupRun: true,
    setupBusy: false,
    ai: {},
    isRunning: () => false,
    describe: async () => "Not installed.",
    install: async () => {
      throw new Error("EACCES: permission denied, mkdir '/home/me/.local/share'");
    },
    ensure: async () => {},
    stop() {},
    saveProviderKey: () => "",
  });
  try {
    const button = rec.buttons.find((entry) => entry.label === "Download and install");
    assert.ok(button && button.run, "the install button is on the AI page");
    obsidian.notices.length = 0;
    await button.run();
    const failure = obsidian.notices.find((text) => text.startsWith("OpenCode setup"));
    assert.ok(failure, JSON.stringify(obsidian.notices));
    assert.match(failure, /^OpenCode setup did not finish: EACCES: permission denied, mkdir '\/home\/me\/\.local\/share'\./);
    assert.match(failure, /Check the status below, then try again\.$/);
  } finally {
    rec.restore();
  }
  assert.equal(plugin.settings.ai.backend, "opencode");
});

test("settings: 'Check again' reports a failed check instead of the raw error", async () => {
  const { plugin, rec } = await openAiPage({
    setupRun: true,
    setupBusy: false,
    ai: {},
    isRunning: () => false,
    describe: async () => {
      throw new Error("EACCES: permission denied, scandir '/home/me/.opencode'");
    },
    install: async () => ({ version: "1.0.0" }),
    ensure: async () => {},
    stop() {},
    saveProviderKey: () => "",
  });
  try {
    const button = rec.buttons.find((entry) => entry.label === "Check again");
    assert.ok(button && button.run, "the check button is on the AI page");
    await button.run();
    await new Promise((resolve) => setImmediate(resolve));
    const shown = rec.descs.find((text) => /OpenCode/.test(text) && /Check again/.test(text));
    assert.ok(shown, JSON.stringify(rec.descs));
    assert.match(shown, /^Could not check OpenCode: EACCES: permission denied, scandir '\/home\/me\/\.opencode'\./);
    assert.match(shown, /Check the program path below, then press Check again\.$/);
  } finally {
    rec.restore();
  }
  assert.equal(plugin.settings.ai.backend, "opencode");
});

test("settings: a provider key that cannot be saved says where it goes and what to check", async () => {
  const { plugin, rec } = await openAiPage({
    setupRun: true,
    setupBusy: false,
    ai: {},
    isRunning: () => false,
    describe: async () => "Not installed.",
    install: async () => ({ version: "1.0.0" }),
    ensure: async () => {},
    stop() {},
    saveProviderKey: () => {
      throw new Error("EACCES: permission denied, open '/home/me/.config/opencode/auth.json'");
    },
  });
  try {
    for (const onChange of rec.texts) onChange("sk-test-key");
    const button = rec.buttons.find((entry) => entry.label === "Save key");
    assert.ok(button && button.run, "the save button is on the AI page");
    obsidian.notices.length = 0;
    button.run();
    assert.equal(obsidian.notices.length, 1, JSON.stringify(obsidian.notices));
    assert.match(obsidian.notices[0], /^Could not save that provider key: EACCES: permission denied, open '\/home\/me\/\.config\/opencode\/auth\.json'\./);
    assert.match(obsidian.notices[0], /Check that OpenCode's config folder is writable, then try again\.$/);
    assert.equal(plugin.settings.ai.backend, "opencode");
  } finally {
    rec.restore();
  }
});

test("settings: a schedule sync that fails says what to check next", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.sources = [{ id: "s1", name: "Classes", type: "file", path: "Sched.ics" }];
  plugin.syncCalendarSource = async () => {
    throw new Error("ENOENT: no such file, open 'Sched.ics'");
  };
  plugin.refreshCalendarViews = () => {};
  const dom = makeDom();
  const rec = recordSettings();
  try {
    T.calendarSettings.renderCalendarSettings(dom.root, plugin, () => {}, "schedules", () => {});
    const button = rec.buttons.find((entry) => entry.label === "Sync");
    assert.ok(button && button.run, "the sync button is on the calendar page");
    obsidian.notices.length = 0;
    await button.run();
    assert.equal(obsidian.notices.length, 1, JSON.stringify(obsidian.notices));
    assert.match(obsidian.notices[0], /^Could not sync that schedule: ENOENT: no such file, open 'Sched\.ics'\./);
    assert.match(obsidian.notices[0], /Check the source still exists, then try again\.$/);
  } finally {
    rec.restore();
  }
});
