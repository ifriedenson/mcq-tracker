"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const pdfPlus = T.pdfPlus;

test("pdf plus: settings default on and preserve the upstream data object", () => {
  assert.deepEqual(pdfPlus.normalizePdfPlusSettings(undefined), { enabled: true, data: null });
  assert.deepEqual(pdfPlus.normalizePdfPlusSettings({ enabled: false, data: { colors: { red: "#ff0000" } } }), {
    enabled: false,
    data: { colors: { red: "#ff0000" } },
  });
  assert.deepEqual(pdfPlus.normalizePdfPlusSettings({ data: [] }), { enabled: true, data: null });
});

test("pdf plus: the embedded manifest is namespaced and keeps upstream identity", () => {
  const manifest = pdfPlus.embeddedManifest({ dir: "/vault/.obsidian/plugins/mcq-tracker/" });
  assert.equal(manifest.id, "mcq-tracker-pdf-plus");
  assert.equal(manifest.name, "PDF++");
  assert.equal(manifest.version, "0.40.31");
  assert.equal(manifest.author, "Ryota Ushio");
  assert.equal(manifest.dir, "/vault/.obsidian/plugins/mcq-tracker");
});

test("pdf plus: embedding is refused when there is no Obsidian plugin registry", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(pdfPlus.canEmbed(app), false);
  assert.equal(await pdfPlus.start(plugin), null);
  await pdfPlus.stop(plugin);
  assert.equal(plugin.pdfPlus, null);
});

test("pdf plus: an enabled standalone PDF++ blocks the embedded copy", async () => {
  const app = makeApp([]);
  app.plugins = { plugins: { "pdf-plus": {} } };
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(await pdfPlus.start(plugin), null);
  assert.match(plugin.pdfPlusError, /standalone PDF\+\+ plugin/);
});

test("pdf plus: the plugin exposes and persists its own enable switch", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(plugin.pdfPlusEnabled(), true);
  await plugin.setPdfPlusEnabled(false);
  assert.equal(plugin.pdfPlusEnabled(), false);
  assert.equal(plugin.settings.pdfPlus.enabled, false);
  await plugin.setPdfPlusEnabled(true);
  assert.equal(plugin.pdfPlusEnabled(), true);
});
