"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin: QT } = load();

test("startup: onload defers vault indexing and vault listeners until layout is ready", async () => {
  const app = makeApp([]);
  let ready = null;
  app.workspace.onLayoutReady = (callback) => {
    ready = callback;
  };
  const plugin = new QT(app);
  let scans = 0;
  let indexes = 0;
  const refreshPlainCards = plugin.refreshPlainCards.bind(plugin);
  const indexReadingPlans = plugin.indexReadingPlans.bind(plugin);
  plugin.refreshPlainCards = (...args) => {
    scans += 1;
    return refreshPlainCards(...args);
  };
  plugin.indexReadingPlans = (...args) => {
    indexes += 1;
    return indexReadingPlans(...args);
  };

  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.plainMarkdown = { enabled: true, folder: "Flashcards" };

  assert.equal(typeof ready, "function", "the plugin schedules deferred startup");
  assert.equal(scans, 0, "onload does not scan the vault for plain cards");
  assert.equal(indexes, 0, "onload does not scan the vault for reading plans");
  assert.equal(app.handlers["vault:create"], undefined, "vault create listeners wait for layout-ready");

  ready();
  assert.equal(typeof app.handlers["vault:create"], "function", "vault create listeners start after layout-ready");
  assert.ok(scans > 0, "the plain-card index starts after layout-ready");
  assert.ok(indexes > 0, "the reading-plan index starts after layout-ready");
});
