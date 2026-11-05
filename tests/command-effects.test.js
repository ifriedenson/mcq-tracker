"use strict";
/**
 * The command palette is user-facing surface: every one of these 30 commands was
 * registered but named by no test, so a broken delegation would have shipped.
 *
 * Each test runs the real registered callback (or checkCallback) and asserts the
 * observable effect: which method it delegates to and with which arguments, or —
 * for a command that only makes sense on a note — that its guard refuses when
 * there is nothing to act on. A command rewired to the wrong method, or one that
 * drops its argument, fails here.
 */
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin: QT } = load();

async function ready(notes = []) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

function command(plugin, id) {
  const found = plugin.commands.find((entry) => entry.id === id);
  assert.ok(found, `the ${id} command is registered`);
  return found;
}

/** Replace one plugin method with a recorder; the original is restored by the test's own scope. */
function spy(plugin, name, result) {
  assert.equal(typeof plugin[name], "function", `${name} exists before it is spied on`);
  const calls = [];
  plugin[name] = (...args) => {
    calls.push(args);
    return result;
  };
  return calls;
}

/** A file and its cache, for the commands that only appear on an open note. */
function openNote(plugin, path, frontmatter, headings = []) {
  const file = { path };
  plugin.app.workspace.getActiveFile = () => file;
  plugin.app.metadataCache.getFileCache = () => ({ frontmatter, headings: headings.map((heading) => ({ heading })) });
  return file;
}

const DELEGATIONS = [
  ["ai-undo-last-write", "undoLastAiWriteCommand", []],
  ["ai-undo-agent-edits", "undoLastAgentEditCommand", []],
  ["course-notes-import", "openCourseNotesImport", []],
  ["pdf-annotate", "openPdfAnnotation", []],
  ["pdf-open-annotations", "openPdfAnnotations", []],
  ["dismiss-reminder", "dismissTodayReminder", []],
  ["study-skin", "openStudySkin", []],
  ["note-review-dock-toggle", "toggleNoteReviewDock", []],
  ["calendar-add-schedule", "openCalendarImport", []],
  ["calendar-note-next-class", "openNextClassNote", []],
  ["open-time-blocks", "activateStudyWorkspace", ["timeBlocks"]],
  ["open-reading-library", "activateStudyWorkspace", ["readingLibrary"]],
  ["open-ap-resources", "openApResources", []],
  ["new-frq-note", "openNewFrqNote", []],
  ["new-image-occlusion", "openImageOcclusion", []],
  ["weak-spot-generate", "openWeakSpotGenerate", []],
  ["verify-calculation-all", "verifyAllByCalculation", []],
  ["cards-import-document", "openDocumentCards", []],
  ["export-cards", "openCardExport", []],
  ["push-cards-anki", "openAnkiConnectPush", []],
  ["sync-cards-anki", "openAnkiConnectPush", [{ sync: true }]],
  ["open-due-queue", "openDueQueue", []],
  ["cards-import-archive", "openCardArchiveImport", []],
  ["course-note-from-template", "openCourseNoteBuilder", []],
];

for (const [id, method, args] of DELEGATIONS) {
  test(`${id} delegates to ${method}`, async () => {
    const { plugin } = await ready();
    const calls = spy(plugin, method);
    const entry = command(plugin, id);
    assert.equal(typeof entry.callback, "function", `${id} is reachable from the palette`);
    await entry.callback();
    assert.equal(calls.length, 1, `${id} delegates exactly once`);
    assert.deepEqual(calls[0], args, `${id} passes ${JSON.stringify(args)}`);
  });
}

test("add-fields-all hands every question note to addMissingFields", async () => {
  const { plugin } = await ready();
  const first = { path: "A.md" };
  const second = { path: "B.md" };
  plugin.getQuestions = () => [{ file: first }, { file: second }];
  const calls = spy(plugin, "addMissingFields");
  await command(plugin, "add-fields-all").callback();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], [first, second], "the whole question set is passed, not an empty list");
});

test("add-fields-this-note refuses with no note and passes the open one", async () => {
  const { plugin } = await ready();
  const entry = command(plugin, "add-fields-this-note");
  assert.equal(entry.checkCallback(true), false, "no active file means the command is unavailable");
  const file = openNote(plugin, "Questions/Q1.md", { question_id: "Q1" });
  const calls = spy(plugin, "addMissingFields");
  assert.equal(entry.checkCallback(true), true, "checking reports availability without acting");
  assert.equal(calls.length, 0, "checking never writes");
  assert.equal(entry.checkCallback(false), true);
  assert.deepEqual(calls[0][0], [file], "the open note is the one repaired");
});

test("toggle-flag refuses outside a question and flags the open question when run", async () => {
  const { plugin } = await ready();
  const entry = command(plugin, "toggle-flag");
  assert.equal(entry.checkCallback(true), false, "a note without question_id is not flaggable");
  const file = openNote(plugin, "Questions/Q1.md", { question_id: "Q1" });
  const calls = spy(plugin, "toggleFlag", Promise.resolve(true));
  assert.equal(entry.checkCallback(true), true);
  assert.equal(calls.length, 0, "checking does not toggle anything");
  assert.equal(entry.checkCallback(false), true);
  assert.equal(calls[0][0], file, "the open file is toggled");
});

test("calendar attendance commands refuse without a class note and log the right outcome", async () => {
  const { plugin } = await ready();
  plugin.classNoteEvent = () => null;
  for (const id of ["calendar-class-attended", "calendar-class-absent"]) {
    assert.equal(command(plugin, id).checkCallback(true), false, `${id} is unavailable outside a class note`);
  }
  plugin.classNoteEvent = () => ({ id: "event-1" });
  const attended = spy(plugin, "logClassNoteAttendance");
  const attendedEntry = command(plugin, "calendar-class-attended");
  assert.equal(attendedEntry.checkCallback(true), true);
  assert.equal(attended.length, 0, "checking does not record attendance");
  attendedEntry.checkCallback(false);
  assert.deepEqual(attended[0], [null, true], "attended writes the attended outcome");

  const absent = spy(plugin, "logClassNoteAttendance");
  command(plugin, "calendar-class-absent").checkCallback(false);
  assert.deepEqual(absent[0], [null, false], "absent writes the absent outcome");
});

test("lecture-practice refuses outside a transcript note", async () => {
  const { plugin } = await ready();
  const entry = command(plugin, "lecture-practice");
  assert.equal(entry.checkCallback(true), false, "no active file means no lecture");
  openNote(plugin, "Bio/Lecture 1.md", { question_id: "Q1" });
  assert.equal(entry.checkCallback(true), false, "a question note is not a lecture");
  plugin.app.workspace.getActiveFile = () => null;
  assert.equal(entry.checkCallback(false), false, "running it with nothing open is a no-op, not a crash");
});
