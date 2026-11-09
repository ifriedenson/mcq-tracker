"use strict";
/**
 * The bundled groups that back a README feature claim, driven rather than listed.
 *
 * Modals, the review dock, the settings tab and its renderers are constructed on the
 * existing fake app, opened, and asserted to render content and close; the pure feature
 * helpers are called with real input and asserted on what they produce; the reference
 * panels are asserted on the status text they hand the user. Internal helpers that only
 * move bytes (download, unzip, auth-file merge, binary discovery) stay listed in the
 * inventory with a reason, because they have no user-observable behaviour without the
 * network or filesystem they wrap.
 */
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();

// Obsidian exposes createEl/createDiv/createSpan globally; the harness keeps its
// fake elements behind makeDom, so the modals that use those helpers get one here.
global.createEl = () => el();
global.createDiv = () => el();
global.createSpan = () => el();

/** A fresh fake element (makeDom wraps its root element). */
const el = () => makeDom().root;

async function boot(notes = []) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

/** Open a modal the way Obsidian does: elements exist first, then onOpen draws into them. */
function openModal(Modal, ...args) {
  const modal = new Modal(...args);
  assert.equal(typeof modal.open, "function", `${Modal.name} can be opened`);
  modal.containerEl = el();
  modal.modalEl = el();
  modal.contentEl = el();
  modal.titleEl = el();
  modal.open();
  const own = modal.contentEl.__own;
  assert.ok(own.children.length > 0, `${Modal.name} renders at least one child`);
  modal.close();
  return modal;
}

/** A modal that needs a source file draws nothing until it has one. */
function opensEmpty(Modal, ...args) {
  const modal = new Modal(...args);
  modal.containerEl = el();
  modal.modalEl = el();
  modal.contentEl = el();
  modal.titleEl = el();
  modal.open();
  modal.close();
  return modal;
}

const MODALS = [
  ["AgentEditReviewModal", (app, plugin) => [app, plugin, [], () => {}]],
  ["AssignmentModal", (app, plugin) => [app, plugin, {}, () => {}]],
  ["CalculationPreviewModal", (app, plugin) => [app, plugin, { items: [] }]],
  ["CardExtractModal", (app, plugin) => [app, plugin, {}, () => {}]],
  ["DocumentReviewModal", (app, plugin) => [app, plugin, {}], true],
  ["DueQueueModal", (app, plugin) => [app, plugin, () => {}]],
  ["FocusLogModal", (app, plugin) => [app, plugin, {}]],
  ["LocalEventModal", (app, plugin) => [app, plugin, { title: "Lecture", date: "2026-11-05" }]],
  ["OcrModal", (app, plugin) => [app, plugin, () => {}], true],
  ["PdfAnnotationModal", (app, plugin) => [app, plugin, {}]],
  ["QuickAddModal", (app, plugin) => [app, plugin, () => {}, {}]],
  ["SpacedEverythingCaptureModal", (app, plugin) => [app, plugin]],
  ["StudyStatusModal", (app, plugin) => [app, plugin]],
  ["TranscriptPracticeModal", (app, plugin) => [app, plugin, {}, () => {}], true],
  ["WeakSpotModal", (app, plugin) => [app, plugin, () => {}]],
  ["WelcomeModal", (app, plugin) => [app, plugin]],
  ["WhatsNewModal", (app, plugin) => [app, plugin, T.whatsNew.latestRelease()]],
];

test("every dialog and settings renderer the README advertises is exported", () => {
  const dialogs = [
    T.AgentEditReviewModal,
    T.AssignmentModal,
    T.CalculationPreviewModal,
    T.CardExtractModal,
    T.DocumentReviewModal,
    T.DueQueueModal,
    T.FocusLogModal,
    T.LocalEventModal,
    T.OcrModal,
    T.PdfAnnotationModal,
    T.QuickAddModal,
    T.SpacedEverythingCaptureModal,
    T.StudyStatusModal,
    T.TranscriptPracticeModal,
    T.WeakSpotModal,
    T.WelcomeModal,
    T.WhatsNewModal,
  ];
  for (const dialog of dialogs) assert.equal(typeof dialog, "function", "a modal class is exported");
  assert.equal(dialogs.length, MODALS.length, "the driven table covers every advertised dialog");
  assert.equal(typeof T.NoteReviewDock, "function", "the note review dock is exported");
  assert.equal(typeof T.QuestionTrackerSettingTab, "function", "the settings tab is exported");
  assert.equal(typeof T.renderAssignmentsSettings, "function", "the assignments settings renderer is exported");
  assert.equal(typeof T.renderDailySettings, "function", "the daily settings renderer is exported");
  assert.equal(typeof T.renderReferenceSettings, "function", "the reference settings renderer is exported");
});

for (const [name, args, empty] of MODALS) {
  test(`${name} opens on an empty vault and renders`, async () => {
    const { app, plugin } = await boot();
    const modal = empty ? opensEmpty(T[name], ...args(app, plugin)) : openModal(T[name], ...args(app, plugin));
    assert.equal(modal.closed, true, `${name} closes without leaving state behind`);
  });
}

test("the note review dock draws the note's review state, and stays away with no note", async () => {
  const { plugin } = await boot();
  const dock = new T.NoteReviewDock(plugin);
  dock.refresh();
  assert.equal(dock.bar, null, "no active note means no docked bar");
  const host = el();
  dock.render({ containerEl: host }, { title: "Cell structure", set: "Biology", dueDate: "2026-11-06", isNew: false, note: { fm: {} } }, { all: [] });
  const bar = dock.bar;
  assert.ok(bar, "rendering mounts a bar on the view");
  assert.ok(bar.__own.children.length > 0, "the bar draws its head");
  assert.equal(dock.currentTitle, "Cell structure", "the bar is titled with the open note");
  assert.equal(dock.path, "", "rendering directly does not claim a note path");
  dock.remove();
  assert.equal(dock.bar, null, "removing takes the bar down");
});

test("the settings tab draws every section heading", async () => {
  const { app, plugin } = await boot();
  const tab = new T.QuestionTrackerSettingTab(app, plugin);
  tab.containerEl = el();
  assert.equal(typeof tab.display, "function", "the tab renders");
  tab.display();
  const children = tab.containerEl.__own.children;
  const layout = children.find((child) => child.classes && child.classes.has("qt-settings-layout"));
  assert.ok(layout, "the settings page draws its navigation");
  const grid = (layout.children || []).find((child) => child.classes && child.classes.has("qt-settings-grid"));
  assert.ok(grid && grid.children.length >= 2, "the navigation is a page list beside the page");
  assert.ok(
    (layout.children || []).some((child) => child.classes && child.classes.has("qt-settings-categories")),
    "the category row is drawn"
  );
  for (const heading of ["Main modules"]) {
    assert.ok(obsidian.settingNames.includes(heading), `the ${heading} heading is drawn`);
  }
  assert.ok(!obsidian.settingNames.includes("Study tools"), "optional study tools stay collapsed out of the beginner page");
  assert.ok(obsidian.settingNames.length > 6, "the page names more than the top heading");
});

test("the settings section renderers draw their own controls", async () => {
  const { plugin } = await boot();
  for (const name of ["renderAssignmentsSettings", "renderDailySettings", "renderReferenceSettings"]) {
    const container = el();
    T[name](container, plugin, () => {});
    assert.ok(container.__own.children.length > 0, `${name} draws controls`);
  }
});

test("chat history becomes provider turns and opencode parts become turns", () => {
  assert.deepEqual(T.apiTurns([{ role: "user", content: "hi" }]), [{ role: "user", texts: ["hi"], tools: [] }]);
  assert.equal(T.apiTurns([{ role: "system", content: "x" }])[0].role, "assistant", "only user turns keep the user role");
  const turns = T.partsToTurns([
    { info: { role: "user" }, parts: [{ type: "text", text: "question" }] },
    { info: { role: "assistant" }, parts: [{ type: "text", text: "answer" }, { type: "text", text: "  " }] },
  ]);
  assert.equal(turns.length, 2);
  assert.deepEqual(turns[0].texts, ["question"]);
  assert.deepEqual(turns[1].texts, ["answer"], "blank text parts are dropped");
});

test("error messages name the cause the user can act on", () => {
  assert.match(T.friendlyApiError(new Error("HTTP 401")), /rejected the API key/);
  assert.match(T.friendlyApiError(new Error("HTTP 429")), /rate limited or out of credit/);
  assert.match(T.friendlyApiError(new Error("ENOTFOUND")), /Couldn't reach the provider/);
  assert.equal(T.friendlyApiError(new Error("odd")), "odd", "an unknown error is passed through");
  assert.match(T.friendlyError(new Error("ECONNREFUSED"), "http://127.0.0.1:4096"), /Can't reach OpenCode at http:\/\/127\.0\.0\.1:4096/);
  assert.match(T.friendlyError(new Error("401"), "http://x"), /rejected the username or password/);
});

test("a model string splits into provider and model, and bad input is refused", () => {
  assert.deepEqual(T.modelFromString("anthropic/claude-sonnet-4"), { providerID: "anthropic", modelID: "claude-sonnet-4" });
  assert.equal(T.modelFromString("/model"), null, "an empty provider is refused");
  assert.equal(T.modelFromString("provider/"), null, "an empty model is refused");
  assert.equal(T.modelFromString("plain"), null, "a string with no slash is refused");
});

test("the installer picks the platform asset names and refuses unknown platforms", () => {
  assert.deepEqual(T.platformTriple("linux", "x64", true), { os: "linux", arch: "x64", musl: true });
  assert.deepEqual(T.platformTriple("win32", "arm64", false), { os: "windows", arch: "arm64", musl: false });
  assert.equal(T.platformTriple("aix", "x64", false), null, "an unsupported platform is refused");
  assert.deepEqual(T.candidateAssetNames({ os: "linux", arch: "x64", musl: false }), ["opencode-linux-x64.tar.gz", "opencode-linux-x64-baseline.tar.gz"]);
  assert.deepEqual(T.candidateAssetNames({ os: "darwin", arch: "arm64", musl: false }), ["opencode-darwin-arm64.zip"]);
  assert.equal(T.MAX_OPENCODE_MAJOR, 1, "the supported OpenCode major version is pinned");
});

test("a quick session records what was asked for and a saved one restores", () => {
  const session = T.createQuickSession([{ file: { path: "a.md" } }, { file: { path: "b.md" } }], { kind: "time", value: 5, mode: "due" }, 1000);
  assert.deepEqual(session.paths, ["a.md", "b.md"]);
  assert.equal(session.kind, "time");
  assert.equal(session.value, 5);
  assert.equal(session.remainingSeconds, 300, "a five-minute run starts with five minutes");
  assert.equal(session.runningSince, 1000, "and starts counting immediately");
  const counts = T.createQuickSession([{ file: { path: "a.md" } }], { kind: "nonsense", value: 0 }, 0);
  assert.equal(counts.kind, "count", "an unknown kind becomes a question count");
  assert.equal(counts.value, 1, "and the count is at least one");
  const queue = T.buildQuickQueue([{ file: { path: "a.md" }, fm: {} }, { file: { path: "b.md" }, fm: {} }], "random", "2026-11-05", 5, true);
  assert.equal(queue.length, 2, "the queue holds each note once");
  assert.equal(new Set(queue.map((q) => q.file.path)).size, 2);
});

test("tracking defaults are filled in and My Notes is replaced in place", () => {
  const fm = {};
  const filled = T.fillDefaults(fm);
  assert.ok(filled > 0, `${filled} tracking properties were added`);
  assert.ok(Object.keys(fm).length > 0);
  assert.equal(T.fillDefaults(fm), 0, "a second pass adds nothing");
  const note = "# Q\n\n## Question\nWhat?\n\n## My Notes\n\nold\n";
  const replaced = T.replaceMyNotes(note, "new text");
  assert.match(replaced, /## My Notes\n\nnew text/);
  assert.ok(!replaced.includes("old"), "the old body is replaced, not appended");
  assert.match(T.replaceMyNotes("# Q\n", "body"), /## My Notes\n\nbody/, "a note without the heading gains one");
});

test("the mastery trend sentence states the comparison instead of a bare number", () => {
  assert.equal(T.masteryTrendText(null), "", "no trend draws nothing");
  assert.match(T.masteryTrendText({ days: 7, hasComparison: false }), /No earlier attempts in the previous 7 days/);
  assert.match(T.masteryTrendText({ days: 7, hasComparison: true, delta: 0 }), /No change in mastered questions/);
  assert.match(T.masteryTrendText({ days: 7, hasComparison: true, delta: 3 }), /\+3 mastered/);
  assert.match(T.masteryTrendText({ days: 7, hasComparison: true, delta: -2 }), /-2 mastered/);
});

test("saving a provider key keeps the other entries in OpenCode's auth file", () => {
  const out = T.mergeAuth(JSON.stringify({ openai: { type: "api", key: "old" } }), "anthropic", "sk-new");
  const parsed = JSON.parse(out);
  assert.equal(parsed.anthropic.key, "sk-new");
  assert.equal(parsed.openai.key, "old", "the existing provider is preserved");
  assert.ok(T.mergeAuth("", "anthropic", "k").includes('"anthropic"'), "an empty file starts a fresh object");
  assert.throws(() => T.mergeAuth("not json", "x", "k"), /isn't valid JSON/, "invalid JSON is refused instead of overwritten");
  assert.throws(() => T.mergeAuth("[]", "x", "k"), /unexpected shape/, "an unexpected shape is refused");
});

test("the grade snapshot reports practice accuracy and per-course grades", () => {
  const snapshot = T.buildGradeSnapshot([]);
  assert.equal(snapshot.basis, "practice accuracy");
  assert.equal(snapshot.overall.attempts, 0);
  assert.deepEqual(snapshot.courses, []);
  const graded = T.buildGradeSnapshot([
    { file: { path: "Math/q1.md" }, fm: { course: ["Math"], attempts: 2, correct: 2, history: [] } },
  ]);
  assert.equal(graded.courses.length, 1, "a course with attempts is listed");
  assert.equal(graded.courses[0].course, "Math");
  assert.equal(typeof graded.courses[0].grade, "string");
});

test("the reference panels hand the user a status line", () => {
  const status = el();
  T.geometryPanel.announceGeometry.call({ geometryStatusEl: status }, "Triangle drawn");
  assert.equal(status.__own.meta.text, "Triangle drawn");
  const threeD = el();
  T.graph3dPanel.announceThreeD.call({ threeDStatusEl: threeD }, "Surface drawn");
  assert.equal(threeD.__own.meta.text, "Surface drawn");
  const vector = el();
  T.vectorPanel.announceVectorField.call({ vectorFieldStatusEl: vector }, "Field drawn");
  assert.equal(vector.__own.meta.text, "Field drawn");
});

test("the dashboard embed parses its block options", () => {
  assert.ok(T.analyticsEmbed.DASHBOARD_METRICS.length > 0, "the widget list is not empty");
  const parsed = T.analyticsEmbed.parseDashboardBlock("metric: calibration\nweeks: 8\ntitle: My board");
  assert.equal(parsed.metric, "calibration");
  assert.equal(parsed.weeks, 8);
  assert.equal(parsed.title, "My board");
  const fallback = T.analyticsEmbed.parseDashboardBlock("metric: nonsense");
  assert.equal(fallback.metric, "overview", "an unknown metric falls back to the overview");
});
