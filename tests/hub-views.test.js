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
  assert.deepEqual(ids, ["calendar"], "the Plan hub offers one merged calendar");
  plugin.settings.calendar = { ...(plugin.settings.calendar || {}), enabled: false };
  const after = hubs.enabledTabs(plan, plugin).map((tab) => tab.id);
  assert.deepEqual(after, ["calendar"], "the merged calendar stays reachable so Plan is never empty");
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
  assert.deepEqual(labels, ["Calendar"], "the merged calendar is the only Plan tab");
  assert.ok(dom.texts().includes("Calendar"), "the tab bar draws");
  const first = view.tabs[0].id;
  const firstView = view.childView(first);
  assert.ok(firstView, "the calendar's real view is mounted");
  assert.equal(firstView.contentEl, view.panes[first].el, "the real view renders into the pane");
  assert.equal(view.activeTab, first, "the calendar tab is active");
  assert.equal(view.childView("focus"), null, "Focus day is no longer a tab");
  assert.equal(view.childView("events"), null, "Local events is no longer a tab");
  assert.equal(view.showHubTab("missing"), null, "an unknown tab is ignored");
  assert.equal(view.childView(first), firstView, "a second visit reuses the child");
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

test("hubs: the module commands open their views in the right place", async () => {
  const plugin = await setup();
  plugin.settings.calendar = { ...(plugin.settings.calendar || {}), enabled: true };
  const spec = hubs.hubSpec("plan");
  const view = new T.QtHubView({ app: plugin.app }, plugin, spec);
  const dom = makeDom();
  view.contentEl = dom.root;
  await view.onOpen();
  workspaceFor(plugin.app, view);
  // The Plan hub is one calendar; its commands now open that calendar in the
  // right sidebar instead of a main-tab hub.
  let sidebarLeaf = null;
  const opened = [];
  plugin.app.workspace.getLeavesOfType = (type) => (sidebarLeaf && sidebarLeaf.view && sidebarLeaf.view.getViewType() === type ? [sidebarLeaf] : []);
  plugin.app.workspace.getRightLeaf = () => {
    if (!sidebarLeaf) {
      sidebarLeaf = {
        app: plugin.app,
        view: null,
        containerEl: { closest: (sel) => (sel === ".mod-right-split" ? {} : null) },
        loadIfDeferred: async () => {},
        setViewState: async (state) => {
          opened.push(state.type);
          sidebarLeaf.view = new T.CalendarView(sidebarLeaf, plugin);
          sidebarLeaf.view.contentEl = makeDom().root;
          await sidebarLeaf.view.onOpen();
        },
      };
    }
    return sidebarLeaf;
  };
  plugin.app.workspace.getLeaf = () => sidebarLeaf;
  plugin.app.workspace.revealLeaf = async () => {};
  const calendar = await plugin.activateFocusDay();
  assert.equal(opened[0], "question-tracker-calendar", "Focus day opens the calendar view type");
  assert.equal(calendar, sidebarLeaf.view, "in the right sidebar leaf");
  assert.equal(calendar.mode, "day", "in the day view");
  assert.equal(plugin.settings.calendar.layers.planned, true, "with the planned layer on");
  assert.equal(await plugin.activatePlanHub(), calendar, "Open Plan reuses the same sidebar calendar");
  assert.equal(opened.length, 1, "a second open focuses the existing calendar");
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

test("hubs: tabs are keyboard-operable Apple-style tab controls", async () => {
  const plugin = await setup();
  const spec = hubs.hubSpec("today");
  const view = new T.QtHubView({ app: plugin.app }, plugin, spec);
  const dom = makeDom();
  view.contentEl = dom.root;
  await view.onOpen();
  const ids = view.tabs.map((tab) => tab.id);
  assert.ok(ids.length > 1, "needs more than one tab to move between");
  const firstButton = view.tabButtons[ids[0]];
  assert.equal(firstButton.getAttr("type"), "button", "tabs never submit");
  view.showHubTab(ids[0]);
  const fire = (button, key) => {
    const own = button.__own || button;
    const handlers = (own.handlers || []).filter((entry) => entry.ev === "keydown");
    assert.ok(handlers.length, "tabs listen for arrow keys");
    for (const handler of handlers) handler.fn({ key, preventDefault() {} });
  };
  fire(firstButton, "ArrowRight");
  assert.equal(view.activeTab, ids[1], "ArrowRight moves one tab forward");
  fire(view.tabButtons[ids[1]], "ArrowLeft");
  assert.equal(view.activeTab, ids[0], "ArrowLeft moves back");
  await view.onClose();
});
