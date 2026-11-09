"use strict";
// Simple settings: new installs get the beginner path, legacy data keeps the full tree.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const CATS = T.settingsCategories;

async function boot(saved) {
  const plugin = new QT(makeApp([]));
  if (saved !== undefined) plugin.saved = saved;
  await plugin.onload();
  obsidian.settingNames.length = 0;
  return plugin;
}

function openTab(plugin) {
  const tab = new T.QuestionTrackerSettingTab(plugin.app, plugin);
  const dom = makeDom();
  tab.containerEl = dom.root;
  tab.display();
  return { tab, dom };
}

function current(dom) {
  const out = [];
  const walk = (own) => {
    for (const child of own.children || []) {
      out.push(child);
      walk(child);
    }
  };
  walk(dom.root.__own);
  return out;
}

const byClass = (nodes, name) => nodes.filter((own) => own.classes && own.classes.has(name));
const textOf = (own) => (own.children || []).map((child) => child.meta.text).filter(Boolean).join(" ");
const click = async (own) => {
  for (const handler of (own.handlers || []).filter((entry) => entry.ev === "click")) await handler.fn({});
};

test("new installs start with Simple settings and only the essential pages", async () => {
  const plugin = await boot();
  assert.equal(plugin.settings.simpleSettings, true);

  const { tab, dom } = openTab(plugin);
  const nodes = current(dom);
  const categories = byClass(nodes, "qt-settings-category");

  assert.deepEqual(categories.map(textOf), ["Practice", "Courses & planning", "Study agent", "App & documents"]);
  assert.ok(!categories.some((entry) => textOf(entry) === "Notes & tools"), "the 20-tool notes category is hidden");
  assert.ok(!categories.some((entry) => textOf(entry) === "Cards & memory"), "cards settings appear only when cards are on");
  assert.equal(tab.activePage, "global");
  assert.equal(byClass(nodes, "qt-settings-layout")[0].classes.has("is-simple"), true);
  assert.equal(byClass(nodes, "qt-settings-grid")[0].classes.has("is-single-page"), true, "a one-page category uses the full width");

  const mode = byClass(nodes, "qt-settings-mode-title")[0];
  assert.equal(mode.meta.text, "Simple settings");
  const toggle = byClass(nodes, "qt-settings-mode-toggle")[0];
  assert.equal(toggle.meta.attrs.role, "switch");
  assert.equal(toggle.meta.attrs["aria-checked"], "false");
  assert.ok(!nodes.some((own) => own.classes.has("qt-module-index")), "the 31-tool index is not on the beginner page");
});

test("existing data without the new flag keeps the full settings tree", async () => {
  const plugin = await boot({ questionFolder: "Questions" });
  assert.equal(plugin.settings.simpleSettings, false);

  const { dom } = openTab(plugin);
  assert.equal(byClass(current(dom), "qt-settings-category").length, 6);
  assert.equal(byClass(current(dom), "qt-settings-mode-title")[0].meta.text, "All settings");
});

test("Show all settings reveals every page, persists, and a hidden page falls back safely", async () => {
  const plugin = await boot();
  const { tab, dom } = openTab(plugin);

  tab.openPage("mcq-practice");
  await click(byClass(current(dom), "qt-settings-mode-toggle")[0]);
  assert.equal(plugin.settings.simpleSettings, false);
  assert.equal(plugin.saved.simpleSettings, false);
  assert.equal(byClass(current(dom), "qt-settings-category").length, 6);
  assert.equal(byClass(current(dom), "qt-settings-mode-title")[0].meta.text, "All settings");
  assert.equal(byClass(current(dom), "qt-settings-mode-toggle")[0].meta.attrs["aria-checked"], "true");

  tab.openPage("study-nudge");
  assert.equal(tab.activePage, "study-nudge");
  await tab.setSimpleSettings(true);
  assert.equal(tab.activePage, "global", "a hidden current page falls back to the main module page");
  assert.equal(plugin.settings.simpleSettings, true);
  assert.equal(byClass(current(dom), "qt-settings-category").length, 4);
});

test("a PDF++ deep link reveals the advanced page instead of dropping the link", async () => {
  const plugin = await boot({ simpleSettings: true });
  const { tab } = openTab(plugin);
  tab.openPage("pdf-plus");
  assert.equal(tab.activePage, "global", "an ordinary hidden page stays hidden");
  tab.openPage("pdf-plus", { reveal: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(tab.activePage, "pdf-plus");
  assert.equal(plugin.settings.simpleSettings, false, "the advanced destination is visible");
});

test("an enabled optional module keeps its settings page in Simple mode", async () => {
  const plugin = await boot({ simpleSettings: true, cards: { enabled: true } });
  const { dom } = openTab(plugin);
  const categories = byClass(current(dom), "qt-settings-category").map(textOf);
  assert.ok(categories.includes("Cards & memory"), "Cards settings stay reachable when Cards is on");
  assert.ok(CATS.settingsPageVisible(plugin, "cards"));
  assert.ok(!CATS.settingsPageVisible(plugin, "study-nudge"));
});

test("the old default confidence labels migrate while custom labels stay", async () => {
  const old = await boot({ confidenceLabels: ["Guessing", "Unsure", "Confident"] });
  assert.deepEqual(old.settings.confidenceLabels, ["Guessing", "Probably Right", "Confident"]);
  assert.deepEqual(old.saved.confidenceLabels, ["Guessing", "Probably Right", "Confident"], "the migrated default is saved");

  const custom = await boot({ confidenceLabels: ["Low", "Medium", "High"] });
  assert.deepEqual(custom.settings.confidenceLabels, ["Low", "Medium", "High"], "a user's labels are left alone");
});

test("advanced global settings keep the optional index collapsed and the summary honest", async () => {
  const plugin = await boot({ simpleSettings: false });
  const dom = makeDom();
  T.settingsGlobal.renderModules(dom.root, plugin, () => {}, () => {});
  const nodes = current(dom);
  const details = nodes.filter((own) => own.meta.tag === "details");

  assert.equal(details.length, 2);
  for (const disclosure of details) {
    assert.equal((disclosure.meta.attrs || {}).open, undefined, "advanced groups start closed");
  }
  const titles = byClass(nodes, "qt-settings-disclosure-title").map((own) => own.meta.text);
  assert.deepEqual(titles, ["Study tools", "Advanced"]);
  const status = byClass(nodes, "qt-settings-disclosure-status").map((own) => own.meta.text);
  assert.match(status[0], /^\d+ of \d+ on$/, "the study-tool summary reports saved state");
  assert.ok(nodes.some((own) => own.classes.has("qt-settings-overview")), "the setup summary is at the top");
});

test("simple global settings omit optional tools and duplicate AI controls", async () => {
  const plugin = await boot({ simpleSettings: true });
  const dom = makeDom();
  obsidian.settingNames.length = 0;
  T.settingsGlobal.renderModules(dom.root, plugin, () => {}, () => {});
  const names = obsidian.settingNames;
  const nodes = current(dom);

  assert.ok(!nodes.some((own) => own.classes.has("qt-module-index")), "no optional tool index");
  assert.ok(!names.includes("Reference"), "Reference is an advanced module switch");
  assert.ok(!names.includes("AI features"), "AI lives on its own page");
  assert.ok(names.includes("MCQ Tracker") && names.includes("Assignments"));
  assert.ok(nodes.some((own) => own.classes.has("qt-settings-footnote")), "the page names the way to reveal more");
});

test("feedback and reminder details are collapsed disclosures", async () => {
  const plugin = await boot({ simpleSettings: false });
  const about = makeDom();
  T.settingsGlobal.renderGlobalSettings(about.root, plugin, () => {}, "about", () => {}, () => {});
  const aboutNodes = current(about);
  const aboutTitles = byClass(aboutNodes, "qt-settings-disclosure-title").map((own) => own.meta.text);
  assert.deepEqual(aboutTitles, ["Feedback and support"]);
  assert.equal((aboutNodes.find((own) => own.meta.tag === "details").meta.attrs || {}).open, undefined);

  const general = makeDom();
  T.settingsGlobal.renderGeneral(general.root, plugin, () => {});
  const generalNodes = current(general);
  const generalTitles = byClass(generalNodes, "qt-settings-disclosure-title").map((own) => own.meta.text);
  assert.deepEqual(generalTitles, ["Reminder details"]);
  assert.equal((generalNodes.find((own) => own.meta.tag === "details").meta.attrs || {}).open, undefined);
});
