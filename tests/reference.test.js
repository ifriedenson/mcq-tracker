"use strict";
// Reference module: pure data checks plus the optional module's entry points.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const ref = T.referenceData;

async function setup(saved) {
  const app = makeApp([]);
  const plugin = new QT(app);
  if (saved) plugin.saved = saved;
  await plugin.onload();
  obsidian.notices.length = 0;
  return { app, plugin };
}

test("reference: length, temperature and invalid conversions", () => {
  assert.equal(ref.convertUnit(1, "length", "km", "m"), 1000);
  assert.ok(Math.abs(ref.convertUnit(12, "length", "in", "ft") - 1) < 1e-12);
  assert.equal(ref.convertUnit(100, "temperature", "c", "f"), 212);
  assert.equal(ref.convertUnit(32, "temperature", "f", "c"), 0);
  assert.equal(ref.convertUnit(0, "temperature", "c", "k"), 273.15);
  assert.equal(ref.convertUnit("nope", "length", "m", "ft"), null);
  assert.equal(ref.convertUnit(1, "length", "m", "nope"), null);
  assert.equal(ref.convertUnit(1, "nope", "m", "ft"), null);
});

test("reference: formulas and constants are searchable by name, subject and text", () => {
  const momentum = ref.searchFormulas("momentum", "physics");
  assert.ok(momentum.some((f) => f.id === "momentum"));
  assert.ok(momentum.some((f) => f.id === "impulse"), "the note text is searchable too");
  assert.ok(ref.searchFormulas("", "chemistry").every((f) => f.subject === "chemistry"));
  assert.ok(ref.searchFormulas("quadratic").some((f) => f.id === "quadratic"));
  assert.ok(ref.searchFormulas("", "all").length >= 20);
  assert.ok(ref.searchConstants("avogadro").some((c) => c.id === "avogadro"));
  assert.ok(ref.searchConstants("J/(mol K)").length >= 1);
});

test("reference: settings are off by default, and the view command follows the module", async () => {
  const { plugin } = await setup();
  assert.equal(plugin.referenceEnabled(), false);
  assert.ok(plugin.commands.some((c) => c.id === "open-reference"));
  assert.equal(await plugin.activateReference(), null);
  assert.ok(obsidian.notices.some((n) => /Reference module is off/.test(n)));

  plugin.settings.reference.enabled = true;
  assert.equal(plugin.referenceEnabled(), true);
});

test("reference: reference hides during a timed test unless the user turns that off", async () => {
  const { plugin } = await setup();
  plugin.settings.reference.enabled = true;
  plugin.settings.testSession = { v: 1, items: [{ path: "Q/a.md" }], deadline: Date.now() + 60000 };
  assert.equal(await plugin.activateReference(), null);
  assert.ok(obsidian.notices.some((n) => /hidden while a timed test/.test(n)));

  plugin.settings.reference.hideDuringTests = false;
  // The fake workspace has no real leaf; the guard should now get past the test check.
  let leafRequested = false;
  plugin.app.workspace.getLeavesOfType = () => [];
  plugin.app.workspace.getLeaf = () => {
    leafRequested = true;
    return { setViewState: async () => {}, loadIfDeferred: async () => {}, view: {} };
  };
  plugin.app.workspace.revealLeaf = async () => {};
  await plugin.activateReference();
  assert.equal(leafRequested, true);
});

test("reference: switching it off closes only the reference tab", async () => {
  const { app, plugin } = await setup();
  const detached = [];
  app.workspace.detachLeavesOfType = (type) => detached.push(type);
  plugin.settings.reference.enabled = true;
  await plugin.onReferenceToggled();
  assert.deepEqual(detached, []);
  plugin.settings.reference.enabled = false;
  await plugin.onReferenceToggled();
  assert.deepEqual(detached, ["question-tracker-reference"]);
});

test("reference: the view shows formulas, the converter and the off state", async () => {
  const { app, plugin } = await setup();
  const dom = makeDom();
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().some((t) => /Reference is off/.test(t)));

  plugin.settings.reference.enabled = true;
  const again = makeDom();
  view.contentEl = again.root;
  view.render();
  assert.ok(again.texts().includes("Reference"));
  assert.ok(again.texts().includes("Formulas"));
  assert.ok(again.texts().includes("Quadratic formula"));

  view.tab = "units";
  const units = makeDom();
  view.contentEl = units.root;
  view.render();
  assert.ok(units.texts().includes("Unit converter"));
  assert.ok(units.texts().includes("Length"));

  view.tab = "constants";
  const constants = makeDom();
  view.contentEl = constants.root;
  view.render();
  assert.ok(constants.texts().includes("Avogadro constant"));
});
