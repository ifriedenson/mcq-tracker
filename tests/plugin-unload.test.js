"use strict";
/* Disabling (or updating) the plugin must never report failure, even when the
 * window helpers are already gone or a subsystem throws during teardown. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin: QT } = load();
const notes = [{ path: "Questions/unload.md", fm: { answer: "B", choices: 4 } }];

test("onunload never throws without activeWindow, even when stop() throws", async () => {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  const saved = global.activeWindow;
  delete global.activeWindow;
  try {
    plugin.manager = {
      stop() {
        throw new Error("stop blew up");
      },
    };
    plugin._plainCardRefreshTimer = setTimeout(() => {}, 60000);
    assert.doesNotThrow(() => plugin.onunload());
    assert.equal(plugin._plainCardRefreshTimer, null);
  } finally {
    global.activeWindow = saved;
  }
});

test("the plain-card refresh still schedules without activeWindow", async () => {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards = { plainMarkdown: { enabled: true, folder: "Cards" } };
  const saved = global.activeWindow;
  delete global.activeWindow;
  try {
    const t = plugin.schedulePlainCardRefresh(60000);
    assert.ok(t !== null && t !== undefined);
    clearTimeout(t);
    plugin._plainCardRefreshTimer = null;
  } finally {
    global.activeWindow = saved;
  }
});
