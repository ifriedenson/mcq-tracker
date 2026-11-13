"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();

/** Flip the runtime to a phone, and hand back the undo. */
function onPhone() {
  const platform = obsidian.Platform;
  const before = { isMobile: platform.isMobile, isPhone: platform.isPhone, isDesktopApp: platform.isDesktopApp };
  platform.isMobile = true;
  platform.isPhone = true;
  platform.isDesktopApp = false;
  return () => {
    platform.isMobile = before.isMobile;
    platform.isDesktopApp = before.isDesktopApp;
    if (before.isPhone === undefined) delete platform.isPhone;
    else platform.isPhone = before.isPhone;
  };
}

function openWelcome(plugin, dom) {
  const modal = new T.WelcomeModal(plugin.app, plugin);
  modal.containerEl = dom.root;
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.titleEl = dom.root;
  modal.open();
  return modal;
}

test("mobile welcome: the AI card can open the settings it tells you to visit", async () => {
  // Regression: the phone copy said "add a key in Settings" and offered no button.
  const restore = onPhone();
  try {
    const plugin = new QT(makeApp([]));
    await plugin.onload();
    let opened = 0;
    plugin.openSettings = () => {
      opened++;
    };
    const dom = makeDom();
    openWelcome(plugin, dom);

    const status = dom.find(/OpenCode is desktop-only/);
    assert.ok(status.length, "the phone card explains why OpenCode is unavailable");
    assert.match(status[0].meta.text, /Direct API provider key in Settings/);

    const buttons = dom.find("Open settings");
    assert.ok(buttons.length, "the card offers the settings button the copy refers to");
    const button = dom.all.find((o) => o.meta && o.meta.text === "Open settings" && o.handlers.some((h) => h.ev === "click"));
    assert.ok(button, "the settings button is clickable");
  } finally {
    restore();
  }
});

test("mobile welcome: opening the settings button reaches the plugin's settings", async () => {
  const restore = onPhone();
  try {
    const plugin = new QT(makeApp([]));
    await plugin.onload();
    let opened = 0;
    plugin.openSettings = () => {
      opened++;
    };
    const dom = makeDom();
    openWelcome(plugin, dom);
    await dom.click("Open settings");
    assert.equal(opened, 1);
  } finally {
    restore();
  }
});

test("platform: a phone uses Direct API while the saved desktop backend is untouched", async () => {
  const restore = onPhone();
  try {
    const plugin = new QT(makeApp([]));
    await plugin.onload();
    plugin.settings.ai.backend = "opencode";
    assert.equal(plugin.backend(), "api", "OpenCode cannot run on a phone");
    assert.equal(plugin.settings.ai.backend, "opencode", "the desktop choice is kept for next time");
  } finally {
    restore();
  }
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.backend = "opencode";
  assert.equal(plugin.backend(), "opencode", "the desktop keeps using OpenCode");
});

test("platform: the beginner connection form on a phone skips OpenCode but keeps a working path", async () => {
  const restore = onPhone();
  try {
    const plugin = new QT(makeApp([]));
    await plugin.onload();
    plugin.settings.ai.api = { provider: "anthropic", model: "", keys: {} };
    const dom = makeDom();
    T.renderAiConnectionForm(dom.root, { plugin });
    const texts = dom.all.filter((o) => o.meta && typeof o.meta.text === "string").map((o) => o.meta.text);
    assert.ok(
      !texts.some((t) => /OpenCode \(recommended\)/.test(t)),
      "the OpenCode path is not offered where it cannot run"
    );
    assert.ok(texts.some((t) => /Paste your key, then press Fetch models/.test(t)), "the phone form says what to do next");
    assert.ok(texts.some((t) => /Paste questions instead \(works offline\)/.test(t)), "an offline way forward stays visible");
  } finally {
    restore();
  }
});
