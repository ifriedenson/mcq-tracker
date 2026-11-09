"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const whatsNew = T.whatsNew;
const welcome = T.welcome;

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app, require("../manifest.json"));
  await plugin.onload();
  return { app, plugin };
}

test("what's new: every bundled release is complete and covers this version", () => {
  const manifest = require("../manifest.json");
  const release = whatsNew.releaseFor(manifest.version);
  assert.ok(release, "the manifest version has bundled notes");
  assert.equal(whatsNew.latestRelease().version, release.version);
  for (const entry of whatsNew.RELEASES) {
    assert.match(entry.version, /^\d+\.\d+\.\d+$/);
    assert.ok(entry.date.length > 5, "the release has a date");
    assert.ok(entry.title.length > 3, "the release has a title");
    assert.ok(entry.summary.length > 40, "the release has a summary");
    assert.ok(entry.highlights.length >= 4, "the release lists its changes");
    for (const item of entry.highlights) {
      assert.ok(item.title.length > 3);
      assert.ok(item.body.length > 30);
    }
  }
});

test("what's new: a first install stays quiet, then an update shows once", async () => {
  const { app } = await setup();
  assert.equal(whatsNew.whatsNewShouldShow(app, "1.296.0"), false, "a first install is owned by the welcome guide");

  welcome.markWelcomeSeen(app, "1.295.0");
  assert.equal(whatsNew.whatsNewShouldShow(app, "1.296.0"), true, "a previous version unlocks the update note");
  assert.equal(whatsNew.whatsNewShouldShow(app, "1.295.0"), false, "the same version does not repeat");

  const state = whatsNew.markWhatsNewSeen(app, "1.296.0");
  assert.equal(state.seenVersion, "1.296.0");
  assert.ok(state.seenAt.length > 10);
  assert.equal(whatsNew.whatsNewShouldShow(app, "1.296.0"), false, "the note is dismissed for this version");
});

test("what's new: an unknown version has no note and no popup", async () => {
  const { app } = await setup();
  welcome.markWelcomeSeen(app, "1.295.0");
  assert.equal(whatsNew.releaseFor("9.9.9"), null);
  assert.equal(whatsNew.whatsNewShouldShow(app, "9.9.9"), false);
});

test("what's new: startup schedules the note for an existing install", async () => {
  const original = global.activeWindow.setTimeout;
  const timers = [];
  global.activeWindow.setTimeout = (fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  };
  try {
    const app = makeApp([]);
    welcome.markWelcomeSeen(app, "1.295.0");
    app.workspace.onLayoutReady = (callback) => callback();
    const before = obsidian.modals.length;
    const plugin = new QT(app, require("../manifest.json"));
    await plugin.onload();

    assert.equal(obsidian.modals.length, before, "the update note waits for the workspace");
    const scheduled = timers.filter((timer) => timer.ms === 1600);
    assert.equal(scheduled.length, 1, "one update note is scheduled");
    scheduled[0].fn();
    assert.equal(obsidian.modals.length, before + 1);
    assert.ok(obsidian.modals.at(-1) instanceof T.WhatsNewModal);
  } finally {
    global.activeWindow.setTimeout = original;
  }
});

test("what's new: the command opens the bundled note and the modal marks it seen", async () => {
  const { app, plugin } = await setup();
  const release = whatsNew.releaseFor(plugin.manifest.version);
  const command = plugin.commands.find((entry) => entry.id === "open-whats-new");
  assert.ok(command, "the command is registered");
  const before = obsidian.modals.length;
  command.callback();
  assert.equal(obsidian.modals.length, before + 1);
  assert.ok(obsidian.modals.at(-1) instanceof T.WhatsNewModal);

  const dom = makeDom();
  const modal = new T.WhatsNewModal(app, plugin, release, { automatic: true });
  modal.containerEl = dom.root;
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.titleEl = dom.root;
  modal.open();

  assert.ok(dom.find(`Updated to ${release.version}`).length);
  assert.ok(dom.find(release.title).length);
  assert.ok(dom.find("Open practice").length);
  for (const item of release.highlights) assert.ok(dom.find(item.title).length, item.title);
  assert.match(dom.texts().join(" "), /Show what's new/);

  await dom.click("Got it");
  assert.equal(whatsNew.loadWhatsNewState(app).seenVersion, release.version);
});
