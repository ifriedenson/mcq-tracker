"use strict";
// Settings navigation: two levels (categories, then pages) over the existing renderers.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const CATS = T.settingsCategories;
const STS = T.studyToolSettings;
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const source = (name) => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");

async function setup(saved) {
  const plugin = new QT(makeApp([]));
  // These navigation tests exercise the full tree; the new-install default is
  // covered in tests/settings-simple-mode.test.js.
  plugin.saved = saved === undefined ? { simpleSettings: false } : saved;
  await plugin.onload();
  obsidian.settingNames.length = 0;
  return plugin;
}

/** Elements in the live tree, not the fake DOM's accumulated history. */
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
const click = (own) => (own.handlers || []).filter((h) => h.ev === "click").forEach((h) => h.fn({}));
const textOf = (own) => (own.children || []).map((child) => child.meta.text).filter(Boolean).join(" ");

function openTab(plugin) {
  const tab = new T.QuestionTrackerSettingTab(plugin.app, plugin);
  const dom = makeDom();
  tab.containerEl = dom.root;
  tab.display();
  return { tab, dom };
}

test("settings navigation: six categories hold every settings page exactly once", () => {
  assert.deepEqual(
    CATS.SETTINGS_CATEGORIES.map((category) => category.id),
    ["practice", "memory", "planning", "notes", "agent", "app"]
  );
  const pages = CATS.SETTINGS_PAGES;
  assert.equal(new Set(pages.map((page) => page.id)).size, pages.length, "page ids are unique");
  for (const category of CATS.SETTINGS_CATEGORIES) {
    assert.ok(category.pages.length > 0, `${category.id} has pages`);
    assert.ok(category.label && category.description, `${category.id} is named and described`);
    const labels = category.pages.map((page) => page.label);
    assert.equal(new Set(labels).size, labels.length, `${category.id} page labels are unique`);
    for (const page of category.pages) {
      assert.ok(page.module, `${page.id} names a renderer`);
      assert.ok(page.icon, `${page.id} has an icon`);
      assert.equal(CATS.SETTINGS_PAGE_BY_ID[page.id].category, category.id, `${page.id} remembers its category`);
    }
  }
  for (const module of STS.STUDY_TOOL_SETTINGS_MODULES) {
    const owners = pages.filter((page) => page.module === module.id);
    assert.equal(owners.length, 1, `${module.id} has exactly one settings home`);
  }
  for (const module of ["mcq", "cards", "calendar", "assignments", "reference", "global"]) {
    assert.ok(pages.some((page) => page.module === module), `${module} is reachable`);
  }
  assert.deepEqual(
    pages.filter((page) => page.module === "mcq").map((page) => page.tab).sort(),
    ["about", "ai", "daily", "practice", "review"],
    "every MCQ Tracker tab is its own destination"
  );
  assert.equal(CATS.pageForModule("study-nudge"), "study-nudge");
  assert.equal(CATS.pageForModule("mcq"), "mcq-practice");
});

test("settings navigation: the category row and the page list render together", async () => {
  const { tab, dom } = openTab(await setup());
  let nodes = current(dom);
  assert.equal(byClass(nodes, "qt-settings-category").length, 6);
  assert.equal(byClass(nodes, "qt-settings-page").length, 1, "the App & documents page list");

  assert.equal(tab.currentPage().id, "global");
  assert.ok(
    nodes.some((own) => /App & documents · Modules and global options/.test(own.meta.text || "")),
    "the breadcrumb names the category and page"
  );

  const activeCategory = byClass(nodes, "qt-settings-category").find((own) => own.classes.has("is-active"));
  assert.equal(activeCategory.meta.attrs["aria-selected"], "true");
  const activePage = byClass(nodes, "qt-settings-page").find((own) => own.classes.has("is-active"));
  assert.equal(activePage.meta.attrs["aria-current"], "page");

  const picker = byClass(nodes, "qt-settings-module-picker")[0];
  assert.ok(picker, "the narrow-width picker is present");
  assert.equal(picker.children.length, 6, "one optgroup per category");
  assert.equal(picker.value, "global");

  const practiceButton = byClass(nodes, "qt-settings-category")[0];
  assert.equal(textOf(practiceButton), "Practice");
  click(practiceButton);
  assert.equal(tab.currentPage().id, "mcq-practice");
  assert.equal(tab.activeModule, "mcq");
  assert.equal(tab.activeMcqTab, "practice");
  nodes = current(dom);
  assert.deepEqual(
    byClass(nodes, "qt-settings-page").map(textOf),
    CATS.SETTINGS_CATEGORIES[0].pages.map((page) => page.label)
  );
  assert.ok(nodes.some((own) => /Practice · Practice session/.test(own.meta.text || "")), "the breadcrumb follows the category");
});

test("settings navigation: a page opens the existing renderer for its module and tab", async () => {
  const { tab } = openTab(await setup());
  tab.openPage("mcq-review");
  assert.equal(tab.activeModule, "mcq");
  assert.equal(tab.activeMcqTab, "review");
  assert.ok(obsidian.settingNames.includes("Review intervals (days)"), "the review tab rendered");

  tab.openPage("study-nudge");
  assert.equal(tab.activeModule, "study-nudge");
  assert.ok(obsidian.settingNames.includes("Enable Study nudge"), "the study tool page rendered");

  tab.openPage("not-a-page");
  assert.equal(tab.activePage, "study-nudge", "an unknown page is ignored");
});

test("settings navigation: the extra answer checks pick models from a list, not a typed field", async () => {
  const plugin = await setup();
  plugin.settings.ai.api.models = ["model-a", "model-b"];
  const { tab } = openTab(plugin);
  tab.openPage("mcq-ai");
  for (const name of ["Extra check model 1", "Extra check model 2", "Extra check model 3"]) {
    assert.ok(obsidian.settingNames.includes(name), `${name} is offered`);
  }
  assert.ok(!obsidian.settingNames.includes("Models for the extra checks"), "the typed list is gone");
  // A saved name that is not in the fetched list still shows, in its own field.
  plugin.settings.ai.verifyPanelModels = ["hand-typed/model"];
  const again = openTab(plugin);
  again.tab.openPage("mcq-ai");
  assert.ok(obsidian.settingNames.includes("Extra check model 1"));
});

test("settings navigation: the practice page exposes the mobile view switch", async () => {
  const { tab } = openTab(await setup());
  tab.openPage("mcq-practice");
  assert.ok(obsidian.settingNames.includes("Mobile practice view"));
  assert.ok(obsidian.settingNames.includes("Distraction-free practice mode"));
});

test("settings navigation: phones get the compact picker and tablets keep the desktop list", async () => {
  const original = { ...obsidian.Platform };
  try {
    obsidian.Platform.isMobile = true;
    obsidian.Platform.isTablet = true;
    obsidian.Platform.isPhone = false;
    const tablet = openTab(await setup());
    let nodes = current(tablet.dom);
    assert.equal(
      byClass(nodes, "qt-settings-layout")[0].classes.has("is-phone"),
      false,
      "an iPad keeps the desktop page list"
    );
    assert.equal(byClass(nodes, "qt-settings-page").length, 1, "the tablet still renders the page list");

    obsidian.Platform.isTablet = false;
    obsidian.Platform.isPhone = true;
    const phone = openTab(await setup());
    nodes = current(phone.dom);
    assert.equal(
      byClass(nodes, "qt-settings-layout")[0].classes.has("is-phone"),
      true,
      "a phone keeps the compact settings layout"
    );

    delete obsidian.Platform.isPhone;
    delete obsidian.Platform.isTablet;
    const legacyPhone = openTab(await setup());
    nodes = current(legacyPhone.dom);
    assert.equal(
      byClass(nodes, "qt-settings-layout")[0].classes.has("is-phone"),
      true,
      "an older API without isPhone keeps the phone layout"
    );

    obsidian.Platform.isTablet = true;
    const legacyTablet = openTab(await setup());
    nodes = current(legacyTablet.dom);
    assert.equal(
      byClass(nodes, "qt-settings-layout")[0].classes.has("is-phone"),
      false,
      "an older tablet flag avoids the phone layout"
    );
  } finally {
    obsidian.Platform.isMobile = original.isMobile;
    obsidian.Platform.isDesktopApp = original.isDesktopApp;
    delete obsidian.Platform.isPhone;
    delete obsidian.Platform.isTablet;
  }
});

test("settings navigation CSS: two columns on wide panes, the grouped picker on narrow ones", () => {
  assert.match(css, /\.qt-settings-grid \{[^}]*grid-template-columns: minmax\(170px, 210px\) minmax\(0, 1fr\)/s);
  assert.match(css, /\.qt-settings-pages \{[^}]*flex-direction: column/s);
  assert.match(css, /\.qt-settings-page\.is-active \{[^}]*box-shadow: inset 2px 0 0 var\(--interactive-accent\)/s);
  assert.match(css, /\.qt-settings-page \{[^}]*white-space: normal/s, "page labels wrap instead of running into the content");
  assert.match(css, /\.qt-settings-page-label \{[^}]*overflow-wrap: anywhere/s);
  assert.match(css, /\.qt-settings-page:focus-visible,[\s\S]*?outline: 2px solid var\(--interactive-accent\)/s);
  assert.match(css, /@container \(max-width: 540px\) \{[\s\S]*?\.qt-settings-pages \{\s*display: none/s);
  assert.match(css, /@container \(max-width: 540px\) \{[\s\S]*?\.qt-settings-module-picker \{\s*display: block/s);
  assert.match(css, /@container \(max-width: 760px\) \{[\s\S]*?grid-template-columns: minmax\(150px, 168px\)/s, "the compact two-column layout");
  assert.match(css, /\.qt-settings-layout\.is-phone \.qt-settings-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\)/s, "a phone uses one column");
  assert.match(css, /\.qt-settings-layout\.is-phone > \.qt-settings-module-picker \{\s*display: block/s, "a phone shows the grouped picker");
  assert.doesNotMatch(
    css,
    /body\.is-mobile \.qt-settings-(grid|pages|tabs|body)\b/,
    "phone settings styles are scoped to phones, not every mobile app"
  );
  assert.match(source("settings-tab.js"), /Platform\.isPhone/);
  assert.match(css, /\.qt-settings-body \.setting-item \{[^}]*flex-wrap: wrap/s, "setting rows may wrap instead of clipping");
  assert.match(source("settings-tab.js"), /qt-settings-categories/);
  assert.match(source("settings-tab.js"), /aria-selected/);
  assert.match(source("settings-categories.js"), /const CATEGORIES = \[/);
});
