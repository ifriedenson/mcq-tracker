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
  if (saved) plugin.saved = saved;
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
  assert.ok(pages.some((page) => page.id === "pdf-plus" && page.module === "pdf-plus"), "PDF++ has a page");
  assert.equal(CATS.pageForModule("study-nudge"), "study-nudge");
  assert.equal(CATS.pageForModule("mcq"), "mcq-practice");
  assert.equal(CATS.categoryForPage("pdf-plus").id, "app");
});

test("settings navigation: the category row and the page list render together", async () => {
  const { tab, dom } = openTab(await setup());
  let nodes = current(dom);
  assert.equal(byClass(nodes, "qt-settings-category").length, 6);
  assert.equal(byClass(nodes, "qt-settings-page").length, 2, "the App & documents page list");

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

test("settings navigation: PDF++ lives in the same navigation and hosts the vendor tab", async () => {
  const plugin = await setup();
  const { tab, dom } = openTab(plugin);
  tab.openPage("pdf-plus");
  assert.equal(tab.activePage, "pdf-plus");
  const texts = current(dom).map((own) => own.meta.text || "");
  assert.ok(texts.includes("PDF++"));
  assert.ok(obsidian.settingNames.includes("Run the embedded PDF++ tools"), "the on/off switch is on the page");
  assert.ok(texts.some((text) => /PDF\+\+'s options are not available yet/.test(text)), "the page explains an unavailable vendor tab");

  // A vendor tab draws into the elements it created in its constructor, so the
  // page mounts a second instance instead of reparenting the shared tab.
  class FakeVendorTab {
    constructor(hostPlugin) {
      this.plugin = hostPlugin;
      this.containerEl = dom.root.createDiv({ cls: "pdf-plus-settings" });
      this.contentEl = this.containerEl.createDiv({ cls: "content" });
    }
    display() {
      this.contentEl.createDiv({ text: "PDF++ vendor control" });
    }
  }
  const vendorPlugin = { manifest: { id: "mcq-tracker-pdf-plus" } };
  const vendor = new FakeVendorTab(vendorPlugin);
  vendor.id = "mcq-tracker-pdf-plus";
  plugin.app.setting = { pluginTabs: [vendor] };
  tab.openPage("global");
  tab.openPage("pdf-plus");
  assert.ok(current(dom).some((own) => own.meta.text === "PDF++ vendor control"), "the vendor tab draws in the page");
  assert.equal(plugin.app.setting.pluginTabs[0].containerEl, vendor.containerEl, "the real vendor tab keeps its own container");
});

test("pdf plus settings: vendor scroll targets inside Obsidian's settings pane", async () => {
  const plugin = await setup();
  const { tab, dom } = openTab(plugin);
  class FakeScrollVendorTab {
    constructor(hostPlugin) {
      this.plugin = hostPlugin;
      this.containerEl = dom.root.createDiv({ cls: "pdf-plus-settings" });
      this.contentEl = this.containerEl.createDiv({ cls: "content" });
      this.items = { colors: { settingEl: this.contentEl.createDiv({ text: "Colour swatches" }) } };
    }
    display() {
      this.contentEl.createDiv({ text: "PDF++ scroll control" });
    }
    scrollTo(id, options) {
      const setting = this.items[id];
      if (setting) this.scrollToSetting(setting, options);
    }
    scrollToSetting() {
      this.originalScrollCalls = (this.originalScrollCalls || 0) + 1;
    }
  }
  const vendorPlugin = { manifest: { id: "mcq-tracker-pdf-plus" } };
  const vendor = new FakeScrollVendorTab(vendorPlugin);
  plugin.app.setting = { pluginTabs: [vendor] };
  tab.openPage("pdf-plus");
  const embedded = plugin._pdfPlusSettingsView;
  assert.ok(embedded, "the embedded vendor tab was created");
  const target = embedded.items.colors.settingEl;
  embedded.scrollTo("colors", { behavior: "auto" });
  assert.equal(target.__own.scrolledIntoView, true, "the real setting was scrolled into view");
  assert.equal(embedded.originalScrollCalls, undefined, "the no-op vendor scroll was bypassed");
});

test("pdf plus settings: a moving target is scrolled again after the page settles", async () => {
  const plugin = await setup();
  const { tab, dom } = openTab(plugin);
  let top = 840;
  const calls = [];
  const timers = [];
  const target = {
    isConnected: true,
    scrollIntoView(options) {
      calls.push(options);
      if (calls.length === 2) top = 46;
    },
    getBoundingClientRect() {
      return { top, bottom: top + 385, height: 385 };
    },
    ownerDocument: {
      defaultView: {
        innerHeight: 700,
        setTimeout(fn, ms) {
          timers.push({ fn, ms });
          return timers.length;
        },
      },
    },
  };
  class FakeMovingVendorTab {
    constructor(hostPlugin) {
      this.plugin = hostPlugin;
      this.containerEl = dom.root.createDiv({ cls: "pdf-plus-settings" });
      this.contentEl = this.containerEl.createDiv({ cls: "content" });
      this.items = { colors: { settingEl: target } };
    }
    display() {}
    scrollTo(id, options) {
      if (id === "colors") this.scrollToSetting(this.items.colors, options);
    }
    scrollToSetting() {}
  }
  const vendor = new FakeMovingVendorTab({ manifest: { id: "mcq-tracker-pdf-plus" } });
  plugin.app.setting = { pluginTabs: [vendor] };
  tab.openPage("pdf-plus");
  const embedded = plugin._pdfPlusSettingsView;
  embedded.scrollTo("colors");
  assert.equal(calls.length, 1, "the target is scrolled as soon as the page opens");
  const settle = timers.find((timer) => timer.ms === 180);
  assert.ok(settle, "a short post-render check is scheduled");
  settle.fn();
  assert.equal(calls.length, 2, "a target that moved below the viewport is scrolled again");
  assert.equal(calls[1].behavior, "auto", "the corrective scroll is immediate");
  for (const timer of timers) timer.fn();
  assert.equal(calls.length, 2, "a visible target is not scrolled again");
});

test("pdf plus settings: Customize links open the integrated MCQ page", async () => {
  const plugin = await setup();
  const calls = [];
  plugin.app.setting = {
    open() {
      calls.push("open");
    },
    openTabById(id) {
      calls.push(id);
    },
  };
  plugin.settingsTab = { openPage: (id) => calls.push(`page:${id}`) };
  assert.equal(plugin.openPdfPlusSettingsTab(), true);
  assert.deepEqual(calls, ["open", "mcq-tracker", "page:pdf-plus"]);
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
    assert.equal(byClass(nodes, "qt-settings-page").length, 2, "the tablet still renders the page list");

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
  assert.match(source("pdf-plus-settings.js"), /renderPdfPlusSettings/);
  assert.match(
    css,
    /\.qt-settings-body \.qt-settings-grid \.qt-pdf-plus-embedded\.vertical-tab-content > \.header-container\s*\{[\s\S]*?overflow: hidden;[\s\S]*?flex-wrap: wrap;/s,
    "the embedded PDF++ icon header wraps without its own horizontal scrollbar"
  );
  assert.match(
    css,
    /\.qt-settings-body \.qt-pdf-plus-embedded \.content \.dropdown\.is-measuring \{\s*display: none/s,
    "invisible dropdown measuring clones do not widen the embedded page"
  );
});

test("pdf plus settings: the page renderer is exported and finds the hosted tab", () => {
  assert.equal(typeof T.pdfPlusSettings.renderPdfPlusSettings, "function");
  assert.equal(typeof T.pdfPlusSettings.pdfPlusSettingsTab, "function");
  assert.equal(T.pdfPlusSettings.pdfPlusSettingsTab({ app: {} }), null, "no registry means no tab");
  const tab = { id: "mcq-tracker-pdf-plus", containerEl: "x", display() {} };
  assert.equal(T.pdfPlusSettings.pdfPlusSettingsTab({ app: { setting: { pluginTabs: [tab] } } }), tab);
  assert.equal(
    T.pdfPlusSettings.pdfPlusSettingsTab({ pdfPlus: { settingTab: tab } }),
    tab,
    "the captured host tab is preferred over the app registry"
  );
});
