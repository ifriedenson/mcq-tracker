"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const W = T.writingSessions;

const NOTE = [
  "# Cell respiration",
  "",
  "Glycolysis splits glucose into two pyruvate molecules. It happens in the cytoplasm.",
  "",
  "The Krebs cycle runs in the mitochondrial matrix. It yields ATP, NADH and FADH2.",
  "",
].join("\n");

test("writing sessions: counts words, sentences and paragraphs", () => {
  const counts = W.countText(NOTE);
  assert.equal(counts.words, 28);
  assert.equal(counts.sentences, 4);
  assert.equal(counts.paragraphs, 3);
  assert.equal(counts.characters > 0, true);
  assert.deepEqual(W.countText(""), { words: 0, characters: 0, sentences: 0, paragraphs: 0 });
  assert.equal(W.readingMinutes(0), 0);
  assert.equal(W.readingMinutes(1), 1);
  assert.equal(W.readingMinutes(401), 3);
  assert.equal(W.countText("don't stop 2 + 2").words, 4, "apostrophes stay in a word and symbols are not words");
});

test("writing sessions: normalises the stored slice", () => {
  const state = W.normalizeWritingSession({
    path: "Biology/Cells.md",
    startedAt: 1000,
    baseline: 12,
    sessions: [
      { path: "Biology/Cells.md", startedAt: 10, endedAt: 61000, words: 40 },
      { path: "", startedAt: 0 },
      { path: "Ghost.md", startedAt: 5, endedAt: 5, words: -4 },
    ],
  });
  assert.equal(state.path, "Biology/Cells.md");
  assert.equal(state.startedAt, 1000);
  assert.equal(state.sessions.length, 2, "a session without a path is dropped");
  assert.deepEqual(state.sessions[1], { path: "Ghost.md", startedAt: 5, endedAt: 5, words: 0, minutes: 0 });
  const idle = W.normalizeWritingSession({ path: "", startedAt: 0, baseline: 40, sessions: [] });
  assert.deepEqual(idle, { path: "", startedAt: 0, baseline: 0, sessions: [] });
  assert.deepEqual(W.normalizeWritingSession(null).sessions, []);
});

test("writing sessions: starts, refuses a second start and records the added words", () => {
  const empty = W.normalizeWritingSession(null);
  assert.equal(W.startWritingSession(empty, { path: "", text: NOTE }).reason, "path");

  const started = W.startWritingSession(empty, { path: "Biology/Cells.md", text: NOTE }, 1000);
  assert.equal(started.ok, true);
  assert.equal(started.value.baseline, 28);
  assert.equal(started.value.startedAt, 1000);
  assert.equal(W.startWritingSession(started.value, { path: "Biology/Cells.md", text: NOTE }, 2000).reason, "running");

  assert.equal(W.finishWritingSession(empty, NOTE, 5000).reason, "idle");

  const grown = NOTE + "\nPyruvate enters the mitochondrion.\n";
  const finished = W.finishWritingSession(started.value, grown, 1000 + 12 * 60000);
  assert.equal(finished.ok, true);
  assert.equal(finished.session.words, 4);
  assert.equal(finished.session.minutes, 12);
  assert.equal(finished.value.startedAt, 0);
  assert.equal(finished.value.sessions.length, 1);
  assert.equal(W.sessionLine(finished.session), "Cells.md · 12 min · +4 words");

  const shrunk = W.finishWritingSession(started.value, "", 2000);
  assert.equal(shrunk.session.words, 0, "a shorter note never reports negative words");
});

test("writing sessions: cancelling keeps the finished log and drops the running one", () => {
  const running = W.startWritingSession({ sessions: [] }, { path: "Notes/A.md", text: NOTE }, 1000).value;
  const cancelled = W.cancelWritingSession(running);
  assert.equal(cancelled.startedAt, 0);
  assert.equal(cancelled.path, "");
  assert.equal(cancelled.sessions.length, 0);
  const kept = W.cancelWritingSession({ ...running, sessions: [{ path: "Notes/B.md", startedAt: 5, endedAt: 605, words: 9 }] });
  assert.equal(kept.sessions.length, 1);
  assert.deepEqual(Object.keys(W.sessionReport({ ...running, sessions: kept.sessions }, NOTE, 61000)).sort(), [
    "added",
    "baseline",
    "counts",
    "minutes",
    "path",
    "running",
    "sessions",
    "startedAt",
    "totals",
  ]);
  const report = W.sessionReport({ ...running, sessions: kept.sessions }, NOTE + "\nextra words here\n", 1000 + 5 * 60000);
  assert.equal(report.running, true);
  assert.equal(report.minutes, 5);
  assert.equal(report.added, 3);
  assert.equal(report.counts.readingMinutes, 1);
  assert.deepEqual(report.totals, { count: 1, words: 9, minutes: 0 });
  assert.equal(W.writingSummary(report), "31 words · 4 sentences · 1 min read · +3 this session");
});

test("writing sessions: the plugin reads the active note and stores only its own slice", async () => {
  const app = makeApp([]);
  let writes = 0;
  app.vault.create = async () => {
    writes += 1;
    return { path: "unexpected.md" };
  };
  app.vault.modify = async () => {
    writes += 1;
  };
  let text = NOTE;
  app.workspace.activeEditor = { file: { path: "Biology/Cells.md" }, editor: { getValue: () => text } };
  const plugin = new QT(app);
  await plugin.onload();

  assert.equal(plugin.writingSessionState().startedAt, 0);
  const started = await plugin.startWritingSession();
  assert.equal(started.ok, true);
  assert.equal(plugin.settings.writingSession.path, "Biology/Cells.md");
  assert.equal(plugin.settings.writingSession.baseline, 28);

  text = NOTE + "\nPyruvate enters the mitochondrion.\n";
  const finishing = await plugin.writingSessionReport();
  assert.equal(finishing.running, true);
  assert.equal(finishing.added, 4);

  const finished = await plugin.finishWritingSession();
  assert.equal(finished.ok, true);
  assert.equal(plugin.settings.writingSession.sessions.length, 1);
  assert.equal(plugin.settings.writingSession.sessions[0].words, 4);
  assert.equal(plugin.settings.writingSession.path, "", "the running session is cleared");
  assert.equal(writes, 0, "no note is written or created");

  app.workspace.activeEditor = null;
  app.workspace.getActiveFile = () => null;
  const idle = await plugin.startWritingSession();
  assert.equal(idle.ok, false);
  assert.equal(idle.reason, "path");

  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.contentEl = dom.root;
  view.tab = "flow";
  view.writingReport = await plugin.writingSessionReport();
  view.render();
  const texts = dom.texts();
  assert.ok(texts.some((row) => row.includes("Writing session (read-only)")));
  assert.ok(texts.some((row) => row.includes("1 session")), "the finished session is summarised");
  assert.equal(writes, 0);
});
