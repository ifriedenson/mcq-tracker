"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const hubs = T.hubs;

async function setup(patch) {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  if (patch) Object.assign(plugin.settings, patch);
  return plugin;
}

/** A workspace that records what a hub activation asked for. */
function workspaceFor(app, view) {
  const leaf = { view, loadIfDeferred: async () => {}, setViewState: async (state) => { leaf.state = state; } };
  app.workspace.getLeavesOfType = (type) => (leaf.state && leaf.state.type === type ? [leaf] : []);
  app.workspace.getLeaf = () => leaf;
  app.workspace.revealLeaf = async () => {};
  return leaf;
}

function ribbonOf(plugin) {
  const ribbon = [];
  plugin.addRibbonIcon = (icon, title, onClick) => {
    ribbon.push({ icon, title, onClick });
    return { remove() {} };
  };
  plugin.ribbonAdded = {};
  plugin.ribbonButtons = {};
  plugin.refreshRibbon();
  return ribbon;
}

test("hubs: a hub answers its view type before its constructor body runs", async () => {
  const plugin = await setup();
  // Obsidian's View constructor calls getViewType() during super(), so the
  // registered class must answer from its closure, not from instance fields.
  for (const spec of hubs.HUB_SPECS) {
    const HubClass = T.hubViewClass(spec);
    assert.equal(HubClass.prototype.getViewType.call({}), spec.type, `${spec.id} view type`);
    assert.equal(HubClass.prototype.getDisplayText.call({}), spec.title, `${spec.id} title`);
    assert.equal(HubClass.prototype.getIcon.call({}), spec.icon, `${spec.id} icon`);
    const view = new HubClass({ app: plugin.app }, plugin, spec);
    assert.equal(view.getViewType(), spec.type, "and the instance agrees");
  }
});

test("hubs: the tab list follows the module switches", async () => {
  const plugin = await setup();
  const plan = hubs.hubSpec("plan");
  const ids = hubs.enabledTabs(plan, plugin).map((tab) => tab.id);
  assert.ok(ids.includes("focus"), "Focus day is always available");
  plugin.settings.calendar = { ...(plugin.settings.calendar || {}), enabled: false };
  plugin.settings.localEvents = { ...(plugin.settings.localEvents || {}), enabled: false };
  const after = hubs.enabledTabs(plan, plugin).map((tab) => tab.id);
  assert.ok(!after.includes("calendar"), "a disabled Calendar is not offered");
  assert.ok(!after.includes("events"), "a disabled Local events is not offered");
  assert.ok(after.includes("focus"), "Focus day stays");
  assert.equal(hubs.hubSpecByType(plan.type), plan, "a hub is found by its view type");
  assert.equal(hubs.hubSpec("nope"), null);
});

test("hubs: the grouped ribbon is three hubs shorter than the classic one", async () => {
  const plugin = await setup();
  const grouped = ribbonOf(plugin).map((item) => item.title);
  assert.ok(grouped.includes("Open Plan"), "Plan hub");
  assert.ok(grouped.includes("Open today"), "Today hub");
  assert.ok(grouped.includes("Open Study Workspace"), "Study hub");
  for (const gone of ["Open calendar", "Open Focus day", "Open review calendar", "Open local events", "Open study statistics", "Open Pomodoro timer", "Open Study Tools"]) {
    assert.ok(!grouped.includes(gone), `${gone} moved into a hub`);
  }
  assert.ok(grouped.length <= 11, `the grouped ribbon stays short (${grouped.length} buttons)`);
  plugin.settings.ribbonLayout = "classic";
  const classic = ribbonOf(plugin).map((item) => item.title);
  assert.ok(classic.includes("Open Focus day"), "classic restores the Focus day button");
  assert.ok(!classic.includes("Open Plan"), "and drops the hub button");
  assert.ok(classic.length > grouped.length, "classic is the longer ribbon");
});

test("hubs: a hub mounts its real views as tabs and switches without rebuilding", async () => {
  const plugin = await setup();
  const spec = hubs.hubSpec("plan");
  const view = new T.QtHubView({ app: plugin.app }, plugin, spec);
  const dom = makeDom();
  view.contentEl = dom.root;
  await view.onOpen();
  const labels = view.tabs.map((tab) => tab.label);
  assert.ok(labels.includes("Focus day"), "the calendar-family tab is offered");
  assert.ok(labels.length >= 1, "at least one tab");
  assert.ok(dom.texts().includes("Focus day"), "the tab bar draws");
  const first = view.tabs[0].id;
  const firstView = view.childView(first);
  assert.ok(firstView, "the first tab's real view is mounted");
  assert.equal(firstView.contentEl, view.panes[first].el, "the real view renders into the pane");
  assert.equal(view.activeTab, first, "the first tab is active");
  const other = view.tabs.find((tab) => tab.id !== first);
  assert.ok(other, "the hub offers more than one section");
  const switched = view.showHubTab(other.id);
  assert.ok(switched, "switching mounts the other view");
  assert.ok(!view.panes[first].el.classes.has("is-active"), "the old pane hides");
  assert.ok(view.panes[other.id].el.classes.has("is-active"), "the new pane shows");
  view.showHubTab(first);
  assert.equal(view.childView(first), firstView, "coming back reuses the same child");
  assert.equal(view.childView(other.id), switched, "state is never thrown away");
  assert.equal(view.showHubTab("missing"), null, "an unknown tab is ignored");
  await view.onClose();
  assert.deepEqual(view.panes, {}, "closing releases the children");
});

test("hubs: a hub with every section off explains itself", async () => {
  const plugin = await setup();
  plugin.mcqEnabled = () => false;
  plugin.studyStatsEnabled = () => false;
  plugin.pomodoroEnabled = () => false;
  const spec = hubs.hubSpec("today");
  const view = new T.QtHubView({ app: plugin.app }, plugin, spec);
  const dom = makeDom();
  view.contentEl = dom.root;
  await view.onOpen();
  assert.equal(view.tabs.length, 0, "no tabs");
  assert.ok(dom.texts().some((text) => text.includes("has no sections turned on")), "the empty hub names the fix");
  assert.doesNotThrow(() => view.render(), "render on an empty hub is harmless");
});

test("hubs: the module commands open the hub on the right tab", async () => {
  const plugin = await setup();
  const spec = hubs.hubSpec("plan");
  const view = new T.QtHubView({ app: plugin.app }, plugin, spec);
  const dom = makeDom();
  view.contentEl = dom.root;
  await view.onOpen();
  workspaceFor(plugin.app, view);
  const opened = await plugin.activateFocusDay();
  assert.equal(opened, view, "Focus day opens the hub");
  assert.equal(view.activeTab, "focus", "on the Focus day tab");
  const stats = hubs.hubSpec("today");
  const todayView = new T.QtHubView({ app: plugin.app }, plugin, stats);
  todayView.contentEl = makeDom().root;
  await todayView.onOpen();
  workspaceFor(plugin.app, todayView);
  await plugin.activateStudyStats();
  assert.equal(todayView.activeTab, "stats", "Study statistics opens the Today hub on Statistics");
  const study = hubs.hubSpec("study");
  assert.ok(hubs.enabledTabs(study, plugin).length, "the Study hub has sections");
  assert.ok(plugin.commands.some((command) => command.id === "open-plan-hub"), "Open Plan is a command");
});

test("hubs: toggling every study module off closes an empty Study hub", async () => {
  const plugin = await setup();
  const detached = [];
  plugin.detachModuleLeaves = (types) => detached.push(...types);
  plugin.studyWorkspaceEnabled = () => false;
  plugin.studyToolsEnabled = () => false;
  plugin.refreshHubLeaves();
  assert.ok(detached.includes(hubs.hubSpec("study").type), "the Study hub closes");
});

test("pdf++: its three toggles ride in one button's menu", async () => {
  const plugin = await setup();
  const calls = [];
  plugin._pdfPlusRibbons = [
    { icon: "copy", title: "PDF++: Toggle auto-copy", callback: () => calls.push("copy") },
    { icon: "focus", title: "PDF++: Toggle auto-focus", callback: () => calls.push("focus") },
    { icon: "clipboard", title: "PDF++: Toggle auto-paste", callback: () => calls.push("paste") },
  ];
  const ribbon = ribbonOf(plugin);
  const pdfButtons = ribbon.filter((item) => item.title.startsWith("PDF++"));
  assert.equal(pdfButtons.length, 1, "one PDF++ button");
  assert.equal(pdfButtons[0].title, "PDF++ toggles");
  const menu = pdfButtons[0].onClick({});
  assert.ok(menu.shown, "the menu opens on the click");
  assert.equal(menu.items.length, 4, "three toggles plus PDF++ settings");
  assert.equal(menu.separators, 1, "the settings entry is separated");
  for (const item of menu.items.slice(0, 3)) item.click();
  assert.deepEqual(calls, ["copy", "focus", "paste"], "each entry runs its own toggle");
  assert.ok(obsidian.menus.includes(menu), "a real Menu was used");
  plugin._pdfPlusRibbons = [];
  const after = ribbonOf(plugin);
  assert.ok(!after.some((item) => item.title.startsWith("PDF++")), "no PDF++ button without toggles");
});
