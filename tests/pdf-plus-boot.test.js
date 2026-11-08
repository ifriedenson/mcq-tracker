"use strict";
/*
 * Proves the embedded PDF++ lifecycle against the real vendored bundle:
 * boot, UI registration, full teardown, reader-conflict pause/resume cycles,
 * overlapping MCQ PDF surfaces, and enable/disable while a surface is open.
 *
 * "Restarted exactly once" is asserted three ways: the surface snapshot (commands,
 * settings tab, event refs, intervals, stylesheet, embed registration, hover sources,
 * view registration and patch flags) equals a clean boot, the patch probe reaches the
 * stock Obsidian behaviour once per call (a double wrap would reach it twice), and
 * teardown puts the stock prototypes back — impossible if patches had stacked.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, Plugin, obsidian } = load();
const { install, makeApp, surface, trackLoads } = require("./helpers/pdf-plus-boot");

install();

const NODE_ONLY = /^(assert|buffer|child_process|crypto|events|fs|http|https|net|os|path|stream|url|util|zlib)$/;

function hostPlugin(app) {
  return {
    app,
    manifest: { id: "mcq-tracker", dir: "/vault/.obsidian/plugins/mcq-tracker" },
    settings: { pdfPlus: { enabled: true, data: { autoCheckForUpdates: false } } },
    addChild(child) {
      this.child = child;
      return child;
    },
    removeChild(child) {
      if (this.child === child) this.child = null;
    },
    async save() {},
  };
}

/** A real QuestionTrackerPlugin instance without running the whole plugin onload. */
function hostInstance(app) {
  return Object.assign(Object.create(Plugin.prototype), hostPlugin(app));
}

/** The surface an inactive embedded PDF++ leaves behind: nothing at all. */
const STOPPED = {
  commands: [],
  commandCount: 0,
  duplicateCommands: [],
  settingTabs: [],
  styles: 0,
  workspaceRefs: 0,
  vaultRefs: 0,
  metadataRefs: 0,
  intervals: 0,
  embedPatched: false,
  pdfPlusEmbedRegistrations: 0,
  hoverSources: [],
  views: [],
  patched: { workspace: false, menu: false, pagePreview: false },
};

function assertStopped(app, message) {
  assert.deepEqual(surface(app), STOPPED, message);
  assert.equal(obsidian.Workspace.prototype.openLinkText, app._originals.workspace, "stock openLinkText is back");
  assert.equal(obsidian.Menu.prototype.showAtPosition, app._originals.menuShow, "stock showAtPosition is back");
  assert.equal(
    app.internalPlugins.plugins["page-preview"].instance.onLinkHover,
    app._originals.pagePreview,
    "stock onLinkHover is back"
  );
  assert.equal(app.embedRegistry.embedByExtension.pdf, app._originals.embedCreator, "stock PDF embed creator is back");
}

/** The function currently installed on each patched target. */
function currentPatches(app) {
  return {
    workspace: obsidian.Workspace.prototype.openLinkText,
    menu: obsidian.Menu.prototype.showAtPosition,
    pagePreview: app.internalPlugins.plugins["page-preview"].instance.onLinkHover,
    embed: app.embedRegistry.embedByExtension.pdf,
  };
}

/** The stock functions a single PDF++ layer must sit on top of. */
function stockFunctions(app) {
  return {
    workspace: app._originals.workspace,
    menu: app._originals.menuShow,
    pagePreview: app._originals.pagePreview,
    embed: app._originals.embedCreator,
  };
}

/** The modals claim and release synchronously; await the queued transition they started. */
async function settled(plugin) {
  await plugin._pdfPlusQueue;
}

/** Start the host once and record what a healthy, single-application surface looks like. */
async function cleanBoot(app) {
  const plugin = hostInstance(app);
  await plugin.startPdfPlus();
  const host = plugin.pdfPlus;
  assert.ok(host, "the host started");
  const baseline = surface(app);
  const patches = currentPatches(app);
  return {
    plugin,
    host,
    settingTab: host.settingTab,
    baseline,
    patches,
    hostShape: {
      children: host._children.length,
      commands: host.commands.length,
      cleanups: host._cleanups.length,
      loaded: host._loaded,
    },
  };
}

function assertResumed(app, boot, message) {
  const now = surface(app);
  assert.deepEqual(now, boot.baseline, `${message}: the whole surface matches a clean boot`);
  assert.equal(now.styles, 1, `${message}: exactly one embedded stylesheet`);
  assert.equal(now.settingTabs.length, 0, `${message}: no separate top-level PDF++ settings tab`);
  const settingTab = boot.plugin.pdfPlus && boot.plugin.pdfPlus.settingTab;
  assert.ok(settingTab, `${message}: the vendor settings tab is captured`);
  assert.equal(
    boot.plugin.app.setting.pluginTabs.includes(settingTab),
    false,
    `${message}: the captured tab is not registered as a second plugin tab`
  );
  assert.deepEqual(now.duplicateCommands, [], `${message}: no duplicate command ids`);
  assert.deepEqual(now.patched, { workspace: true, menu: true, pagePreview: true }, `${message}: every patch is applied`);
  assert.equal(now.embedPatched, true, `${message}: PDF++'s embed creator is installed`);
  assert.equal(now.pdfPlusEmbedRegistrations, 1, `${message}: exactly one PDF++ embed registration`);
  // A stacked or reused patch cannot survive this: every target must sit on a fresh
  // wrapper that is neither the stock function nor the wrapper the previous host left.
  const nowPatches = currentPatches(app);
  const stock = stockFunctions(app);
  for (const key of Object.keys(nowPatches)) {
    assert.notEqual(nowPatches[key], stock[key], `${message}: ${key} is patched`);
    assert.notEqual(nowPatches[key], boot.patches[key], `${message}: ${key} got a fresh single patch`);
  }
  boot.patches = nowPatches;
}

function assertHostShape(boot, message) {
  const host = boot.plugin.pdfPlus;
  assert.ok(host, `${message}: a host is running`);
  assert.equal(host._loaded, true, `${message}: the restarted host is loaded`);
  assert.equal(host._children.length, boot.hostShape.children, `${message}: same child components`);
  assert.equal(host.commands.length, boot.hostShape.commands, `${message}: same host commands`);
  assert.equal(host._cleanups.length, boot.hostShape.cleanups, `${message}: same live cleanups`);
  assert.ok(host.settingTab, `${message}: the vendor settings tab is captured again`);
  assert.equal(host.app.setting.pluginTabs.includes(host.settingTab), false, `${message}: still no separate tab`);
}

test("embedded PDF++ boots the real bundle, registers its surface and tears it all down", async () => {
  const app = makeApp();
  const plugin = hostPlugin(app);
  const opens = { settings: 0 };
  plugin.openPdfPlusSettingsTab = () => {
    opens.settings += 1;
    plugin._pdfPlusSettingsView = plugin.pdfPlus && plugin.pdfPlus.settingTab;
    return true;
  };
  const tracked = await trackLoads(() => T.pdfPlus.start(plugin));
  const host = tracked.value;

  assert.ok(host, "the real vendored class was constructed");
  assert.equal(host._loaded, true);
  assert.ok(host._children.length > 0, "PDF++ child components are attached");
  assert.ok(host.commands.length > 0, "PDF++ commands are registered");
  assert.ok(host.settingTab, "PDF++ created its settings tab");
  assert.equal(host.settingTab.id, "mcq-tracker-pdf-plus", "the captured tab keeps the embedded id");
  assert.equal(host.settingTab.plugin, host, "the captured tab belongs to the embedded host");
  assert.equal(app.setting.pluginTabs.includes(host.settingTab), false, "no separate top-level PDF++ tab is registered");
  assert.ok(app.commands.length > 0, "commands reached the app command registry");
  assert.ok(global.document.getElementById("mcq-tracker-pdf-plus-styles"), "the embedded stylesheet is injected");
  assert.ok(app.workspace._refs.size > 0, "workspace event refs are active");

  const running = surface(app);
  assert.deepEqual(running.patched, { workspace: true, menu: true, pagePreview: true }, "every native view is patched");
  assert.equal(running.embedPatched, true, "PDF++ installed its own PDF embed/reader creator");
  assert.ok(running.hoverSources.length > 0, "PDF++ registered its hover-link sources");
  assert.deepEqual(running.duplicateCommands, [], "no duplicate command ids on a single boot");

  assert.equal(running.pdfPlusEmbedRegistrations, 1, "exactly one PDF++ embed registration");
  assert.equal(host.openSettingTab(), host.settingTab, "PDF++ settings links return the mounted view");
  assert.equal(opens.settings, 1, "PDF++ settings links open MCQ Tracker's PDF++ page");
  const single = currentPatches(app);
  for (const [name, fn] of Object.entries(single)) {
    assert.notEqual(fn, stockFunctions(app)[name], `a single boot patches ${name}`);
  }

  const nodeOnly = tracked.requests.filter((request) => NODE_ONLY.test(request));
  assert.deepEqual(nodeOnly, [], "the bundle does not require a Node-only built-in at boot");

  await T.pdfPlus.stop(plugin);

  assert.equal(host._loaded, false);
  assert.equal(host._children.length, 0, "child components were unloaded");
  assert.equal(host._cleanups.length, 0, "registered cleanups ran");
  assert.equal(host.commands.length, 0, "host commands were removed");
  assert.equal(plugin.pdfPlus, null);
  assertStopped(app, "teardown reverses the entire surface");
});

test("the hosted settings renderer survives Obsidian 1.15's missing Page Preview overrides", async () => {
  const app = makeApp();
  const pagePreview = app.internalPlugins.plugins["page-preview"].instance;
  // Obsidian 1.15's Page Preview no longer has this map; upstream PDF++ reads it
  // unconditionally and would throw while drawing its settings tab.
  assert.equal(pagePreview.overrides, undefined);
  const plugin = hostPlugin(app);
  const host = await T.pdfPlus.start(plugin);
  try {
    // PDF++ registers its own hover source; when the core map is missing the host
    // must apply that exact source default instead of throwing.
    const registered = app.workspace.hoverLinkSources["pdf-plus"] || {};
    assert.doesNotThrow(() => host.requireModKeyForLinkHover("pdf-plus"));
    assert.equal(host.requireModKeyForLinkHover("pdf-plus"), !!registered.defaultMod, "the registered hover-source default is honored");
    app.workspace.hoverLinkSources["pdf-plus"] = { defaultMod: true };
    assert.equal(host.requireModKeyForLinkHover("pdf-plus"), true);
    app.workspace.hoverLinkSources["pdf-plus"] = { defaultMod: false };
    assert.equal(host.requireModKeyForLinkHover("pdf-plus"), false);

    // When the app does expose the map, PDF++'s own answer must pass through unchanged.
    pagePreview.overrides = { "pdf-plus": true };
    assert.equal(host.requireModKeyForLinkHover("pdf-plus"), true);
    pagePreview.overrides = { "pdf-plus": false };
    assert.equal(host.requireModKeyForLinkHover("pdf-plus"), false);
  } finally {
    await T.pdfPlus.stop(plugin);
  }
  assertStopped(app, "the compatibility guard owns no extra surface");
});

test("nothing is loaded or registered while the embedded PDF++ module is off", async () => {
  const app = makeApp();
  const plugin = hostPlugin(app);
  plugin.settings.pdfPlus.enabled = false;

  const tracked = await trackLoads(() => T.pdfPlus.start(plugin));

  assert.equal(tracked.value, null, "the host refuses to start");
  assert.equal(plugin.pdfPlus, undefined, "no host instance was stored");
  assert.equal(
    tracked.requests.some((request) => /vendor[\\/]pdf-plus/.test(request)),
    false,
    "the vendored bundle was never even required"
  );
  assertStopped(app, "an off module owns nothing");

  // Turning it on attaches the whole surface; that is the only difference.
  plugin.settings.pdfPlus.enabled = true;
  const host = await T.pdfPlus.start(plugin);
  assert.ok(host && plugin.pdfPlus === host, "the host attaches once enabled");
  assert.ok(app.commands.length > 0);
  assert.equal(surface(app).embedPatched, true);
  await T.pdfPlus.stop(plugin);
  assertStopped(app, "turning it off again removes everything");
});

test("opening the MCQ reader stops the host and closing it restarts the whole surface once", async () => {
  const app = makeApp();
  const boot = await cleanBoot(app);

  await boot.plugin.beginMcqPdfUi();
  assertStopped(app, "the embedded host and every patch are gone while the reader is open");
  assert.equal(boot.plugin.pdfPlus, null);
  assert.equal(boot.plugin.pdfPlusPaused, true);
  assert.equal(boot.plugin.pdfPlusUiDepth, 1);

  await boot.plugin.endMcqPdfUi();
  assert.equal(boot.plugin.pdfPlusUiDepth, 0);
  assert.equal(boot.plugin.pdfPlusPaused, false);
  assert.ok(boot.plugin.pdfPlus, "the host is running again");
  assert.notEqual(boot.plugin.pdfPlus, boot.host, "it is a fresh host, not the torn-down instance");
  assertResumed(app, boot, "after one reader session");
  assertHostShape(boot, "after one reader session");

  await boot.plugin.stopPdfPlus();
  assertStopped(app, "a final stop still reverses the whole surface");
});

test("overlapping MCQ PDF surfaces restart the host only when the last one closes", async () => {
  const app = makeApp();
  const boot = await cleanBoot(app);

  // The editor opened, then the reader opened on top of it.
  await boot.plugin.beginMcqPdfUi();
  await boot.plugin.beginMcqPdfUi();
  assert.equal(boot.plugin.pdfPlusUiDepth, 2);
  assertStopped(app, "two surfaces keep the host down");

  await boot.plugin.endMcqPdfUi();
  assert.equal(boot.plugin.pdfPlusUiDepth, 1);
  assert.equal(boot.plugin.pdfPlus, null, "the host stays down while one surface is still open");
  assertStopped(app, "closing one of two surfaces changes nothing");

  await boot.plugin.endMcqPdfUi();
  assert.equal(boot.plugin.pdfPlusUiDepth, 0);
  assert.ok(boot.plugin.pdfPlus, "the host restarts when the last surface closes");
  assertResumed(app, boot, "after overlapping surfaces");
  assertHostShape(boot, "after overlapping surfaces");

  // An extra release cannot drive the depth below zero or restart a running host.
  const runningHost = boot.plugin.pdfPlus;
  await boot.plugin.endMcqPdfUi();
  assert.equal(boot.plugin.pdfPlusUiDepth, 0);
  assert.ok(boot.plugin.pdfPlus, "a stray release does not stop the running host");
  assert.equal(boot.plugin.pdfPlus, runningHost, "the running host is reused, not restarted");
  assert.deepEqual(surface(app), boot.baseline, "a stray release leaves the surface untouched");

  await boot.plugin.stopPdfPlus();
  assertStopped(app, "teardown after overlapping surfaces");
});

test("the module can be turned off under an open surface and back on afterwards", async () => {
  const app = makeApp();
  const boot = await cleanBoot(app);

  // Off while the reader is open: the host must stay down after the reader closes.
  await boot.plugin.beginMcqPdfUi();
  await boot.plugin.setPdfPlusEnabled(false);
  await boot.plugin.endMcqPdfUi();
  assert.equal(boot.plugin.pdfPlusEnabled(), false);
  assert.equal(boot.plugin.pdfPlus, null, "a disabled module does not restart when the reader closes");
  assertStopped(app, "the disabled module owns nothing");

  // Turning it back on starts a clean host with no stale pause flag.
  await boot.plugin.setPdfPlusEnabled(true);
  assert.equal(boot.plugin.pdfPlusPaused, false, "no stale pause is remembered");
  assert.equal(boot.plugin.pdfPlusUiDepth, 0);
  assert.ok(boot.plugin.pdfPlus, "enabling the module starts the host");
  assertResumed(app, boot, "after re-enabling");
  assertHostShape(boot, "after re-enabling");

  // Enabled again while a surface is open: still nothing until that surface closes.
  await boot.plugin.beginMcqPdfUi();
  await boot.plugin.setPdfPlusEnabled(true);
  assert.equal(boot.plugin.pdfPlus, null, "a toggle cannot bring a second PDF UI under an open reader");
  assertStopped(app, "still stopped under an open reader");
  await boot.plugin.endMcqPdfUi();
  assert.ok(boot.plugin.pdfPlus, "the surface close starts the freshly enabled host");
  assertResumed(app, boot, "after an enable-while-open cycle");
  assertHostShape(boot, "after an enable-while-open cycle");

  // Disabling the module while nothing is open stops it.
  await boot.plugin.setPdfPlusEnabled(false);
  assert.equal(boot.plugin.pdfPlus, null);
  assertStopped(app, "disabling from idle stops everything");
});

test("repeated pause/resume cycles leak no timers, intervals or event refs", async () => {
  const app = makeApp();
  const boot = await cleanBoot(app);

  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await boot.plugin.beginMcqPdfUi();
    assertStopped(app, `cycle ${cycle}: stopped`);
    await boot.plugin.endMcqPdfUi();
    assertResumed(app, boot, `cycle ${cycle}`);
    assertHostShape(boot, `cycle ${cycle}`);
  }

  // Nothing accumulates in the harness either: the app-level registries are the same
  // size as after a single clean boot, and no interval outlives its host.
  assert.equal(app.workspace._refs.size, boot.baseline.workspaceRefs);
  assert.equal(app.vault._refs.size, boot.baseline.vaultRefs);
  assert.equal(app.metadataCache._refs.size, boot.baseline.metadataRefs);
  assert.equal(app._timers.size, boot.baseline.intervals);
  assert.equal(app.commands.length, boot.baseline.commandCount);

  await boot.plugin.stopPdfPlus();
  assertStopped(app, "three cycles later, teardown is still complete");
  assert.equal(app._timers.size, 0, "no interval survives the final stop");
});

test("the real reader and editor modals stop the host on open and restart it on close", async () => {
  const app = makeApp();
  const boot = await cleanBoot(app);

  const { PdfInkModal } = T.pdfInkModal;
  const { PdfEditorModal } = T.pdfEditorModal;

  const reader = new PdfInkModal(app, boot.plugin, { pdfPath: "chapter.pdf" });
  reader.modalEl = reader.modalEl || global.document.createElement("div");
  reader.contentEl = reader.contentEl || global.document.createElement("div");
  reader.render = () => {};
  reader.loadPage = () => {};
  reader.onOpen();
  assert.equal(boot.plugin.pdfPlusUiDepth, 1, "the real reader claims the PDF UI on open");
  await settled(boot.plugin);
  assertStopped(app, "the real reader stops the embedded host");

  // The editor opened on top of the reader keeps the host down.
  const editor = new PdfEditorModal(app, boot.plugin, { pdfPath: "chapter.pdf" });
  editor.modalEl = editor.modalEl || global.document.createElement("div");
  editor.contentEl = editor.contentEl || global.document.createElement("div");
  editor.renderShell = () => {};
  editor.load = () => Promise.resolve();
  editor.onOpen();
  assert.equal(boot.plugin.pdfPlusUiDepth, 2, "the real editor nests the claim");
  await settled(boot.plugin);
  assertStopped(app, "two real surfaces keep the host down");

  editor.onClose();
  assert.equal(boot.plugin.pdfPlusUiDepth, 1);
  await settled(boot.plugin);
  assert.equal(boot.plugin.pdfPlus, null, "closing the editor leaves the host down for the reader");

  reader.onClose();
  assert.equal(boot.plugin.pdfPlusUiDepth, 0);
  await settled(boot.plugin);
  assert.ok(boot.plugin.pdfPlus, "closing the last real surface restarts the host");
  assertResumed(app, boot, "after the real modals");
  assertHostShape(boot, "after the real modals");

  // A modal that never opened must not release a claim it does not hold.
  reader.onClose();
  await settled(boot.plugin);
  assert.equal(boot.plugin.pdfPlusUiDepth, 0, "a repeated close does not unbalance the depth");
  assert.ok(boot.plugin.pdfPlus);

  await boot.plugin.stopPdfPlus();
  assertStopped(app, "teardown after the real modals");
});

test("the reader and editor modals claim and release exactly once each", async () => {
  const calls = { begin: 0, end: 0 };
  const plugin = {
    beginMcqPdfUi() {
      calls.begin += 1;
      return Promise.resolve();
    },
    endMcqPdfUi() {
      calls.end += 1;
      return Promise.resolve();
    },
  };
  const { PdfInkModal } = T.pdfInkModal;
  const { PdfEditorModal } = T.pdfEditorModal;
  const ink = Object.create(PdfInkModal.prototype);
  ink.plugin = plugin;
  ink.pdfPlusClaimed = false;
  const editor = Object.create(PdfEditorModal.prototype);
  editor.plugin = plugin;
  editor.pdfPlusClaimed = false;

  ink.claimPdfPlus();
  ink.claimPdfPlus();
  assert.deepEqual(calls, { begin: 1, end: 0 }, "a repeated claim does not nest");
  ink.releasePdfPlus();
  ink.releasePdfPlus();
  assert.deepEqual(calls, { begin: 1, end: 1 }, "a repeated release does not unbalance the count");

  editor.claimPdfPlus();
  assert.deepEqual(calls, { begin: 2, end: 1 }, "the editor claims the PDF UI too");
  editor.releasePdfPlus();
  assert.deepEqual(calls, { begin: 2, end: 2 });

  const plain = Object.create(PdfInkModal.prototype);
  plain.plugin = null;
  plain.pdfPlusClaimed = false;
  assert.doesNotThrow(() => {
    plain.claimPdfPlus();
    plain.releasePdfPlus();
  }, "a modal without a plugin host does not throw");
});

test("the duplicate detector fires on a second host loaded without teardown", async () => {
  const app = makeApp();
  const boot = await cleanBoot(app);
  const before = surface(app);

  // The exact failure mode every resume in this file must avoid: another host on top.
  const stacked = T.pdfPlus.createHost(boot.plugin);
  boot.plugin.addChild(stacked);
  await stacked.load();

  const after = surface(app);
  assert.ok(after.commandCount > before.commandCount, "the command registry grew");
  assert.ok(after.duplicateCommands.length > 0, "duplicate commands are visible to the snapshot");
  assert.deepEqual(after.settingTabs, before.settingTabs, "the embedded host never registers a top-level settings tab");

  await stacked.unload();
  await boot.plugin.stopPdfPlus();
  assertStopped(app, "unwinding the stacked host restores the stock surface");
});
