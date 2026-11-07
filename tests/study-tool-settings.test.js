"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const STS = T.studyToolSettings;

async function setup() {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  return plugin;
}

test("study tool settings: every study tool has its own settings module in the sidebar", () => {
  const ids = STS.STUDY_TOOL_SETTINGS_MODULES.map((module) => module.id);
  assert.deepEqual([...STS.STUDY_TOOL_SETTINGS_PAGE_IDS].sort(), [...ids].sort(), "every settings page is reachable from the module nav");
  assert.ok(ids.includes("web-browser"), "web browser is exposed in the settings nav");
  assert.equal(new Set(ids).size, ids.length, "module ids are unique");
  assert.ok(ids.length >= 27, `expected at least 27 study tool pages, got ${ids.length}`);
  for (const id of ids) {
    const entry = STS.STUDY_TOOL_SETTINGS_BY_ID[id];
    assert.ok(entry && entry.page, `${id} has a page`);
    assert.ok(entry.label, `${id} has a label`);
    assert.ok(T.SETTINGS_MODULES.some((module) => module.id === id), `${id} is in the settings nav`);
  }
  const navIds = T.SETTINGS_MODULES.map((module) => module.id);
  assert.equal(new Set(navIds).size, navIds.length, "settings nav ids are unique");
});

test("study tool settings: every enable switch drives the real module getter", async () => {
  const plugin = await setup();
  for (const module of STS.STUDY_TOOL_SETTINGS_MODULES) {
    const page = STS.STUDY_TOOL_SETTINGS_BY_ID[module.id].page;
    assert.equal(typeof plugin[page.enabledGetter], "function", `${module.id} getter exists`);
    page.enable(plugin, false);
    await plugin.save();
    assert.equal(plugin[page.enabledGetter](), false, `${module.id} can be switched off`);
    page.enable(plugin, true);
    await plugin.save();
    assert.equal(plugin[page.enabledGetter](), true, `${module.id} can be switched on`);
  }
});

test("study tool settings: every page reads its data and round-trips its fields", async () => {
  const plugin = await setup();
  for (const module of STS.STUDY_TOOL_SETTINGS_MODULES) {
    const page = STS.STUDY_TOOL_SETTINGS_BY_ID[module.id].page;
    if (typeof page.status === "function") {
      assert.equal(typeof page.status(plugin), "string", `${module.id} status is text`);
    }
    for (const field of page.fields || []) {
      const before = field.get(plugin);
      assert.notEqual(before, undefined, `${module.id}: ${field.name} reads a value`);
      await field.set(plugin, before);
      assert.equal(field.get(plugin), before, `${module.id}: ${field.name} keeps its value`);
      await plugin.save();
    }
  }
});

test("study tool settings: the off-by-default nudge page matches the stored setting", async () => {
  const plugin = await setup();
  const page = STS.STUDY_TOOL_SETTINGS_BY_ID["study-nudge"].page;
  assert.equal(plugin.studyNudgeEnabled(), false);
  page.enable(plugin, true);
  await plugin.save();
  assert.equal(plugin.studyNudgeEnabled(), true);
  page.enable(plugin, false);
  await plugin.save();
  assert.equal(plugin.studyNudgeEnabled(), false);
});
